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

// Ensure house_styles and its subfolders exist
const houseStylesDir = path.join(databaseDir, 'house_styles');
const constructionStyles = [
  'Modern Minimalist',
  'Scandinavian Timber',
  'Mid-Century Modern',
  'Industrial Concrete',
  'Cozy Stone Cottage',
  'Kerala Traditional'
];
if (!fs.existsSync(houseStylesDir)) {
  fs.mkdirSync(houseStylesDir, { recursive: true });
}
constructionStyles.forEach(style => {
  const styleDir = path.join(houseStylesDir, style);
  if (!fs.existsSync(styleDir)) {
    fs.mkdirSync(styleDir, { recursive: true });
  }
});

// Helper to get database folders dynamically (excluding house_styles)
const getDatabaseFolders = () => {
  if (!fs.existsSync(databaseDir)) {
    fs.mkdirSync(databaseDir, { recursive: true });
  }
  return fs.readdirSync(databaseDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory() && dirent.name !== 'house_styles')
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

const styleDescriptions = {
  "Kerala Traditional": {
    roof: "sloping multi-tiered gabled roofs covered with rustic weathered terracotta clay tiles (Mangalore style tiles), deep overhanging eaves with exposed wood brackets, traditional bargeboards and decorated wooden gables",
    walls: "smooth lime-plastered white or light cream exterior walls, combined with solid laterite brick accents and dark wood trimmings",
    columns: "elegant carved teak wood columns (pillars) on the veranda, sitting on dark polished granite or stone pedestals, supporting the sloping porch roof",
    veranda: "an open front veranda (sitout or poomukham) with traditional low wooden built-in seating benches (charupady) wrapping around the entrance",
    features: "windows with vertical wooden bars/louvers and heavy dark teak wooden frames, traditional padippura style arched entrance gateway, lush tropical garden with banana plants and palms",
    vibe: "authentic heritage Kerala architecture, classic traditional look matching rural estate homes, warm earthy tones, no modern flat roofs or glass panels"
  },
  "Modern Minimalist": {
    roof: "flat concrete slab roofs, clean sharp horizontal and vertical planes, cantilevered roof slabs with integrated slim LED strip recess lines",
    walls: "smooth pristine white concrete walls, contrasting with dark grey plaster finishes and panels of natural grey slate or split-face stone cladding",
    columns: "slender black structural steel posts or heavy raw concrete pillars integrated seamlessly into the rectilinear layout",
    veranda: "minimalist raised deck with concrete steps, seamless indoor-outdoor transition through full-height pocket doors",
    features: "monolithic floor-to-ceiling glass wall panels with thin black aluminum frames, minimalist floating steel staircase, neat manicured lawns with simple concrete pavers",
    vibe: "ultra-modern, minimalist luxury, sharp geometric lines, cubic forms, neutral grey and white color palette"
  },
  "Scandinavian Timber": {
    roof: "steep A-frame or simple gabled roofs finished in dark charcoal metal standing seam panels or slate shingles, minimalist roofline",
    walls: "vertical timber wood siding, painted in black, dark charcoal grey, or left natural light pine/cedar tone with weather-resistant oils",
    columns: "simple, unadorned square light pine wood columns supporting the deck roof overhang",
    veranda: "large wrap-around elevated wooden sun-deck with simple wood railings, minimalist outdoor furniture",
    features: "large panoramic triple-glazed windows with simple black or natural wood frames, glass double doors opening to the deck, simple forest or pine tree backdrop",
    vibe: "warm cozy nordic design, organic wood textures, highly functional, high-contrast exterior, integrated with natural wooded landscape"
  },
  "Industrial Concrete": {
    roof: "flat concrete roofs with exposed gravel/stone ballast, thick metal fascia bands along the roof edge",
    walls: "raw board-formed concrete walls showing the wood grain texture and tie-rod holes, combined with black corrugated steel sheeting and red brick accents",
    columns: "heavy exposed black H-beam steel columns and girders forming a rigid structural frame",
    veranda: "raw concrete loading dock style porch with black steel wire railings and industrial mesh doors",
    features: "large multi-pane steel grid factory windows, exposed copper pipes, metal ducts, black steel metal stairs, industrial pendant light fixtures",
    vibe: "urban loft aesthetic, rugged raw materials, exposed structural systems, monochromatic grey and black color scheme"
  },
  "Cozy Stone Cottage": {
    roof: "multi-gabled steep roofs with irregular weathered grey slate shingles, wavy rooflines, thick stone chimney with terracotta clay pots",
    walls: "thick, rustic load-bearing walls built from irregular natural fieldstones, rough mortar joints, and small patches of peeling white stucco",
    columns: "gnarled rough-hewn oak timber columns and lintels supporting the arched porch roof",
    veranda: "small stone flagstone porch with a wooden bench, climbing flowering wisteria or ivy on the walls",
    features: "small divided-lite casement windows with wood shutters painted in sage green or soft blue, heavy arched oak main door with black iron strap hinges",
    vibe: "fairytale cottage, rustic charm, organic hand-crafted feel, blending perfectly with a wild cottage flower garden"
  },
  "Mid-Century Modern": {
    roof: "low-pitched gabled roofs or flat butterfly roofs, extremely wide overhanging wood-paneled eaves showing tongue-and-groove boards",
    walls: "horizontal redwood or cedar planks, combined with vertical tongue-and-groove siding and stacked orange-brown brick accent walls",
    columns: "thin painted steel columns or laminated wood posts holding up the low-angle roof trusses",
    veranda: "concrete sitout deck sheltered by the wide eaves, integrating indoor planters and terrazzo tiling",
    features: "large floor-to-ceiling glass panels, clerestory windows under the roofline, bright orange or mustard yellow main door, retro atomic era sconce light fixtures",
    vibe: "retro mid-century elegance, organic integration, warm wood tones, pops of vintage color (orange, teal, yellow)"
  }
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

// Helper: Parse CSV formatted text including handling of quotes
function parseCSV(csvText) {
  const lines = [];
  let row = [""];
  let insideQuote = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (insideQuote && nextChar === '"') {
        row[row.length - 1] += '"';
        i++; // skip next quote
      } else {
        insideQuote = !insideQuote;
      }
    } else if (char === ',' && !insideQuote) {
      row.push("");
    } else if ((char === '\r' || char === '\n') && !insideQuote) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      lines.push(row);
      row = [""];
    } else {
      row[row.length - 1] += char;
    }
  }
  if (row.length > 1 || row[0] !== "") {
    lines.push(row);
  }
  return lines;
}

