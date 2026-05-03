/**
 * Settings — desktop & mobile.
 *
 * Each tab now renders its actual content inline (no "Open ___" button intermediate
 * step). Three components support an `inline` mode for this:
 *   - SettingsModal         → Profile (theme, avatar, layout, AI, etc.)
 *   - GroupsManager         → Groups & Sharing
 *   - ReferenceCalendarBrowser is used directly (not via its modal wrapper).
 *
 * Tabs reorganised into three logical groups:
 *   Personal:    Profile, Notifications
 *   Customise:   Tags, Calendars
 *   Connect:     Groups, Integrations
 *   Data:        Export
 */

import React, { useState } from 'react';
import IntegrationsView from './IntegrationsView';
import TagsManager from './TagsManager';
import SettingsModal from './components/SettingsModal';
import DataExport from './components/DataExport';
import GroupsManager from './components/GroupsManager';
import NotificationSettings from './components/NotificationSettings';
import { ReferenceCalendarBrowser } from './components/ReferenceCalendarBrowser';

type SettingsTab =
  | 'profile'
  | 'notifications'
  | 'tags'
  | 'calendars'
  | 'groups'
  | 'integrations'
  | 'export';

const TABS: { id: SettingsTab; icon: string; label: string; desc: string; group: string }[] = [
  { id: 'profile',       icon: '👤', label: 'Profile',       desc: 'Theme, avatar, dashboard layout, AI', group: 'Personal' },
  { id: 'notifications', icon: '🔔', label: 'Notifications', desc: 'Reminders & push alerts',            group: 'Personal' },
  { id: 'tags',          icon: '🏷️', label: 'Tags',          desc: 'Categorise tasks, events, journal',  group: 'Customise' },
  { id: 'calendars',     icon: '📅', label: 'Calendars',     desc: 'Reference holiday calendars',         group: 'Customise' },
  { id: 'groups',        icon: '👥', label: 'Groups',        desc: 'Share with family & friends',         group: 'Connect' },
  { id: 'integrations',  icon: '🔌', label: 'Integrations',  desc: 'Google, Fitbit, weather, etc.',       group: 'Connect' },
  { id: 'export',        icon: '📤', label: 'Export',        desc: 'Download your data',                  group: 'Data' },
];

const SettingsView: React.FC = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [activeTab, setActiveTab] = useState<SettingsTab | null>(isMobile ? null : 'profile');

  React.useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile && activeTab) setActiveTab(null);
      else if (!mobile && !activeTab) setActiveTab('profile');
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeTab]);

  const showMenu = isMobile && activeTab === null;
  const hideSettingsTitleOnMobileTags = isMobile && activeTab === 'tags';

  // Group tabs for visual hierarchy
  const groupedTabs = TABS.reduce<Record<string, typeof TABS>>((acc, t) => {
    (acc[t.group] = acc[t.group] || []).push(t);
    return acc;
  }, {});

  return (
    <div className="settings-view">
      {!hideSettingsTitleOnMobileTags && (
        <div className="view-header">
          <h2>⚙️ Settings</h2>
        </div>
      )}

      {showMenu ? (
        <MobileMenu groupedTabs={groupedTabs} onPick={setActiveTab} />
      ) : (
        <>
          {!isMobile && (
            <div className="sub-tabs settings-subtabs" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={activeTab === t.id}
                  className={`sub-tab ${activeTab === t.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(t.id)}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          )}

          {isMobile && activeTab && activeTab !== 'tags' && (
            <button
              onClick={() => setActiveTab(null)}
              className="settings-mobile-back"
            >
              ← Back to Settings Menu
            </button>
          )}

          <div className="sub-tab-content settings-tab-content">
            {activeTab === 'profile' && <ProfilePane />}
            {activeTab === 'notifications' && (
              <Section
                title="🔔 Notifications"
                subtitle="Choose what triggers a push or in-app alert."
              >
                <NotificationSettings />
              </Section>
            )}
            {activeTab === 'tags' && (
              <TagsManager isMobile={isMobile} onMobileBack={() => setActiveTab(null)} />
            )}
            {activeTab === 'calendars' && <CalendarsPane />}
            {activeTab === 'groups' && <GroupsPane />}
            {activeTab === 'integrations' && (
              <Section
                title="🔌 Integrations"
                subtitle="Connect Google, Fitbit, weather, and other services."
              >
                <IntegrationsView />
              </Section>
            )}
            {activeTab === 'export' && (
              <Section
                title="📤 Export"
                subtitle="Download all your data as JSON, CSV, or Excel."
              >
                <DataExport />
              </Section>
            )}
          </div>
        </>
      )}
    </div>
  );
};

/* ─────────────── Reusable pieces ─────────────── */

const Section: React.FC<{ title: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode }> = ({
  title,
  subtitle,
  right,
  children,
}) => (
  <div className="settings-section">
    <div className="settings-section-header">
      <div>
        <h3 className="settings-section-title">{title}</h3>
        {subtitle && <p className="settings-section-subtitle">{subtitle}</p>}
      </div>
      {right}
    </div>
    <div className="settings-section-body">{children}</div>
  </div>
);

const ProfilePane: React.FC = () => (
  <Section
    title="👤 Profile"
    subtitle="Theme, avatar, dashboard layout, family, and AI preferences — saved automatically."
  >
    <SettingsModal show={true} onClose={() => { /* inline: no-op */ }} inline />
  </Section>
);

const CalendarsPane: React.FC = () => (
  <Section
    title="📅 Reference Calendars"
    subtitle="Enable holiday calendars from around the world. Each holiday opens a rich card with cultural insights."
  >
    <div
      style={{
        background: '#fff',
        border: '0.5px solid #e5e7eb',
        borderRadius: 12,
        padding: 16,
      }}
    >
      <ReferenceCalendarBrowser />
    </div>
  </Section>
);

const GroupsPane: React.FC = () => (
  <Section
    title="👥 Groups & Sharing"
    subtitle="Create groups, invite family or friends, and share tasks, events and journal entries."
  >
    <GroupsManager onClose={() => { /* inline: no-op */ }} inline />
  </Section>
);

const MobileMenu: React.FC<{
  groupedTabs: Record<string, typeof TABS>;
  onPick: (id: SettingsTab) => void;
}> = ({ groupedTabs, onPick }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }}>
    {Object.entries(groupedTabs).map(([group, items]) => (
      <div key={group}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: '#9ca3af',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            margin: '4px 0 8px',
          }}
        >
          {group}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => onPick(item.id)}
              style={{
                padding: '14px 16px',
                background: '#fff',
                border: '0.5px solid #e5e7eb',
                borderRadius: 12,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'border-color 0.15s, transform 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#1d9e75';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e5e7eb';
              }}
            >
              <div style={{ fontSize: 22 }}>{item.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{item.label}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{item.desc}</div>
              </div>
              <div style={{ fontSize: 16, color: '#9ca3af' }}>›</div>
            </button>
          ))}
        </div>
      </div>
    ))}
  </div>
);

export default SettingsView;
