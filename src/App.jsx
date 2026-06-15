import React, { useState, useEffect } from 'react';
import ModuleBlueprint from './components/ModuleBlueprint';
import ModuleExterior from './components/ModuleExterior';
import ModuleInterior from './components/ModuleInterior';
import DatabasePanel from './components/DatabasePanel';

// API_BASE_URL is dynamically configured to use port 5000 in dev and relative path in production Vercel
const API_BASE_URL = import.meta.env.DEV ? 'http://localhost:5000' : '';

export default function App() {
  const [activeTab, setActiveTab] = useState('blueprint'); // 'blueprint' | 'exterior' | 'interior'
  const [assets, setAssets] = useState({ tiles: [], furniture: [] });
  const [floorPlanUrl, setFloorPlanUrl] = useState(null);
  const [generatedSvg, setGeneratedSvg] = useState(null);
  const [activeRoom, setActiveRoom] = useState('Living Room');
  const [isApiConfigured, setIsApiConfigured] = useState(false);
  const [roomsList, setRoomsList] = useState([
    { id: 'Living Room', icon: '🛋️', size: '5.0m x 4.0m' },
    { id: 'Bedroom', icon: '🛏️', size: '4.0m x 3.5m' },
    { id: 'Kitchen', icon: '🍳', size: '3.5m x 3.0m' },
    { id: 'Bathroom', icon: '🛁', size: '2.5m x 2.0m' }
  ]);
  const [constructionStyle, setConstructionStyle] = useState('Modern Minimalist');
  const [floorsCount, setFloorsCount] = useState(1);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/status`);
      if (res.ok) {
        const data = await res.json();
        setIsApiConfigured(data.hasKey);
      }
    } catch (err) {
      console.error("Failed to fetch API status from server:", err);
    }
  };

  const fetchAssets = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/assets`);
      if (res.ok) {
        const data = await res.json();
        setAssets(data);
      }
    } catch (err) {
      console.error("Failed to fetch local database assets:", err);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchAssets();
  }, []);

  return (
    <div className="app-container">
      {/* Top Header Navbar */}
      <header className="app-header">
        <div className="brand-section">
          <div className="brand-logo">AI</div>
          <span className="brand-name">AI House Designer Studio</span>
        </div>
        <div className="api-status">
          <div className={`status-dot ${isApiConfigured ? 'active' : 'inactive'}`}></div>
          <span>
            {isApiConfigured ? "Gemini 2.5 API Connected" : "No Gemini API Key Configured"}
          </span>
        </div>
      </header>

      {/* Main Dashboard Grid */}
      <div className="dashboard-grid">
        {/* Left Sidebar: Asset Database (Common for all modules) */}
        <aside className="sidebar">
          <DatabasePanel 
            assets={assets}
            fetchAssets={fetchAssets}
            apiBaseUrl={API_BASE_URL}
          />
        </aside>

        {/* Right Workspace Pane */}
        <main className="content-area">
          {/* Module Navigation Tabs */}
          <div className="tab-headers" style={{ marginBottom: '1.5rem', padding: '0.35rem', borderRadius: '12px' }}>
            <button 
              className={`tab-btn ${activeTab === 'blueprint' ? 'active' : ''}`}
              onClick={() => setActiveTab('blueprint')}
              style={{ padding: '0.85rem', fontSize: '0.95rem' }}
            >
              📐 1. Blueprint Design
            </button>
            <button 
              className={`tab-btn ${activeTab === 'exterior' ? 'active' : ''}`}
              onClick={() => setActiveTab('exterior')}
              style={{ padding: '0.85rem', fontSize: '0.95rem' }}
            >
              🏡 2. House Exterior View
            </button>
            <button 
              className={`tab-btn ${activeTab === 'interior' ? 'active' : ''}`}
              onClick={() => setActiveTab('interior')}
              style={{ padding: '0.85rem', fontSize: '0.95rem' }}
            >
              🛋️ 3. Room Interior Designer
            </button>
          </div>

          {/* Module View Renderer */}
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            {activeTab === 'blueprint' && (
              <ModuleBlueprint 
                floorPlanUrl={floorPlanUrl}
                setFloorPlanUrl={setFloorPlanUrl}
                generatedSvg={generatedSvg}
                setGeneratedSvg={setGeneratedSvg}
                activeRoom={activeRoom}
                setActiveRoom={setActiveRoom}
                setActiveTab={setActiveTab}
                apiBaseUrl={API_BASE_URL}
                roomsList={roomsList}
                setRoomsList={setRoomsList}
                constructionStyle={constructionStyle}
                setConstructionStyle={setConstructionStyle}
                floorsCount={floorsCount}
                setFloorsCount={setFloorsCount}
              />
            )}

            {activeTab === 'exterior' && (
              <ModuleExterior 
                floorPlanUrl={floorPlanUrl}
                generatedSvg={generatedSvg}
                apiBaseUrl={API_BASE_URL}
                isApiConfigured={isApiConfigured}
                constructionStyle={constructionStyle}
                floorsCount={floorsCount}
                assets={assets}
              />
            )}

            {activeTab === 'interior' && (
              <ModuleInterior 
                activeRoom={activeRoom}
                floorPlanUrl={floorPlanUrl}
                assets={assets}
                apiBaseUrl={API_BASE_URL}
                isApiConfigured={isApiConfigured}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
