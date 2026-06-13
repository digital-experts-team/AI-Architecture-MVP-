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

// Seed paint options (displayed with colored hex swatches)
const defaultPaints = {
  "hale_navy": { name: "Hale Navy HC-154", hex: "#1c2c3a", providerName: "Benjamin Moore", providerWebsite: "https://www.benjaminmoore.com", price: "$59.99 / gallon" },
  "alabaster_white": { name: "Alabaster SW 7008", hex: "#f2f0ea", providerName: "Sherwin-Williams", providerWebsite: "https://www.sherwin-williams.com", price: "$64.99 / gallon" },
  "forest_green": { name: "Forest Green 2047-10", hex: "#273d32", providerName: "Benjamin Moore", providerWebsite: "https://www.benjaminmoore.com", price: "$59.99 / gallon" },
  "terracotta_sand": { name: "Terracotta Sand 2090-30", hex: "#c47a61", providerName: "Benjamin Moore", providerWebsite: "https://www.benjaminmoore.com", price: "$59.99 / gallon" }
};

// Helper to get database folders dynamically
const getDatabaseFolders = (databaseDir) => {
  return fs.readdirSync(databaseDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
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

  const { roomType, floorPlanUrl } = req.body;

  if (!roomType) {
    return res.status(400).json({ error: "roomType is required." });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set.");
    }
    const ai = new GoogleGenAI({ apiKey });

    const databaseDir = path.join(process.cwd(), 'database');

    // Read list of assets from all folders dynamically
    const folders = getDatabaseFolders(databaseDir);
    const contents = [];

    // 1. Add Floor Plan if available
    if (floorPlanUrl) {
      const cleanPath = floorPlanUrl.replace(/^\//, '');
      const floorPlanPath = path.join(process.cwd(), cleanPath);
      if (fs.existsSync(floorPlanPath)) {
        const mimeType = getMimeType(floorPlanPath);
        contents.push(fileToGenerativePart(floorPlanPath, mimeType));
        contents.push("User's Floor Plan / Survey blueprint: (Refer to this attached image for wall coordinates and room structure).");
      }
    }

    const folderAssetsInfo = {};
    let totalAssetsCount = 0;

    // Load assets from each folder and append to multimodal context
    folders.forEach(folder => {
      const folderPath = path.join(databaseDir, folder);
      const files = fs.readdirSync(folderPath).filter(f => f.match(/\.(png|jpg|jpeg|webp)$/i));
      
      folderAssetsInfo[folder] = files;
      totalAssetsCount += files.length;

      files.forEach(file => {
        const filePath = path.join(folderPath, file);
        contents.push(fileToGenerativePart(filePath, getMimeType(filePath)));
        contents.push("Asset item from category \"" + folder + "\" (Filename: \"" + file + "\")");
      });
    });

    const tileFolderKey = folders.find(f => f.toLowerCase().includes('tile') || f.toLowerCase().includes('floor')) || 'tiles';
    const hasTiles = folderAssetsInfo[tileFolderKey] && folderAssetsInfo[tileFolderKey].length > 0;

    if (!hasTiles || totalAssetsCount < 2) {
      return res.status(400).json({ error: "Please ensure you have at least one floor tile texture and at least one furniture/decor item in the database." });
    }

    // Add detailed planning instructions
    const randomSalt = Math.floor(Math.random() * 1000000);
    const promptText = `You are a world-class AI Interior Designer. You are designing a single ${roomType}.
I have provided the floor plan/room layout (if available) and our database of room design assets.
The database assets are organized into folders. For each folder, the reference images have been attached above with labels in the format 'Asset item from category "[foldername]" (Filename: "[filename]")'.

Here is the list of available categories and their items in our database:
${JSON.stringify(folderAssetsInfo, null, 2)}

Here is the list of available Wall Paint Colors you can use in your design:
${JSON.stringify(defaultPaints, null, 2)}

Create a single distinct, beautiful interior design style for the ${roomType}. 
Ensure the materials, layouts, styles, and colors coordinate visually.

[Randomization Seed: ${randomSalt}]

For your design, you MUST select items from the database folders:
1. Identify a folder containing tiles or flooring options (usually 'tiles'). Select exactly 1 filename from it for the floor.
2. For all other folders, select items to place in the room as appropriate for the style (e.g., sofas/setees for seating, lighting fixtures, carpets/rugs, wall decor, plants, shelving, TV units, etc.).
3. You can select between 1 and 3 items from a folder if appropriate, or select 0 items (null or empty array) if no items from that folder are needed.
4. You must NOT select any files from folders that have 0 items.
5. Select exactly 1 paint color key from the available Wall Paint Colors list.
6. Write a description of the layout, style concept, and how all components coordinate.
7. Write a highly detailed, professional photorealistic image generation prompt for Imagen 4. 

The Imagen 4 prompt MUST:
- Describe a gorgeous, professional interior design photo of the ${roomType}.
- Explicitly describe the visual appearance of the selected tile flooring in detail.
- Explicitly describe the placed furniture items, lighting fixtures, carpets, and wall decor in detail (referencing their color, materials, shapes, and positions matching the reference files).
- Explicitly incorporate the selected paint color in detail.
- Describe the lighting, staging, and professional photography settings.
- CRITICAL DATABASE CONSTRAINT: The generated design and the Imagen 4 prompt MUST ONLY contain the selected flooring tile, wall paint, and the selected database items from the folders. It MUST NOT contain any other furniture items (no other sofas, chairs, tables, beds, closets, cupboards, etc.), no other carpets or rugs, and no additional decorative pieces (no paintings, plants, curtains, wall paneling, bookshelves, etc.) that are not in the selected lists.
- NEGATIVE CONSTRAINT PROMPTING: You MUST write strong negative constraint instructions into the Imagen prompt. For example: "The room is styled minimally, containing only the selected items from the database: [list selected items] on the oak floor with a geometric rug underneath. There are no other furniture items, no chairs, no extra tables, no desks, no wardrobes, no lighting fixtures besides the selected items, and no other decorative objects."
- Do NOT mention filenames or code variables in the Imagen prompt. Use descriptive details instead.

Return your response as a JSON object with the exact structure:
{
  "title": "Style title",
  "description": "Design concept description...",
  "paintUsed": "key_of_selected_paint_color",
  "selectedAssets": {
    "tiles": "filename_of_selected_tile.png",
    "furniture": ["filename_of_furniture_1.png", "filename_of_furniture_2.png"],
    "hanging_lights": "filename_of_selected_light.png"
  },
  "imagenPrompt": "Detailed Imagen 4 prompt"
}`;

    contents.push(promptText);

    console.log("Analyzing assets and formulating room design with Gemini 2.5 Flash...");
    const designResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
      config: {
        responseMimeType: 'application/json',
        temperature: 1.0
      }
    });

    const designResult = JSON.parse(designResponse.text);
    console.log("Design Option created:", designResult.title);

    // Resolve paint details for the design result response
    const getPaintDetails = (paintKey) => {
      return defaultPaints[paintKey] || { name: "Custom Paint Color", hex: "#cccccc", providerName: "Local Supplier", providerWebsite: "https://example.com", price: "$49.99 / gallon" };
    };

    // Helper to map dynamic selectedAssets to old flat keys for backward compatibility
    const mapToLegacyKeys = (option) => {
      if (!option) return;
      option.paint = getPaintDetails(option.paintUsed);
      
      if (option.selectedAssets) {
        // tileUsed
        const tileKey = Object.keys(option.selectedAssets).find(k => k.toLowerCase().includes('tile') || k.toLowerCase().includes('floor'));
        if (tileKey) {
          const val = option.selectedAssets[tileKey];
          option.tileUsed = Array.isArray(val) ? val[0] : val;
        } else {
          option.tileUsed = null;
        }

        // furnitureUsed: collect from furniture, setees, sofas, chairs, table, bed, dining, curtains
        let legacyFurniture = [];
        const furnitureKeys = ['furniture', 'setees', 'sofas', 'chairs', 'table', 'bed', 'dining', 'curtains'];
        furnitureKeys.forEach(k => {
          const foundKey = Object.keys(option.selectedAssets).find(key => key.toLowerCase() === k);
          if (foundKey) {
            const val = option.selectedAssets[foundKey];
            if (val) {
              if (Array.isArray(val)) legacyFurniture = legacyFurniture.concat(val);
              else legacyFurniture.push(val);
            }
          }
        });
        option.furnitureUsed = legacyFurniture;

        // lightUsed: collect from lighting, hanging_lights, table_lights
        const lightKeys = ['lighting', 'light', 'hanging_lights', 'table_lights', 'lamps'];
        let resolvedLight = null;
        for (const k of lightKeys) {
          const foundKey = Object.keys(option.selectedAssets).find(key => key.toLowerCase() === k);
          if (foundKey) {
            const val = option.selectedAssets[foundKey];
            if (val) {
              resolvedLight = Array.isArray(val) ? val[0] : val;
              break;
            }
          }
        }
        option.lightUsed = resolvedLight;

        // carpetUsed: collect from carpets, carpet, rugs, rug
        const carpetKeys = ['carpets', 'carpet', 'rugs', 'rug'];
        let resolvedCarpet = null;
        for (const k of carpetKeys) {
          const foundKey = Object.keys(option.selectedAssets).find(key => key.toLowerCase() === k);
          if (foundKey) {
            const val = option.selectedAssets[foundKey];
            if (val) {
              resolvedCarpet = Array.isArray(val) ? val[0] : val;
              break;
            }
          }
        }
        option.carpetUsed = resolvedCarpet;

        // wallDecorUsed: collect from wall_decor, wall_shelves, wall_plants, wall_hangings, panels, wall_furnitures, tv_units
        let legacyWallDecor = [];
        const wallKeys = ['wall_decor', 'wall_shelves', 'wall_plants', 'wall_hangings', 'panels', 'wall_furnitures', 'tv_units'];
        wallKeys.forEach(k => {
          const foundKey = Object.keys(option.selectedAssets).find(key => key.toLowerCase() === k);
          if (foundKey) {
            const val = option.selectedAssets[foundKey];
            if (val) {
              if (Array.isArray(val)) legacyWallDecor = legacyWallDecor.concat(val);
              else legacyWallDecor.push(val);
            }
          }
        });
        option.wallDecorUsed = legacyWallDecor;
      }
    };

    mapToLegacyKeys(designResult);

    // Call Imagen 4 to generate a single photorealistic rendering
    console.log("Generating photorealistic rendering with Imagen 4...");
    const imgResponse = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: designResult.imagenPrompt,
      config: {
        numberOfImages: 1,
        aspectRatio: '16:9',
        outputMimeType: 'image/jpeg'
      }
    });

    const optionImage = imgResponse?.generatedImages?.[0]?.image?.imageBytes 
      ? `data:image/jpeg;base64,${imgResponse.generatedImages[0].image.imageBytes}`
      : null;

    if (!optionImage) {
      throw new Error("AI Room rendering failed. Please verify your API key capabilities or try again.");
    }

    res.json({
      success: true,
      roomType,
      floorPlanUrl,
      design: designResult,
      image: optionImage
    });

  } catch (error) {
    console.error("AI Generation failed:", error);
    res.status(500).json({ error: error.message });
  }
}
