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
    const databaseDir = path.join(process.cwd(), 'database');

    // Get all subdirectories in database/
    const folders = fs.readdirSync(databaseDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory() && dirent.name !== 'house_styles')
      .map(dirent => dirent.name);

    const result = {};

    // Load metadata
    const metadataPath = path.join(databaseDir, 'metadata.json');
    let metadata = {};
    if (fs.existsSync(metadataPath)) {
      metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    }

    folders.forEach(folder => {
      const folderPath = path.join(databaseDir, folder);
      const files = fs.readdirSync(folderPath).filter(f => f.match(/\.(png|jpg|jpeg|webp)$/i));

      let defaultPrice = "$199.00";
      const folderLower = folder.toLowerCase();
      if (folderLower.includes('tile') || folderLower.includes('floor')) {
        defaultPrice = "$5.99 / sq ft";
      } else if (folderLower.includes('light') || folderLower.includes('lamp')) {
        defaultPrice = "$129.00";
      } else if (folderLower.includes('carpet') || folderLower.includes('rug')) {
        defaultPrice = "$249.00";
      } else if (folderLower.includes('door')) {
        defaultPrice = "$599.00";
      } else if (folderLower.includes('window')) {
        defaultPrice = "$249.00";
      } else if (folderLower.includes('wall') || folderLower.includes('shelf') || folderLower.includes('plant') || folderLower.includes('panel') || folderLower.includes('unit')) {
        defaultPrice = "$349.00";
      }

      result[folder] = files.map(f => {
        const meta = metadata[folder]?.[f] || {
          providerName: "Local Artisan",
          providerWebsite: "https://example.com",
          price: defaultPrice
        };
        return {
          name: f.replace(/_/g, ' ').replace(/\.[^/.]+$/, ""),
          filename: f,
          url: `/database/${folder}/${f}`,
          ...meta
        };
      });
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to read database files: " + error.message });
  }
}
