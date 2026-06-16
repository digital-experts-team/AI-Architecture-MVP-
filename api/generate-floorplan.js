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
Generate a premium, highly detailed, colored, and textured 2.5D presentation floor plan blueprint SVG for a ${floors}-story family home designed in the style of "${styleName}". 

${layoutInstruction}

The design must look like a high-end rendered architectural presentation plan (similar to Kruti Buildspace's color-rendered floorplans):
- It must have depth, realistic colors, textured floor fills, drawn furniture, and a central courtyard.

STRICT DESIGN RULES:
1. **Universal Central Courtyard (Nadumuttam)**:
   - Every Ground Floor layout (and single-story layout) MUST contain a prominent, open-to-sky central courtyard garden (labeled "Central Courtyard" or "Nadumuttam") positioned in the exact middle of the home.
   - The primary rooms (Living Room, Kitchen, Dining Area, Bedrooms, Prayer Room) must wrap around this central courtyard.
   - A walkway/passage (labeled "Passage") must surround the courtyard to connect all the rooms.
2. **2.5D Depth & Wall Drop Shadows**:
   - Define a drop shadow filter in <defs>:
     <filter id="wall-shadow" x="-10%" y="-10%" width="130%" height="130%">
       <feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.35"/>
     </filter>
   - Apply filter="url(#wall-shadow)" to all walls to give them a realistic, raised 2.5D visual appearance.
3. **Colored Floor Fills**:
   - **Bedrooms**: Rich warm wood flooring (use soft wood tan #e3c09b or wood brown #cb997e, or simple linear gradients showing floorboards).
   - **Living & Dining Area**: Polished white/gray marble tiles (use light off-white #f8fafc to soft gray #e2e8f0).
   - **Kitchen & Utility**: Clean light grey tiled look (use light grey #e2e8f0 or concrete texture color).
   - **Bathrooms**: Aqua or blue-grey tiled texture (use #bfdbfe or #cbd5e1).
   - **Central Courtyard**: Vibrant green lawn (use green #86efac or #4ade80) decorated with small dark green circles for shrubs/plants.
   - **Verandas / Sitouts / Covered Passages**: Light stone paving (use concrete gray #cbd5e1 or sand beige #ebd6c3).
   - **Car Porch**: Dark gray concrete pavement or pavers.
4. **Detailed Drawn Furniture & Representative Room Icons (rendered on top of floor fills)**:
   - To make the layout highly professional, recognizable, and easy to read, you MUST render both standard architectural furniture outlines AND a specific representative vector icon in each room next to its label:
   - **Representative Room Icons**: Place a small, distinct vector-based icon group (using nested path, circle, rect, or polygon elements with a clean fill and contrasting stroke, roughly 16x16px or 20x20px size) next to or above each room's label. Draw:
     - Bedroom: A clean double-bed icon (headboard + pillows).
     - Living Room: A couch/sofa icon.
     - Dining Area: A dining plate and fork icon or table/chairs icon.
     - Kitchen: A chef hat, stove burner, or pot icon.
     - Bathroom: A toilet or shower icon.
     - Prayer Room: A traditional brass lamp (diya) or sacred lotus icon.
     - Central Courtyard: A green leaf or leafy branch icon.
     - Car Porch: A car front-view icon.
   - **Detailed Furniture Drawings**:
     - **Bedrooms**: Draw a detailed double bed (a rect for the frame, two smaller rects for pillows with a subtle stroke, and a colored rect for the folded-down duvet at the foot of the bed).
     - **Living Room**: Draw a cozy sofa layout (modular or L-shaped sofas with cushions, colored in modern charcoal #334155, and a wooden coffee table rect in the center).
     - **Dining Area**: Draw a large wooden dining table rect, surrounded by 4 to 8 small square or circle dining chairs tucked under the table.
     - **Car Porch**: Draw a detailed sedan/SUV silhouette showing the windshield, side mirrors, wheels, and headlamps.
     - **Kitchen**: Draw thick countertop paths (#475569) along the walls, with a double-circle stove burner detail and a split-rectangle sink bowl with faucet line.
     - **Bathrooms**: Draw a highly recognizable toilet toilet seat layout (toilet tank rect, oval toilet bowl, and inner flush water circle) and a glass shower stall/bathtub with a drain circle.
     - **Prayer Room**: Draw a small rectangular or circular wooden shrine pedestal with a golden lamp/oil lamp drawing in the center.
     - **Central Courtyard (Nadumuttam)**: Draw a lush green courtyard layout matching traditional Kerala style: a central traditional brick tulsi-thara pedestal (a dark terracotta square #c2410c or circle with a green plant leaf structure rising from the middle), surrounded by irregular slate-grey stepping stones (circles/paths), small green leafy trees (overlapping green circles of varying shades and sizes), and decorative plants.
5. **Architectural Structure, Doors & Windows**:
   - **Walls**: Outer walls must be thick charcoal lines (#1e293b, width 6px), inner walls thinner slate lines (#475569, width 4px). Apply the wall-shadow filter to all wall elements.
   - **Doors**: Green swinging doors (Main Entrance: double green swing arc door with arrow, color #059669; Interior: single green swing arc door, color #059669).
   - **Windows**: Bright glowing teal double-lined rectangles (#0891b2) embedded in the outer walls.
   - **Labels**: Add clear, visible dark charcoal text labels (fill="#0f172a", font-weight="bold", font-family="sans-serif") indicating room names (e.g. "Living Room", "Nadumuttam / Courtyard", "Bedroom 1", "Dining Area") and dimensions.

Set the SVG viewBox="0 0 700 500" and make it responsive.
Add a title text inside the SVG (color #0f172a): "AI House Design - ${styleName} (${floors} Floor(s))".

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
