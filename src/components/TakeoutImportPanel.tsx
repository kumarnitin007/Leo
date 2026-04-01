/**
 * TakeoutImportPanel
 *
 * Upload .json or .zip from Google Takeout (Keep notes).
 * Shows preview table, lets user choose destination (Tasks / Journal),
 * then imports. Embeds inside GoogleServicesSection.
 */

import React, { useState, useRef } from 'react';
import { parseTakeoutFiles, parseTakeoutZip, type ParsedImportItem, type ImportPreview } from '../integrations/google/services/TakeoutImportService';
import { addTask } from '../storage';
import { saveJournalEntry } from '../storage/journal';
import type { Task, JournalEntry } from '../types';
import { generateId } from '../utils';

const TakeoutImportPanel: React.FC = () => {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [items, setItems] = useState<ParsedImportItem[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setResult(null);

    try {
      let parsed: ImportPreview;
      if (files.length === 1 && files[0].name.endsWith('.zip')) {
        parsed = await parseTakeoutZip(files[0]);
      } else {
        parsed = await parseTakeoutFiles(files, includeArchived);
      }
      setPreview(parsed);
      setItems(parsed.items);
    } catch (err: any) {
      alert(err.message || 'Failed to parse files');
    }
  };

  const toggleDestination = (idx: number) => {
    setItems(prev => prev.map((item, i) =>
      i === idx ? { ...item, destination: item.destination === 'tasks' ? 'journal' : 'tasks' } : item,
    ));
  };

  const setAllDestination = (dest: 'tasks' | 'journal') => {
    setItems(prev => prev.map(item => ({ ...item, destination: dest })));
  };

  const handleImport = async () => {
    if (!items.length) return;
    setImporting(true);
    let tasksCreated = 0;
    let journalCreated = 0;

    for (const item of items) {
      try {
        if (item.destination === 'tasks') {
          const task: Task = {
            id: generateId(),
            name: item.title,
            description: item.body,
            category: 'Imported',
            weightage: 5,
            frequency: 'custom',
            customFrequency: 'One-time import from Google Keep',
            specificDate: new Date().toISOString().slice(0, 10),
            tags: item.tags.length > 0 ? item.tags : undefined,
            createdAt: item.createdAt,
          };
          await addTask(task);
          tasksCreated++;
        } else {
          const entry: JournalEntry = {
            id: generateId(),
            date: item.createdAt.slice(0, 10),
            content: `## ${item.title}\n\n${item.body}`,
            mood: 'okay',
            tags: item.tags,
            createdAt: item.createdAt,
            updatedAt: new Date().toISOString(),
          };
          await saveJournalEntry(entry);
          journalCreated++;
        }
      } catch (err: any) {
        console.warn(`[TakeoutImport] Failed to import "${item.title}":`, err.message);
      }
    }

    setResult(`Imported ${tasksCreated} tasks and ${journalCreated} journal entries.`);
    setImporting(false);
    setPreview(null);
    setItems([]);
  };

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.zip"
          multiple
          onChange={handleFiles}
          style={{ display: 'none' }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          style={{
            padding: '6px 14px', fontSize: 12, fontWeight: 600,
            background: '#4285F4', color: '#fff', border: 'none',
            borderRadius: 8, cursor: 'pointer',
          }}
        >
          📂 Upload Keep Files
        </button>
        <label style={{ fontSize: 11, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={e => setIncludeArchived(e.target.checked)}
          />
          Include archived
        </label>
      </div>

      {result && (
        <div style={{ fontSize: 12, color: '#059669', fontWeight: 600, marginBottom: 8 }}>
          ✓ {result}
        </div>
      )}

      {preview && items.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 6 }}>
            {items.length} notes ready · {preview.skippedArchived} archived · {preview.skippedTrashed} trashed
          </div>

          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <button onClick={() => setAllDestination('tasks')} style={pillStyle}>All → Tasks</button>
            <button onClick={() => setAllDestination('journal')} style={pillStyle}>All → Journal</button>
          </div>

          <div style={{ maxHeight: 250, overflowY: 'auto', border: '1px solid #E5E7EB', borderRadius: 8 }}>
            <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F9FAFB', position: 'sticky', top: 0 }}>
                  <th style={thStyle}>Title</th>
                  <th style={{ ...thStyle, width: 60 }}>Tags</th>
                  <th style={{ ...thStyle, width: 80 }}>Destination</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600, color: '#111827' }}>{item.title}</div>
                      {item.body && <div style={{ color: '#9CA3AF', fontSize: 10, marginTop: 2, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.body}</div>}
                    </td>
                    <td style={tdStyle}>
                      {item.tags.map(t => (
                        <span key={t} style={{ fontSize: 9, background: '#E5E7EB', padding: '1px 4px', borderRadius: 3, marginRight: 2 }}>{t}</span>
                      ))}
                    </td>
                    <td style={tdStyle}>
                      <button
                        onClick={() => toggleDestination(i)}
                        style={{
                          fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                          border: 'none', cursor: 'pointer',
                          background: item.destination === 'tasks' ? '#DBEAFE' : '#FEF3C7',
                          color: item.destination === 'tasks' ? '#1D4ED8' : '#92400E',
                        }}
                      >
                        {item.destination === 'tasks' ? '📝 Task' : '📖 Journal'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              onClick={handleImport}
              disabled={importing}
              style={{
                padding: '8px 20px', fontSize: 13, fontWeight: 700,
                background: '#059669', color: '#fff', border: 'none',
                borderRadius: 8, cursor: 'pointer',
              }}
            >
              {importing ? '⏳ Importing...' : `✓ Import ${items.length} Items`}
            </button>
            <button
              onClick={() => { setPreview(null); setItems([]); }}
              style={{
                padding: '8px 16px', fontSize: 12, fontWeight: 600,
                background: '#fff', color: '#6B7280', border: '1px solid #D1D5DB',
                borderRadius: 8, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {preview && items.length === 0 && (
        <div style={{ fontSize: 12, color: '#9CA3AF', padding: 12 }}>
          No importable notes found in the uploaded files.
        </div>
      )}
    </div>
  );
};

export default TakeoutImportPanel;

const pillStyle: React.CSSProperties = {
  padding: '3px 10px', fontSize: 10, fontWeight: 600,
  background: '#F3F4F6', color: '#374151', border: '1px solid #D1D5DB',
  borderRadius: 6, cursor: 'pointer',
};

const thStyle: React.CSSProperties = { textAlign: 'left', padding: '6px 8px', fontWeight: 600, color: '#6B7280' };
const tdStyle: React.CSSProperties = { padding: '6px 8px', verticalAlign: 'top' };
