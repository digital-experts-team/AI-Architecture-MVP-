import React, { useState, useRef } from 'react';

export default function ModuleBlueprint({ 
  floorPlanUrl, 
  setFloorPlanUrl, 
  generatedSvg, 
  setGeneratedSvg, 
  activeRoom, 
  setActiveRoom, 
  setActiveTab, 
  apiBaseUrl 
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const fileInputRef = useRef(null);
  const hasBlueprint = !!(floorPlanUrl || generatedSvg);

  // Available rooms in the multi-room blueprint
  const roomsList = [
    { id: 'Living Room', icon: '🛋️', size: '5.0m x 4.0m' },
    { id: 'Bedroom', icon: '🛏️', size: '4.0m x 3.5m' },
    { id: 'Kitchen', icon: '🍳', size: '3.5m x 3.0m' },
    { id: 'Bathroom', icon: '🛁', size: '2.5m x 2.0m' }
  ];

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
        headers: { 'Content-Type': 'application/json' }
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
        <h2 className="card-title" style={{ margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Module 1: Blueprint Design</span>
          <button 
            className="btn btn-secondary" 
            onClick={handleGenerateLayout}
            disabled={isGenerating || isUploading}
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
          >
            {isGenerating ? "Generating..." : "Generate AI Blueprint"}
          </button>
        </h2>
        <p className="card-subtitle" style={{ margin: '0.5rem 0 0 0' }}>
          Upload your house floor plan image, or generate a custom multi-room vector blueprint layout using Gemini 2.5 Flash.
        </p>
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/*" 
        style={{ display: 'none' }} 
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1.5rem' }}>
        {/* Left: View Panel */}
        <div style={{ position: 'relative', minHeight: '380px', border: '1px solid var(--card-border)', borderRadius: '12px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {isUploading && (
            <div className="loading-overlay">
              <div className="spinner"></div>
              <div className="loading-text">Uploading blueprint image...</div>
            </div>
          )}

          {isGenerating && (
            <div className="loading-overlay">
              <div className="spinner"></div>
              <div className="loading-text">Designing multi-room SVG layout...</div>
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
              style={{ width: '90%', height: '90%' }}
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

        {/* Right: Detected Rooms */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, borderBottom: '1px solid var(--card-border)', paddingBottom: '0.5rem', margin: 0 }}>
            Select Room to Design
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
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
                    gap: '1rem',
                    padding: '0.85rem 1rem',
                    background: isSelected ? 'rgba(37, 99, 235, 0.06)' : 'rgba(0, 0, 0, 0.01)',
                    border: '1px solid',
                    borderColor: isSelected ? 'var(--secondary)' : 'var(--card-border)',
                    borderRadius: '12px',
                    cursor: hasBlueprint ? 'pointer' : 'not-allowed',
                    textAlign: 'left',
                    opacity: hasBlueprint ? 1 : 0.45,
                    transition: 'all 0.2s ease',
                    width: '100%'
                  }}
                >
                  <span style={{ fontSize: '1.5rem' }}>{room.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: isSelected ? 'var(--secondary)' : 'var(--text-primary)' }}>{room.id}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Est. Dimensions: {room.size}</div>
                  </div>
                  {isSelected && (
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--secondary)', boxShadow: '0 0 8px var(--secondary-glow)' }}></div>
                  )}
                </button>
              );
            })}

            {!hasBlueprint && (
              <div style={{ fontSize: '0.8rem', color: '#fda4af', padding: '0.5rem', background: 'rgba(244, 63, 94, 0.08)', borderRadius: '8px', border: '1px solid rgba(244, 63, 94, 0.25)', textAlign: 'center' }}>
                ⚠️ Please upload or generate a blueprint layout to activate room selection.
              </div>
            )}
          </div>

          <button
            className="btn btn-action"
            disabled={!hasBlueprint}
            onClick={() => setActiveTab('exterior')}
            style={{ 
              width: '100%', 
              padding: '0.85rem', 
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
              color: '#fff', 
              marginBottom: '0.5rem',
              boxShadow: '0 4px 15px rgba(16, 185, 129, 0.2)'
            }}
          >
            View House Exterior 🏡
          </button>

          <button
            className="btn btn-primary"
            disabled={!activeRoom || !hasBlueprint}
            onClick={() => setActiveTab('interior')}
            style={{ width: '100%', padding: '0.85rem' }}
          >
            Design {activeRoom || "Room"} Interior 🛋️
          </button>
        </div>
      </div>
    </div>
  );
}