// Helper: Fetch Google Sheets data as CSV and parse into assets object
async function fetchGoogleSheetAssets(sheetId) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Google Sheets fetch failed with status ${response.status}`);
  }
  const csvText = await response.text();
  const rows = parseCSV(csvText);

  if (rows.length < 2) {
    throw new Error("Google Sheet is empty or lacks header/data rows.");
  }

  // Parse headers
  const headers = rows[0].map(h => h.toLowerCase().trim().replace(/_/g, '').replace(/\s+/g, ''));
  const categoryIndex = headers.indexOf('category');
  const nameIndex = headers.indexOf('name');
  const imageUrlIndex = headers.findIndex(h => h.includes('image'));
  const productUrlIndex = headers.findIndex(h => h.includes('product') || h.includes('website') || h.includes('link'));
  const providerNameIndex = headers.findIndex(h => h.includes('provider'));
  const priceIndex = headers.indexOf('price');

  if (categoryIndex === -1 || nameIndex === -1 || imageUrlIndex === -1) {
    throw new Error("Google Sheet must contain Category, Name, and ImageUrl columns.");
  }

  const result = {};

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 3) continue; // skip incomplete rows

    const category = row[categoryIndex]?.trim();
    const name = row[nameIndex]?.trim();
    const imageUrl = row[imageUrlIndex]?.trim();

    if (!category || !name || !imageUrl) continue;

    const productUrl = productUrlIndex !== -1 ? row[productUrlIndex]?.trim() : '';
    const providerName = providerNameIndex !== -1 ? row[providerNameIndex]?.trim() : '';
    const price = priceIndex !== -1 ? row[priceIndex]?.trim() : '';

    if (!result[category]) {
      result[category] = [];
    }

    // Default prices based on category (consistent with local fallback)
    let defaultPrice = "$199.00";
    const catLower = category.toLowerCase();
    if (catLower.includes('tile') || catLower.includes('floor')) {
      defaultPrice = "$5.99 / sq ft";
    } else if (catLower.includes('light') || catLower.includes('lamp')) {
      defaultPrice = "$129.00";
    } else if (catLower.includes('carpet') || catLower.includes('rug')) {
      defaultPrice = "$249.00";
    } else if (catLower.includes('door')) {
      defaultPrice = "$599.00";
    } else if (catLower.includes('window')) {
      defaultPrice = "$249.00";
    } else if (catLower.includes('wall') || catLower.includes('shelf') || catLower.includes('plant') || catLower.includes('panel') || catLower.includes('unit')) {
      defaultPrice = "$349.00";
    }

    result[category].push({
      name,
      filename: imageUrl.split('/').pop() || name,
      url: imageUrl,
      providerName: providerName || "Local Artisan",
      providerWebsite: productUrl || "https://example.com",
      price: price || defaultPrice
    });
  }

  return result;
}

// 2. Get list of available assets in database
app.get('/api/assets', async (req, res) => {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (sheetId && sheetId !== 'your_google_sheet_id_here') {
    try {
      console.log(`Attempting to load assets from Google Sheet: ${sheetId}`);
      const sheetAssets = await fetchGoogleSheetAssets(sheetId);
      return res.json(sheetAssets);
    } catch (sheetError) {
      console.error("Failed to fetch assets from Google Sheets, falling back to local database:", sheetError.message);
    }
  }

  // Local fallback
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
      } else if (folderLower.includes('door')) {
        defaultPrice = "$599.00";
      } else if (folderLower.includes('window')) {
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

// 2.5 Get list of blueprints from local database based on floors and bedrooms
app.get('/api/blueprints', (req, res) => {
  try {
    const { floors, bedrooms } = req.query;
    const floorsCount = parseInt(floors) || 1;
    const bedroomsCount = parseInt(bedrooms) || 2;

    const folderName = `${floorsCount}_floor`;
    const subFolderName = `${bedroomsCount}_bedroom`;
    const targetDir = path.join(databaseDir, 'blueprints', folderName, subFolderName);

    if (!fs.existsSync(targetDir)) {
      return res.json([]);
    }

    const files = fs.readdirSync(targetDir).filter(f => f.match(/\.(png|jpg|jpeg|webp)$/i));
    const blueprints = files.map(file => {
      return {
        name: file.replace(/_/g, ' ').replace(/\.[^/.]+$/, ""),
        filename: file,
        url: `/database/blueprints/${folderName}/${subFolderName}/${file}`
      };
    });

    res.json(blueprints);
  } catch (error) {
    res.status(500).json({ error: "Failed to read blueprint database: " + error.message });
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

// 4.5 Upload user land survey
app.post('/api/upload-survey', upload.single('survey'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No survey image provided." });
    }
    res.json({
      success: true,
      url: `/uploads/${req.file.filename}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4.7 Match land survey proportions to blueprints
