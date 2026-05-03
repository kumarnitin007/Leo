/**
 * Integrations Hub Component
 * 
 * Manage integrations with external task management services
 * Features:
 * - Google Tasks integration
 * - Apple Reminders integration
 * - Todoist integration
 * - IFTTT/Zapier webhooks
 * - Import/Export functionality
 */

import React, { useState, useEffect } from 'react';
import { Task } from './types';
import { getTasks, addTask } from './storage';
import GoogleServicesSection from './components/GoogleServicesSection';
import FitnessProviderSection from './components/FitnessProviderSection';
import { useGoogleAuth } from './integrations/google/hooks/useGoogleAuth';

/**
 * Per-integration setup metadata.
 *
 * Each card here has very different state-of-implementation. To stop showing the
 * misleading generic "API Key" modal we declare the actual story for each one.
 *
 * Possible `auth` values:
 *  - 'google-oauth' — reuses the same Google sign-in as Google Fit / Contacts
 *    (single client-id from VITE_GOOGLE_CLIENT_ID, just different scopes)
 *  - 'oauth'        — provider-specific OAuth not yet wired
 *  - 'api-key'      — token-pasted-by-user flow (none of the active ones)
 *  - 'webhook'      — incoming webhook URL pasted by user
 *  - 'manual'       — copy/paste JSON / file
 *
 * `implementation` controls the badge & whether Connect actually does anything:
 *  - 'available'    — already implemented elsewhere, route there
 *  - 'planned'      — not built yet, show roadmap note
 */
type IntegrationMeta = {
  auth: 'google-oauth' | 'oauth' | 'api-key' | 'webhook' | 'manual';
  implementation: 'available' | 'planned';
  steps?: string[];
  note?: string;
  /** When 'available' and routes elsewhere, this label tells the user where to go. */
  routeHint?: string;
};

const INTEGRATION_META: Record<string, IntegrationMeta> = {
  'google-calendar': {
    auth: 'google-oauth',
    implementation: 'planned',
    steps: [
      'Sign in to Google once (the same sign-in used for Google Fit / Contacts).',
      'Grant calendar.readonly + calendar.events scope when prompted.',
      'Two-way sync of events and reminders will become available here.',
    ],
    note: "Uses the same Google sign-in as Google Fit. No API key needed — that prompt was misleading and has been removed. Sync code is on the roadmap.",
  },
  'google-drive': {
    auth: 'google-oauth',
    implementation: 'planned',
    steps: [
      'Sign in to Google once (shared with Google Fit / Contacts).',
      'Grant drive.file scope (only files this app creates).',
      'Backups + document export to Drive will land here.',
    ],
    note: 'Until this ships, use Settings → Export → Google Drive (manual upload) for Drive backups.',
  },
  'gmail': {
    auth: 'google-oauth',
    implementation: 'planned',
    steps: [
      'Sign in to Google once (shared with Google Fit / Contacts).',
      'Grant gmail.send / gmail.readonly scope.',
      'Email-to-task and daily summary emails will be configurable here.',
    ],
  },
  'google-tasks': {
    auth: 'google-oauth',
    implementation: 'planned',
    steps: [
      'Sign in to Google once (shared with Google Fit / Contacts).',
      'Grant tasks scope to read & write task lists.',
      'Tasks will sync bidirectionally with Google Tasks lists.',
    ],
  },
  'apple-health':       { auth: 'oauth', implementation: 'planned', note: 'Apple HealthKit only works in a native iOS app — web cannot access it. Tracked for future native wrapper.' },
  'apple-reminders':    { auth: 'manual', implementation: 'planned', note: 'Apple Reminders has no public web API. Use the iCloud share link export or paste reminders via the Import button.' },
  'notion':             { auth: 'oauth',   implementation: 'planned', note: 'Will use Notion OAuth + databases API.' },
  'slack':              { auth: 'webhook', implementation: 'planned', note: 'Will accept an incoming webhook URL from Slack to post the daily digest.' },
  'dropbox':            { auth: 'oauth',   implementation: 'planned', note: 'Until this ships, use Settings → Export → Dropbox (manual upload).' },
  'onedrive':           { auth: 'oauth',   implementation: 'planned', note: 'Until this ships, use Settings → Export → OneDrive (manual upload).' },
  'fitbit':             { auth: 'oauth',   implementation: 'available', routeHint: 'Configure in the Fitness Provider section above.' },
  'headspace':          { auth: 'oauth',   implementation: 'planned',  note: 'No public Headspace/Calm API. Will use manual log entries until one is offered.' },
  'todoist':            { auth: 'oauth',   implementation: 'planned',  note: 'Will use Todoist REST API + OAuth.' },
  'ifttt':              { auth: 'webhook', implementation: 'planned',  note: 'Will accept an IFTTT webhook URL.' },
  'zapier':             { auth: 'webhook', implementation: 'planned',  note: 'Will accept a Zapier webhook URL.' },
};

