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

  const { blueprintUrl, blueprintSvg, style } = req.body;
  if (!style) {
    return res.status(400).json({ error: "style is required (e.g., Modern, Scandinavian)." });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set.");
    }
    const ai = new GoogleGenAI({ apiKey });
    const contents = [];

    // 1. Add SVG blueprint description if available
    if (blueprintSvg) {
      contents.push(`Here is the raw SVG floor plan blueprint of the house:\n${blueprintSvg}`);
    }

    // 2. Add uploaded floor plan image if available
    if (blueprintUrl) {
      const cleanPath = blueprintUrl.replace(/^\//, '');
      const floorPlanPath = path.join(process.cwd(), cleanPath);
      if (fs.existsSync(floorPlanPath)) {
        const mimeType = getMimeType(floorPlanPath);
        contents.push(fileToGenerativePart(floorPlanPath, mimeType));
        contents.push("Here is the uploaded image of the house blueprint layout.");
      }
    }

    const promptText = `You are a professional architect and architectural photographer.
Analyze the provided house blueprint (SVG code or image) with extreme care. Notice:
- The overall shape, wall boundaries, room division, and level structure of the floor plan.
- The front entrance door, car porch/garage (if present), and window configurations along all outer walls.

Based on this blueprint, write a detailed architectural description and TWO distinct image generation prompts for Imagen 4 representing two alternative perspective views of this house in a "${style}" style.

The two views must represent:
- View 1 (Front-Right Perspective): Must show two sides of the house (the front facade and the right side facade) in a single image. It must clearly highlight the main entrance door, the car porch (if selected in the blueprint), the living room window, and front landscaping.
- View 2 (Back-Left Perspective): Must show the alternative two sides of the house (the back facade and the left side facade) in a single image. It must highlight the rear entrance/yard patio, backyard landscaping, and bedroom/bathroom windows on the alternative side.

Both Imagen 4 prompts MUST STAY 100% TRUE TO THE BLUEPRINT:
1. If the blueprint represents a single-story multi-room house, the prompts must explicitly specify a "single-story residential house" in the "${style}" style.
2. Align the doors, windows, and car porch/garage exactly as they are arranged in the blueprint layout.
3. Describe the chosen architectural style ("${style}"), detailing consistent facade materials (e.g., natural cedar wood slats, white concrete plaster, dark steel trims), roof style, and landscaping.
4. Specify high-end architectural catalog photography details: "shot on 35mm lens, warm late afternoon sunlight, volumetric soft lighting, photorealistic, 8k resolution, architectural digest feature".
5. Do NOT mention code variables, filenames, or technical terms in the Imagen prompts. Use visual descriptions.

Return your response as a JSON object with this structure:
{
  "title": "Architectural Design Title",
  "description": "Short explanation of the exterior facade design concept and how it matches the blueprint layout.",
  "detectedLayout": {
    "footprint": "Brief description of the floor plan footprint style (e.g., 'L-Shaped footprint with integrated car porch')",
    "levels": "Description of the height profile (e.g., 'Single-story structure')",
    "entranceLocation": "Detected location of the front door entrance",
    "facadeWindows": "Detailed summary of window counts and locations as seen on the blueprint",
    "blueprintMatchDetails": "Detailed list of exactly how the exterior architectural prompts respect the blueprint room coordinates"
  },
  "imagenPrompt1": "The highly detailed Imagen 4 prompt for View 1 (Front-Right perspective showing front entrance, car porch, living room facade)",
  "imagenPrompt2": "The highly detailed Imagen 4 prompt for View 2 (Back-Left perspective showing alternative sides, backyard patio, bedroom/bathroom window facades)"
}`;

    contents.push(promptText);

    console.log("Analyzing blueprint for exterior facade...");
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.7
      }
    });

    const designResult = JSON.parse(response.text);
    console.log("Generated facade prompt 1:", designResult.imagenPrompt1);
    console.log("Generated facade prompt 2:", designResult.imagenPrompt2);

    console.log("Generating photorealistic exterior views with Imagen 4...");
    const [imgResponse1, imgResponse2] = await Promise.all([
      ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: designResult.imagenPrompt1,
        config: {
          numberOfImages: 1,
          aspectRatio: '16:9',
          outputMimeType: 'image/jpeg'
        }
      }),
      ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: designResult.imagenPrompt2,
        config: {
          numberOfImages: 1,
          aspectRatio: '16:9',
          outputMimeType: 'image/jpeg'
        }
      })
    ]);

    const exteriorImage1 = imgResponse1?.generatedImages?.[0]?.image?.imageBytes 
      ? `data:image/jpeg;base64,${imgResponse1.generatedImages[0].image.imageBytes}`
      : null;

    const exteriorImage2 = imgResponse2?.generatedImages?.[0]?.image?.imageBytes 
      ? `data:image/jpeg;base64,${imgResponse2.generatedImages[0].image.imageBytes}`
      : null;

    if (!exteriorImage1 || !exteriorImage2) {
      throw new Error("Failed to render alternative exterior facade views.");
    }

    res.json({
      success: true,
      design: designResult,
      exteriorImage1,
      exteriorImage2
    });

  } catch (error) {
    console.error("Exterior generation failed:", error);
    res.status(500).json({ error: error.message });
  }
}
