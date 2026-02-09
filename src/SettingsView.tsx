import React, { useState } from 'react';
import IntegrationsView from './IntegrationsView';
import TagsManager from './TagsManager';
import SettingsModal from './components/SettingsModal';
import DataExport from './components/DataExport';
import GroupsManager from './components/GroupsManager';
import NotificationSettings from './components/NotificationSettings';
import { ReferenceCalendarModal } from './components/ReferenceCalendarModal';

type SettingsTab = 'profile' | 'notifications' | 'integrations' | 'tags' | 'export' | 'groups' | 'calendars';

const SettingsView: React.FC = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [activeTab, setActiveTab] = useState<SettingsTab | null>(isMobile ? null : 'profile');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showGroupsModal, setShowGroupsModal] = useState(false);
  const [showReferenceCalendarModal, setShowReferenceCalendarModal] = useState(false);

  React.useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      // Reset to menu on mobile, profile on desktop
      if (mobile && activeTab) {
        setActiveTab(null);
      } else if (!mobile && !activeTab) {
        setActiveTab('profile');
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeTab]);

  // Mobile: Show menu first, then content
  const showMenu = isMobile && activeTab === null;

  return (
    <div className="settings-view">
      <div className="view-header">
        <h2>⚙️ Settings</h2>
      </div>

      {/* Mobile: Settings Menu (shown first) */}
      {showMenu ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          padding: '1rem'
        }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1f2937', marginBottom: '0.5rem' }}>
            Choose a setting to configure
          </h3>
          
          {[
            { id: 'profile', icon: '👤', label: 'Profile', desc: 'Theme, avatar, dashboard layout' },
            { id: 'calendars', icon: '📅', label: 'Reference Calendars', desc: 'Enable holiday calendars' },
            { id: 'notifications', icon: '🔔', label: 'Notifications', desc: 'Event reminders' },
            { id: 'tags', icon: '🏷️', label: 'Tags', desc: 'Manage tags and categories' },
            { id: 'groups', icon: '👥', label: 'Groups', desc: 'Family and sharing groups' },
            { id: 'export', icon: '📤', label: 'Export', desc: 'Download your data' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as SettingsTab)}
              style={{
                padding: '1.25rem',
                background: 'white',
                border: '2px solid #e5e7eb',
                borderRadius: '12px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                e.currentTarget.style.borderColor = '#14b8a6';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.borderColor = '#e5e7eb';
              }}
            >
              <div style={{ fontSize: '2rem' }}>{item.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '1rem', color: '#1f2937', marginBottom: '0.25rem' }}>
                  {item.label}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  {item.desc}
                </div>
              </div>
              <div style={{ fontSize: '1.25rem', color: '#9ca3af' }}>›</div>
            </button>
          ))}
        </div>
      ) : (
        <>
          {/* Desktop: Tabs */}
          {!isMobile && (
            <div className="sub-tabs">
              <button
                className={`sub-tab ${activeTab === 'profile' ? 'active' : ''}`}
                onClick={() => setActiveTab('profile')}
              >
                👤 Profile
              </button>
              <button
                className={`sub-tab ${activeTab === 'calendars' ? 'active' : ''}`}
                onClick={() => setActiveTab('calendars')}
              >
                📅 Calendars
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
              <button
                className={`sub-tab ${activeTab === 'integrations' ? 'active' : ''}`}
                onClick={() => setActiveTab('integrations')}
              >
                🔌 Integrations
              </button>
            </div>
          )}

          {/* Mobile: Back button */}
          {isMobile && activeTab && (
            <button
              onClick={() => setActiveTab(null)}
              style={{
                margin: '0 1rem 1rem 1rem',
                padding: '0.75rem 1rem',
                background: '#f3f4f6',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#374151'
              }}
            >
              ← Back to Settings Menu
            </button>
          )}

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
                    <p>Share tasks and family members</p>
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

            {activeTab === 'calendars' && (
              <div className="calendars-settings-container">
                <div className="settings-info">
                  <h3>Reference Calendars</h3>
                  <p>Enable holiday calendars from around the world to see rich cards with cultural insights, traditions, and celebration ideas.</p>
                  <button 
                    className="btn-primary"
                    onClick={() => setShowReferenceCalendarModal(true)}
                    style={{ marginTop: '1rem' }}
                  >
                    Manage Calendars
                  </button>
                </div>

                <div className="settings-quick-info" style={{ marginTop: '2rem' }}>
                  <div className="info-card">
                    <h4>🌍 Global Holidays</h4>
                    <p>60+ celebrations worldwide</p>
                  </div>
                  <div className="info-card">
                    <h4>📚 Rich Content</h4>
                    <p>Cultural insights & traditions</p>
                  </div>
                  <div className="info-card">
                    <h4>💡 Ideas & Tips</h4>
                    <p>Celebration suggestions</p>
                  </div>
                  <div className="info-card">
                    <h4>📅 365-Day View</h4>
                    <p>See upcoming observances</p>
                  </div>
                </div>

                <ReferenceCalendarModal 
                  isOpen={showReferenceCalendarModal} 
                  onClose={() => setShowReferenceCalendarModal(false)} 
                />
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
        </>
      )}
    </div>
  );
};

export default SettingsView;

