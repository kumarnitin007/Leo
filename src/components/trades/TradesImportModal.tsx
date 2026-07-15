/**
 * TradesImportModal
 *
 * Upload a Robinhood .csv / .xlsx export, tag the upload (like the passwords
 * import), preview how many rows are new vs duplicate, and import — duplicates
 * are never loaded twice.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { CryptoKey } from '../../utils/encryption';
import { Tag } from '../../types';
import { TradesData } from '../../types/trades';
import { getSafeTags, createSafeTag } from '../../storage';
import { parseTradesFile, ParsedTrades } from '../../services/trades/robinhoodParser';
import { mergeTrades, saveTrades, previewMerge } from '../../services/trades/tradesStorage';

interface TradesImportModalProps {
  existingData: TradesData;
  userId?: string;
  encryptionKey: CryptoKey;
  onClose: () => void;
  onImported: (data: TradesData) => void;
}

const TAG_COLORS = ['#667eea', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9'];

const TradesImportModal: React.FC<TradesImportModalProps> = ({
  existingData, userId, encryptionKey, onClose, onImported,
}) => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedTrades | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSafeTags().then(setTags).catch(() => setTags([]));
  }, []);

  const preview = useMemo(() => {
    if (!parsed) return null;
    return previewMerge(existingData, parsed.rows);
  }, [parsed, existingData]);

  const handleFile = async (f: File) => {
    setError(null);
    setFile(f);
    setParsed(null);
    setParsing(true);
    try {
      const result = await parseTradesFile(f, { tags: selectedTagIds, importBatchId: 'pending' });
      setParsed(result);
      if (result.source === 'unknown') {
        setError('This file does not look like a Robinhood export. You can still import it, but columns may be misread.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to read file.');
    } finally {
      setParsing(false);
    }
  };

  const toggleTag = (id: string) => {
    setSelectedTagIds(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };

  const handleCreateTag = async () => {
    const name = newTagName.trim();
    if (!name) return;
    const color = TAG_COLORS[tags.length % TAG_COLORS.length];
    const tag = await createSafeTag(name, color);
    if (tag) {
      setTags(prev => [...prev, tag]);
      setSelectedTagIds(prev => [...prev, tag.id]);
      setNewTagName('');
    }
  };

  const handleImport = async () => {
    if (!parsed || !file) return;
    setImporting(true);
    setError(null);
    try {
      // Re-stamp tags onto rows (in case tags changed after parse)
      const rows = parsed.rows.map(r => ({ ...r, tags: selectedTagIds }));
      const { data } = mergeTrades(existingData, rows, {
        fileName: file.name,
        source: parsed.source,
        tags: selectedTagIds,
        dateRange: parsed.dateRange,
      });
      await saveTrades(userId, encryptionKey, data);
      onImported(data);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div
        className="trades-import-modal"
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 16, padding: '1.75rem', width: '95vw',
          maxWidth: 620, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            📈 Import Trades
          </h2>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#6b7280' }}>✕</button>
        </div>

        {/* File picker */}
        <label
          htmlFor="trades-file-input"
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
            border: '2px dashed #c7d2fe', borderRadius: 12, padding: '1.75rem', cursor: 'pointer',
            background: '#f5f7ff', textAlign: 'center', marginBottom: '1rem',
          }}
        >
          <span style={{ fontSize: '1.75rem' }}>📄</span>
          <span style={{ fontWeight: 600, color: '#4338ca' }}>
            {file ? file.name : 'Choose a Robinhood CSV or Excel file'}
          </span>
          <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>Supports .csv, .xlsx, .xls</span>
          <input
            id="trades-file-input"
            type="file"
            accept=".csv,.xlsx,.xls"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </label>

        {parsing && <p style={{ color: '#6b7280' }}>Reading file…</p>}

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '0.75rem', borderRadius: 8, marginBottom: '1rem', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        {/* Parse preview */}
        {parsed && (
          <div style={{ background: '#f9fafb', borderRadius: 10, padding: '1rem', marginBottom: '1rem', border: '1px solid #eef0f2' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem' }}>
              <Stat label="Detected" value={parsed.source === 'robinhood' ? 'Robinhood' : 'Unknown'} />
              <Stat label="Rows parsed" value={String(parsed.rows.length)} />
              <Stat label="New" value={String(preview?.newCount ?? 0)} accent="#059669" />
              <Stat label="Duplicates" value={String(preview?.duplicateCount ?? 0)} accent="#d97706" />
            </div>
            {parsed.dateRange && (
              <p style={{ margin: '0.75rem 0 0', fontSize: '0.8rem', color: '#6b7280' }}>
                Date range: <strong>{parsed.dateRange.start}</strong> → <strong>{parsed.dateRange.end}</strong>
              </p>
            )}
            {preview && preview.newCount === 0 && (
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#d97706' }}>
                All rows in this file are already imported — nothing new to add.
              </p>
            )}
          </div>
        )}

        {/* Tags */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.9rem' }}>
            Tags for this upload <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span>
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.6rem' }}>
            {tags.length === 0 && <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>No tags yet — create one below.</span>}
            {tags.map(tag => {
              const active = selectedTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  style={{
                    padding: '0.35rem 0.7rem', borderRadius: 20, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                    border: `2px solid ${active ? tag.color : '#e5e7eb'}`,
                    background: active ? `${tag.color}20` : '#fff',
                    color: active ? tag.color : '#6b7280',
                  }}
                >
                  {tag.name}{active ? ' ✓' : ''}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={newTagName}
              onChange={e => setNewTagName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCreateTag(); } }}
              placeholder="New tag name…"
              style={{ flex: 1, padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.85rem' }}
            />
            <button
              type="button"
              onClick={handleCreateTag}
              disabled={!newTagName.trim()}
              className="ck-btn"
              style={{ whiteSpace: 'nowrap' }}
            >
              + Add tag
            </button>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
          <button onClick={onClose} className="ck-btn">Cancel</button>
          <button
            onClick={handleImport}
            disabled={!parsed || importing || (preview?.newCount ?? 0) === 0}
            className="ck-btn ck-btn-primary"
          >
            {importing ? 'Importing…' : `Import ${preview?.newCount ?? 0} trade${(preview?.newCount ?? 0) === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; accent?: string }> = ({ label, value, accent }) => (
  <div>
    <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#9ca3af', fontWeight: 700 }}>{label}</div>
    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: accent || '#1f2937' }}>{value}</div>
  </div>
);

export default TradesImportModal;
