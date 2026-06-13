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
}
