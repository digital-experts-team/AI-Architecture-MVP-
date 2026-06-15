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

    const { style, rooms } = req.body || {};

    let roomDetails = [];
    if (rooms) {
      if (rooms.livingRoom) roomDetails.push("- A spacious Living Room");
      if (rooms.prayerRoom) roomDetails.push("- A quiet, dedicated Prayer Room / Puja space");
      if (rooms.diningRoom) roomDetails.push("- A Dining Room / dining hall");
      if (rooms.carPorch) roomDetails.push("- A Car Porch / parking garage space integrated at the front facade");
      if (rooms.bedroomsCount && rooms.bedroomsCount > 0) {
        for (let i = 1; i <= rooms.bedroomsCount; i++) {
          roomDetails.push(`- Bedroom ${i}`);
        }
      }
      if (rooms.bathroomsCount && rooms.bathroomsCount > 0) {
        for (let i = 1; i <= rooms.bathroomsCount; i++) {
          roomDetails.push(`- Bathroom ${i}`);
        }
      }
    } else {
      roomDetails = [
        "- A spacious Living Room",
        "- A Master Bedroom",
        "- A Kitchen and Dining space",
        "- A small Bathroom"
      ];
    }

    // Always include a Kitchen
    if (!roomDetails.some(r => r.toLowerCase().includes("kitchen"))) {
      roomDetails.push("- A Kitchen space");
    }

    const styleName = style || 'Modern Minimalist';

    const prompt = `You are a professional architect. 
Generate a simplified, clean, modern 2D floor plan blueprint SVG for a single-story family home designed in the style of "${styleName}". 

The house plan must contain:
${roomDetails.join('\n')}
- A front entrance door and multiple windows on the outer walls.
- Set the SVG viewBox="0 0 700 500" and make it responsive.
- Use a dark blueprint theme: dark blue background #0a0e1a, outer walls as thick charcoal lines #1e293b, inner walls #334155, glowing teal outlines for windows #06b6d4, swinging doors in green #10b981.
- Add text labels indicating room names and their dimensions matching the listed rooms.
- Add a title text inside the SVG: "AI House Design - ${styleName} Layout".
- Ensure the layout has a clear outer boundary shape (like a rectangle or L-shape) and rooms are arranged logically inside. E.g., if there is a Car Porch, it must be located on the front exterior (typically bottom or left side) next to the main entrance.

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
}
