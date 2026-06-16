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

  const { roomType, styleTitle, styleDescription, selectedAssets, tileUsed, furnitureUsed, lightUsed, carpetUsed, wallDecorUsed, paint, angle } = req.body;

  if (!roomType || !angle) {
    return res.status(400).json({ error: "roomType and angle are required." });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set.");
    }
    const ai = new GoogleGenAI({ apiKey });

    const databaseDir = path.join(process.cwd(), 'database');
    const contents = [];

    // If selectedAssets is available, we load them dynamically
    if (selectedAssets) {
      for (const [folderName, files] of Object.entries(selectedAssets)) {
        if (!files) continue;
        const fileList = Array.isArray(files) ? files : [files];
        const folderDir = path.join(databaseDir, folderName);
        for (const file of fileList) {
          const filePath = path.join(folderDir, file);
          if (fs.existsSync(filePath)) {
            contents.push(fileToGenerativePart(filePath, getMimeType(filePath)));
            contents.push(`Selected Item from folder "${folderName}" (Filename: "${file}")`);
          }
        }
      }
    } else {
      // Fallback for legacy calls
      // Add selected Tile file
      if (tileUsed) {
        const filePath = path.join(databaseDir, 'tiles', tileUsed);
        if (fs.existsSync(filePath)) {
          contents.push(fileToGenerativePart(filePath, getMimeType(filePath)));
          contents.push(`Selected Floor Tile (Filename: "${tileUsed}")`);
        }
      }

      // Add selected Furniture files
      if (furnitureUsed && Array.isArray(furnitureUsed)) {
        furnitureUsed.forEach(file => {
          const filePath = path.join(databaseDir, 'furniture', file);
          if (fs.existsSync(filePath)) {
            contents.push(fileToGenerativePart(filePath, getMimeType(filePath)));
            contents.push(`Selected Furniture Item (Filename: "${file}")`);
          }
        });
      }

      // Add selected Lighting file
      if (lightUsed) {
        const filePath = path.join(databaseDir, 'lighting', lightUsed);
        if (fs.existsSync(filePath)) {
          contents.push(fileToGenerativePart(filePath, getMimeType(filePath)));
          contents.push(`Selected Lighting Item (Filename: "${lightUsed}")`);
        }
      }

      // Add selected Carpet file
      if (carpetUsed) {
        const filePath = path.join(databaseDir, 'carpets', carpetUsed);
        if (fs.existsSync(filePath)) {
          contents.push(fileToGenerativePart(filePath, getMimeType(filePath)));
          contents.push(`Selected Carpet Item (Filename: "${carpetUsed}")`);
        }
      }

      // Add selected Wall Decor files
      if (wallDecorUsed && Array.isArray(wallDecorUsed)) {
        wallDecorUsed.forEach(file => {
          const filePath = path.join(databaseDir, 'wall_decor', file);
          if (fs.existsSync(filePath)) {
            contents.push(fileToGenerativePart(filePath, getMimeType(filePath)));
            contents.push(`Selected Wall Decor Item (Filename: "${file}")`);
          }
        });
      } else if (wallDecorUsed && typeof wallDecorUsed === 'string') {
        const filePath = path.join(databaseDir, 'wall_decor', wallDecorUsed);
        if (fs.existsSync(filePath)) {
          contents.push(fileToGenerativePart(filePath, getMimeType(filePath)));
          contents.push(`Selected Wall Decor Item (Filename: "${wallDecorUsed}")`);
        }
      }
    }

    const promptText = `You are a world-class AI Interior Designer.
You have designed a ${roomType} called "${styleTitle}" with the following concept:
"${styleDescription}"

We need to generate a new photorealistic render of this exact room design from a DIFFERENT CAMERA ANGLE: "${angle}".

Here are the selected design specifications that MUST remain identical:
- Wall Paint color: Name: "${paint?.name}", Hex: "${paint?.hex}", Brand: "${paint?.providerName}".
- Floor Tile: Reference the provided tile image texture.
- Placed Furniture: Reference the provided furniture images.
- Lighting: Reference the provided lighting image (if available).
- Carpet/Rug: Reference the provided carpet image (if available).
- Wall Decor/Furniture: Reference the provided wall decor image (if available).

CRITICAL CONSTRAINTS:
1. ONLY USE DATABASE ITEMS: The render must ONLY contain the selected floor tile, wall paint color, and the specific database items provided (furniture, lighting, carpet, wall decor). Absolutely do NOT add any other furniture items, lighting fixtures, rugs, or wall decorations that are not in the provided references.
2. REPRESENT THE ANGLE: Rewrite the Imagen 4 prompt to describe the room from the camera perspective of "${angle}" (e.g., if it's opposite corner view, describe looking from the opposite side back at the furniture; if it's close-up, describe a tight, detailed shot of the primary furniture item and tile texture; if it's high angle, describe looking down onto the layout; if it's side view, describe viewing from the side wall).
3. NEGATIVE CONSTRAINT PROMPTING: You MUST write strong negative constraint instructions into the Imagen prompt. For example: "The room is styled minimally, containing only [furniture description] on the [tile description] floor with a [carpet description] rug underneath. Banish all other furniture items. There are no other chairs, no extra tables, no desks, no shelving units, no rugs on the floor, and no wall art or decor."
4. Do NOT mention code variables, filenames, or technical terms in the Imagen prompt. Use visual descriptions.

Return your response as a JSON object with this structure:
{
  "angleTitle": "A title describing this angle and view",
  "angleDescription": "Brief explanation of what is visible in this perspective",
  "imagenPrompt": "The highly detailed Imagen 4 prompt for this camera angle"
}`;

    contents.push(promptText);

    console.log(`Analyzing design for alternative angle "${angle}" with Gemini 2.5 Flash...`);
    const designResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
      config: {
        responseMimeType: 'application/json',
        temperature: 1.0
      }
    });

    const result = JSON.parse(designResponse.text);
    console.log(`Generated prompt for angle "${angle}":`, result.imagenPrompt);

    console.log(`Generating photorealistic rendering for angle "${angle}" with Imagen 4...`);
    const imgResponse = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: result.imagenPrompt,
      config: {
        numberOfImages: 1,
        aspectRatio: '16:9',
        outputMimeType: 'image/jpeg'
      }
    });

    const angleImage = imgResponse?.generatedImages?.[0]?.image?.imageBytes 
      ? `data:image/jpeg;base64,${imgResponse.generatedImages[0].image.imageBytes}`
      : null;

    if (!angleImage) {
      throw new Error(`AI Room rendering failed for angle "${angle}".`);
    }

    res.json({
      success: true,
      angle,
      design: result,
      angleImage
    });

  } catch (error) {
    console.error(`Angle generation failed for "${angle}":`, error);
    res.status(500).json({ error: error.message });
  }
}
