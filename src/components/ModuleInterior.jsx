import React, { useState, useEffect } from 'react';

export default function ModuleInterior({ 
  activeRoom, 
  setActiveRoom,
  roomsList,
  floorPlanUrl,
  assets,
  apiBaseUrl,
  isApiConfigured,
  constructionStyle,
  exteriorResult
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [result, setResult] = useState(null);
  const [activeLightboxImage, setActiveLightboxImage] = useState(null);
  const [activeProviderAsset, setActiveProviderAsset] = useState(null);

  const [optionImages, setOptionImages] = useState({});
  const [optionActiveAngle, setOptionActiveAngle] = useState('initial');
  const [isAngleRendering, setIsAngleRendering] = useState(false);
  const [renderingAngleName, setRenderingAngleName] = useState(''); // e.g. 'Opposite Corner'

  // Persist room designs locally so switching rooms doesn't wipe them
  const [roomDesigns, setRoomDesigns] = useState({});

  // Set default active room if not set
  useEffect(() => {
    if (!activeRoom && roomsList && roomsList.length > 0) {
      setActiveRoom(roomsList[0].id);
    }
  }, [roomsList, activeRoom, setActiveRoom]);

  // Load/Restore previous results when switching active room
  useEffect(() => {
    const saved = roomDesigns[activeRoom];
    if (saved) {
      setResult(saved.result);
      setOptionImages(saved.optionImages || {});
      setOptionActiveAngle(saved.optionActiveAngle || 'initial');
    } else {
      setResult(null);
      setOptionImages({});
      setOptionActiveAngle('initial');
    }
  }, [activeRoom]);

  const handleSetOptionActiveAngle = (angleId) => {
    setOptionActiveAngle(angleId);
    setRoomDesigns(prev => {
      if (!prev[activeRoom]) return prev;
      return {
        ...prev,
        [activeRoom]: {
          ...prev[activeRoom],
          optionActiveAngle: angleId
        }
      };
    });
  };

  const cameraAngles = [
    { id: 'initial', label: 'Default', icon: '🏠' },
    { id: 'opposite', label: 'Opposite Corner', icon: '📸' },
    { id: 'closeup', label: 'Detail Close-up', icon: '🔍' },
    { id: 'side', label: 'Side Angle', icon: '📐' },
    { id: 'high', label: 'High Overview', icon: '🦅' }
  ];

  const handleRenderAngle = async (angleId, angleLabel) => {
    const optionData = result.design;
    setIsAngleRendering(true);
    setRenderingAngleName(angleLabel);

    try {
      const res = await fetch(`${apiBaseUrl}/api/generate-angle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomType: activeRoom,
          styleTitle: optionData.title,
          styleDescription: optionData.description,
          selectedAssets: optionData.selectedAssets,
          tileUsed: optionData.tileUsed,
          furnitureUsed: optionData.furnitureUsed,
          lightUsed: optionData.lightUsed,
          carpetUsed: optionData.carpetUsed,
          wallDecorUsed: optionData.wallDecorUsed,
          paint: optionData.paint,
          angle: angleLabel
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Angle generation failed.");
      }

      const data = await res.json();
      if (data.success && data.angleImage) {
        const updatedImages = {
          ...optionImages,
          [angleId]: data.angleImage
        };
        setOptionImages(updatedImages);
        setOptionActiveAngle(angleId);
        setRoomDesigns(prev => ({
          ...prev,
          [activeRoom]: {
            ...prev[activeRoom],
            optionImages: updatedImages,
            optionActiveAngle: angleId
          }
        }));
      }
    } catch (err) {
      alert("Error rendering angle: " + err.message);
    } finally {
      setIsAngleRendering(false);
      setRenderingAngleName('');
    }
  };

  const renderAngleBar = (activeAngle, setActiveAngle, imagesMap) => {
    return (
      <div 
        style={{ 
          display: 'flex', 
          gap: '0.35rem', 
          overflowX: 'auto', 
          paddingBottom: '0.5rem', 
          marginBottom: '0.75rem', 
          borderBottom: '1px solid var(--card-border)' 
        }}
      >
        {cameraAngles.map(angle => {
          const isSelected = activeAngle === angle.id;
          const isRendered = !!imagesMap[angle.id];
          return (
            <button
              key={angle.id}
              onClick={() => setActiveAngle(angle.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.35rem 0.65rem',
                fontSize: '0.8rem',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: isSelected ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                background: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255,255,255,0.02)',
                color: isSelected ? 'var(--primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                fontWeight: isSelected ? 600 : 400,
                transition: 'all 0.2s ease'
              }}
            >
              <span>{angle.icon}</span>
              <span>{angle.label}</span>
              {isRendered && angle.id !== 'initial' && (
                <span style={{ color: 'var(--secondary)', marginLeft: '2px', fontSize: '0.75rem' }}>●</span>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  const handleGenerate = async () => {
    if (!activeRoom) return;
    setIsLoading(true);
    setLoadingStep(`Analyzing local database assets for ${activeRoom} design...`);
    setResult(null);

    try {
      const res = await fetch(`${apiBaseUrl}/api/generate-design`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          roomType: activeRoom, 
          floorPlanUrl,
          constructionStyle,
          exteriorDesign: exteriorResult ? exteriorResult.design : null
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Generation failed.");
      }

      setLoadingStep("Generating photorealistic room renders with Imagen 4...");
      const data = await res.json();
      
      if (data.success) {
        setResult(data);
        setOptionImages({ initial: data.interiorImage });
        setOptionActiveAngle('initial');
        setRoomDesigns(prev => ({
          ...prev,
          [activeRoom]: {
            result: data,
            optionImages: { initial: data.interiorImage },
            optionActiveAngle: 'initial'
          }
        }));
      }
    } catch (err) {
      alert("Design generation error: " + err.message);
    } finally {
      setIsLoading(false);
      setLoadingStep("");
    }
  };

  const getAssetDetails = (filename, type) => {
    const list = assets[type] || [];
    const found = list.find(a => a.filename === filename);
    if (found) return found;

    let defaultPrice = "$199.00";
    const typeLower = type.toLowerCase();
    if (typeLower.includes('tile') || typeLower.includes('floor')) {
      defaultPrice = "$5.99 / sq ft";
    } else if (typeLower.includes('light') || typeLower.includes('lamp') || typeLower.includes('lighting')) {
      defaultPrice = "$129.00";
    } else if (typeLower.includes('carpet') || typeLower.includes('rug')) {
      defaultPrice = "$249.00";
    } else if (typeLower.includes('wall') || typeLower.includes('shelf') || typeLower.includes('plant') || typeLower.includes('panel') || typeLower.includes('unit') || typeLower.includes('decor')) {
      defaultPrice = "$349.00";
    }

    return {
      name: filename.replace(/_/g, ' ').replace(/\.[^/.]+$/, ""),
      url: `/database/${type}/${filename}`,
      providerName: "Local Artisan",
      providerWebsite: "https://example.com",
      price: defaultPrice
    };
  };

  const getShoppableItems = (option) => {
    const items = [];
    
    // Wall Paint is a special color swatch item
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
          const asset = getAssetDetails(file, folderName);
          const formattedCategory = folderName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          items.push({
            ...asset,
            category: formattedCategory,
            isPaint: false
          });
        });
      });
    } else {
      // Fallback for legacy data
      if (option.tileUsed) {
        items.push({
          ...getAssetDetails(option.tileUsed, 'tiles'),
          category: 'Flooring Tile',
          isPaint: false
        });
      }
      if (option.furnitureUsed) {
        option.furnitureUsed.forEach(f => {
          items.push({
            ...getAssetDetails(f, 'furniture'),
            category: 'Furniture',
            isPaint: false
          });
        });
      }
      if (option.lightUsed) {
        items.push({
          ...getAssetDetails(option.lightUsed, 'lighting'),
          category: 'Lighting',
          isPaint: false
        });
      }
      if (option.carpetUsed) {
        items.push({
          ...getAssetDetails(option.carpetUsed, 'carpets'),
          category: 'Carpet/Rug',
          isPaint: false
        });
      }
      if (option.wallDecorUsed) {
        const list = Array.isArray(option.wallDecorUsed) ? option.wallDecorUsed : [option.wallDecorUsed];
        list.forEach(wdFile => {
          items.push({
            ...getAssetDetails(wdFile, 'wall_decor'),
            category: 'Wall Decor',
            isPaint: false
          });
        });
      }
    }
    
    return items;
  };

  const calculateTotalPrice = (option) => {
    let total = 0;
    
    // Paint
    if (option.paint && option.paint.price) {
      const match = option.paint.price.match(/\$(\d+(\.\d+)?)/);
      if (match) total += parseFloat(match[1]);
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
              if (folderLower.includes('tile') || folderLower.includes('floor')) {
                total += val * 150; // Tile coverage multiplier
              } else {
                total += val;
              }
            }
          }
        });
      });
    } else {
      // Fallback for legacy data
      if (option.tileUsed) {
        const tile = getAssetDetails(option.tileUsed, 'tiles');
        if (tile && tile.price) {
          const match = tile.price.match(/\$(\d+(\.\d+)?)/);
          if (match) total += parseFloat(match[1]) * 150;
        }
      }
      if (option.furnitureUsed) {
        option.furnitureUsed.forEach(f => {
          const furn = getAssetDetails(f, 'furniture');
          if (furn && furn.price) {
            const match = furn.price.match(/\$(\d+(\.\d+)?)/);
            if (match) total += parseFloat(match[1]);
          }
        });
      }
      if (option.lightUsed) {
        const light = getAssetDetails(option.lightUsed, 'lighting');
        if (light && light.price) {
          const match = light.price.match(/\$(\d+(\.\d+)?)/);
          if (match) total += parseFloat(match[1]);
        }
      }
      if (option.carpetUsed) {
        const carpet = getAssetDetails(option.carpetUsed, 'carpets');
        if (carpet && carpet.price) {
          const match = carpet.price.match(/\$(\d+(\.\d+)?)/);
          if (match) total += parseFloat(match[1]);
        }
      }
      if (option.wallDecorUsed) {
        const list = Array.isArray(option.wallDecorUsed) ? option.wallDecorUsed : [option.wallDecorUsed];
        list.forEach(wdFile => {
          const wd = getAssetDetails(wdFile, 'wall_decor');
          if (wd && wd.price) {
            const match = wd.price.match(/\$(\d+(\.\d+)?)/);
            if (match) total += parseFloat(match[1]);
          }
        });
      }
    }
    
    return total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="glass-card" style={{ flex: 2 }}>
      <div>
        <h2 className="card-title" style={{ margin: 0, fontSize: '1.4rem' }}>
          <span>Module 3: Room Interior Designer</span>
        </h2>
        <p className="card-subtitle" style={{ margin: '0.5rem 0 0 0', fontSize: '0.95rem' }}>
          Select matching flooring tiles, custom furniture, and paint schemes dynamically utilizing AI-driven design styles.
        </p>
      </div>

      {/* Warning Box if no blueprint has been created yet */}
      {(!roomsList || roomsList.length === 0) && (
        <div className="info-box" style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#fca5a5', marginTop: '1.5rem', padding: '1.5rem', textAlign: 'center', fontSize: '0.95rem' }}>
          <strong>Blueprint Required:</strong> Please go to the <strong>Module 1: Blueprint Design</strong> tab and generate or upload a blueprint to populate the list of designable rooms.
        </div>
      )}

      {roomsList && roomsList.length > 0 && activeRoom && (
        <div style={{ marginTop: '1.5rem' }}>
          {/* Active room and room selection dropdown bar */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr auto', gap: '1.5rem', alignItems: 'center', marginBottom: '1.5rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', border: '1px solid var(--card-border)', borderRadius: '12px' }}>
            <div>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Active Customization:</span>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeRoom} Interior</h3>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem', display: 'block' }}>Select Room to Design</label>
              <select
                className="form-select"
                value={activeRoom}
                onChange={(e) => setActiveRoom(e.target.value)}
                style={{ height: '2.5rem', padding: '0.35rem 0.5rem', fontSize: '0.85rem' }}
              >
                {roomsList.map(room => (
                  <option key={room.id} value={room.id}>{room.id} ({room.size})</option>
                ))}
              </select>
            </div>
            
            <button 
              className="btn btn-action" 
              onClick={handleGenerate}
              disabled={isLoading || !isApiConfigured}
              style={{ height: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 1.5rem', fontSize: '0.9rem', alignSelf: 'end' }}
            >
              {isLoading ? "Designing..." : `Design & Render`}
            </button>
          </div>

          {!isApiConfigured && (
            <div className="info-box" style={{ marginBottom: '1.5rem', fontSize: '0.95rem' }}>
              <strong>API Key Required:</strong> Please configure your <code>GEMINI_API_KEY</code> in the project's local <code>.env</code> file, then restart the server.
            </div>
          )}

          {/* Renders Section */}
          <div style={{ position: 'relative', minHeight: '380px', border: '1px solid var(--card-border)', borderRadius: '12px', background: '#f8fafc', overflow: 'hidden', padding: result ? '1.5rem' : 0 }}>
            
            {/* Loading Overlay */}
            {isLoading && (
              <div className="loading-overlay">
                <div className="spinner"></div>
                <div className="loading-text" style={{ textAlign: 'center', maxWidth: '80%', fontSize: '1.05rem' }}>
                  {loadingStep}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>This can take 15-25 seconds...</div>
              </div>
            )}

            {/* Placeholder if no design generated yet */}
            {!result && !isLoading && (
              <div className="image-placeholder" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '100%', fontSize: '1rem' }}>
                <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" height="3em" width="3em" xmlns="http://www.w3.org/2000/svg">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
                <div style={{ fontWeight: 500 }}>Your photorealistic interior rendering for the {activeRoom} will appear here.</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Click "Design & Render" to let the AI formulate layout ideas.</div>
              </div>
            )}

            {/* Result Showcase */}
            {result && !isLoading && (
              <div>
                {/* Renders header with Regenerate button */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.75rem' }}>
                  <h3 style={{ fontSize: '1.45rem', fontFamily: 'var(--font-display)', color: 'var(--text-primary)', margin: 0, fontWeight: 700 }}>
                    Design Concept: {result.design.title}
                  </h3>
                  <button 
                    className="btn btn-secondary" 
                    onClick={handleGenerate} 
                    disabled={isLoading}
                    style={{ fontSize: '0.9rem', padding: '0.45rem 1rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    Regenerate Room ↺
                  </button>
                </div>

                <div className="single-render-layout">
                  
                  {/* Left Column: Image Display */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    
                    {/* Camera Angle Bar hidden - only generating the high overview view */}

                    <div 
                      className="render-image-container" 
                      style={{ cursor: optionImages[optionActiveAngle] ? 'zoom-in' : 'default', width: '100%', height: '600px' }}
                    >
                      {optionImages[optionActiveAngle] ? (
                        <>
                          <img 
                            src={optionImages[optionActiveAngle]} 
                            alt="Interior Render" 
                            className="render-image" 
                            onClick={() => setActiveLightboxImage(optionImages[optionActiveAngle])}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          <div className="zoom-overlay">🔍 Click to Expand</div>
                        </>
                      ) : isAngleRendering && renderingAngleName === cameraAngles.find(a => a.id === optionActiveAngle)?.label ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', padding: '2rem' }}>
                          <div className="spinner"></div>
                          <div style={{ fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 600 }}>Rendering {renderingAngleName}...</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Positioning camera and rendering with Imagen 4...</div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', justifyContent: 'center', padding: '2rem', textAlign: 'center', width: '100%' }}>
                          <span style={{ fontSize: '2.5rem' }}>📷</span>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            This perspective has not been generated yet.
                          </div>
                          <button
                            className="btn btn-primary"
                            onClick={() => handleRenderAngle(optionActiveAngle, cameraAngles.find(a => a.id === optionActiveAngle).label)}
                            style={{ padding: '0.5rem 1.25rem', fontSize: '0.8rem' }}
                          >
                            Render {cameraAngles.find(a => a.id === optionActiveAngle).label} View
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Info & Shoppable items list */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div>
                      <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--primary)', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '0.5rem' }}>Style Description</h4>
                      <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                        {result.design.description}
                      </p>
                    </div>

                    <div className="used-assets-section">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Used Materials & Staging</span>
                        <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--secondary)' }}>
                          Total: ${calculateTotalPrice(result.design)}
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '380px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                        {getShoppableItems(result.design).map((item, idx) => (
                          <div 
                            key={idx} 
                            style={{ 
                              display: 'flex', 
                              gap: '0.85rem', 
                              padding: '0.75rem', 
                              background: '#ffffff', 
                              border: '1px solid var(--card-border)', 
                              borderRadius: '12px', 
                              alignItems: 'center'
                            }}
                          >
                            {/* Thumbnail or Color Swatch */}
                            {item.isPaint ? (
                              <div style={{ width: '3.25rem', height: '3.25rem', borderRadius: '50%', backgroundColor: item.hex, border: '1px solid rgba(0,0,0,0.08)', flexShrink: 0 }} />
                            ) : (
                              <div style={{ width: '3.25rem', height: '3.25rem', borderRadius: '8px', background: '#f8fafc', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <img src={`${apiBaseUrl}${item.url}`} alt={item.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                              </div>
                            )}
                            
                            {/* Details */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>{item.name}</h4>
                              <div style={{ display: 'flex', gap: '0.35rem', margin: '0.2rem 0', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.7rem', padding: '0.05rem 0.4rem', borderRadius: '4px', background: 'rgba(0,0,0,0.03)', color: 'var(--text-secondary)' }}>
                                  {item.category}
                                </span>
                                <span style={{ fontSize: '0.7rem', padding: '0.05rem 0.4rem', borderRadius: '4px', background: 'rgba(0,0,0,0.02)', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                  {item.providerName}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--secondary)' }}>
                                {item.price}
                              </div>
                            </div>
                            
                            {/* Actions */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'flex-end', flexShrink: 0 }}>
                              <a 
                                href={item.providerWebsite} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                style={{ fontSize: '0.8rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}
                              >
                                Buy Now ↗
                              </a>
                              <button 
                                onClick={() => setActiveProviderAsset(item)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer', padding: 0 }}
                              >
                                Details ⚙
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

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
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
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
              boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
              border: '1px solid rgba(0,0,0,0.1)'
            }} 
          />
          <button 
            onClick={() => setActiveLightboxImage(null)}
            style={{
              position: 'absolute',
              top: '2rem',
              right: '2rem',
              background: 'rgba(0,0,0,0.05)',
              border: 'none',
              color: '#0f172a',
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

      {/* Provider Details Modal */}
      {activeProviderAsset && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            backdropFilter: 'blur(6px)'
          }}
        >
          <div 
            className="glass-card" 
            style={{
              width: '400px',
              maxWidth: '90%',
              padding: '2rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              boxShadow: '0 20px 50px rgba(0,0,0,0.1)',
              border: '1px solid var(--card-border)',
              background: '#ffffff'
            }}
          >
            <div className="card-title" style={{ marginBottom: 0, fontSize: '1.2rem' }}>
              <span>Material Details</span>
              <button 
                onClick={() => setActiveProviderAsset(null)} 
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>
            
            {activeProviderAsset.isPaint ? (
              <div style={{ aspectRatio: '4/3', width: '100%', background: activeProviderAsset.hex, borderRadius: '8px', border: '1px solid var(--card-border)' }} />
            ) : (
              <div style={{ aspectRatio: '4/3', width: '100%', background: '#f8fafc', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={`${apiBaseUrl}${activeProviderAsset.url}`} alt={activeProviderAsset.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              </div>
            )}

            <div>
              <h4 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{activeProviderAsset.name}</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Selected in room design</p>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.015)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.25rem' }}>Supplier / Provider</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '0.5rem' }}>{activeProviderAsset.providerName}</div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.25rem' }}>Price</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--secondary)', marginBottom: '0.5rem' }}>{activeProviderAsset.price}</div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.25rem' }}>Website</div>
              <a 
                href={activeProviderAsset.providerWebsite} 
                target="_blank" 
                rel="noopener noreferrer" 
                style={{ fontSize: '0.85rem', color: 'var(--secondary)', textDecoration: 'underline', wordBreak: 'break-all' }}
              >
                {activeProviderAsset.providerWebsite}
              </a>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <a 
                href={activeProviderAsset.providerWebsite} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="btn btn-primary" 
                style={{ flex: 1, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                Visit Website
              </a>
              <button 
                className="btn btn-secondary" 
                onClick={() => setActiveProviderAsset(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
