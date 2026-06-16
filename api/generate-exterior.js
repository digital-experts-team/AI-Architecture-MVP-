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

  const { blueprintUrl, blueprintSvg, style, floorsCount } = req.body;
  if (!style) {
    return res.status(400).json({ error: "style is required (e.g., Modern, Scandinavian)." });
  }

  const floors = parseInt(floorsCount) || 1;
  const floorsText = floors === 1 ? 'single-story' : (floors === 2 ? 'two-story' : 'three-story');

  const defaultPaints = {
    "hale_navy": { name: "Hale Navy HC-154", hex: "#1c2c3a", providerName: "Benjamin Moore", providerWebsite: "https://www.benjaminmoore.com", price: "$59.99 / gallon" },
    "alabaster_white": { name: "Alabaster SW 7008", hex: "#f2f0ea", providerName: "Sherwin-Williams", providerWebsite: "https://www.sherwin-williams.com", price: "$64.99 / gallon" },
    "forest_green": { name: "Forest Green 2047-10", hex: "#273d32", providerName: "Benjamin Moore", providerWebsite: "https://www.benjaminmoore.com", price: "$59.99 / gallon" },
    "terracotta_sand": { name: "Terracotta Sand 2090-30", hex: "#c47a61", providerName: "Benjamin Moore", providerWebsite: "https://www.benjaminmoore.com", price: "$59.99 / gallon" }
  };

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

    // 3. Load exterior database assets dynamically
    const databaseDir = path.join(process.cwd(), 'database');
    const exteriorFolders = ['roof tiles', 'front door', 'windows'];
    const folderAssetsInfo = {};

    exteriorFolders.forEach(folder => {
      const folderPath = path.join(databaseDir, folder);
      if (fs.existsSync(folderPath)) {
        const files = fs.readdirSync(folderPath).filter(f => f.match(/\.(png|jpg|jpeg|webp)$/i));
        folderAssetsInfo[folder] = files;
        files.forEach(file => {
          const filePath = path.join(folderPath, file);
          contents.push(fileToGenerativePart(filePath, getMimeType(filePath)));
          contents.push(`Asset item from category "${folder}" (Filename: "${file}")`);
        });
      } else {
        folderAssetsInfo[folder] = [];
      }
    });

    // 4. Load house style reference images if uploaded
    const styleName = style; // e.g. "Kerala Traditional"
    const styleDir = path.join(databaseDir, 'house_styles', styleName);
    const styleRefs = [];
    if (fs.existsSync(styleDir)) {
      const files = fs.readdirSync(styleDir).filter(f => f.match(/\.(png|jpg|jpeg|webp)$/i));
      files.forEach((file, index) => {
        const filePath = path.join(styleDir, file);
        contents.push(fileToGenerativePart(filePath, getMimeType(filePath)));
        contents.push(`Reference image for selected architectural style "${styleName}" (Image #${index + 1})`);
        styleRefs.push(`- Reference image for style "${styleName}" (Image #${index + 1}) attached above.`);
      });
    }

    let styleRefsPrompt = "";
    if (styleRefs.length > 0) {
      styleRefsPrompt = `\nI have also provided the following reference images for the architectural style "${styleName}":
${styleRefs.join('\n')}
CRITICAL CONSTRAINT: You MUST analyze these reference images and ensure the generated exterior house visual style, roofing style, columns, verandas, color palettes, textures, and facade layout look highly similar and authentic to these reference images. The house should look like it belongs in the same style family as the references.`;
    }

    const paintInfoText = JSON.stringify(defaultPaints, null, 2);
    const assetsInfoText = JSON.stringify(folderAssetsInfo, null, 2);

    const heightInstruction = floors === 1
      ? '2. The house MUST be exactly a single-story structure (1 floor tall, ground level only). Describe it as a low-profile, single-level bungalow or ranch-style structure. Do NOT mention multiple floors, upper levels, balconies on upper levels, or second-story windows. It must clearly look like a single-story home.'
      : `2. The house MUST be exactly ${floors} floors tall (${floorsText} structure). Clearly describe the distinct levels (e.g. ground floor, upper floor(s)), the horizontal floor separation bands, and the overall height profile. Ensure windows and door alignments are described floor-by-side matching the blueprint layout.`;

    const promptText = `You are a professional architect and architectural photographer.
Analyze the provided house blueprint (SVG code or image) with extreme care. Notice:
- The overall shape, wall boundaries, room division, and level structure of the floor plan.
- The front entrance door, car porch/garage (if present), and window configurations along all outer walls.

I have also provided our database of exterior building assets.
The database assets are organized into folders. For each folder, the reference images have been attached above with labels in the format 'Asset item from category "[foldername]" (Filename: "[filename]")'.

Here is the list of available categories and their items in our database:
${assetsInfoText}

Here is the list of available Wall Paint Colors you can use:
${paintInfoText}

Based on this blueprint and these assets, select:
1. Exactly 1 filename from "roof tiles".
2. Exactly 1 filename from "front door".
3. Exactly 1 filename from "windows".
4. Exactly 1 paint color key from Wall Paint Colors.

    Based on these selections, write a detailed architectural description and a single image generation prompt for Imagen 4 that will render a single perspective exterior view showing the front side of the house:
- The image must clearly depict the front facade and the right side facade of the house (Front-Right Perspective).
- It must clearly show the selected front door, the car porch (if present in the blueprint), the selected windows, the selected roof tiles, the selected wall paint, and the front yard landscaping.

The Imagen 4 prompt MUST STAY 100% TRUE TO THE BLUEPRINT AND SELECTED ASSETS:
1. Clearly specify a "single perspective architectural visualization of a ${floorsText} house showing the front side facade".
${heightInstruction}
3. Incorporate the selected front door, roof tiles, windows, and paint color by describing their visual appearance (materials, textures, and style) in detail.
4. Align doors, windows, and the car porch exactly as they are arranged in the blueprint layout (e.g., if the car porch is on the ground floor bottom-left on the blueprint, it must show on the ground floor left side of the front facade).
5. Specify high-end architectural catalog photography details: "shot on 35mm lens, warm late afternoon sunlight, volumetric soft lighting, photorealistic, 8k resolution, architectural digest feature".
6. Do NOT mention code variables, filenames, or technical terms in the Imagen prompt. Use visual descriptions.
${styleRefsPrompt}

Return your response as a JSON object with this structure:
{
  "title": "Architectural Design Title",
  "description": "Short explanation of the exterior facade design concept and how it matches the blueprint layout.",
  "paintUsed": "key_of_selected_paint_color",
  "selectedAssets": {
    "roof tiles": "filename_of_selected_roof_tile.png",
    "front door": "filename_of_selected_front_door.png",
    "windows": "filename_of_selected_window.png"
  },
  "detectedLayout": {
    "footprint": "Brief description of the floor plan footprint style (e.g., 'L-Shaped footprint with integrated car porch')",
    "levels": "Description of the height profile (e.g., 'Single-story structure')",
    "entranceLocation": "Detected location of the front door entrance",
    "facadeWindows": "Detailed summary of window counts and locations as seen on the blueprint",
    "blueprintMatchDetails": "Detailed list of exactly how the exterior architectural prompt respects the blueprint room coordinates"
  },
  "imagenPrompt": "The highly detailed Imagen 4 prompt for the single perspective exterior view"
}`;

    contents.push(promptText);

    console.log("Analyzing blueprint and selecting exterior parts...");
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        responseMimeType: 'application/json',
        temperature: 1.0
      }
    });

    const designResult = JSON.parse(response.text);
    console.log("Generated facade exterior prompt:", designResult.imagenPrompt);

    // Resolve paint details for the design result response
    const getPaintDetails = (paintKey) => {
      return defaultPaints[paintKey] || { name: "Custom Paint Color", hex: "#cccccc", providerName: "Local Supplier", providerWebsite: "https://example.com", price: "$49.99 / gallon" };
    };
    designResult.paint = getPaintDetails(designResult.paintUsed);

    console.log("Generating photorealistic exterior views with Imagen 4...");
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
