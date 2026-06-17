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
5. STRICT DOOR AND WINDOW FIDELITY: You MUST count the exact number of windows and doors on the front-facing walls in the blueprint, and describe their exact placement and count in the Imagen prompt. For example, if the blueprint shows exactly two windows on the left section of the facade and one window on the right section, you must write 'exactly two windows on the left facade section and exactly one window on the right facade section'. Do not add or hallucinate any doors, windows, balconies, chimneys, or wings that are not in the blueprint. Match the door and window counts, styles, and alignments exactly.
6. Specify high-end architectural catalog photography details: "shot on 35mm lens, warm late afternoon sunlight, volumetric soft lighting, photorealistic, 8k resolution, architectural digest feature".
7. Do NOT mention code variables, filenames, or technical terms in the Imagen prompt. Use visual descriptions.
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
}
