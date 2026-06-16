import { GoogleGenAI } from '@google/genai';

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

    // Always include a Kitchen
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
Generate a premium, clean, modern 2D floor plan blueprint SVG for a ${floors}-story family home designed in the style of "${styleName}". 

${layoutInstruction}

The house plan must contain the following room details:
${roomDetails.join('\n')}
- STRICT CONSTRAINT: Every Bedroom MUST be directly adjacent to and connected with a Bathroom (en-suite attached layout). The Bathroom door must open directly inside the Bedroom, not into the general corridor.
- Every ground floor layout (and single-story layout) MUST contain a central open-to-sky courtyard garden (labeled "Central Courtyard" or "Nadumuttam") positioned in the middle of the home, surrounded by a passage corridor.

STRICT DESIGN RULES:
1. **Dark Blue Blueprint Theme & Color Scheme**:
   - The entire SVG canvas background MUST be a dark blueprint blue (#0a0e1a). You must render a root \`<rect width="700" height="500" fill="#0a0e1a" />\`.
   - Do NOT use colored room floor fills (no wood textures, no grey tile textures, no blue bathroom fills, no marble fills). All rooms must have transparent or dark blue fills matching the background (#0a0e1a).
   - Only the **Central Courtyard (Nadumuttam)** can have a soft, deep green garden lawn background fill (#14532d or #15803d) with leafy plant outlines.
   - All rooms, passage lines, walls, doors, windows, labels, and drawings must be styled to stand out beautifully on the dark blue background.
2. **Detailed Drawn Furniture & Representative Room Icons (rendered as technical wireframes)**:
   - To make the layout highly professional, recognizable, and easy to read, you MUST render both standard architectural furniture outlines AND a specific representative vector icon in each room next to its label:
   - All furniture drawings (beds, sofas, tables, counters, toilets, altars) and room icons must be drawn as clean, white or light sky-blue wireframe outlines (stroke="#e2e8f0" or stroke="#38bdf8", fill="none", stroke-width="1.5px") to look like a technical blueprint.
   - **Representative Room Icons**: Place a small, distinct vector-based icon group next to or above each room's label. Draw:
     - Bedroom: A clean double-bed icon (headboard + pillows).
     - Living Room: A couch/sofa icon.
     - Dining Area: A dining plate and fork icon or table/chairs icon.
     - Kitchen: A chef hat, stove burner, or pot icon.
     - Bathroom: A toilet or shower icon.
     - Prayer Room: A traditional brass lamp (diya) or sacred lotus icon.
     - Central Courtyard: A green leaf or leafy branch icon.
     - Car Porch: A car front-view icon.
   - **Detailed Furniture Drawings**:
     - **Bedrooms**: Draw a detailed double bed outline (frame rect, two pillow rects, and duvet line).
     - **Living Room**: Draw a cozy sofa layout outline (modular or L-shaped sofas and a coffee table rect).
     - **Dining Area**: Draw a large dining table rect, surrounded by dining chairs.
     - **Car Porch**: Draw a detailed sedan/SUV silhouette outline showing windshield, mirrors, and wheels.
     - **Kitchen**: Draw countertop paths, stove burner circle details, and a sink bowl.
     - **Bathrooms**: Draw toilet seat outlines (tank rect, oval bowl, flush circle) and glass shower stall/bathtub.
     - **Prayer Room**: Draw a small wooden shrine pedestal outline with a lamp/altar symbol in the center.
     - **Central Courtyard (Nadumuttam)**: Draw a central traditional brick tulsi-thara pedestal (dark terracotta square or circle with a leaf structure), stepping stone outlines, and small leafy trees (overlapping circles).
3. **Architectural Structure, Doors & Windows**:
   - **Walls**: Outer walls must be thick solid white or light sky-blue lines (#f8fafc or #38bdf8, width 6px), inner walls thinner solid white or sky-blue lines (#e2e8f0 or #7dd3fc, width 4px).
   - **Doors**: Glowing green swinging doors (Main Entrance: double green swing arc door with arrow, color #10b981; Interior: single green swing arc door, color #10b981).
   - **Windows**: Glowing teal double-lined rectangles (#06b6d4) embedded in the outer walls.
   - **Labels**: Add clear, visible white or light sky-blue text labels (fill="#ffffff" or fill="#38bdf8", font-weight="bold", font-family="sans-serif") indicating room names and dimensions.

Set the SVG viewBox="0 0 700 500" and make it responsive.
Add a title text inside the SVG (color #38bdf8): "AI House Design - ${styleName} (${floors} Floor(s))".

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
}
