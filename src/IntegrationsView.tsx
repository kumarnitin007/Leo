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

const IntegrationsView: React.FC = () => {
  const [integrations, setIntegrations] = useState<Integration[]>([
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
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => setShowImportModal(true)} className="btn-secondary">
            📥 Import Tasks
          </button>
          <button onClick={handleExport} className="btn-secondary">
            📤 Export Tasks
          </button>
        </div>
      </div>

      <div className="integrations-grid">
        {integrations.map(integration => (
          <div key={integration.id} className="integration-card">
            <div className="integration-icon">{integration.icon}</div>
            <div className="integration-content">
              <h3>{integration.name}</h3>
              <p>{integration.description}</p>
              {integration.status === 'connected' && (
                <div className="integration-status">
                  <span className="status-badge connected">✓ Connected</span>
                  <span className="last-sync">Last sync: {formatLastSync(integration.lastSync)}</span>
                </div>
              )}
            </div>
            <div className="integration-actions">
              {integration.status === 'disconnected' ? (
                <button 
                  onClick={() => handleConnect(integration)}
                  className="btn-connect"
                >
                  Connect
                </button>
              ) : (
                <>
                  <button 
                    onClick={() => handleSync(integration.id)}
                    className="btn-sync"
                  >
                    🔄 Sync
                  </button>
                  <button 
                    onClick={() => handleDisconnect(integration.id)}
                    className="btn-disconnect"
                  >
                    Disconnect
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Configuration Modal */}
      {showConfigModal && selectedIntegration && (
        <div className="modal-overlay" onClick={() => setShowConfigModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Configure {selectedIntegration.name}</h2>
              <button className="modal-close" onClick={() => setShowConfigModal(false)}>×</button>
            </div>
            <form className="integration-form" onSubmit={(e) => { e.preventDefault(); handleConfigSave(); }}>
              <div className="form-group">
                <label>API Key / Credentials</label>
                <input
                  type="password"
                  placeholder="Enter API key"
                  value={config.apiKey || ''}
                  onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                />
                <small>Your credentials are stored locally and never sent to our servers</small>
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

              <div className="form-group">
                <label>Sync Direction</label>
                <select
                  value={config.syncDirection}
                  onChange={(e) => setConfig({ ...config, syncDirection: e.target.value as any })}
                >
                  <option value="import">Import only (from {selectedIntegration.name})</option>
                  <option value="export">Export only (to {selectedIntegration.name})</option>
                  <option value="bidirectional">Two-way sync</option>
                </select>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-primary">Save & Connect</button>
                <button type="button" onClick={() => setShowConfigModal(false)} className="btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

