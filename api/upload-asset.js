import path from 'path';
import fs from 'fs';
import multer from 'multer';

// Configure multer to write to /tmp since Vercel filesystem is read-only
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const type = req.body.type || 'furniture';
    const dest = path.join('/tmp', 'database', type);
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    cb(null, dest);
  },
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const uploadAsset = multer({ storage });

// Helper to run multer as a promise
function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

export const config = {
  api: {
    bodyParser: false, // Required for multer to work
  },
};

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
    await runMiddleware(req, res, uploadAsset.single('image'));

    if (!req.file) {
      return res.status(400).json({ error: "No image file provided." });
    }

    const type = req.body.type || 'furniture';
    const providerName = req.body.providerName || "Local Artisan";
    const providerWebsite = req.body.providerWebsite || "https://example.com";

    let defaultPrice = "$199.00";
    const typeLower = type.toLowerCase();
    if (typeLower.includes('tile') || typeLower.includes('floor')) {
      defaultPrice = "$5.99 / sq ft";
    } else if (typeLower.includes('light') || typeLower.includes('lamp')) {
      defaultPrice = "$129.00";
    } else if (typeLower.includes('carpet') || typeLower.includes('rug')) {
      defaultPrice = "$249.00";
    } else if (typeLower.includes('wall') || typeLower.includes('shelf') || typeLower.includes('plant') || typeLower.includes('panel') || typeLower.includes('unit')) {
      defaultPrice = "$349.00";
    }

    const price = req.body.price || defaultPrice;

    // Note: In Vercel serverless, /tmp is ephemeral. Metadata updates won't persist.
    // For a production app, use a database or object storage (e.g., Vercel Blob).
    const databaseDir = path.join(process.cwd(), 'database');
    const metadataPath = path.join(databaseDir, 'metadata.json');
    let metadata = {};
    if (fs.existsSync(metadataPath)) {
      metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    }

    // We can read metadata but can't write back to the read-only filesystem.
    // Log the intended metadata update.
    console.log(`Asset upload: ${req.file.filename} -> ${type}, provider: ${providerName}, price: ${price}`);

    res.json({
      success: true,
      asset: {
        name: req.file.filename.replace(/_/g, ' ').replace(/\.[^/.]+$/, ""),
        filename: req.file.filename,
        url: `/database/${type}/${req.file.filename}`,
        providerName,
        providerWebsite,
        price
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
