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
 *
 * Mobile header behaviour:
 *   We deliberately do NOT render our own "⚙️ Settings" header on mobile —
 *   the global `<MobileContextHeader />` already shows it at the top of the
 *   viewport. Rendering it again here was producing the duplicated "Settings"
 *   title visible in earlier screenshots.
 *
 *   When the user opens a sub-tab on mobile (e.g. Profile) we publish a
 *   `MobileHeaderContext` override so the global top bar reads
 *   "‹ 👤 Profile" with the back arrow returning to the Settings menu —
 *   matching the Journal mobile pattern.
 */

import React, { useEffect, useState } from 'react';
import IntegrationsView from './IntegrationsView';
import TagsManager from './TagsManager';
import SettingsModal from './components/SettingsModal';
import DataExport from './components/DataExport';
import GroupsManager from './components/GroupsManager';
import NotificationSettings from './components/NotificationSettings';
import { ReferenceCalendarBrowser } from './components/ReferenceCalendarBrowser';
import { useMobileHeader } from './contexts/MobileHeaderContext';

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
  const { setOverride } = useMobileHeader();

  /**
   * Watch for breakpoint *crossings* only.
   *
   * Mobile browsers fire `resize` events for many non-breakpoint reasons:
   * URL-bar collapse on scroll, on-screen keyboard open/close, viewport
   * jiggle from layout shifts when a tab's content first mounts. The
   * previous version of this effect treated *every* mobile resize as a
   * reason to bounce back to the menu, so tapping a settings item would
   * open it briefly and then snap closed the moment the layout settled.
   *
   * We now use a ref to remember the previous breakpoint and only act
   * when it changes (true ↔ false), leaving in-mobile resizes alone.
   */
  const prevMobileRef = React.useRef(isMobile);
  React.useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      if (mobile === prevMobileRef.current) return; // ignore non-crossing resizes
      prevMobileRef.current = mobile;
      setIsMobile(mobile);
      if (mobile) {
        // Just crossed into mobile: drop to the menu so the user sees the list.
        setActiveTab(null);
      } else {
        // Just crossed into desktop: pick a default tab if none is selected.
        setActiveTab((prev) => prev ?? 'profile');
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  /**
   * Push the active sub-tab into the global mobile top bar so it reads
   * e.g. "‹ 👤 Profile" while in a sub-page. Cleared as soon as we leave
   * mobile or return to the menu.
   */
  useEffect(() => {
    if (isMobile && activeTab) {
      const tab = TABS.find((t) => t.id === activeTab);
      if (tab) {
        setOverride({
          title: tab.label,
          icon: tab.icon,
          onBack: () => setActiveTab(null),
        });
      }
    } else {
      setOverride(null);
    }
    return () => setOverride(null);
  }, [isMobile, activeTab, setOverride]);

  const showMenu = isMobile && activeTab === null;

  // Group tabs for visual hierarchy
  const groupedTabs = TABS.reduce<Record<string, typeof TABS>>((acc, t) => {
    (acc[t.group] = acc[t.group] || []).push(t);
    return acc;
  }, {});

  return (
    <div className="settings-view">
      {/* Desktop only — on mobile the global MobileContextHeader handles this. */}
      {!isMobile && (
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
