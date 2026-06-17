import path from 'path';
import fs from 'fs';

// Helper: Parse CSV formatted text including handling of quotes
function parseCSV(csvText) {
  const lines = [];
  let row = [""];
  let insideQuote = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (insideQuote && nextChar === '"') {
        row[row.length - 1] += '"';
        i++; // skip next quote
      } else {
        insideQuote = !insideQuote;
      }
    } else if (char === ',' && !insideQuote) {
      row.push("");
    } else if ((char === '\r' || char === '\n') && !insideQuote) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      lines.push(row);
      row = [""];
    } else {
      row[row.length - 1] += char;
    }
  }
  if (row.length > 1 || row[0] !== "") {
    lines.push(row);
  }
  return lines;
}

// Helper: Fetch Google Sheets data as CSV and parse into assets object from multiple category tabs
async function fetchGoogleSheetAssets(sheetId, databaseDir) {
  const categories = fs.readdirSync(databaseDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory() && dirent.name !== 'house_styles' && dirent.name !== 'category_templates')
    .map(dirent => dirent.name);

  const result = {};

  // Fetch all categories in parallel
  await Promise.all(categories.map(async (category) => {
    try {
      // Export a specific sheet tab by name
      const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&sheet=${encodeURIComponent(category)}`;
      const response = await fetch(url);
      if (!response.ok) {
        // If a sheet tab doesn't exist, we skip it
        return;
      }
      const csvText = await response.text();
      const rows = parseCSV(csvText);

      if (rows.length < 2) return;

      // Parse headers
      const headers = rows[0].map(h => h.toLowerCase().trim().replace(/_/g, '').replace(/\s+/g, ''));
      const nameIndex = headers.indexOf('name');
      const imageUrlIndex = headers.findIndex(h => h.includes('image'));
      const productUrlIndex = headers.findIndex(h => h.includes('product') || h.includes('website') || h.includes('link'));
      const providerNameIndex = headers.findIndex(h => h.includes('provider'));
      const priceIndex = headers.indexOf('price');

      if (nameIndex === -1 || imageUrlIndex === -1) {
        return; // skip if invalid schema
      }

      result[category] = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length < 2) continue; // skip incomplete rows

        const name = row[nameIndex]?.trim();
        const imageUrl = row[imageUrlIndex]?.trim();

        if (!name || !imageUrl) continue;

        const productUrl = productUrlIndex !== -1 ? row[productUrlIndex]?.trim() : '';
        const providerName = providerNameIndex !== -1 ? row[providerNameIndex]?.trim() : '';
        const price = priceIndex !== -1 ? row[priceIndex]?.trim() : '';

        // Default prices based on category
        let defaultPrice = "$199.00";
        const catLower = category.toLowerCase();
        if (catLower.includes('tile') || catLower.includes('floor')) {
          defaultPrice = "$5.99 / sq ft";
        } else if (catLower.includes('light') || catLower.includes('lamp')) {
          defaultPrice = "$129.00";
        } else if (catLower.includes('carpet') || catLower.includes('rug')) {
          defaultPrice = "$249.00";
        } else if (catLower.includes('door')) {
          defaultPrice = "$599.00";
        } else if (catLower.includes('window')) {
          defaultPrice = "$249.00";
        } else if (catLower.includes('wall') || catLower.includes('shelf') || catLower.includes('plant') || catLower.includes('panel') || catLower.includes('unit')) {
          defaultPrice = "$349.00";
        }

        result[category].push({
          name,
          filename: imageUrl.split('/').pop() || name,
          url: imageUrl,
          providerName: providerName || "Local Artisan",
          providerWebsite: productUrl || "https://example.com",
          price: price || defaultPrice
        });
      }
    } catch (err) {
      console.warn(`Failed to fetch tab "${category}" from Google Sheets:`, err.message);
    }
  }));

  return result;
}

export default async function handler(req, res) {
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

  const databaseDir = path.join(process.cwd(), 'database');
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (sheetId && sheetId !== 'your_google_sheet_id_here') {
    try {
      console.log(`Attempting to load assets from Google Sheet: ${sheetId}`);
      const sheetAssets = await fetchGoogleSheetAssets(sheetId, databaseDir);
      return res.json(sheetAssets);
    } catch (sheetError) {
      console.error("Failed to fetch assets from Google Sheets, falling back to local database:", sheetError.message);
    }
  }

  // Local fallback
  try {
    // Get all subdirectories in database/ except house_styles and category_templates
    const folders = fs.readdirSync(databaseDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory() && dirent.name !== 'house_styles' && dirent.name !== 'category_templates')
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
