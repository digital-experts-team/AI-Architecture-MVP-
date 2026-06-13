import React, { useState, useRef, useEffect } from 'react';

export default function DatabasePanel({ assets, fetchAssets, apiBaseUrl }) {
  const [activeTab, setActiveTab] = useState('tiles');
  const [isUploading, setIsUploading] = useState(false);
  const [providerName, setProviderName] = useState('');
  const [providerWebsite, setProviderWebsite] = useState('');
  const [price, setPrice] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const fileInputRef = useRef(null);

  const folderNames = Object.keys(assets);

  // Keep activeTab synced with available folders
  useEffect(() => {
    if (folderNames.length > 0 && !folderNames.includes(activeTab)) {
      setActiveTab(folderNames.includes('tiles') ? 'tiles' : folderNames[0]);
    }
  }, [assets]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setIsCreatingFolder(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/create-folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to create category.");
      }

      const data = await res.json();
      if (data.success) {
        setNewFolderName('');
        await fetchAssets();
        setActiveTab(data.folderName);
      }
    } catch (err) {
      alert("Failed to create category folder: " + err.message);
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('image', file);
    formData.append('type', activeTab);
    formData.append('providerName', providerName || "Local Artisan");
    formData.append('providerWebsite', providerWebsite || "https://example.com");
    
    let defaultPrice = "$199.00";
    const tabLower = activeTab.toLowerCase();
    if (tabLower.includes('tile') || tabLower.includes('floor')) {
      defaultPrice = "$5.99 / sq ft";
    } else if (tabLower.includes('light') || tabLower.includes('lamp') || tabLower.includes('lighting')) {
      defaultPrice = "$129.00";
    } else if (tabLower.includes('carpet') || tabLower.includes('rug')) {
      defaultPrice = "$249.00";
    } else if (tabLower.includes('wall') || tabLower.includes('shelf') || tabLower.includes('plant') || tabLower.includes('panel') || tabLower.includes('unit') || tabLower.includes('decor')) {
      defaultPrice = "$349.00";
    }
    
    formData.append('price', price || defaultPrice);

    try {
      const res = await fetch(`${apiBaseUrl}/api/upload-asset`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to upload asset.");
      }

      const data = await res.json();
      if (data.success) {
        setProviderName('');
        setProviderWebsite('');
        setPrice('');
        await fetchAssets();
      }
    } catch (err) {
      alert("Upload failed: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const triggerUpload = () => {
    fileInputRef.current.click();
  };

  const activeAssets = assets[activeTab] || [];

  return (
    <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div className="card-title">
        <span>Asset Database</span>
      </div>
      <p className="card-subtitle" style={{ marginBottom: '0.75rem' }}>
        Your local collection of material textures and furniture assets used by the AI.
      </p>

      {/* Create Dynamic Folder UI */}
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem' }}>
        <input 
          type="text" 
          placeholder="New Category Name (e.g. Cushions)" 
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          className="form-input"
          style={{ fontSize: '0.75rem', padding: '0.45rem', flex: 1 }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); }}
        />
        <button 
          className="btn btn-action" 
          onClick={handleCreateFolder}
          disabled={isCreatingFolder || !newFolderName.trim()}
          style={{ fontSize: '0.72rem', padding: '0 0.6rem', height: 'auto', whiteSpace: 'nowrap' }}
        >
          {isCreatingFolder ? "Creating..." : "+ Add"}
        </button>
      </div>

      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.01)', padding: '0.5rem 0.75rem', border: '1px solid var(--card-border)', borderRadius: '8px', marginBottom: '1rem', lineHeight: '1.4' }}>
        💡 Select a category tab below to view and add assets. Create custom folders to separate your images.
      </div>

      {/* Tabs */}
      <div className="tab-headers" style={{ flexWrap: 'wrap', gap: '0.25rem', maxHeight: '180px', overflowY: 'auto', paddingBottom: '0.25rem' }}>
        {folderNames.map(folderName => {
          const count = assets[folderName]?.length || 0;
          const label = folderName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          return (
            <button 
              key={folderName}
              className={`tab-btn ${activeTab === folderName ? 'active' : ''}`}
              onClick={() => setActiveTab(folderName)}
              style={{ fontSize: '0.72rem', padding: '0.4rem 0.45rem' }}
            >
              {label} ({count})
            </button>
          );
        })}
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        accept="image/*" 
        style={{ display: 'none' }} 
      />

      {/* Asset Grid */}
      <div className="asset-grid" style={{ flex: 1, marginTop: '0.75rem' }}>
        {activeAssets.map((asset, idx) => (
          <div key={idx} className="asset-card">
            <div className="asset-thumb-container">
              <img src={`${apiBaseUrl}${asset.url}`} alt={asset.name} className="asset-thumb" />
            </div>
            <div className="asset-name" title={asset.name}>{asset.name}</div>
          </div>
        ))}
        {activeAssets.length === 0 && (
          <div style={{ gridColumn: 'span 2', textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No assets found in this folder.
          </div>
        )}
      </div>

      {/* Upload metadata form */}
      <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(0,0,0,0.15)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '0.25rem' }}>Upload Provider Details (Optional)</div>
        <input 
          type="text" 
          placeholder="Provider Name (e.g. Tile World)" 
          value={providerName} 
          onChange={(e) => setProviderName(e.target.value)}
          className="form-input"
          style={{ fontSize: '0.8rem', padding: '0.45rem' }}
        />
        <input 
          type="text" 
          placeholder="Website URL (e.g. https://example.com)" 
          value={providerWebsite} 
          onChange={(e) => setProviderWebsite(e.target.value)}
          className="form-input"
          style={{ fontSize: '0.8rem', padding: '0.45rem' }}
        />
        <input 
          type="text" 
          placeholder={`Price (e.g. $45.00 or $5.99 / sq ft)`} 
          value={price} 
          onChange={(e) => setPrice(e.target.value)}
          className="form-input"
          style={{ fontSize: '0.8rem', padding: '0.45rem' }}
        />
      </div>

      {/* Add asset button */}
      <button 
        className="btn btn-secondary upload-asset-btn" 
        onClick={triggerUpload}
        disabled={isUploading || !activeTab}
        style={{ marginTop: '0.75rem' }}
      >
        {isUploading ? "Uploading..." : `Add Custom ${activeTab.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`}
      </button>
    </div>
  );
}
