import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure folders exist
const uploadsDir = path.join(__dirname, 'uploads');
const databaseDir = path.join(__dirname, 'database');

const defaultFolders = [
  'tiles',
  'furniture',
  'lighting',
  'carpets',
  'wall_decor',
  'hanging_lights',
  'table_lights',
  'tv_units',
  'setees',
  'wall_furnitures',
  'wall_hangings',
  'panels',
  'wall_shelves',
  'wall_plants'
];

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(databaseDir)) {
  fs.mkdirSync(databaseDir, { recursive: true });
}

defaultFolders.forEach(folder => {
  const dir = path.join(databaseDir, folder);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Helper to get database folders dynamically
const getDatabaseFolders = () => {
  if (!fs.existsSync(databaseDir)) {
    fs.mkdirSync(databaseDir, { recursive: true });
  }
  return fs.readdirSync(databaseDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
};

// Metadata path for provider contact numbers
const metadataPath = path.join(databaseDir, 'metadata.json');
const defaultMetadata = {
  tiles: {
    "marble_tile.png": { providerName: "Premium Stone & Co.", providerWebsite: "https://example.com/premium-marble", price: "$12.99 / sq ft" },
    "oak_wood_tile.png": { providerName: "Hardwood Depot", providerWebsite: "https://example.com/hardwood-oak", price: "$7.49 / sq ft" }
  },
  furniture: {
    "emerald_sofa.png": { providerName: "Lux Living Furniture", providerWebsite: "https://example.com/velvet-sofa", price: "$899.00" },
    "wooden_bed.png": { providerName: "Nordic Comforts", providerWebsite: "https://example.com/nordic-bed", price: "$599.00" },
    "coffee_table.png": { providerName: "Minimalist Woodworks", providerWebsite: "https://example.com/wooden-table", price: "$249.00" }
  }
};
if (!fs.existsSync(metadataPath)) {
  fs.writeFileSync(metadataPath, JSON.stringify(defaultMetadata, null, 2));
}

// Seed paint options (displayed with colored hex swatches)
const defaultPaints = {
  "hale_navy": { name: "Hale Navy HC-154", hex: "#1c2c3a", providerName: "Benjamin Moore", providerWebsite: "https://www.benjaminmoore.com", price: "$59.99 / gallon" },
  "alabaster_white": { name: "Alabaster SW 7008", hex: "#f2f0ea", providerName: "Sherwin-Williams", providerWebsite: "https://www.sherwin-williams.com", price: "$64.99 / gallon" },
  "forest_green": { name: "Forest Green 2047-10", hex: "#273d32", providerName: "Benjamin Moore", providerWebsite: "https://www.benjaminmoore.com", price: "$59.99 / gallon" },
  "terracotta_sand": { name: "Terracotta Sand 2090-30", hex: "#c47a61", providerName: "Benjamin Moore", providerWebsite: "https://www.benjaminmoore.com", price: "$59.99 / gallon" }
};

// Configure static file serving
app.use('/database', express.static(databaseDir));
app.use('/uploads', express.static(uploadsDir));

// Multer for general uploads (like user floor plans)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// Multer for adding assets to the database dynamically
const assetStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const type = req.body.type || 'furniture';
    const dest = path.join(databaseDir, type);
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    cb(null, dest);
  },
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const uploadAsset = multer({ storage: assetStorage });

// Initialize Gemini Client
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set in the server `.env` file.");
  }
  return new GoogleGenAI({ apiKey });
};

// Helper to get mime type based on file extension
const getMimeType = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'image/png'; // default fallback
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

// 1. Get status of API key
app.get('/api/status', (req, res) => {
  res.json({
    hasKey: !!process.env.GEMINI_API_KEY
  });
});

