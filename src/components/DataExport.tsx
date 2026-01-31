/**
 * DataExport Component
 * 
 * Comprehensive data export feature that allows users to:
 * - Export all their data (tasks, events, journals, etc.)
 * - Choose format: CSV, JSON, or Excel-compatible
 * - Download locally or upload to cloud services (Dropbox, Google Drive)
 */

import React, { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getTasks,
  getEvents,
  getJournalEntries,
  getRoutines,
  getTags,
  getItems,
  getSafeEntries,
  getSafeTags,
  getDocumentVaults
} from '../storage';
import { Task, Event, JournalEntry, Routine, Tag, Item, SafeEntry, DocumentVault } from '../types';
import * as todoService from '../services/todoService';

// Export format types
type ExportFormat = 'json' | 'csv' | 'xlsx';
type ExportDestination = 'download' | 'dropbox' | 'google-drive' | 'onedrive';

interface ExportOptions {
  tasks: boolean;
  events: boolean;
  journals: boolean;
  routines: boolean;
  tags: boolean;
  items: boolean;
  todos: boolean;
  safeEntries: boolean; // Note: Only metadata, not encrypted data
  documents: boolean; // Note: Only metadata
}

interface ExportData {
  exportedAt: string;
  version: string;
  user?: { id: string; email?: string };
  tasks?: Task[];
  events?: Event[];
  journals?: JournalEntry[];
  routines?: Routine[];
  tags?: Tag[];
  items?: Item[];
  todos?: { groups: any[]; items: any[] };
  safeEntriesMetadata?: { id: string; title: string; category: string; createdAt: string; updatedAt: string }[];
  documentsMetadata?: { id: string; title: string; createdAt: string; updatedAt: string }[];
}

