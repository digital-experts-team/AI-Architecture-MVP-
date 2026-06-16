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

    const prompt = `You are a professional architect and master draftsman.
Generate a mathematically precise, highly logical, and clean 2D floor plan blueprint SVG for a ${floors}-story family home designed in the style of "${styleName}".

${layoutInstruction}

The house plan must contain:
${roomDetails.join('\n')}
- STRICT CONSTRAINT: Every Bedroom MUST be directly adjacent to and connected with a Bathroom (en-suite attached layout). The Bathroom door must open directly inside the Bedroom, not into the general corridor.

STRICT LAYOUT & DRAFTING RULES:
1. **Grid-Aligned Rectilinear Walls**:
   - Bounding coordinates for floors must be clean multiples of 10 or 50. All walls must be strictly vertical or horizontal (no arbitrary angles).
   - Outer walls must be thick charcoal lines (#1e293b, stroke-width="6px"), and inner walls must be thinner slate lines (#334155, stroke-width="4px").
   - Walls must meet perfectly at corners without gaps, overhangs, or layout errors.
2. **Logical Door Placement & Swing Direction**:
   - Every door must be placed on a wall line (not floating in space) and serve as a logical passage between rooms or to the exterior.
   - For each door, draw:
     a) A green door leaf line (color #10b981, stroke-width="2.5px") representing the open door itself, angled at 90 degrees relative to the wall.
     b) A thin, dotted green swing arc (color #10b981, stroke-dasharray="2,2", stroke-width="1.5px", fill="none") representing the 90-degree door swing path.
   - **Critical Door Logic**: The door swing arc must open inward into the room and rest against an adjacent wall. A door swing path must NEVER pass through, cut, or overlap any wall, window, furniture, or another door. It must have clear physical space.
   - **Main Entrance Door**: Positioned at the front exterior wall (usually bottom-center of the ground floor layout). Render as a double-swing green arc door symbol with a green entry arrow pointing inside.
3. **No Overlapping Labels (Centered Text)**:
   - Every room MUST contain a clear, legible text label showing the room name (e.g. "Bedroom 1") and dimensions (e.g. "4.0m x 3.5m").
   - **Centering Constraint**: Compute the exact center coordinate (x, y) of each room's bounding box and place the text label precisely at that center. Use \`text-anchor="middle"\` and \`dominant-baseline="middle"\`.
   - **Overlap Prevention**: Room text labels must NEVER overlap with any wall lines, door swing paths, windows, or other text.
   - Use a clear, small font (\`font-size="12px"\` for room names, \`font-size="10px"\` for dimensions, fill="#ffffff" or fill="#38bdf8"). For smaller rooms like Bathrooms, reduce font sizes to \`10px\` and \`8px\` respectively so the text fits completely inside the room boundaries.
4. **Window Alignment**:
   - Windows must be bright glowing teal double-lined rectangles (color #06b6d4) embedded directly within the outer walls.
   - Add a small, high-contrast, non-overlapping teal label "Window" or dimension next to it if appropriate, but keep it clear of the wall.

Set the SVG viewBox="0 0 700 500" and make it responsive.
Use a dark blueprint theme: dark blue background #0a0e1a.
Add a title text inside the SVG (color #38bdf8, font-size="18px", font-weight="bold", X=350, Y=30, text-anchor="middle"): "AI House Design - ${styleName} (${floors} Floor(s))".

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
