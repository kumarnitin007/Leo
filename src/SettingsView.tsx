import React, { useState } from 'react';
import IntegrationsView from './IntegrationsView';
import TagsManager from './TagsManager';
import SettingsModal from './components/SettingsModal';

type SettingsTab = 'profile' | 'integrations' | 'tags';

const SettingsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  return (
    <div className="settings-view">
      <div className="view-header">
        <h2>⚙️ Settings</h2>
      </div>

      <div className="sub-tabs">
        <button
          className={`sub-tab ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          👤 Profile & Preferences
        </button>
        <button
          className={`sub-tab ${activeTab === 'integrations' ? 'active' : ''}`}
          onClick={() => setActiveTab('integrations')}
        >
          🔌 Integrations
        </button>
        <button
          className={`sub-tab ${activeTab === 'tags' ? 'active' : ''}`}
          onClick={() => setActiveTab('tags')}
        >
          🏷️ Tags
        </button>
      </div>

      <div className="sub-tab-content">
        {activeTab === 'profile' && (
          <div className="profile-settings-container">
            <div className="settings-info">
              <h3>User Profile</h3>
              <p>Manage your account, theme, avatar, and dashboard layout.</p>
              <button 
                className="btn-primary"
                onClick={() => setShowSettingsModal(true)}
                style={{ marginTop: '1rem' }}
              >
                Open Settings
              </button>
            </div>

            <div className="settings-quick-info" style={{ marginTop: '2rem' }}>
              <div className="info-card">
                <h4>🎨 Themes</h4>
                <p>Choose from multiple color themes</p>
              </div>
              <div className="info-card">
                <h4>😊 Avatar</h4>
                <p>Personalize your profile emoji</p>
              </div>
              <div className="info-card">
                <h4>📊 Dashboard Layout</h4>
                <p>Uniform, Grid Spans, or Masonry</p>
              </div>
              <div className="info-card">
                <h4>👥 Family Accounts</h4>
                <p>Share tasks with family members</p>
              </div>
            </div>

            {showSettingsModal && (
              <SettingsModal 
                show={showSettingsModal} 
                onClose={() => setShowSettingsModal(false)} 
              />
            )}
          </div>
        )}
        {activeTab === 'integrations' && <IntegrationsView />}
        {activeTab === 'tags' && <TagsManager />}
      </div>
    </div>
  );
};

export default SettingsView;

