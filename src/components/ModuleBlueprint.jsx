import React, { useState, useRef, useEffect } from 'react';

export default function ModuleBlueprint({ 
  floorPlanUrl, 
  setFloorPlanUrl, 
  generatedSvg, 
  setGeneratedSvg, 
  activeRoom, 
  setActiveRoom, 
  setActiveTab, 
  apiBaseUrl,
  roomsList,
  setRoomsList,
  constructionStyle,
  setConstructionStyle,
  floorsCount,
  setFloorsCount
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const fileInputRef = useRef(null);
  const hasBlueprint = !!(floorPlanUrl || generatedSvg);

  // Layout customization states
  const [includeLiving, setIncludeLiving] = useState(true);
  const [includePrayer, setIncludePrayer] = useState(false);
  const [includeDining, setIncludeDining] = useState(true);
  const [includeCarPorch, setIncludeCarPorch] = useState(false);
  const [bedroomsCount, setBedroomsCount] = useState(2);
  const [bathroomsCount, setBathroomsCount] = useState(1);

  const stylesList = [
    'Modern Minimalist',
    'Scandinavian Timber',
    'Mid-Century Modern',
    'Industrial Concrete',
    'Cozy Stone Cottage',
    'Kerala Traditional'
  ];

  // Helper to synchronize structural room menu selections floor-wise
  const syncRoomsList = (opts) => {
    const newList = [];
    const floors = parseInt(floorsCount) || 1;

    // Ground Floor Common Rooms
    if (opts.livingRoom) newList.push({ id: 'Living Room (GF)', icon: '🛋️', size: '5.0m x 4.0m' });
    if (opts.prayerRoom) newList.push({ id: 'Prayer Room (GF) 🙏', icon: '🙏', size: '2.5m x 2.0m' });
    if (opts.diningRoom) newList.push({ id: 'Dining Room (GF)', icon: '🍽️', size: '4.0m x 3.5m' });
    if (opts.carPorch) newList.push({ id: 'Car Porch (GF) 🚗', icon: '🚗', size: '5.5m x 3.0m' });
    newList.push({ id: 'Kitchen (GF)', icon: '🍳', size: '3.5m x 3.0m' }); // Always GF Kitchen

    // Distribute Bedrooms and Bathrooms floor-wise
    if (opts.bedroomsCount > 0) {
      for (let i = 1; i <= opts.bedroomsCount; i++) {
        let floorLabel = "GF";
        if (floors === 2) {
          floorLabel = i === 1 ? "GF" : "FF";
        } else if (floors === 3) {
          floorLabel = i === 1 ? "GF" : (i === 2 ? "FF" : "SF");
        }
        newList.push({ id: `Bedroom ${i} (${floorLabel})`, icon: '🛏️', size: '4.0m x 3.5m' });
        
        // Attached Bathroom corresponding to this Bedroom (en-suite constraint)
        if (i <= opts.bathroomsCount) {
          newList.push({ id: `Bathroom ${i} (Attached - ${floorLabel})`, icon: '🛁', size: '2.5m x 2.0m' });
        }
      }
      
      // If there are more bathrooms than bedrooms, add them as general bathrooms on GF
      if (opts.bathroomsCount > opts.bedroomsCount) {
        for (let i = opts.bedroomsCount + 1; i <= opts.bathroomsCount; i++) {
          newList.push({ id: `Bathroom ${i} (GF)`, icon: '🛁', size: '2.5m x 2.0m' });
        }
      }
    } else {
      for (let i = 1; i <= opts.bathroomsCount; i++) {
        newList.push({ id: `Bathroom ${i} (GF)`, icon: '🛁', size: '2.5m x 2.0m' });
      }
    }

    setRoomsList(newList);
    if (newList.length > 0 && !newList.some(r => r.id === activeRoom)) {
      setActiveRoom(newList[0].id);
    }
  };

  // Sync rooms list automatically as form options or floors change
  useEffect(() => {
    syncRoomsList({
      livingRoom: includeLiving,
      prayerRoom: includePrayer,
      diningRoom: includeDining,
      carPorch: includeCarPorch,
      bedroomsCount,
      bathroomsCount
    });
  }, [includeLiving, includePrayer, includeDining, includeCarPorch, bedroomsCount, bathroomsCount, floorsCount]);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setGeneratedSvg(null); // Clear SVG if uploading image
    const formData = new FormData();
    formData.append('floorplan', file);

    try {
      const res = await fetch(`${apiBaseUrl}/api/upload-floorplan`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Failed to upload blueprint.");
      }

      const data = await res.json();
      if (data.success) {
        setFloorPlanUrl(data.url);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleGenerateLayout = async () => {
    setIsGenerating(true);
    setFloorPlanUrl(null); // Clear image if generating SVG
    
    try {
      const res = await fetch(`${apiBaseUrl}/api/generate-floorplan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          style: constructionStyle,
          floorsCount: floorsCount,
          rooms: {
            livingRoom: includeLiving,
            prayerRoom: includePrayer,
            diningRoom: includeDining,
            carPorch: includeCarPorch,
            bedroomsCount: bedroomsCount,
            bathroomsCount: bathroomsCount
          }
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to generate floor plan.");
      }

      const data = await res.json();
      if (data.svg) {
        setGeneratedSvg(data.svg);
      }
    } catch (err) {
      alert("Error generating floor plan: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <h2 className="card-title" style={{ margin: 0 }}>
          <span>Module 1: Blueprint Design & Setup</span>
        </h2>
        <p className="card-subtitle" style={{ margin: '0.5rem 0 0 0' }}>
          Configure layout rooms, style, and floors, then auto-generate a blueprint or upload your own floor plan drawing.
        </p>
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/*" 
        style={{ display: 'none' }} 
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 0.75fr', gap: '1.5rem' }}>
        {/* Left: View Panel */}
        <div style={{ position: 'relative', minHeight: '460px', border: '1px solid var(--card-border)', borderRadius: '12px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {isUploading && (
            <div className="loading-overlay">
              <div className="spinner"></div>
              <div className="loading-text">Uploading blueprint image...</div>
            </div>
          )}

          {isGenerating && (
            <div className="loading-overlay">
              <div className="spinner"></div>
              <div className="loading-text" style={{ textAlign: 'center' }}>
                Designing custom {floorsCount}-floor layout...<br />
                <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>Generating custom rooms and en-suite baths (10-15s)</span>
              </div>
            </div>
          )}

          {!floorPlanUrl && !generatedSvg && !isUploading && !isGenerating && (
            <div className="floorplan-dropzone" onClick={triggerFileInput} style={{ width: '80%', border: 'none', background: 'transparent' }}>
              <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" height="2.5em" width="2.5em" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              <div style={{ fontWeight: 600, fontSize: '1rem', marginTop: '0.5rem' }}>Upload House Plan / Survey</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Supports PNG, JPG, JPEG</div>
            </div>
          )}

          {floorPlanUrl && (
            <img src={`${apiBaseUrl}${floorPlanUrl}`} alt="Blueprint layout" style={{ maxWidth: '95%', maxHeight: '95%', objectFit: 'contain' }} />
          )}

          {generatedSvg && (
            <div 
              className="svg-container" 
              style={{ width: '95%', height: '95%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              dangerouslySetInnerHTML={{ __html: generatedSvg }} 
            />
          )}

          {(floorPlanUrl || generatedSvg) && (
            <button 
              className="btn btn-secondary" 
              onClick={() => { setFloorPlanUrl(null); setGeneratedSvg(null); }}
              style={{ 
                position: 'absolute', 
                bottom: '0.75rem', 
                right: '0.75rem', 
                fontSize: '0.75rem', 
                padding: '0.25rem 0.5rem',
                background: 'rgba(15, 23, 42, 0.85)',
                backdropFilter: 'blur(4px)'
              }}
            >
              Clear Layout
            </button>
          )}
        </div>

        {/* Right: Controls & Detected Rooms */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* Blueprint Parameter Inputs */}
          <div style={{ background: '#ffffff', border: '1px solid var(--card-border)', padding: '0.85rem 1rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, margin: 0, borderBottom: '1px solid var(--card-border)', paddingBottom: '0.35rem' }}>
              Blueprint Design Customizer
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '0.5rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Construction Style</label>
                <select
                  className="form-select"
                  value={constructionStyle}
                  onChange={(e) => setConstructionStyle(e.target.value)}
                  style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}
                >
                  {stylesList.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Floors</label>
                <select
                  className="form-select"
                  value={floorsCount}
                  onChange={(e) => setFloorsCount(parseInt(e.target.value) || 1)}
                  style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}
                >
                  <option value={1}>1 Floor</option>
                  <option value={2}>2 Floors</option>
                  <option value={3}>3 Floors</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.1rem' }}>Rooms to Include</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
                  <input type="checkbox" checked={includeLiving} onChange={(e) => setIncludeLiving(e.target.checked)} />
                  Living Room
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
                  <input type="checkbox" checked={includePrayer} onChange={(e) => setIncludePrayer(e.target.checked)} />
                  Prayer Room 🙏
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
                  <input type="checkbox" checked={includeDining} onChange={(e) => setIncludeDining(e.target.checked)} />
                  Dining Room
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
                  <input type="checkbox" checked={includeCarPorch} onChange={(e) => setIncludeCarPorch(e.target.checked)} />
                  Car Porch 🚗
                </label>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Bedrooms</label>
                <input 
                  type="number" min="0" max="4"
                  value={bedroomsCount}
                  onChange={(e) => setBedroomsCount(parseInt(e.target.value) || 0)}
                  className="form-select"
                  style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Bathrooms</label>
                <input 
                  type="number" min="0" max="4"
                  value={bathroomsCount}
                  onChange={(e) => setBathroomsCount(parseInt(e.target.value) || 0)}
                  className="form-select"
                  style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                />
              </div>
            </div>

            <button 
              className="btn btn-secondary" 
              onClick={handleGenerateLayout}
              disabled={isGenerating || isUploading}
              style={{ width: '100%', fontSize: '0.75rem', padding: '0.45rem', marginTop: '0.15rem' }}
            >
              {isGenerating ? "Designing..." : "Generate AI Blueprint ⚡"}
            </button>
          </div>

          {/* Design Room Selector Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', flex: 1 }}>
            <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, borderBottom: '1px solid var(--card-border)', paddingBottom: '0.35rem', margin: 0 }}>
              Select Room to Design
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', overflowY: 'auto', maxHeight: '180px', paddingRight: '0.25rem' }}>
              {roomsList.map((room) => {
                const isSelected = activeRoom === room.id;
                
                return (
                  <button
                    key={room.id}
                    onClick={() => { if (hasBlueprint) setActiveRoom(room.id); }}
                    disabled={!hasBlueprint}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.65rem',
                      padding: '0.55rem 0.75rem',
                      background: isSelected ? 'rgba(37, 99, 235, 0.06)' : 'rgba(0, 0, 0, 0.01)',
                      border: '1px solid',
                      borderColor: isSelected ? 'var(--secondary)' : 'var(--card-border)',
                      borderRadius: '8px',
                      cursor: hasBlueprint ? 'pointer' : 'not-allowed',
                      textAlign: 'left',
                      opacity: hasBlueprint ? 1 : 0.45,
                      transition: 'all 0.2s ease',
                      width: '100%'
                    }}
                  >
                    <span style={{ fontSize: '1.05rem' }}>{room.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: isSelected ? 'var(--secondary)' : 'var(--text-primary)' }}>{room.id}</div>
                      <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Dimensions: {room.size}</div>
                    </div>
                    {isSelected && (
                      <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--secondary)', boxShadow: '0 0 5px var(--secondary-glow)' }}></div>
                    )}
                  </button>
                );
              })}

              {!hasBlueprint && (
                <div style={{ fontSize: '0.75rem', color: '#fda4af', padding: '0.5rem', background: 'rgba(244, 63, 94, 0.08)', borderRadius: '8px', border: '1px solid rgba(244, 63, 94, 0.25)', textAlign: 'center' }}>
                  ⚠️ Generate or upload a blueprint to customize interior rooms.
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn btn-action"
              disabled={!hasBlueprint}
              onClick={() => setActiveTab('exterior')}
              style={{ 
                flex: 1,
                padding: '0.75rem 0.5rem', 
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
                color: '#fff', 
                fontSize: '0.8rem',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
              }}
            >
              Exterior Facade 🏡
            </button>

            <button
              className="btn btn-primary"
              disabled={!activeRoom || !hasBlueprint}
              onClick={() => setActiveTab('interior')}
              style={{ flex: 1, padding: '0.75rem 0.5rem', fontSize: '0.8rem' }}
            >
              Room Interior 🛋️
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
