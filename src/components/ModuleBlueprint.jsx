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
            // Re-match or select first plan
            const matched = data.find(p => p.url === floorPlanUrl);
            if (matched) {
              setSelectedPlanUrl(matched.url);
            } else {
              setSelectedPlanUrl(data[0].url);
              setFloorPlanUrl(data[0].url);
              setGeneratedSvg(null); // Clear generated SVG
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

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <h2 className="card-title" style={{ margin: 0 }}>
          <span>Module 1: Blueprint Design & Setup</span>
        </h2>
        <p className="card-subtitle" style={{ margin: '0.5rem 0 0 0' }}>
          Select floor and bedroom configurations to load pre-designed plans from the database.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 0.75fr', gap: '1.5rem' }}>
        {/* Left: View Panel */}
        <div style={{ position: 'relative', minHeight: '460px', border: '1px solid var(--card-border)', borderRadius: '12px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {isLoadingPlans && (
            <div className="loading-overlay">
              <div className="spinner"></div>
              <div className="loading-text" style={{ textAlign: 'center' }}>
                Loading available blueprints from database...
              </div>
            </div>
          )}

          {!floorPlanUrl && !isLoadingPlans && (
            <div className="floorplan-dropzone" style={{ width: '80%', border: 'none', background: 'transparent', cursor: 'default' }}>
              <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" height="2.5em" width="2.5em" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="9" y1="3" x2="9" y2="21"></line>
                <line x1="3" y1="9" x2="21" y2="9"></line>
              </svg>
              <div style={{ fontWeight: 600, fontSize: '1rem', marginTop: '0.5rem' }}>No Blueprint Selected</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Select floor and bedroom parameters, then choose a database blueprint plan.</div>
            </div>
          )}

          {floorPlanUrl && !isLoadingPlans && (
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
          )}

          {floorPlanUrl && !isLoadingPlans && (
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
                backdropFilter: 'blur(4px)'
              }}
            >
              Clear Selection
            </button>
          )}
        </div>

        {/* Right: Controls & Detected Rooms */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* Blueprint Parameter Inputs */}
          <div style={{ background: '#ffffff', border: '1px solid var(--card-border)', padding: '1.25rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, margin: 0, borderBottom: '1px solid var(--card-border)', paddingBottom: '0.5rem' }}>
              Blueprint Selector
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
                  value={selectedPlanUrl}
                  onChange={(e) => {
                    const url = e.target.value;
                    setSelectedPlanUrl(url);
                    setFloorPlanUrl(url);
                    setGeneratedSvg(null);
                  }}
                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', width: '100%' }}
                >
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

            {availablePlans.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.25rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Available Plans Preview:</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
                  {availablePlans.map(plan => (
                    <button
                      key={plan.url}
                      onClick={() => {
                        setSelectedPlanUrl(plan.url);
                        setFloorPlanUrl(plan.url);
                        setGeneratedSvg(null);
                      }}
                      style={{
                        padding: '0.25rem',
                        border: selectedPlanUrl === plan.url ? '2px solid var(--primary)' : '1px solid var(--card-border)',
                        borderRadius: '6px',
                        background: '#ffffff',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.2rem'
                      }}
                    >
                      <div style={{ width: '100%', height: '36px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src={`${apiBaseUrl}${plan.url}`} alt={plan.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                      </div>
                      <span style={{ fontSize: '0.65rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textAlign: 'center', color: 'var(--text-primary)' }}>{plan.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Design Room Selector Section removed (now selected from Room Interior Design tab) */}
        </div>
      </div>
    </div>
  );
}