const DataExport: React.FC = () => {
  const { user } = useAuth();
  const [format, setFormat] = useState<ExportFormat>('json');
  const [destination, setDestination] = useState<ExportDestination>('download');
  const [options, setOptions] = useState<ExportOptions>({
    tasks: true,
    events: true,
    journals: true,
    routines: true,
    tags: true,
    items: true,
    todos: true,
    safeEntries: false, // Off by default for security
    documents: false,
  });
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  // Toggle individual option
  const toggleOption = (key: keyof ExportOptions) => {
    setOptions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Select/deselect all
  const selectAll = (selected: boolean) => {
    setOptions({
      tasks: selected,
      events: selected,
      journals: selected,
      routines: selected,
      tags: selected,
      items: selected,
      todos: selected,
      safeEntries: selected,
      documents: selected,
    });
  };

  // Gather export data
  const gatherExportData = async (): Promise<ExportData> => {
    const data: ExportData = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      user: user ? { id: user.id, email: user.email } : undefined,
    };

    if (options.tasks) {
      setExportProgress('Loading tasks...');
      data.tasks = await getTasks();
    }

    if (options.events) {
      setExportProgress('Loading events...');
      data.events = await getEvents();
    }

    if (options.journals) {
      setExportProgress('Loading journal entries...');
      data.journals = await getJournalEntries();
    }

    if (options.routines) {
      setExportProgress('Loading routines...');
      data.routines = await getRoutines();
    }

    if (options.tags) {
      setExportProgress('Loading tags...');
      data.tags = await getTags();
    }

    if (options.items) {
      setExportProgress('Loading items...');
      data.items = await getItems();
    }

    if (options.todos) {
      setExportProgress('Loading to-dos...');
      const groups = await todoService.getGroups();
      const items = await todoService.getItems();
      data.todos = { groups, items };
    }

    if (options.safeEntries) {
      setExportProgress('Loading safe entries metadata...');
      // Only export metadata, not encrypted content
      const entries = await getSafeEntries(null as any); // Pass null key - we only want metadata
      data.safeEntriesMetadata = entries.map(e => ({
        id: e.id,
        title: e.title,
        category: e.category || 'unknown',
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      }));
    }

    if (options.documents) {
      setExportProgress('Loading document metadata...');
      const docs = await getDocumentVaults(null as any);
      data.documentsMetadata = docs.map(d => ({
        id: d.id,
        title: d.title,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      }));
    }

    return data;
  };

  // Convert data to CSV format
  const convertToCSV = (data: ExportData): string => {
    const sheets: string[] = [];
    
    // Helper to convert array of objects to CSV
    const arrayToCSV = (arr: any[], name: string): string => {
      if (!arr || arr.length === 0) return '';
      
      const headers = Object.keys(arr[0]);
      const rows = arr.map(item => 
        headers.map(h => {
          const val = item[h];
          if (val === null || val === undefined) return '';
          if (typeof val === 'object') return JSON.stringify(val).replace(/"/g, '""');
          return String(val).replace(/"/g, '""');
        }).map(v => `"${v}"`).join(',')
      );
      
      return `### ${name} ###\n${headers.join(',')}\n${rows.join('\n')}\n\n`;
    };

    if (data.tasks) sheets.push(arrayToCSV(data.tasks, 'Tasks'));
    if (data.events) sheets.push(arrayToCSV(data.events, 'Events'));
    if (data.journals) sheets.push(arrayToCSV(data.journals, 'Journals'));
    if (data.routines) sheets.push(arrayToCSV(data.routines, 'Routines'));
    if (data.tags) sheets.push(arrayToCSV(data.tags, 'Tags'));
    if (data.items) sheets.push(arrayToCSV(data.items, 'Items'));
    if (data.todos?.groups) sheets.push(arrayToCSV(data.todos.groups, 'TodoGroups'));
    if (data.todos?.items) sheets.push(arrayToCSV(data.todos.items, 'TodoItems'));
    if (data.safeEntriesMetadata) sheets.push(arrayToCSV(data.safeEntriesMetadata, 'SafeEntriesMetadata'));
    if (data.documentsMetadata) sheets.push(arrayToCSV(data.documentsMetadata, 'DocumentsMetadata'));

    return `Leo App Data Export\nExported: ${data.exportedAt}\nVersion: ${data.version}\n\n${sheets.join('\n')}`;
  };

  // Download file locally
  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Upload to Dropbox
  const uploadToDropbox = async (content: string, filename: string): Promise<boolean> => {
    // Dropbox uses OAuth 2.0 - we need to redirect user to authorize
    const DROPBOX_APP_KEY = import.meta.env.VITE_DROPBOX_APP_KEY;
    
    if (!DROPBOX_APP_KEY) {
      // Open Dropbox in new tab with manual upload instructions
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Download file first
      downloadFile(content, filename, 'application/json');
      
      // Open Dropbox upload page
      window.open('https://www.dropbox.com/home', '_blank');
      
      setSuccess('File downloaded! Please upload it manually to your Dropbox.');
      return true;
    }

    // If we have API key, use Dropbox API (would require full OAuth flow)
    // For now, fall back to download + manual upload
    downloadFile(content, filename, 'application/json');
    window.open('https://www.dropbox.com/home', '_blank');
    setSuccess('File downloaded! Please upload it to your Dropbox.');
    return true;
  };

  // Upload to Google Drive
  const uploadToGoogleDrive = async (content: string, filename: string): Promise<boolean> => {
    const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    
    if (!GOOGLE_CLIENT_ID) {
      // Fall back to download + open Google Drive
      downloadFile(content, filename, 'application/json');
      window.open('https://drive.google.com/drive/my-drive', '_blank');
      setSuccess('File downloaded! Please upload it to your Google Drive.');
      return true;
    }

    // Would implement full Google OAuth + Drive API here
    downloadFile(content, filename, 'application/json');
    window.open('https://drive.google.com/drive/my-drive', '_blank');
    setSuccess('File downloaded! Please upload it to your Google Drive.');
    return true;
  };

  // Upload to OneDrive
  const uploadToOneDrive = async (content: string, filename: string): Promise<boolean> => {
    // Fall back to download + open OneDrive
    downloadFile(content, filename, 'application/json');
    window.open('https://onedrive.live.com/', '_blank');
    setSuccess('File downloaded! Please upload it to your OneDrive.');
    return true;
  };

  // Main export function
  const handleExport = async () => {
    setIsExporting(true);
    setError('');
    setSuccess('');
    setExportProgress('Starting export...');

    try {
      // Gather data
      const data = await gatherExportData();
      
      // Format data
      setExportProgress('Formatting data...');
      let content: string;
      let filename: string;
      let mimeType: string;
      const dateStr = new Date().toISOString().split('T')[0];

      switch (format) {
        case 'json':
          content = JSON.stringify(data, null, 2);
          filename = `leo-export-${dateStr}.json`;
          mimeType = 'application/json';
          break;
        case 'csv':
          content = convertToCSV(data);
          filename = `leo-export-${dateStr}.csv`;
          mimeType = 'text/csv';
          break;
        case 'xlsx':
          // For XLSX, we export as CSV which can be opened in Excel
          content = convertToCSV(data);
          filename = `leo-export-${dateStr}.csv`;
          mimeType = 'text/csv';
          break;
      }

      // Handle destination
      setExportProgress('Saving...');
      switch (destination) {
        case 'download':
          downloadFile(content, filename, mimeType);
          setSuccess(`Successfully exported ${filename}!`);
          break;
        case 'dropbox':
          await uploadToDropbox(content, filename);
          break;
        case 'google-drive':
          await uploadToGoogleDrive(content, filename);
          break;
        case 'onedrive':
          await uploadToOneDrive(content, filename);
          break;
      }
    } catch (err) {
      console.error('Export error:', err);
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExporting(false);
      setExportProgress('');
    }
  };

  const selectedCount = Object.values(options).filter(Boolean).length;

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          📤 Export Your Data
        </h3>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>
          Download a backup of all your Leo app data. Safe entries export only metadata (titles/dates), not passwords.
        </p>
      </div>

      {/* Data Selection */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Select Data to Export</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => selectAll(true)}
              style={{
                padding: '0.375rem 0.75rem',
                fontSize: '0.8rem',
                background: '#f3f4f6',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
              }}
            >
              Select All
            </button>
            <button
              onClick={() => selectAll(false)}
              style={{
                padding: '0.375rem 0.75rem',
                fontSize: '0.8rem',
                background: '#f3f4f6',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
              }}
            >
              Clear All
            </button>
          </div>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', 
          gap: '0.5rem' 
        }}>
          {[
            { key: 'tasks' as const, label: '✅ Tasks', icon: '✅' },
            { key: 'events' as const, label: '📅 Events', icon: '📅' },
            { key: 'journals' as const, label: '📔 Journals', icon: '📔' },
            { key: 'routines' as const, label: '🔄 Routines', icon: '🔄' },
            { key: 'tags' as const, label: '🏷️ Tags', icon: '🏷️' },
            { key: 'items' as const, label: '📦 Items', icon: '📦' },
            { key: 'todos' as const, label: '📝 To-Dos', icon: '📝' },
            { key: 'safeEntries' as const, label: '🔐 Safe (meta)', icon: '🔐' },
            { key: 'documents' as const, label: '📄 Docs (meta)', icon: '📄' },
          ].map(({ key, label }) => (
            <label
              key={key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.625rem',
                background: options[key] ? '#eff6ff' : '#f9fafb',
                border: `2px solid ${options[key] ? '#3b82f6' : '#e5e7eb'}`,
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontSize: '0.85rem',
                transition: 'all 0.2s',
              }}
            >
              <input
                type="checkbox"
                checked={options[key]}
                onChange={() => toggleOption(key)}
                style={{ accentColor: '#3b82f6' }}
              />
              {label}
            </label>
          ))}
        </div>
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#9ca3af' }}>
          {selectedCount} of 9 selected
        </p>
      </div>

      {/* Format Selection */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem' }}>
          Export Format
        </label>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {[
            { value: 'json' as const, label: 'JSON', desc: 'Best for backup' },
            { value: 'csv' as const, label: 'CSV', desc: 'Spreadsheet compatible' },
            { value: 'xlsx' as const, label: 'Excel', desc: 'Opens in Excel' },
          ].map(({ value, label, desc }) => (
            <button
              key={value}
              onClick={() => setFormat(value)}
              style={{
                padding: '0.75rem 1rem',
                background: format === value ? '#3b82f6' : 'white',
                color: format === value ? 'white' : '#374151',
                border: `2px solid ${format === value ? '#3b82f6' : '#e5e7eb'}`,
                borderRadius: '0.5rem',
                cursor: 'pointer',
                flex: '1',
                minWidth: '100px',
              }}
            >
              <div style={{ fontWeight: 600 }}>{label}</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>{desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Destination Selection */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem' }}>
          Save To
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
          {[
            { value: 'download' as const, label: '💾 Download', desc: 'Save to device' },
            { value: 'dropbox' as const, label: '📦 Dropbox', desc: 'Cloud backup' },
            { value: 'google-drive' as const, label: '🔶 Google Drive', desc: 'Cloud backup' },
            { value: 'onedrive' as const, label: '☁️ OneDrive', desc: 'Cloud backup' },
          ].map(({ value, label, desc }) => (
            <button
              key={value}
              onClick={() => setDestination(value)}
              style={{
                padding: '0.875rem',
                background: destination === value ? '#10b981' : 'white',
                color: destination === value ? 'white' : '#374151',
                border: `2px solid ${destination === value ? '#10b981' : '#e5e7eb'}`,
                borderRadius: '0.5rem',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{ fontWeight: 600 }}>{label}</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>{desc}</div>
            </button>
          ))}
        </div>
        {destination !== 'download' && (
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#f59e0b' }}>
            ⚠️ Cloud services will download the file first, then open the service for manual upload.
          </p>
        )}
      </div>

      {/* Export Button */}
      <button
        onClick={handleExport}
        disabled={isExporting || selectedCount === 0}
        style={{
          width: '100%',
          padding: '1rem',
          background: isExporting || selectedCount === 0 
            ? '#d1d5db' 
            : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          color: 'white',
          border: 'none',
          borderRadius: '0.75rem',
          fontSize: '1rem',
          fontWeight: 600,
          cursor: isExporting || selectedCount === 0 ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
        }}
      >
        {isExporting ? (
          <>
            <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
            {exportProgress || 'Exporting...'}
          </>
        ) : (
          <>
            📤 Export {selectedCount} Data Type{selectedCount !== 1 ? 's' : ''}
          </>
        )}
      </button>

      {/* Status Messages */}
      {error && (
        <div style={{
          marginTop: '1rem',
          padding: '0.875rem',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '0.5rem',
          color: '#dc2626',
          fontSize: '0.9rem',
        }}>
          ❌ {error}
        </div>
      )}

      {success && (
        <div style={{
          marginTop: '1rem',
          padding: '0.875rem',
          background: '#ecfdf5',
          border: '1px solid #a7f3d0',
          borderRadius: '0.5rem',
          color: '#059669',
          fontSize: '0.9rem',
        }}>
          ✅ {success}
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default DataExport;