interface Integration {
  id: string;
  name: string;
  icon: string;
  description: string;
  status: 'connected' | 'disconnected';
  lastSync?: string;
}

interface IntegrationConfig {
  apiKey?: string;
  webhookUrl?: string;
  syncFrequency?: 'manual' | 'hourly' | 'daily';
  syncDirection?: 'import' | 'export' | 'bidirectional';
}

/** Map IntegrationMeta.auth → user-facing badge label. */
const AUTH_LABEL: Record<IntegrationMeta['auth'], string> = {
  'google-oauth': 'Google sign-in',
  'oauth':        'OAuth',
  'api-key':      'API key',
  'webhook':      'Webhook URL',
  'manual':       'Manual import',
};

const IntegrationsView: React.FC = () => {
  // Reuse the existing Google OAuth session so we can show a live "connected"
  // indicator on Google-family cards instead of asking the user for an API key.
  const { isFitConnected, tokenExpired: googleTokenExpired } = useGoogleAuth();
  const googleSignedIn = isFitConnected && !googleTokenExpired;

  const [integrations, setIntegrations] = useState<Integration[]>([
    // Top Priority Integrations
    {
      id: 'google-calendar',
      name: 'Google Calendar',
      icon: '📅',
      description: 'Sync events and appointments',
      status: 'disconnected'
    },
    {
      id: 'google-drive',
      name: 'Google Drive',
      icon: '☁️',
      description: 'Backup/export data, store documents',
      status: 'disconnected'
    },
    {
      id: 'notion',
      name: 'Notion',
      icon: '📝',
      description: 'Export journal entries, create databases',
      status: 'disconnected'
    },
    {
      id: 'slack',
      name: 'Slack',
      icon: '💬',
      description: 'Daily digest notifications, task reminders',
      status: 'disconnected'
    },
    {
      id: 'apple-health',
      name: 'Apple Health',
      icon: '⌚',
      description: 'Track resolution progress (steps, workouts)',
      status: 'disconnected'
    },
    
    // Additional Integrations
    {
      id: 'dropbox',
      name: 'Dropbox',
      icon: '📦',
      description: 'File backup and sync',
      status: 'disconnected'
    },
    {
      id: 'onedrive',
      name: 'OneDrive',
      icon: '🌐',
      description: 'Microsoft cloud storage',
      status: 'disconnected'
    },
    {
      id: 'gmail',
      name: 'Gmail',
      icon: '📧',
      description: 'Email tasks to Leo, send daily summaries',
      status: 'disconnected'
    },
    {
      id: 'fitbit',
      name: 'Fitbit',
      icon: '🏃',
      description: 'Fitness goal tracking for resolutions',
      status: 'disconnected'
    },
    {
      id: 'headspace',
      name: 'Headspace/Calm',
      icon: '🧘',
      description: 'Meditation tracking for wellness resolutions',
      status: 'disconnected'
    },
    
    // Original Integrations
    {
      id: 'google-tasks',
      name: 'Google Tasks',
      icon: '📋',
      description: 'Sync tasks with Google Tasks',
      status: 'disconnected'
    },
    {
      id: 'apple-reminders',
      name: 'Apple Reminders',
      icon: '🍎',
      description: 'Import from Apple Reminders',
      status: 'disconnected'
    },
    {
      id: 'todoist',
      name: 'Todoist',
      icon: '✅',
      description: 'Sync with Todoist projects',
      status: 'disconnected'
    },
    {
      id: 'ifttt',
      name: 'IFTTT',
      icon: '🔗',
      description: 'Create webhooks and automations',
      status: 'disconnected'
    },
    {
      id: 'zapier',
      name: 'Zapier',
      icon: '⚡',
      description: 'Connect with 1000+ apps',
      status: 'disconnected'
    }
  ]);

  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [config, setConfig] = useState<IntegrationConfig>({
    syncFrequency: 'manual',
    syncDirection: 'bidirectional'
  });
  const [importData, setImportData] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);

  // Load saved integrations from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('myday-integrations');
    if (saved) {
      try {
        const savedIntegrations = JSON.parse(saved);
        setIntegrations(savedIntegrations);
      } catch (e) {
        console.error('Error loading integrations:', e);
      }
    }
  }, []);

  const saveIntegrations = (updated: Integration[]) => {
    localStorage.setItem('myday-integrations', JSON.stringify(updated));
    setIntegrations(updated);
  };

  const handleConnect = (integration: Integration) => {
    setSelectedIntegration(integration);
    setShowConfigModal(true);
  };

  const handleDisconnect = (integrationId: string) => {
    if (confirm('Are you sure you want to disconnect this integration?')) {
      const updated = integrations.map(int => 
        int.id === integrationId 
          ? { ...int, status: 'disconnected' as const, lastSync: undefined }
          : int
      );
      saveIntegrations(updated);
    }
  };

  const handleConfigSave = () => {
    if (!selectedIntegration) return;

    const updated = integrations.map(int => 
      int.id === selectedIntegration.id
        ? { ...int, status: 'connected' as const, lastSync: new Date().toISOString() }
        : int
    );
    saveIntegrations(updated);
    setShowConfigModal(false);
    setSelectedIntegration(null);
  };

  const handleSync = async (integrationId: string) => {
    // In production, this would call actual APIs
    alert(`Syncing ${integrationId}... (Demo mode)`);
    
    const updated = integrations.map(int => 
      int.id === integrationId
        ? { ...int, lastSync: new Date().toISOString() }
        : int
    );
    saveIntegrations(updated);
  };

  const handleImport = () => {
    if (!importData.trim()) {
      alert('Please paste JSON data to import');
      return;
    }

    try {
      const tasks: Task[] = JSON.parse(importData);
      
      if (!Array.isArray(tasks)) {
        throw new Error('Invalid format');
      }

      // Validate and import tasks
      let imported = 0;
      tasks.forEach(task => {
        if (task.name && task.weightage !== undefined) {
          const newTask: Task = {
            id: crypto.randomUUID(),
            name: task.name,
            description: task.description,
            category: task.category,
            weightage: task.weightage,
            frequency: task.frequency || 'daily',
            color: task.color,
            createdAt: new Date().toISOString()
          };
          addTask(newTask);
          imported++;
        }
      });

      alert(`Successfully imported ${imported} task(s)!`);
      setShowImportModal(false);
      setImportData('');
      window.dispatchEvent(new Event('storage'));
    } catch (e) {
      alert('Invalid JSON format. Please check your data and try again.');
    }
  };

  const handleExport = () => {
    const tasks = getTasks();
    const json = JSON.stringify(tasks, null, 2);
    
    // Create a blob and download
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `myday-tasks-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatLastSync = (dateStr?: string) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="integrations-view">
      <div className="integrations-header">
        <div>
          <h2>🔌 Integration Hub</h2>
          <p>Connect Leo Planner with your favorite productivity tools - plan with strength!</p>
        </div>
      </div>

      {/* Fitness Provider — Google Fit / Fitbit / Garmin */}
      <FitnessProviderSection />

      {/* Google Services — Contacts, Takeout */}
      <GoogleServicesSection />

      <div className="integrations-grid">
        {integrations.map(integration => {
          const meta = INTEGRATION_META[integration.id];
          // Live status overrides the persisted localStorage flag for Google-family
          // integrations (we know the real OAuth state via useGoogleAuth).
          const isGoogleFamily = meta?.auth === 'google-oauth';
          const liveConnected = isGoogleFamily ? googleSignedIn : integration.status === 'connected';
          const isPlanned = meta?.implementation === 'planned';
          return (
          <div key={integration.id} className="integration-card">
            <div className="integration-icon">{integration.icon}</div>
            <div className="integration-content">
              <h3>
                {integration.name}
                {meta && (
                  <span
                    title={
                      isPlanned
                        ? 'Not yet implemented — see setup notes for details.'
                        : 'Available — click Connect to configure.'
                    }
                    style={{
                      marginLeft: 8,
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: isPlanned ? '#fef3c7' : '#dcfce7',
                      color:      isPlanned ? '#854f0b' : '#166534',
                      border:     isPlanned ? '0.5px solid #f59e0b' : '0.5px solid #16a34a',
                      verticalAlign: 'middle',
                    }}
                  >
                    {isPlanned ? 'PLANNED' : 'READY'}
                  </span>
                )}
              </h3>
              <p>{integration.description}</p>
              {meta && (
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                  Auth: <strong>{AUTH_LABEL[meta.auth]}</strong>
                  {isGoogleFamily && (
                    <span style={{ marginLeft: 8 }}>
                      ·{' '}
                      <span
                        style={{
                          color: googleSignedIn ? '#166534' : googleTokenExpired ? '#b91c1c' : '#6b7280',
                          fontWeight: 600,
                        }}
                      >
                        {googleSignedIn
                          ? 'Google signed in'
                          : googleTokenExpired
                            ? 'Google token expired — reconnect in Fitness section'
                            : 'Google not signed in'}
                      </span>
                    </span>
                  )}
                </div>
              )}
              {liveConnected && integration.lastSync && !isGoogleFamily && (
                <div className="integration-status">
                  <span className="status-badge connected">✓ Connected</span>
                  <span className="last-sync">Last sync: {formatLastSync(integration.lastSync)}</span>
                </div>
              )}
            </div>
            <div className="integration-actions">
              {!liveConnected ? (
                <button onClick={() => handleConnect(integration)} className="btn-connect">
                  {isPlanned ? 'Setup info' : 'Connect'}
                </button>
              ) : (
                <>
                  {!isPlanned && (
                    <button onClick={() => handleSync(integration.id)} className="btn-sync">
                      🔄 Sync
                    </button>
                  )}
                  <button onClick={() => handleDisconnect(integration.id)} className="btn-disconnect">
                    Disconnect
                  </button>
                </>
              )}
            </div>
          </div>
        );})}
      </div>

      {/* Configuration / Setup-Info Modal
          Behaviour now varies by INTEGRATION_META[id]:
          - google-oauth → explain that the existing Google sign-in is reused;
            no API key prompt at all.
          - api-key       → keep the credentials field (no current integration
            actually uses this, but we leave the path in for future use).
          - oauth/webhook/manual → show setup steps + a roadmap note. */}
      {showConfigModal && selectedIntegration && (() => {
        const meta = INTEGRATION_META[selectedIntegration.id];
        const isPlanned = meta?.implementation === 'planned';
        const isGoogleFamily = meta?.auth === 'google-oauth';
        const requiresKey = meta?.auth === 'api-key';
        return (
          <div className="modal-overlay" onClick={() => setShowConfigModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{isPlanned ? `Setup: ${selectedIntegration.name}` : `Configure ${selectedIntegration.name}`}</h2>
                <button className="modal-close" onClick={() => setShowConfigModal(false)}>×</button>
              </div>
              <div style={{ padding: '1.25rem' }}>
                {/* Status banner */}
                <div
                  style={{
                    padding: '0.75rem 0.875rem',
                    borderRadius: 8,
                    background: isPlanned ? '#fffbeb' : '#ecfdf5',
                    border: isPlanned ? '1px solid #fcd34d' : '1px solid #6ee7b7',
                    color:  isPlanned ? '#854f0b' : '#065f46',
                    fontSize: 13,
                    lineHeight: 1.55,
                    marginBottom: 14,
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>
                    {isPlanned
                      ? '🚧 Not yet implemented'
                      : '✅ Ready to connect'}
                  </div>
                  {isPlanned
                    ? 'This integration is on the roadmap. The setup steps below describe how it will work once shipped.'
                    : 'Click Save & Connect to enable this integration.'}
                </div>

                {/* Google OAuth note */}
                {isGoogleFamily && (
                  <div
                    style={{
                      padding: '0.75rem 0.875rem',
                      borderRadius: 8,
                      background: '#eff6ff',
                      border: '1px solid #93c5fd',
                      color: '#1e3a8a',
                      fontSize: 12,
                      marginBottom: 14,
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>
                      🔑 Uses your existing Google sign-in
                    </div>
                    No API key required — this reuses the same OAuth client as Google Fit and Contacts.
                    {!googleSignedIn && (
                      <div style={{ marginTop: 6 }}>
                        You're not signed in to Google yet. Sign in once from the{' '}
                        <strong>Fitness Provider</strong> section above and all Google services unlock together.
                      </div>
                    )}
                    {googleSignedIn && (
                      <div style={{ marginTop: 6, color: '#166534' }}>
                        ✓ You're signed in to Google.
                      </div>
                    )}
                  </div>
                )}

                {/* Setup steps */}
                {meta?.steps && meta.steps.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Setup steps</div>
                    <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.6, color: '#374151' }}>
                      {meta.steps.map((s, i) => <li key={i}>{s}</li>)}
                    </ol>
                  </div>
                )}

                {/* Free-form note */}
                {meta?.note && (
                  <div
                    style={{
                      padding: '0.625rem 0.75rem',
                      borderRadius: 6,
                      background: '#f9fafb',
                      border: '1px solid #e5e7eb',
                      color: '#4b5563',
                      fontSize: 12,
                      fontStyle: 'italic',
                      marginBottom: 14,
                    }}
                  >
                    {meta.note}
                  </div>
                )}

                {/* Where to go (if available elsewhere) */}
                {meta?.routeHint && (
                  <div
                    style={{
                      padding: '0.625rem 0.75rem',
                      borderRadius: 6,
                      background: '#ecfdf5',
                      border: '1px solid #6ee7b7',
                      color: '#065f46',
                      fontSize: 12,
                      marginBottom: 14,
                    }}
                  >
                    👉 {meta.routeHint}
                  </div>
                )}

                {/* Credentials field (only for api-key auth, currently none) */}
                {requiresKey && (
                  <form
                    className="integration-form"
                    onSubmit={(e) => { e.preventDefault(); handleConfigSave(); }}
                  >
                    <div className="form-group">
                      <label>API Key</label>
                      <input
                        type="password"
                        placeholder="Paste API key"
                        value={config.apiKey || ''}
                        onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                      />
                      <small>Stored locally on this device only.</small>
                    </div>
                    <div className="form-group">
                      <label>Sync Frequency</label>
                      <select
                        value={config.syncFrequency}
                        onChange={(e) => setConfig({ ...config, syncFrequency: e.target.value as any })}
                      >
                        <option value="manual">Manual only</option>
                        <option value="hourly">Every hour</option>
                        <option value="daily">Once daily</option>
                      </select>
                    </div>
                    <div className="form-actions">
                      <button type="submit" className="btn-primary">Save & Connect</button>
                      <button type="button" onClick={() => setShowConfigModal(false)} className="btn-secondary">
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {/* Default footer */}
                {!requiresKey && (
                  <div className="form-actions" style={{ marginTop: 8 }}>
                    {!isPlanned && (
                      <button type="button" onClick={handleConfigSave} className="btn-primary">
                        Mark as Connected
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowConfigModal(false)}
                      className="btn-secondary"
                    >
                      {isPlanned ? 'Got it' : 'Cancel'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Import Modal */}
      {showImportModal && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="modal-content import-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📥 Import Tasks</h2>
              <button className="modal-close" onClick={() => setShowImportModal(false)}>×</button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <p style={{ marginBottom: '1rem', color: '#6b7280' }}>Paste JSON data from another app or exported file</p>
              <textarea
                className="import-textarea"
                placeholder='[{"name": "Task name", "weightage": 5, "frequency": "daily", "category": "Work"}]'
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                rows={10}
              />
              <div className="form-actions">
                <button onClick={handleImport} className="btn-primary">Import</button>
                <button onClick={() => setShowImportModal(false)} className="btn-secondary">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Section */}
      <div className="integrations-info">
        <h3>💡 Integration Notes</h3>
        <div className="info-cards">
          <div className="info-card">
            <h4>🔒 Privacy First</h4>
            <p>All credentials are stored locally on your device. We never send your data to external servers.</p>
          </div>
          <div className="info-card">
            <h4>🔄 Sync Status</h4>
            <p>Sync happens in the background based on your preferences. Check the "Last sync" time for updates.</p>
          </div>
          <div className="info-card">
            <h4>📝 Google Keep Notes</h4>
            <p>While direct integration isn't available, you can export your Keep notes as text and paste into journal entries or import as tasks using the Import button above.</p>
          </div>
          <div className="info-card">
            <h4>📱 Pro Tip</h4>
            <p>Export your tasks regularly to backup your data. Import/Export works with any JSON-compatible app!</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntegrationsView;

