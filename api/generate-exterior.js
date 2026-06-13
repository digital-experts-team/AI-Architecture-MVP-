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
- The front entrance door placement.
- The exact window configurations and placements along the front facade walls.

Based on this blueprint, write a detailed architectural description and image generation prompt for Imagen 4 representing the photorealistic exterior view of this house in a "${style}" style.

The Imagen 4 prompt MUST STAY 100% TRUE TO THE BLUEPRINT:
1. If the blueprint represents a single-story multi-room house, the prompt must explicitly specify a "single-story residential house".
2. Align the main entrance door, windows, and garage exactly as they are arranged in the blueprint layout. E.g., if the blueprint shows a master bedroom window on the left, a front entrance door in the center, and a kitchen window on the right, your prompt MUST describe this exact facade layout (e.g., "a large double-hung window on the left bedroom facade, a recessed central wooden door, and a horizontal kitchen window on the right").
3. Describe the chosen architectural style ("${style}"), detailing the facade materials (e.g., natural cedar wood slats, white concrete plaster, dark steel trims), roof style (e.g., flat roof, sloped shed roof), and landscaping (e.g., manicured lawn, minimalist concrete driveway, ornamental grasses).
4. Specify high-end architectural catalog photography details: "shot on 35mm lens, warm late afternoon sunlight, volumetric soft lighting, photorealistic, 8k resolution, architectural digest feature".
5. Do NOT mention code variables, filenames, or technical terms in the Imagen prompt. Use visual descriptions.

Return your response as a JSON object with this structure:
{
  "title": "Architectural Design Title",
  "description": "Short explanation of the exterior facade design concept and how it matches the blueprint layout.",
  "detectedLayout": {
    "footprint": "Brief description of the floor plan footprint style (e.g., 'Rectangular 4-room layout', 'L-Shaped footprint')",
    "levels": "Description of the height profile (e.g., 'Single-story structure', 'Two-level configuration')",
    "entranceLocation": "Detected location of the front door entrance (e.g., 'Bottom-center entrance', 'Left facade entryway')",
    "facadeWindows": "Detailed summary of window counts and locations as seen on the blueprint (e.g., 'Two master bedroom windows on the left facade, kitchen window on the right')",
    "blueprintMatchDetails": "Detailed list of exactly how the exterior architectural prompt respects the blueprint room coordinates"
  },
  "imagenPrompt": "The highly detailed Imagen 4 prompt"
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
    console.log("Generated facade prompt:", designResult.imagenPrompt);

    console.log("Generating photorealistic exterior view with Imagen 4...");
    const imgResponse = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: designResult.imagenPrompt,
      config: {
        numberOfImages: 1,
        aspectRatio: '16:9',
        outputMimeType: 'image/jpeg'
      }
    });

    const exteriorImage = imgResponse?.generatedImages?.[0]?.image?.imageBytes 
      ? `data:image/jpeg;base64,${imgResponse.generatedImages[0].image.imageBytes}`
      : null;

    if (!exteriorImage) {
      throw new Error("Failed to render exterior facade image.");
    }

    res.json({
      success: true,
      design: designResult,
      exteriorImage
    });

  } catch (error) {
    console.error("Exterior generation failed:", error);
    res.status(500).json({ error: error.message });
  }
}
