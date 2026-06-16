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
}
