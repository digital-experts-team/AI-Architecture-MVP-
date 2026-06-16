import path from 'path';
import fs from 'fs';

export default function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { floors, bedrooms } = req.query;
    const floorsCount = parseInt(floors) || 1;
    const bedroomsCount = parseInt(bedrooms) || 2;

    const databaseDir = path.join(process.cwd(), 'database');
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
}