app.post('/api/match-survey', async (req, res) => {
  try {
    const ai = getGeminiClient();
    const { surveyUrl, floorsCount, bedroomsCount } = req.body || {};
    if (!surveyUrl) {
      return res.status(400).json({ error: "surveyUrl is required." });
    }

    const floors = parseInt(floorsCount) || 1;
    const bedrooms = parseInt(bedroomsCount) || 3;

    // Resolve survey path
    const cleanPath = surveyUrl.replace(/^\//, '');
    const surveyPath = path.join(__dirname, cleanPath);

    if (!fs.existsSync(surveyPath)) {
      return res.status(400).json({ error: "Survey image not found on server." });
    }

    // Scan blueprints folder
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
        temperature: 0.2
      }
    });

    const matchResult = JSON.parse(response.text);
    res.json(matchResult);

  } catch (error) {
    console.error("Plot matching failed:", error);
    res.status(500).json({ error: error.message });
  }
});

// 5. Generate AI 2D floor plan layout (if not provided)
app.post('/api/generate-floorplan', async (req, res) => {
  try {
    const ai = getGeminiClient();
    const { style, rooms, floorsCount } = req.body || {};
    const floors = parseInt(floorsCount) || 1;

    let roomDetails = [];
    if (rooms) {
      if (rooms.livingRoom) roomDetails.push("- A spacious Living Room (typically on Ground Floor)");
      if (rooms.prayerRoom) roomDetails.push("- A quiet, dedicated Prayer Room / Puja space (typically on Ground Floor)");
      if (rooms.diningRoom) roomDetails.push("- A Dining Room / dining hall (typically on Ground Floor)");
      if (rooms.carPorch) roomDetails.push("- A Car Porch / parking garage space integrated at the front facade on the Ground Floor");
      if (rooms.bedroomsCount && rooms.bedroomsCount > 0) {
        for (let i = 1; i <= rooms.bedroomsCount; i++) {
          roomDetails.push(`- Bedroom ${i} (distribute across floors, attached with a Bathroom)`);
        }
      }
      if (rooms.bathroomsCount && rooms.bathroomsCount > 0) {
        for (let i = 1; i <= rooms.bathroomsCount; i++) {
          roomDetails.push(`- Bathroom ${i} (en-suite/attached directly to Bedroom ${i})`);
        }
      }
    } else {
      roomDetails = [
        "- A spacious Living Room on the Ground Floor",
        "- A Master Bedroom with attached Bathroom on the First Floor",
        "- A Kitchen and Dining space on the Ground Floor",
        "- A small Bathroom on the Ground Floor"
      ];
    }

    if (!roomDetails.some(r => r.toLowerCase().includes("kitchen"))) {
      roomDetails.push("- A Kitchen space (on Ground Floor)");
    }

    const styleName = style || 'Modern Minimalist';

    // SVG instruction template depending on floor count
    let layoutInstruction = "";
    if (floors === 1) {
      layoutInstruction = "Generate a single ground floor blueprint layout inside the SVG canvas.";
    } else if (floors === 2) {
      layoutInstruction = `Generate a two-story blueprint layout. Divide the SVG canvas into two side-by-side panels:
- Left Panel (X from 0 to 330): Ground Floor Blueprint. Must contain the Car Porch (integrated at bottom/front), Living Room, Dining Room, Kitchen, and Prayer Room (if selected).
- Right Panel (X from 370 to 700): First Floor Blueprint. Must contain the Bedrooms and their attached Bathrooms.
- Include a 30px spacing between panels with a vertical dashed separator line at X=350.`;
    } else {
      layoutInstruction = `Generate a three-story blueprint layout. Divide the SVG canvas into three side-by-side panels:
- Left Panel (X from 0 to 220): Ground Floor Blueprint (Car Porch, entrance, Living Room, Kitchen, dining).
- Center Panel (X from 240 to 460): First Floor Blueprint (Bedrooms, attached bathrooms).
- Right Panel (X from 480 to 700): Second Floor Blueprint (additional Bedrooms, attached bathrooms, or study/balcony).
- Include vertical dashed separator lines at X=230 and X=470.`;
    }

    const prompt = `You are a professional architect and master SVG designer.
Generate a premium, clean, flat 2D presentation floor plan blueprint SVG for a ${floors}-story family home designed in the style of "${styleName}". 

The layout must match the visual design and room configuration of the uploaded model image:
- It must be a flat 2D vector blueprint layout (no 2.5D shadow filters, no drop shadows, no wood/marble/grass textures).
- The background color of the SVG should be a soft, very light grey (#f8fafc) or white.
- All rooms must have a clean solid white background (#ffffff), except Toilets/Bathrooms which must have a solid light blue fill (#e2f0fd or #e0f2fe).
- Walls must be drawn as solid dark slate/charcoal lines (#475569) with outer walls at width 4px and inner walls at width 2.5px.
- Doors must be rendered as green single-swinging arc symbols (#10b981) indicating opening direction, except the main entrance which must be a bold swing door.
- Windows must be bright glowing teal double-lined rectangles (#06b6d4) embedded in the outer walls.
- Room Labels: Every room must have a centered, clear, uppercase bold room name label (e.g. "LIVING") and a smaller room dimensions label (e.g. "14'0\" x 16'0\"") centered directly below it using font-family="sans-serif" and fill="#1e293b".

STRICT SINGLE-STORY ROOM CONFIGURATION RULES:
For a 1-story house layout, you MUST arrange the rooms in the exact 3-column configuration matching the uploaded model screenshot:
- Left Column (X coordinates from 50 to 230):
  - Bedroom 2: Top-left room (Y: 60 to 180, dimensions "13'0\" x 12'0\"").
  - Bedroom 1: Middle-left room (Y: 180 to 300, dimensions "14'0\" x 12'0\"").
  - Toilet: A small projecting room on the far left of Bedroom 1 (X: 0 to 50, Y: 250 to 300, dimensions "8'0\" x 5'0\""), with a light blue fill.
  - Living Room: Bottom-left room (Y: 300 to 460, dimensions "14'0\" x 16'0\"").
- Center Column (X coordinates from 230 to 410):
  - Two Toilets: Side-by-side toilets at the top-center (Y: 60 to 160, dimensions each "5'0\" x 8'0\""). Left half is Toilet 1, right half is Toilet 2, with a light blue fill.
  - Dining Room: Upper-middle center room (Y: 160 to 280, dimensions "14'0\" x 12'0\""). Draw a small dining icon in the center: a square dining table rectangle (#cbd5e1) with 4 small circular dots representing chairs.
  - Nadumuttam / Courtyard: Lower-middle center room (Y: 280 to 400, dimensions "12'0\" x 12'0\""). Draw a brown border outline (#854d0e, width 3px) around this room. Draw a solid green circle (#4ade80, radius 12px) in the exact center of this room. Labeled "NADUMUTTAM".
  - Sitout: Bottom-center room (Y: 400 to 460, dimensions "20'0\" x 6'0\""). Labeled "SITOUT".
- Right Column (X coordinates from 410 to 630):
  - Bedroom 3: Top-right room (Y: 60 to 180, dimensions "13'0\" x 12'0\"").
  - Work Area / WA: A projecting room on the far right of Bedroom 3 (X: 630 to 680, Y: 110 to 180, dimensions "6'0\" x 7'0\""). Labeled "W/A".
  - Kitchen: Upper-middle right room (Y: 180 to 290, dimensions "11'0\" x 12'0\""). Labeled "KITCHEN".
  - Puja Room: Middle-right room (Y: 290 to 340, dimensions "7'0\" x 5'0\""). Labeled "PUJA".
  - M. Bedroom (Master Bedroom): Lower-middle right room (Y: 340 to 410, dimensions "14'0\" x 12'0\""). Labeled "M. BEDROOM".
  - Toilet: Bottom-right room (Y: 410 to 460, dimensions "8'0\" x 5'0\"") with a light blue fill. Labeled "TOILET".

STRICT MULTI-STORY ROOM CONFIGURATION RULES:
For a 2-story or 3-story house, adapt the above style and 3-column configuration by placing the primary living, sitout, dining, kitchen, and nadumuttam on the Ground Floor (Left Panel), and distributing the bedrooms, toilets, and work areas across the upper floors (Center/Right Panels) accordingly, maintaining the identical clean flat 2D style (white fills, light blue toilets, brown-bordered Nadumuttam with green circle, and uppercase labels).

Set the SVG viewBox="0 0 700 500" and make it responsive.
Return your response as a JSON object with a single key "svg" containing the raw SVG string as its value. Do not wrap the SVG string in Markdown backticks.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 1.0
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
  const { blueprintUrl, blueprintSvg, style, floorsCount } = req.body;
  if (!style) {
    return res.status(400).json({ error: "style is required (e.g., Modern, Scandinavian)." });
  }

  const floors = parseInt(floorsCount) || 1;
  const floorsText = floors === 1 ? 'single-story' : (floors === 2 ? 'two-story' : 'three-story');

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

    // 3. Load exterior database assets dynamically
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
      if (files.length > 0) {
        const file = files[0];
        const filePath = path.join(styleDir, file);
        contents.push(fileToGenerativePart(filePath, getMimeType(filePath)));
        contents.push(`Reference image for selected architectural style "${styleName}" (Image #1)`);
        styleRefs.push(`- Reference image for style "${styleName}" (Image #1) attached above.`);
      }
    }

    const styleDetails = styleDescriptions[styleName] || styleDescriptions["Modern Minimalist"];
    const stylePromptDetails = `
- **Strict Style Characteristics**:
  - Roofing: ${styleDetails.roof}.
  - Wall materials & finish: ${styleDetails.walls}.
  - Columns / pillars: ${styleDetails.columns}.
  - Veranda / porch setup: ${styleDetails.veranda}.
  - Architectural windows/doors & unique features: ${styleDetails.features}.
  - Vibe & mood: ${styleDetails.vibe}.
`;

    let styleRefsPrompt = `\nCRITICAL STYLE REQUIREMENTS FOR "${styleName}":
${stylePromptDetails}`;
    if (styleRefs.length > 0) {
      styleRefsPrompt += `\nI have also provided the following reference images for the architectural style "${styleName}" that you MUST analyze to ensure the output aligns with the visual design:
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

Based on these selections, write a detailed architectural description and a single image generation prompt for Imagen 4 that will render a straight-on architectural front elevation view (straight view) showing the front side facade of the house:
- The image must be a straight-on elevation view (front elevation / straight front view) looking directly and squarely at the front facade, with no perspective angle, no side walls visible, and no perspective distortion.
- It must clearly show the front entrance/sitout, the selected front door, the car porch (if present in the blueprint), the selected windows, the selected roof tiles, the selected wall paint, and the front yard landscaping.

The Imagen 4 prompt MUST STAY 100% TRUE TO THE BLUEPRINT AND SELECTED ASSETS:
1. Clearly specify a "straight-on architectural front elevation view (straight view / front elevation) of a ${floorsText} house showing the front facade directly and squarely".
${heightInstruction}
3. Incorporate the selected front door, roof tiles, windows, and paint color by describing their visual appearance (materials, textures, and style) in detail.
4. Enforce 100% strict alignment to the generated blueprint layout: The generated house exterior facade MUST match the room arrangement, doors, windows, and sitout layout of the blueprint completely without any changes or additions. Specifically, if a Sitout is in the center, the front facade must feature a centered open sitout with teak columns; if a Living Room is on the left, the left side of the facade must show the Living Room windows; if a Master Bedroom is on the right, the right side must correspond to the Master Bedroom windows. There must be NO car porch unless one is explicitly shown in the blueprint.
5. STRICT DOOR AND WINDOW FIDELITY: You MUST count the exact number of windows and doors on the front-facing walls in the blueprint, and describe their exact placement and count in the Imagen prompt. For example, if the blueprint shows exactly two windows on the left section of the facade and one window on the right section, you must write 'exactly two windows on the left facade section and exactly one window on the right facade section'. Do not add or hallucinate any doors, windows, balconies, chimneys, or wings that are not in the blueprint. Match the door and window counts, styles, and alignments exactly. Do NOT use vague plural terms like 'windows' or 'doors' without prefixing them with their exact counts (e.g. 'exactly two windows', 'exactly one door').
6. Specify high-end architectural catalog photography details: "shot on 35mm lens, warm late afternoon sunlight, volumetric soft lighting, photorealistic, 8k resolution, architectural digest feature".
7. Do NOT mention code variables, filenames, or technical terms in the Imagen prompt. Use visual descriptions.
8. CRITICAL REPLICA CONSTRAINT: The visual layout generated by Imagen must look like a direct 3D front-elevation extrusion of the 2D blueprint. Every single window opening and door opening visible on the front-facing wall of the blueprint must be accounted for in the prompt with its exact location (left, center, right, or specific room name) and count. Absolutely no extra windows or doors should appear.
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
  "imagenPrompt": "The highly detailed Imagen 4 prompt for the straight-on architectural front elevation view"
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
});

// 6. Generate Room Design and Photorealistic renders
app.post('/api/generate-design', async (req, res) => {
  const { roomType, floorPlanUrl, constructionStyle, exteriorDesign } = req.body;
  const styleName = constructionStyle || 'Modern Minimalist';

  if (!roomType) {
    return res.status(400).json({ error: "roomType is required." });
  }

  try {
    const ai = getGeminiClient();

    // Read list of assets from all folders dynamically (exclude exterior-only assets)
    const folders = getDatabaseFolders().filter(f => !['roof tiles', 'front door', 'windows'].includes(f));
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

    // Formulate coordination prompts with exterior selections if available
    let exteriorDesignPrompt = "";
    if (exteriorDesign) {
      const paintUsedName = exteriorDesign.paint?.name || exteriorDesign.paintUsed || "";
      const paintHex = exteriorDesign.paint?.hex || "";
      const exteriorWindows = exteriorDesign.selectedAssets?.windows || "";
      const exteriorDoor = exteriorDesign.selectedAssets?.["front door"] || "";
      
      exteriorDesignPrompt = `
COORDINATING WITH EXTERIOR SELECTIONS:
- The selected exterior paint color is: "${paintUsedName}" ${paintHex ? `(Hex: ${paintHex})` : ""}. In your interior design, you MUST choose a wall paint color that coordinates beautifully with this color. You can choose the same color key if it fits, or select a color that compliments it perfectly.
- The exterior window style is: "${exteriorWindows}". The interior room windows MUST reflect this exact window style. Specify the same window design looking out.
- The exterior main door style is: "${exteriorDoor}". If this room is adjacent to the main entrance (like a Living Room/Sitout), any transition doors to the exterior must match this door style.
`;
    }

    // Add detailed planning instructions
    const randomSalt = Math.floor(Math.random() * 1000000);
    const promptText = `You are a world-class AI Interior Designer. You are designing a single ${roomType}.
The overall home architectural style is "${styleName}". The interior design concept, colors, flooring, and furniture layout MUST suit and coordinate with this "${styleName}" style!
${exteriorDesignPrompt}

STRICT BLUEPRINT LAYOUT MATCHING & VISUAL AUDIT:
- You must analyze the provided blueprint of the room with extreme care.
- You MUST identify the exact location and counts of all windows, doors, and walls shown in the blueprint for this specific room: "${roomType}".
- In the generated Imagen 4 prompt, you MUST describe the room's layout exactly as it is in the blueprint. If the blueprint shows exactly one window on a specific wall, describe "exactly one window" on that wall looking out. If it shows exactly one door, describe "exactly one door". Do not add extra windows, doors, or open areas that are not present in the blueprint for this room.
- Do NOT use vague plural terms like 'windows' or 'doors' without prefixing them with their exact counts (e.g. 'exactly one window', 'exactly two doors').
- Paint Coordination: Select an interior paint color that coordinates beautifully with the overall style and any selected exterior paint color.

I have provided the floor plan/room layout (if available) and our database of room design assets.
The database assets are organized into folders. For each folder, the reference images have been attached above with labels in the format 'Asset item from category "[foldername]" (Filename: "[filename]")'.

Here is the list of available categories and their items in our database:
${JSON.stringify(folderAssetsInfo, null, 2)}

Here is the list of available Wall Paint Colors you can use in your design:
${JSON.stringify(defaultPaints, null, 2)}

Create a single distinct, beautiful interior design style for the ${roomType}. 
Ensure the materials, layouts, styles, and colors coordinate visually.

CRITICAL STYLE ALIGNMENT CONSTRAINT:
The selected flooring, wall paint color, and furniture items MUST suit and reflect the home's overall architectural style of "${styleName}":
- If style is "Modern Minimalist", design a clean, sleek, uncluttered modern interior with large polished white marble or grey concrete tile flooring, pristine white or light grey wall paint, low-profile minimalist furniture in neutral tones with thin steel legs, and simple recess lighting.
- If style is "Scandinavian Timber", design a warm organic wood-clad interior with light ash or pine wood floorboards, soft white/pale grey walls, cozy simple fabrics (wool/sheepskin), light timber furniture pieces, and soft diffuse lighting.
- If style is "Kerala Traditional", design a traditional Indian interior featuring polished terracotta clay tiles or rich yellow oxide flooring, warm white/cream plaster walls with teak wood framing, classic solid wood columns (pillars) in the room corners, low-slung dark wood seating, traditional brass oil lamps (nilavilakku) or hanging brass light fixtures, and a warm heritage layout suited to a traditional Indian courtyard home.
- If style is "Mid-Century Modern", use warm walnut or teak parquet flooring, clean white walls with warm vertical wood slat accents, retro atomic era sconce lights, and bold wood furniture with organic tapered legs and retro colored upholstery.
- If style is "Industrial Concrete", design a raw urban loft interior with board-formed concrete or dark grey cement tile flooring, exposed concrete slab walls or rustic red brickwork, black steel structural columns, raw pipes, factory grid glass panels, and steel-and-leather furniture.
- If style is "Cozy Stone Cottage", design a rustic fairytale cottage interior with flagstone or slate floors, rough white plaster walls, exposed heavy oak ceiling beams, small divided-lite windows with wood shutters, and plush fabrics with antique iron finishes.

[Randomization Seed: ${randomSalt}]
Each time you are called, you must create a completely fresh and unique design concept. Randomize layout alignments, colors, textures, and asset selections. Do not produce the same design or prompt twice. Be creative and introduce variety.

For your design, you MUST select items from the database folders:
1. Identify a folder containing tiles or flooring options (usually 'tiles'). Select exactly 1 filename from it for the floor.
2. For all other folders, select items to place in the room as appropriate for the style (e.g., sofas/setees for seating, lighting fixtures, carpets/rugs, wall decor, plants, shelving, TV units, etc.).
3. You can select between 1 and 3 items from a folder if appropriate, or select 0 items (null or empty array) if no items from that folder are needed.
4. You must NOT select any files from folders that have 0 items.
5. Select exactly 1 paint color key from the available Wall Paint Colors list.
6. Write a description of the layout, style concept, and how all components coordinate.
7. Write a highly detailed, professional photorealistic image generation prompt for Imagen 4. 

The Imagen 4 prompt MUST:
- Describe a gorgeous, professional high overview interior design photo of the ${roomType}, taken from a high-angle wide-angle perspective looking down at the entire room layout to show all walls, flooring, placement of the furniture, and doors/windows clearly.
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
});

app.listen(PORT, () => {
  console.log(`AI Room Designer server running on http://localhost:${PORT}`);
});
