import React, { useState } from 'react';

export default function ModuleExterior({ 
  floorPlanUrl, 
  generatedSvg, 
  apiBaseUrl, 
  isApiConfigured,
  constructionStyle,
  floorsCount,
  assets
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [activeLightboxImage, setActiveLightboxImage] = useState(null);
  const [activeProviderAsset, setActiveProviderAsset] = useState(null);

  const getAssetDetails = (filename, folderName) => {
    if (!assets || !assets[folderName]) {
      let defaultPrice = "$199.00";
      const folderLower = folderName.toLowerCase();
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
      }
      return {
        name: filename.replace(/_/g, ' ').replace(/\.[^/.]+$/, ""),
        url: `/database/${folderName}/${filename}`,
        providerName: "Local Artisan",
        providerWebsite: "https://example.com",
        price: defaultPrice
      };
    }

    const found = assets[folderName].find(item => item.filename === filename);
    return found || {
      name: filename.replace(/_/g, ' ').replace(/\.[^/.]+$/, ""),
      url: `/database/${folderName}/${filename}`,
      providerName: "Local Artisan",
      providerWebsite: "https://example.com",
      price: "$199.00"
    };
  };

  const getShoppableItems = (option) => {
    if (!option) return [];
    const items = [];
    
    // Paint
    if (option.paint) {
      items.push({
        name: option.paint.name,
        hex: option.paint.hex,
        providerName: option.paint.providerName,
        providerWebsite: option.paint.providerWebsite,
        price: option.paint.price,
        category: 'Wall Paint',
        isPaint: true
      });
    }
    
    if (option.selectedAssets) {
      Object.entries(option.selectedAssets).forEach(([folderName, files]) => {
        if (!files) return;
        const fileList = Array.isArray(files) ? files : [files];
        fileList.forEach(file => {
          const detail = getAssetDetails(file, folderName);
          let cat = 'Exterior Part';
          if (folderName.toLowerCase().includes('roof')) cat = 'Roof Tiles';
          else if (folderName.toLowerCase().includes('door')) cat = 'Front Door';
          else if (folderName.toLowerCase().includes('window')) cat = 'Window Frame';
          
          items.push({
            ...detail,
            category: cat,
            isPaint: false
          });
        });
      });
    }
    
    return items;
  };

  const calculateTotalPrice = (option) => {
    let total = 0;
    
    // Paint
    if (option.paint && option.paint.price) {
      const match = option.paint.price.match(/\$(\d+(\.\d+)?)/);
      if (match) total += parseFloat(match[1]) * 4; // 4 gallons
    }
    
    if (option.selectedAssets) {
      Object.entries(option.selectedAssets).forEach(([folderName, files]) => {
        if (!files) return;
        const fileList = Array.isArray(files) ? files : [files];
        fileList.forEach(file => {
          const asset = getAssetDetails(file, folderName);
          if (asset && asset.price) {
            const match = asset.price.match(/\$(\d+(\.\d+)?)/);
            if (match) {
              const val = parseFloat(match[1]);
              const folderLower = folderName.toLowerCase();
              if (folderLower.includes('tile') || folderLower.includes('roof')) {
                total += val * 350; // Roof tiles coverage multiplier
              } else if (folderLower.includes('window')) {
                total += val * 8; // 8 windows
              } else {
                total += val; // Single front door
              }
            }
          }
        });
      });
    }
    
    return total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleGenerateExterior = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const res = await fetch(`${apiBaseUrl}/api/generate-exterior`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blueprintUrl: floorPlanUrl,
          blueprintSvg: generatedSvg,
          style: constructionStyle || 'Modern Minimalist',
          floorsCount
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to generate exterior views.");
      }

      const data = await res.json();
      if (data.success) {
        setResult(data);
      }
    } catch (err) {
      alert("Error generating exterior: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const hasBlueprint = floorPlanUrl || generatedSvg;

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <h2 className="card-title" style={{ margin: 0 }}>
          <span>Module 2: Connected House Exterior</span>
        </h2>
        <p className="card-subtitle" style={{ margin: '0.5rem 0 0 0' }}>
          Generate two alternative photorealistic exterior views that strictly follow the levels, windows, and main layout structure of your blueprint.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '2rem' }}>
        {/* Left: Controls & Design Settings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Architectural Style (Blueprint Synced)</label>
            <input
              type="text"
              className="form-select"
              value={constructionStyle || "Modern Minimalist"}
              disabled={true}
              style={{ background: 'rgba(255,255,255,0.02)', cursor: 'not-allowed', color: 'var(--text-secondary)' }}
            />
          </div>

          <button
            className="btn btn-action"
            onClick={handleGenerateExterior}
            disabled={isLoading || !isApiConfigured || !hasBlueprint}
            style={{ width: '100%', height: '3rem' }}
          >
            {isLoading ? "Analyzing Blueprint..." : "Generate Exterior Facades"}
          </button>

          {!isApiConfigured && (
            <div className="info-box" style={{ margin: 0 }}>
              <strong>API Key Required:</strong> Please configure your <code>GEMINI_API_KEY</code> in the project's local <code>.env</code> file, then restart the server.
            </div>
          )}

          {!hasBlueprint && (
            <div className="info-box" style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#fca5a5', margin: 0 }}>
              <strong>Blueprint Required:</strong> You must create or upload a blueprint in <strong>Module 1</strong> before you can generate the exterior facade.
            </div>
          )}

          {result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Style Concept */}
              <div style={{ background: '#ffffff', padding: '1rem', border: '1px solid var(--card-border)', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.35rem', letterSpacing: '0.5px' }}>Style Concept</div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--secondary)', marginBottom: '0.25rem' }}>{result.design.title}</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>{result.design.description}</p>
              </div>

              {/* Blueprint Layout Mapping specs */}
              {result.design.detectedLayout && (
                <div style={{ background: 'rgba(37, 99, 235, 0.02)', padding: '1rem', border: '1px solid rgba(37, 99, 235, 0.08)', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--secondary)', fontWeight: 700, marginBottom: '0.65rem', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span>📐 Floor Plan Mapping</span>
                    <span style={{ fontSize: '0.65rem', padding: '0.05rem 0.35rem', background: 'rgba(37, 99, 235, 0.08)', color: 'var(--secondary)', borderRadius: '4px', textTransform: 'none', fontWeight: 500 }}>Blueprint Synced</span>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.03)', paddingBottom: '0.25rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Footprint:</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500, textAlign: 'right', maxWidth: '65%' }}>{result.design.detectedLayout.footprint}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.03)', paddingBottom: '0.25rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Structure:</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500, textAlign: 'right', maxWidth: '65%' }}>{result.design.detectedLayout.levels}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.03)', paddingBottom: '0.25rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Entrance:</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500, textAlign: 'right', maxWidth: '65%' }}>{result.design.detectedLayout.entranceLocation}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.03)', paddingBottom: '0.25rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Facade Windows:</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500, textAlign: 'right', maxWidth: '65%' }}>{result.design.detectedLayout.facadeWindows}</span>
                    </div>
                  </div>
                  
                  {result.design.detectedLayout.blueprintMatchDetails && (
                    <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(37, 99, 235, 0.08)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      <div style={{ fontWeight: 600, color: 'var(--secondary)', marginBottom: '0.25rem' }}>Facade Alignment Details:</div>
                      <div style={{ lineHeight: '1.45', background: 'rgba(0,0,0,0.015)', padding: '0.5rem', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.05)' }}>
                        {result.design.detectedLayout.blueprintMatchDetails}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Exterior Material Specs & Estimator */}
              <div style={{ background: '#ffffff', padding: '1rem', border: '1px solid var(--card-border)', borderRadius: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, margin: 0 }}>
                    Exterior Material Spec
                  </h3>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--secondary)' }}>
                    Total: ${calculateTotalPrice(result.design)}
                  </span>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '300px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                  {getShoppableItems(result.design).map((item, idx) => (
                    <div 
                      key={idx} 
                      style={{ 
                        display: 'flex', 
                        gap: '0.65rem', 
                        padding: '0.6rem', 
                        background: 'rgba(0,0,0,0.015)', 
                        border: '1px solid var(--card-border)', 
                        borderRadius: '8px', 
                        alignItems: 'center'
                      }}
                    >
                      {/* Thumbnail or Color Swatch */}
                      {item.isPaint ? (
                        <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%', backgroundColor: item.hex, border: '1px solid rgba(0,0,0,0.08)', flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '6px', background: '#f8fafc', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <img src={`${apiBaseUrl}${item.url}`} alt={item.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                        </div>
                      )}
                      
                      {/* Details */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h4 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>{item.name}</h4>
                        <div style={{ display: 'flex', gap: '0.25rem', margin: '0.15rem 0', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.65rem', padding: '0.05rem 0.3rem', borderRadius: '4px', background: 'rgba(0,0,0,0.03)', color: 'var(--text-secondary)' }}>
                            {item.category}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--secondary)' }}>
                          {item.price}
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'flex-end', flexShrink: 0 }}>
                        <a 
                          href={item.providerWebsite} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          style={{ fontSize: '0.75rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}
                        >
                          Buy ↗
                        </a>
                        <button 
                          onClick={() => setActiveProviderAsset(item)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer', padding: 0 }}
                        >
                          Info ⚙
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Render Showcase Panel */}
        <div style={{ position: 'relative', minHeight: '420px', border: '1px solid var(--card-border)', borderRadius: '12px', background: '#f8fafc', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          
          {/* Loading Overlay */}
          {isLoading && (
            <div className="loading-overlay">
              <div className="spinner"></div>
              <div className="loading-text" style={{ textAlign: 'center', maxWidth: '80%' }}>
                Analyzing blueprint layouts and drawing split-screen facades with Imagen 4...
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Generating front-right and back-left views of the same house (10-15s)...</div>
            </div>
          )}

          {/* Placeholder when not generated */}
          {!result && !isLoading && (
            <div className="image-placeholder">
              <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" height="2.5em" width="2.5em" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
              <div>Your photorealistic exterior views will appear here.</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>The AI will render two alternative angles of the same house in a split-screen sheet.</div>
            </div>
          )}

          {/* Generated Result View */}
          {result && !isLoading && (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: '1rem', boxSizing: 'border-box', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>📸 Left Panel: Front-Right Perspective View</span>
                  <span>Right Panel: Back-Left Perspective View 📸</span>
                </div>
                <div 
                  className="render-image-container" 
                  style={{ flex: 1, margin: 0, position: 'relative', overflow: 'hidden', minHeight: '300px' }}
                  onClick={() => setActiveLightboxImage(result.exteriorImage)}
                >
                  <img 
                    src={result.exteriorImage} 
                    alt="Consistent Exterior Views Split Screen" 
                    style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', background: '#0a0e1a' }} 
                  />
                  <div className="zoom-overlay">🔍 Click to View Fullscreen</div>
                </div>
              </div>

              {/* Regenerate Button */}
              <button
                className="btn btn-secondary"
                onClick={handleGenerateExterior}
                style={{
                  alignSelf: 'flex-end',
                  fontSize: '0.8rem',
                  padding: '0.4rem 0.8rem',
                  background: 'rgba(15, 23, 42, 0.85)',
                  backdropFilter: 'blur(4px)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  marginTop: '0.25rem'
                }}
              >
                Regenerate Facades ↺
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Provider Details Dialog Modal */}
      {activeProviderAsset && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(10, 14, 26, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            backdropFilter: 'blur(4px)'
          }}
        >
          <div className="glass-card" style={{ width: '400px', padding: '1.75rem', position: 'relative', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 1rem 0' }}>
              Material Specifications
            </h3>
            
            {activeProviderAsset.isPaint ? (
              <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div style={{ width: '4.5rem', height: '4.5rem', borderRadius: '50%', backgroundColor: activeProviderAsset.hex, border: '2px solid #ffffff', boxShadow: '0 4px 15px rgba(0,0,0,0.15)' }} />
                <div>
                  <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Paint Hex Code</div>
                  <code style={{ fontSize: '0.9rem', color: 'var(--secondary)', fontWeight: 600 }}>{activeProviderAsset.hex}</code>
                </div>
              </div>
            ) : (
              <div style={{ width: '100%', height: '180px', background: '#f8fafc', border: '1px solid var(--card-border)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: '1.25rem' }}>
                <img src={`${apiBaseUrl}${activeProviderAsset.url}`} alt={activeProviderAsset.name} style={{ maxWidth: '95%', maxHeight: '95%', objectFit: 'contain' }} />
              </div>
            )}
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Item Name:</span>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.15rem' }}>{activeProviderAsset.name}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Category:</span>
                <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{activeProviderAsset.category}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Brand / Provider:</span>
                <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{activeProviderAsset.providerName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Cost Estimate:</span>
                <span style={{ fontWeight: 700, color: 'var(--secondary)' }}>{activeProviderAsset.price}</span>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <a 
                href={activeProviderAsset.providerWebsite} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="btn btn-secondary" 
                style={{ flex: 1, textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                Visit Supplier Website ↗
              </a>
              <button 
                className="btn" 
                onClick={() => setActiveProviderAsset(null)}
                style={{ background: 'rgba(0,0,0,0.05)', color: 'var(--text-primary)' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox / Fullscreen Image Overlay */}
      {activeLightboxImage && (
        <div 
          onClick={() => setActiveLightboxImage(null)} 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(5, 7, 16, 0.95)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            cursor: 'zoom-out',
            backdropFilter: 'blur(8px)'
          }}
        >
          <img 
            src={activeLightboxImage} 
            alt="Fullscreen View" 
            style={{
              maxWidth: '90%',
              maxHeight: '90%',
              objectFit: 'contain',
              borderRadius: '8px',
              boxShadow: '0 0 50px rgba(0,0,0,0.8)',
              border: '1px solid rgba(255,255,255,0.1)'
            }} 
          />
          <button 
            onClick={() => setActiveLightboxImage(null)}
            style={{
              position: 'absolute',
              top: '2rem',
              right: '2rem',
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              color: '#fff',
              fontSize: '2rem',
              cursor: 'pointer',
              width: '3rem',
              height: '3rem',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            &times;
          </button>
        </div>
      )}
    </div>
  );
}
