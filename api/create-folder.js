import path from 'path';
import fs from 'fs';

export default function handler(req, res) {
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
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Folder name is required." });
    }

    // Sanitize name: lowercase, convert spaces/special chars to underscore
    const sanitized = name.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
    if (!sanitized) {
      return res.status(400).json({ error: "Invalid folder name." });
    }

    // Note: Vercel filesystem is read-only. Folder creation on /tmp is ephemeral.
    // For production, use a database or object storage.
    const databaseDir = path.join('/tmp', 'database');
    const folderPath = path.join(databaseDir, sanitized);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    res.json({ success: true, folderName: sanitized });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