// 2. Get list of available assets in database
app.get('/api/assets', (req, res) => {
  try {
    const folders = getDatabaseFolders();
    const result = {};

    let metadata = {};
    if (fs.existsSync(metadataPath)) {
      metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    }

    folders.forEach(folder => {
      const folderPath = path.join(databaseDir, folder);
      const files = fs.readdirSync(folderPath).filter(f => f.match(/\.(png|jpg|jpeg|webp)$/i));

      let defaultPrice = "$199.00";
      const folderLower = folder.toLowerCase();
      if (folderLower.includes('tile') || folderLower.includes('floor')) {
        defaultPrice = "$5.99 / sq ft";
      } else if (folderLower.includes('light') || folderLower.includes('lamp')) {
        defaultPrice = "$129.00";
      } else if (folderLower.includes('carpet') || folderLower.includes('rug')) {
        defaultPrice = "$249.00";
      } else if (folderLower.includes('wall') || folderLower.includes('shelf') || folderLower.includes('plant') || folderLower.includes('panel') || folderLower.includes('unit')) {
        defaultPrice = "$349.00";
      }

      result[folder] = files.map(f => {
        const meta = metadata[folder]?.[f] || {
          providerName: "Local Artisan",
          providerWebsite: "https://example.com",
          price: defaultPrice
        };
        return {
          name: f.replace(/_/g, ' ').replace(/\.[^/.]+$/, ""),
          filename: f,
          url: `/database/${folder}/${f}`,
          ...meta
        };
      });
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to read database files: " + error.message });
  }
});

// 3. Upload dynamic asset to local database
app.post('/api/upload-asset', uploadAsset.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided." });
    }
    const type = req.body.type || 'furniture';
    const providerName = req.body.providerName || "Local Artisan";
    const providerWebsite = req.body.providerWebsite || "https://example.com";
    
    let defaultPrice = "$199.00";
    const typeLower = type.toLowerCase();
    if (typeLower.includes('tile') || typeLower.includes('floor')) {
      defaultPrice = "$5.99 / sq ft";
    } else if (typeLower.includes('light') || typeLower.includes('lamp')) {
      defaultPrice = "$129.00";
    } else if (typeLower.includes('carpet') || typeLower.includes('rug')) {
      defaultPrice = "$249.00";
    } else if (typeLower.includes('wall') || typeLower.includes('shelf') || typeLower.includes('plant') || typeLower.includes('panel') || typeLower.includes('unit')) {
      defaultPrice = "$349.00";
    }
    
    const price = req.body.price || defaultPrice;

    // Save metadata
    let metadata = {};
    if (fs.existsSync(metadataPath)) {
      metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    }
    if (!metadata[type]) metadata[type] = {};
    metadata[type][req.file.filename] = { providerName, providerWebsite, price };
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    res.json({
      success: true,
      asset: {
        name: req.file.filename.replace(/_/g, ' ').replace(/\.[^/.]+$/, ""),
        filename: req.file.filename,
        url: `/database/${type}/${req.file.filename}`,
        providerName,
        providerWebsite,
        price
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3.5 Create new database folder dynamically
app.post('/api/create-folder', (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Folder name is required." });
    }
    // Sanitize name: lowercase, convert spaces/special chars to underscore
    const sanitized = name.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
    if (!sanitized) {
      return res.status(400).json({ error: "Invalid folder name." });
    }
    const folderPath = path.join(databaseDir, sanitized);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
    res.json({ success: true, folderName: sanitized });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Upload user floor plan
app.post('/api/upload-floorplan', upload.single('floorplan'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No floor plan image provided." });
    }
    res.json({
      success: true,
      url: `/uploads/${req.file.filename}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Generate AI 2D floor plan layout (if not provided)
app.post('/api/generate-floorplan', async (req, res) => {
  try {
    const ai = getGeminiClient();
    const prompt = `You are a professional architect. 
Generate a simplified, clean, modern 2D floor plan blueprint SVG for a single-story family home. 

The house plan must contain:
- A spacious Living Room.
- A Master Bedroom.
- A Kitchen and Dining space.
- A small Bathroom.
- A front entrance door and multiple windows on the outer walls.
- Set the SVG viewBox="0 0 700 500" and make it responsive.
- Use a dark blueprint theme: dark blue background #0a0e1a, outer walls as thick charcoal lines #1e293b, inner walls #334155, glowing teal outlines for windows #06b6d4, swinging doors in green #10b981.
- Add text labels indicating room names ("Living Room", "Bedroom", "Kitchen", "Bathroom") and their dimensions (e.g., "Living Room - 5.0m x 4.0m", "Bedroom - 4.0m x 3.5m").
- Add a title text inside the SVG: "AI House Design - Ground Floor Plan".
- Ensure the layout has a clear outer boundary shape (like a rectangle or L-shape) and rooms are arranged logically inside.

Return your answer as a JSON object with a single key "svg" containing the raw SVG string as its value. Do not wrap the SVG string in Markdown backticks.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const result = JSON.parse(response.text);
    res.json({ svg: result.svg });
  } catch (error) {
    console.error("Floor plan generation error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 5.5 Generate AI House Exterior View (connected to the blueprint layout)
app.post('/api/generate-exterior', async (req, res) => {
  const { blueprintUrl, blueprintSvg, style } = req.body;
  if (!style) {
    return res.status(400).json({ error: "style is required (e.g., Modern, Scandinavian)." });
  }

  try {
    const ai = getGeminiClient();
    const contents = [];

    // 1. Add SVG blueprint description if available
    if (blueprintSvg) {
      contents.push(`Here is the raw SVG floor plan blueprint of the house:
${blueprintSvg}`);
    }

    // 2. Add uploaded floor plan image if available
    if (blueprintUrl) {
      const cleanPath = blueprintUrl.replace(/^\//, '');
      const floorPlanPath = path.join(__dirname, cleanPath);
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
});

// 6. Generate Room Design and Photorealistic renders
app.post('/api/generate-design', async (req, res) => {
  const { roomType, floorPlanUrl } = req.body;

  if (!roomType) {
    return res.status(400).json({ error: "roomType is required." });
  }

  try {
    const ai = getGeminiClient();

    // Read list of assets from all folders dynamically
    const folders = getDatabaseFolders();
    const contents = [];

    // 1. Add Floor Plan if available
    if (floorPlanUrl) {
      const cleanPath = floorPlanUrl.replace(/^\//, '');
      const floorPlanPath = path.join(__dirname, cleanPath);
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
});

  } catch (error) {
    console.error("AI Generation failed:", error);
    res.status(500).json({ error: error.message });
  }
});

// 7. Generate Design Render from a Different Camera Angle
app.post('/api/generate-angle', async (req, res) => {
  const { roomType, styleTitle, styleDescription, selectedAssets, tileUsed, furnitureUsed, lightUsed, carpetUsed, wallDecorUsed, paint, angle } = req.body;

  if (!roomType || !angle) {
    return res.status(400).json({ error: "roomType and angle are required." });
  }

  try {
    const ai = getGeminiClient();
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
        temperature: 0.7
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
});

app.listen(PORT, () => {
  console.log(`AI Room Designer server running on http://localhost:${PORT}`);
});
