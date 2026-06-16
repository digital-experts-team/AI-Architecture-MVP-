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
4. **Detailed drawn furniture elements (rendered on top of floor fills)**:
   - **Bedrooms**: Draw a double bed outline (a large white/cream rectangle representing sheets, complete with pillows and a colored blanket band).
   - **Living Room**: Draw a cozy sofa layout (L-shaped or facing rectangles representing sofas in charcoal/navy blue, complete with small accent cushions) and a wooden coffee table.
   - **Dining Area**: Draw a large wooden dining table rectangle with smaller squares/circles around it representing dining chairs.
   - **Car Porch**: If present, draw 1 or 2 vehicle outlines (car silhouettes with windshields, hoods, and wheels) parked inside.
   - **Kitchen**: Draw the L-shaped/straight countertop lines, complete with a stove symbol and sink symbol.
   - **Bathrooms**: Draw a toilet seat symbol and a bathtub/shower tray rectangle.
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
        responseMimeType: 'application/json'
      }
    });

    const result = JSON.parse(response.text);
    res.json({ svg: result.svg });
  } catch (error) {
    console.error("Floor plan generation error:", error);
    res.status(500).json({ error: error.message });
  }
}
