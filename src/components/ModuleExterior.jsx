import React, { useState } from 'react';

export default function ModuleExterior({ 
  floorPlanUrl, 
  generatedSvg, 
  apiBaseUrl, 
  isApiConfigured 
}) {
  const [style, setStyle] = useState('Modern Minimalist');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [activeLightboxImage, setActiveLightboxImage] = useState(null);

  const stylesList = [
    'Modern Minimalist',
    'Scandinavian Timber',
    'Mid-Century Modern',
    'Industrial Concrete',
    'Cozy Stone Cottage'
  ];

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
          style
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to generate exterior view.");
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
          Generate a photorealistic house facade matching the levels, windows, and main layout structure defined in your blueprint.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '2rem' }}>
        {/* Left: Controls & Design Settings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Architectural Style</label>
            <select
              className="form-select"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              disabled={isLoading || !hasBlueprint}
            >
              {stylesList.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <button
            className="btn btn-action"
            onClick={handleGenerateExterior}
            disabled={isLoading || !isApiConfigured || !hasBlueprint}
            style={{ width: '100%', height: '3rem' }}
          >
            {isLoading ? "Analyzing Blueprint..." : "Generate Exterior Facade"}
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
            </div>
          )}
        </div>

        {/* Right: Render Showcase Panel */}
        <div style={{ position: 'relative', minHeight: '380px', border: '1px solid var(--card-border)', borderRadius: '12px', background: '#f8fafc', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          
          {/* Loading Overlay */}
          {isLoading && (
            <div className="loading-overlay">
              <div className="spinner"></div>
              <div className="loading-text" style={{ textAlign: 'center', maxWidth: '80%' }}>
                Analyzing blueprint layouts and drawing exterior with Imagen 4...
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Generating facade view (takes 10-15 seconds)...</div>
            </div>
          )}

          {/* Placeholder when not generated */}
          {!result && !isLoading && (
            <div className="image-placeholder">
              <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" height="2.5em" width="2.5em" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
              <div>Your photorealistic exterior house facade render will appear here.</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>The AI will extract window/door alignments from Module 1.</div>
            </div>
          )}

          {/* Generated Result View */}
          {result && !isLoading && (
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
              <div 
                className="render-image-container" 
                style={{ width: '100%', height: '100%', margin: 0, borderRadius: 0, border: 'none' }}
                onClick={() => setActiveLightboxImage(result.exteriorImage)}
              >
                <img 
                  src={result.exteriorImage} 
                  alt="House Exterior View" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
                <div className="zoom-overlay">🔍 Click to View Fullscreen</div>
              </div>

              {/* Reroll Button inside frame */}
              <button
                className="btn btn-secondary"
                onClick={handleGenerateExterior}
                style={{
                  position: 'absolute',
                  top: '1rem',
                  right: '1rem',
                  fontSize: '0.8rem',
                  padding: '0.35rem 0.75rem',
                  background: 'rgba(15, 23, 42, 0.85)',
                  backdropFilter: 'blur(4px)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  zIndex: 2
                }}
              >
                Regenerate Facade ↺
              </button>
            </div>
          )}
        </div>
      </div>

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
