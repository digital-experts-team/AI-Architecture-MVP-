import { GoogleGenAI } from '@google/genai';
import path from 'path';
import fs from 'fs';

// Helper to get mime type based on file extension
const getMimeType = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'image/png';
};

// Helper to read and convert image to inlineData object for Gemini multimodal calls
const fileToGenerativePart = (filePath, mimeType) => {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(filePath)).toString("base64"),
      mimeType
    },
  };
};

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set.");
    }
    const ai = new GoogleGenAI({ apiKey });

    const { surveyUrl, floorsCount, bedroomsCount } = req.body || {};
    if (!surveyUrl) {
      return res.status(400).json({ error: "surveyUrl is required." });
    }

    const floors = parseInt(floorsCount) || 1;
    const bedrooms = parseInt(bedroomsCount) || 3;

    // 1. Resolve survey image path
    const cleanPath = surveyUrl.replace(/^\//, '');
    let surveyPath = path.join(process.cwd(), cleanPath);
    if (!fs.existsSync(surveyPath)) {
      surveyPath = path.join('/tmp', cleanPath);
    }

    if (!fs.existsSync(surveyPath)) {
      return res.status(400).json({ error: "Survey image not found on server." });
    }

    // 2. Scan blueprints directory
    const databaseDir = path.join(process.cwd(), 'database');
    const folderName = `${floors}_floor`;
    const subFolderName = `${bedrooms}_bedroom`;
    const targetDir = path.join(databaseDir, 'blueprints', folderName, subFolderName);

    if (!fs.existsSync(targetDir)) {
      return res.status(400).json({ error: `No blueprints folder exists for ${floors} Floor(s) and ${bedrooms} Bedroom(s).` });
    }

    const files = fs.readdirSync(targetDir).filter(f => f.match(/\.(png|jpg|jpeg|webp)$/i));
    if (files.length === 0) {
      return res.status(400).json({ error: `No blueprints images found in database/blueprints/${folderName}/${subFolderName}/` });
    }

    const contents = [];

    // Add Survey Image
    const surveyMime = getMimeType(surveyPath);
    contents.push(fileToGenerativePart(surveyPath, surveyMime));
    contents.push("LAND SURVEY / SITE PLAN MAP (The plot where the house will be built).");

    // Add Blueprints Images
    const candidatePlans = [];
    files.forEach((file, index) => {
      const filePath = path.join(targetDir, file);
      const mime = getMimeType(filePath);
      const urlPath = `/database/blueprints/${folderName}/${subFolderName}/${file}`;
      
      contents.push(fileToGenerativePart(filePath, mime));
      contents.push(`Blueprint Plan #${index + 1} (Filename: "${file}", URL: "${urlPath}")`);
      
      candidatePlans.push({
        index: index + 1,
        filename: file,
        url: urlPath
      });
    });

    const promptText = `You are a professional architect and site planning coordinator.
Analyze the attached land survey/site boundary map. Notice its boundary proportions, shape (e.g. narrow rectangle, wide rectangle, square, irregular), road direction, and estimated length/width.

Review the candidate blueprint images attached above, labeled in the format 'Blueprint Plan #[index]'.
Based on the land survey's geometry and proportions, select the candidate blueprint plan that fits most logically on the site (e.g. narrow site -> narrow plan; road position -> entrance position alignment).

Here is the list of candidate blueprints you can choose from:
${JSON.stringify(candidatePlans, null, 2)}

Return your response as a JSON object with this exact structure:
{
  "recommendedPlanUrl": "the url of the selected blueprint plan (MUST match one of the candidate blueprint urls exactly, e.g. /database/blueprints/1_floor/3_bedroom/plan.png)",
  "reason": "A detailed, professional architectural explanation of why this layout is the most suitable match for this plot's geometry (e.g. 'This layout has a narrow 25ft width footprint which sits perfectly on your narrow 30ft vertical plot, leaving adequate side setbacks and matching the North-facing road access')."
}`;

    contents.push(promptText);

    console.log("Analyzing land survey and blueprint candidates...");
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2 // Lower temp for more deterministic mapping
      }
    });

    const matchResult = JSON.parse(response.text);
    res.json(matchResult);

  } catch (error) {
    console.error("Plot matching failed:", error);
    res.status(500).json({ error: error.message });
  }
}
