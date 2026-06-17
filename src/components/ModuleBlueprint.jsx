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
  const [bedroomsCount, setBedroomsCount] = useState(3);
  const [availablePlans, setAvailablePlans] = useState([]);
  const [selectedPlanUrl, setSelectedPlanUrl] = useState('');
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);

  // Survey Recommendation States
  const [surveyUrl, setSurveyUrl] = useState('');
  const [isUploadingSurvey, setIsUploadingSurvey] = useState(false);
  const [isMatchingSurvey, setIsMatchingSurvey] = useState(false);
  const [recommendationReason, setRecommendationReason] = useState('');
  const [matchError, setMatchError] = useState('');
  const fileInputRef = useRef(null);

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

  // Sync available plans from database when parameters change
  useEffect(() => {
    const fetchBlueprints = async () => {
      setIsLoadingPlans(true);
      try {
        const res = await fetch(`${apiBaseUrl}/api/blueprints?floors=${floorsCount}&bedrooms=${bedroomsCount}`);
        if (res.ok) {
          const data = await res.json();
          setAvailablePlans(data);
          if (data.length > 0) {
            if (floorPlanUrl) {
              const matched = data.find(p => p.url === floorPlanUrl);
              if (matched) {
                setSelectedPlanUrl(matched.url);
              } else {
                setSelectedPlanUrl('');
                setFloorPlanUrl(null);
              }
            } else {
              setSelectedPlanUrl('');
            }
          } else {
            setSelectedPlanUrl('');
            setFloorPlanUrl(null);
          }
        }
      } catch (err) {
        console.error("Failed to fetch matching blueprints:", err);
      } finally {
        setIsLoadingPlans(false);
      }
    };

    fetchBlueprints();
  }, [floorsCount, bedroomsCount, apiBaseUrl]);

  // Sync rooms list automatically as form options or floors change
  useEffect(() => {
    syncRoomsList({
      livingRoom: true,
      prayerRoom: bedroomsCount >= 3,
      diningRoom: true,
      carPorch: floorsCount >= 2,
      bedroomsCount,
      bathroomsCount: bedroomsCount
    });
  }, [bedroomsCount, floorsCount]);

  const handleSurveyUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploadingSurvey(true);
    setMatchError('');
    setRecommendationReason('');
    const formData = new FormData();
    formData.append('survey', file);

    try {
      const res = await fetch(`${apiBaseUrl}/api/upload-survey`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to upload land survey.");
      }

      const data = await res.json();
      if (data.success) {
        setSurveyUrl(data.url);
      }
    } catch (err) {
      console.error("Failed to upload land survey:", err);
      setMatchError(err.message || "Failed to upload survey image.");
    } finally {
      setIsUploadingSurvey(false);
    }
  };

  const handleRecommendPlan = async () => {
    if (!surveyUrl) {
      setMatchError("Please upload a land survey image first.");
      return;
    }

    setIsMatchingSurvey(true);
    setMatchError('');
    setRecommendationReason('');

    try {
      const res = await fetch(`${apiBaseUrl}/api/match-survey`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          surveyUrl,
          floorsCount,
          bedroomsCount
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to recommend matching blueprint.");
      }

      const data = await res.json();
      if (data.recommendedPlanUrl) {
        setFloorPlanUrl(data.recommendedPlanUrl);
        setSelectedPlanUrl(data.recommendedPlanUrl);
        setRecommendationReason(data.reason);
        setGeneratedSvg(null); // Clear generated SVG
      } else {
        throw new Error(data.error || "No recommended plan returned from API.");
      }
    } catch (err) {
      console.error("Failed to match land survey:", err);
      setMatchError(err.message || "Failed to analyze land survey for recommendation.");
    } finally {
      setIsMatchingSurvey(false);
    }
  };

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <h2 className="card-title" style={{ margin: 0 }}>
          <span>Module 1: Blueprint Design & Setup</span>
        </h2>
        <p className="card-subtitle" style={{ margin: '0.5rem 0 0 0' }}>
          Select floor and bedroom configurations to load blueprints manually or upload a land survey map for smart auto-recommendation.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1.5rem' }}>
        {/* Left: View Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {!floorPlanUrl ? (
            /* Centered Uploading Window / Land Survey AI Matcher */
            <div style={{ 
              background: '#ffffff', 
              border: '1px solid var(--card-border)', 
              padding: '2rem 1.75rem', 
              borderRadius: '12px', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '1rem', 
              minHeight: '460px', 
              justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
            }}>
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ fontSize: '1rem', textTransform: 'uppercase', color: 'var(--text-primary)', fontWeight: 750, margin: '0 0 0.4rem 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                  <span>🗺️</span> Land Survey AI Matcher
                </h3>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  Upload your land survey or plot map, and Gemini will recommend the best blueprint plan.
                </p>
              </div>

              {/* Hidden File Input */}
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleSurveyUpload} 
                accept="image/*" 
                style={{ display: 'none' }} 
              />

              {/* Upload Box / Dropzone */}
              {!surveyUrl ? (
                <div 
                  className="floorplan-dropzone" 
                  onClick={() => fileInputRef.current?.click()}
                  style={{ padding: '3.5rem 2rem', background: '#fcfcfc', borderStyle: 'dashed', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
                >
                  {isUploadingSurvey ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <div className="spinner" style={{ width: '1.75rem', height: '1.75rem', border: '3px solid var(--secondary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Uploading plot map...</span>
                    </div>
                  ) : (
                    <>
                      <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" height="2.5em" width="2.5em" xmlns="http://www.w3.org/2000/svg" style={{ color: 'var(--secondary)' }}>
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                      </svg>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', marginTop: '0.6rem', color: 'var(--text-primary)' }}>Upload Survey Map</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>PNG, JPG or WebP images</div>
                    </>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
                  <div style={{ 
                    position: 'relative', 
                    height: '180px', 
                    width: '100%',
                    maxWidth: '360px',
                    border: '1px solid var(--card-border)', 
                    borderRadius: '10px', 
                    background: '#f8fafc', 
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <img 
                      src={`${apiBaseUrl}${surveyUrl}`} 
                      alt="Uploaded Land Survey" 
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                    />
                    <button 
                      onClick={() => setSurveyUrl('')}
                      style={{
                        position: 'absolute',
                        top: '0.4rem',
                        right: '0.4rem',
                        background: 'rgba(239, 68, 68, 0.9)',
                        border: 'none',
                        color: 'white',
                        borderRadius: '50%',
                        width: '22px',
                        height: '22px',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                      }}
                      title="Remove Survey Image"
                    >
                      ✕
                    </button>
                  </div>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => fileInputRef.current?.click()}
                    style={{ fontSize: '0.7rem', padding: '0.35rem 0.7rem' }}
                    disabled={isUploadingSurvey}
                  >
                    {isUploadingSurvey ? 'Uploading...' : 'Replace Image'}
                  </button>
                </div>
              )}

              {/* Error Message */}
              {matchError && (
                <div style={{ 
                  fontSize: '0.75rem', 
                  color: '#b91c1c', 
                  background: '#fef2f2', 
                  border: '1px solid #fca5a5', 
                  padding: '0.5rem 0.75rem', 
                  borderRadius: '6px' 
                }}>
                  {matchError}
                </div>
              )}

              {/* recommendation trigger button */}
              <button 
                className="btn btn-primary"
                onClick={handleRecommendPlan}
                disabled={!surveyUrl || isMatchingSurvey || isUploadingSurvey}
                style={{
                  width: '100%',
                  maxWidth: '280px',
                  alignSelf: 'center',
                  padding: '0.6rem 1.25rem',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  background: 'var(--secondary)',
                  marginTop: '0.25rem'
                }}
              >
                {isMatchingSurvey ? (
                  <>
                    <div className="spinner" style={{ width: '1rem', height: '1rem', border: '2px solid #ffffff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                    Analyzing site proportions...
                  </>
                ) : (
                  <>
                    <span>🪄</span> Auto-Recommend Blueprint
                  </>
                )}
              </button>
            </div>
          ) : (
            /* Selected Blueprint Preview */
            <div style={{ position: 'relative', minHeight: '460px', border: '1px solid var(--card-border)', borderRadius: '12px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {isLoadingPlans && (
                <div className="loading-overlay">
                  <div className="spinner"></div>
                  <div className="loading-text" style={{ textAlign: 'center' }}>
                    Loading available blueprints from database...
                  </div>
                </div>
              )}

              <div 
                className="svg-container" 
                style={{ width: '95%', height: '95%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <img 
                  src={`${apiBaseUrl}${floorPlanUrl}`} 
                  alt="Selected Blueprint Plan" 
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }} 
                />
              </div>

              <button 
                className="btn btn-secondary" 
                onClick={() => { setFloorPlanUrl(null); setSelectedPlanUrl(''); }}
                style={{ 
                  position: 'absolute', 
                  bottom: '0.75rem', 
                  right: '0.75rem', 
                  fontSize: '0.75rem', 
                  padding: '0.25rem 0.5rem',
                  background: 'rgba(15, 23, 42, 0.85)',
                  backdropFilter: 'blur(4px)',
                  color: '#ffffff',
                  border: 'none'
                }}
              >
                Clear Selection
              </button>
            </div>
          )}

          {/* Architectural justification output */}
          {recommendationReason && (
            <div style={{ 
              background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(37, 99, 235, 0.03) 100%)', 
              borderLeft: '4px solid var(--secondary)',
              borderRadius: '8px', 
              padding: '1rem 1.25rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '1.1rem' }}>📋</span>
                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Architectural Recommendation Details
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: '1.5', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                "{recommendationReason}"
              </p>
            </div>
          )}
        </div>

        {/* Right: Controls Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* Blueprint Parameter Inputs (Manual Selector Secondary) */}
          <div style={{ background: '#ffffff', border: '1px solid var(--card-border)', padding: '1.25rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-primary)', fontWeight: 700, margin: 0, borderBottom: '1px solid var(--card-border)', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>📐</span> Manual Blueprint Selector
            </h3>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Construction Style</label>
              <select
                className="form-select"
                value={constructionStyle}
                onChange={(e) => setConstructionStyle(e.target.value)}
                style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
              >
                {stylesList.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Floors</label>
                <select
                  className="form-select"
                  value={floorsCount}
                  onChange={(e) => setFloorsCount(parseInt(e.target.value) || 1)}
                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                >
                  <option value={1}>1 Floor</option>
                  <option value={2}>2 Floors</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Bedrooms</label>
                <select
                  className="form-select"
                  value={bedroomsCount}
                  onChange={(e) => setBedroomsCount(parseInt(e.target.value) || 1)}
                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                >
                  <option value={1}>1 Bed</option>
                  <option value={2}>2 Beds</option>
                  <option value={3}>3 Beds</option>
                  <option value={4}>4 Beds</option>
                </select>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Select Plan from Database</label>
              {isLoadingPlans ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0.5rem 0' }}>Querying database blueprints...</div>
              ) : availablePlans.length > 0 ? (
                <select
                  className="form-select"
                  value={selectedPlanUrl || ''}
                  onChange={(e) => {
                    const url = e.target.value;
                    setSelectedPlanUrl(url);
                    setFloorPlanUrl(url || null);
                    setGeneratedSvg(null);
                  }}
                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', width: '100%' }}
                >
                  <option value="">-- Choose a Blueprint --</option>
                  {availablePlans.map(plan => (
                    <option key={plan.url} value={plan.url}>
                      {plan.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div style={{ 
                  fontSize: '0.75rem', 
                  color: '#b91c1c', 
                  background: '#fef2f2', 
                  border: '1px solid #fca5a5', 
                  padding: '0.6rem 0.75rem', 
                  borderRadius: '6px',
                  lineHeight: '1.25'
                }}>
                  No blueprints found in: <br />
                  <code style={{ fontSize: '0.7rem', display: 'block', marginTop: '0.2rem', wordBreak: 'break-all' }}>
                    database/blueprints/{floorsCount}_floor/{bedroomsCount}_bedroom/
                  </code>
                  Please add blueprint images to this folder.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
