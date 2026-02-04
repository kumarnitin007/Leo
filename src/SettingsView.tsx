import React, { useState } from 'react';
import IntegrationsView from './IntegrationsView';
import TagsManager from './TagsManager';
import SettingsModal from './components/SettingsModal';
import DataExport from './components/DataExport';
import GroupsManager from './components/GroupsManager';
import NotificationSettings from './components/NotificationSettings';

type SettingsTab = 'profile' | 'notifications' | 'integrations' | 'tags' | 'export' | 'groups';

const SettingsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showGroupsModal, setShowGroupsModal] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
          👤 Profile
        </button>
        <button
          className={`sub-tab ${activeTab === 'notifications' ? 'active' : ''}`}
          onClick={() => setActiveTab('notifications')}
        >
          🔔 Notifications
        </button>
        <button
          className={`sub-tab ${activeTab === 'tags' ? 'active' : ''}`}
          onClick={() => setActiveTab('tags')}
        >
          🏷️ Tags
        </button>
        <button
          className={`sub-tab ${activeTab === 'export' ? 'active' : ''}`}
          onClick={() => setActiveTab('export')}
        >
          📤 Export
        </button>
        <button
          className={`sub-tab ${activeTab === 'groups' ? 'active' : ''}`}
          onClick={() => setActiveTab('groups')}
        >
          👥 Groups
        </button>
        {!isMobile && (
          <button
            className={`sub-tab ${activeTab === 'integrations' ? 'active' : ''}`}
            onClick={() => setActiveTab('integrations')}
          >
            🔌 Integrations
          </button>
        )}
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
        {activeTab === 'notifications' && <NotificationSettings />}
        {activeTab === 'integrations' && <IntegrationsView />}
        {activeTab === 'tags' && <TagsManager />}
        {activeTab === 'export' && <DataExport />}
        {activeTab === 'groups' && (
          <div className="groups-settings-container">
            <div className="settings-info">
              <h3>Sharing Groups</h3>
              <p>Create groups and invite family members to share tasks and entries.</p>
              <button 
                className="btn-primary"
                onClick={() => setShowGroupsModal(true)}
                style={{ marginTop: '1rem' }}
              >
                Manage Groups
              </button>
            </div>

            <div className="settings-quick-info" style={{ marginTop: '2rem' }}>
              <div className="info-card">
                <h4>👨‍👩‍👧‍👦 Family Groups</h4>
                <p>Create groups for your family</p>
              </div>
              <div className="info-card">
                <h4>📧 Invite Members</h4>
                <p>Send invitations by email</p>
              </div>
              <div className="info-card">
                <h4>🔗 Share Entries</h4>
                <p>Share tasks and safe entries</p>
              </div>
            </div>

            {showGroupsModal && (
              <GroupsManager onClose={() => setShowGroupsModal(false)} />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsView;

