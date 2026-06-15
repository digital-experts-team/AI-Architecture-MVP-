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

    const prompt = `You are a professional architect. 
Generate a simplified, clean, modern 2D floor plan blueprint SVG for a ${floors}-story family home designed in the style of "${styleName}". 

${layoutInstruction}

The house plan must contain:
${roomDetails.join('\n')}
- STRICT CONSTRAINT: Every Bedroom MUST be directly adjacent to and connected with a Bathroom (en-suite attached layout). The Bathroom door must open directly inside the Bedroom, not into the general corridor.

Ensure all doors and windows are rendered with highly distinctive SVG symbols and colors so that an AI can easily read and extract their alignments:
1. **Main Entrance Door**: Render as a bold, double-swing green arc door symbol with a green entry arrow pointing inside, clearly labeled "Main Entrance". Use color #059669.
2. **Interior Doors**: Render as green single-line swinging arc door symbols (color #059669) indicating the direction of opening.
3. **Windows**: Render as bright glowing teal double-lined rectangles (color #0891b2) embedded directly in the outer walls, clearly labeled "Window".
4. **Walls**: Outer walls must be thick charcoal lines (#1e293b), inner walls must be thinner slate lines (#475569).
5. **Labels**: Add clear, visible dark charcoal/slate text labels (color #0f172a) indicating room names (e.g. "Living Room", "Bedroom 1", "Attached Bath 1") and dimensions on both floors.

Set the SVG viewBox="0 0 700 500" and make it responsive.
Use a clean, professional white architectural drawing theme: white background #ffffff.
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
