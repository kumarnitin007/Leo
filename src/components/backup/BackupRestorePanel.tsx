/**
 * Backup & Restore panel (Settings → Backup).
 *
 * Create: gather every domain into one encrypted .myday file (local download in
 * v1; Drive/Dropbox shown as coming soon).
 * Restore: pick a file, identify it from its manifest, unlock, preview the diff
 * (new / duplicate / newer per domain), then import the selected domains.
 * Duplicates are skipped by stable record id, so re-importing is safe.
 */

import React, { useMemo, useState } from 'react';
import {
  createBackup,
  inspectBackup,
  prepareRestore,
  runRestore,
} from '../../services/backup/backupService';
import {
  ALL_DESTINATIONS,
  localDestination,
  suggestBackupFilename,
} from '../../services/backup/destinations';
import { addBackupHistory, getBackupHistory } from '../../services/backup/backupHistory';
import {
  BackupContext,
  BackupManifest,
  BundleV1,
  DomainDiff,
  DomainRestoreResult,
  DuplicatePolicy,
} from '../../services/backup/backupTypes';

type Tab = 'create' | 'restore';

const card: React.CSSProperties = { border: '1px solid #eef0f2', borderRadius: 12, padding: '1rem', marginBottom: '1rem' };
const errorBox: React.CSSProperties = { background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 8, padding: '0.6rem 0.75rem', fontSize: '0.85rem' };
const okBox: React.CSSProperties = { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', borderRadius: 8, padding: '0.6rem 0.75rem', fontSize: '0.85rem' };
const label: React.CSSProperties = { fontSize: '0.8rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.3rem' };
const input: React.CSSProperties = { width: '100%', padding: '0.5rem 0.6rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem', boxSizing: 'border-box' };

function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = (e) => resolve((e.target?.result as string) || '');
    r.onerror = () => reject(new Error('Could not read the file.'));
    r.readAsText(file);
  });
}

const BackupRestorePanel: React.FC = () => {
  const [tab, setTab] = useState<Tab>('create');
  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button className={`ck-btn ${tab === 'create' ? '' : ''}`} onClick={() => setTab('create')} style={{ fontWeight: tab === 'create' ? 800 : 500, background: tab === 'create' ? '#eef2ff' : undefined }}>
          ⬇️ Create backup
        </button>
        <button className="ck-btn" onClick={() => setTab('restore')} style={{ fontWeight: tab === 'restore' ? 800 : 500, background: tab === 'restore' ? '#eef2ff' : undefined }}>
          ⬆️ Restore
        </button>
      </div>
      {tab === 'create' ? <CreateTab /> : <RestoreTab />}
    </div>
  );
};

/* ─────────────────────────── Create ─────────────────────────── */

const CreateTab: React.FC = () => {
  const [password, setPassword] = useState('');
  const [deviceLabel, setDeviceLabel] = useState('');
  const [destId, setDestId] = useState<'local' | 'gdrive' | 'dropbox'>('local');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [done, setDone] = useState<{ counts: Record<string, number>; fileName: string } | null>(null);
  const history = useMemo(() => getBackupHistory(), [done]);

  const handleCreate = async () => {
    setBusy(true); setError(null); setWarnings([]); setDone(null);
    try {
      const dest = ALL_DESTINATIONS.find((d) => d.id === destId) || localDestination;
      if (!dest.available) throw new Error(`${dest.label} isn't available yet — use Download.`);
      const { envelope, warnings: w } = await createBackup(password, deviceLabel);
      const fileName = suggestBackupFilename();
      await dest.save(envelope, fileName);
      const total = Object.values(envelope.manifest.domainCounts).reduce((a, b) => a + b, 0);
      addBackupHistory({
        backupId: envelope.manifest.backupId,
        createdAt: envelope.manifest.createdAt,
        deviceLabel: envelope.manifest.deviceLabel,
        destination: dest.label,
        fileName,
        totalRecords: total,
        domainCounts: envelope.manifest.domainCounts,
      });
      setWarnings(w);
      setDone({ counts: envelope.manifest.domainCounts, fileName });
      setPassword('');
    } catch (e: any) {
      const msg = e?.message || String(e);
      console.error('[backup] create failed:', msg);
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div style={card}>
        <p style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: 0 }}>
          Creates one encrypted <code>.myday</code> file containing your tasks, events, items, journal, resolutions,
          routines, tags, to-dos, Safe passwords & documents, bank and trades. It's locked with your Safe master password.
        </p>

        <label style={label}>Destination</label>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
          {ALL_DESTINATIONS.map((d) => (
            <button
              key={d.id}
              onClick={() => d.available && setDestId(d.id)}
              disabled={!d.available}
              className="ck-btn"
              title={d.available ? d.label : `${d.label} — coming soon`}
              style={{
                opacity: d.available ? 1 : 0.5,
                cursor: d.available ? 'pointer' : 'not-allowed',
                fontWeight: destId === d.id ? 800 : 500,
                background: destId === d.id ? '#eef2ff' : undefined,
              }}
            >
              {d.icon} {d.label}{!d.available ? ' (soon)' : ''}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: '0.85rem' }}>
          <label style={label}>Device / note (optional)</label>
          <input style={input} value={deviceLabel} onChange={(e) => setDeviceLabel(e.target.value)} placeholder="e.g. Home laptop" />
        </div>

        <div style={{ marginBottom: '0.85rem' }}>
          <label style={label}>Safe master password</label>
          <input style={input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Required to encrypt the backup" autoComplete="off" />
        </div>

        <button className="ck-btn" onClick={handleCreate} disabled={busy || !password} style={{ fontWeight: 800, background: '#4f46e5', color: '#fff', opacity: busy || !password ? 0.6 : 1 }}>
          {busy ? 'Creating…' : '⬇️ Create backup'}
        </button>
      </div>

      {error && <div style={{ ...errorBox, marginBottom: '1rem' }}>⚠️ {error}</div>}

      {done && (
        <div style={{ ...okBox, marginBottom: '1rem' }}>
          ✅ Backup created: <strong>{done.fileName}</strong>
          <div style={{ marginTop: '0.4rem', fontSize: '0.8rem' }}>
            {Object.entries(done.counts).map(([k, v]) => `${k}: ${v}`).join(' · ')}
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div style={{ ...errorBox, background: '#fffbeb', border: '1px solid #fde68a', color: '#b45309', marginBottom: '1rem' }}>
          Some parts were skipped:
          <ul style={{ margin: '0.3rem 0 0', paddingLeft: '1.1rem' }}>{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </div>
      )}

      {history.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>Recent backups</div>
          {history.slice(0, 6).map((h) => (
            <div key={h.backupId} style={{ fontSize: '0.82rem', color: '#374151', padding: '0.25rem 0', borderBottom: '1px solid #f3f4f6' }}>
              <strong>{h.fileName}</strong> — {new Date(h.createdAt).toLocaleString()} · {h.totalRecords} records{h.deviceLabel ? ` · ${h.deviceLabel}` : ''}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────── Restore ─────────────────────────── */

const RestoreTab: React.FC = () => {
  const [fileText, setFileText] = useState<string | null>(null);
  const [manifest, setManifest] = useState<BackupManifest | null>(null);
  const [password, setPassword] = useState('');
  const [policy, setPolicy] = useState<DuplicatePolicy>('skip');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [bundle, setBundle] = useState<BundleV1 | null>(null);
  const [ctx, setCtx] = useState<BackupContext | null>(null);
  const [diffs, setDiffs] = useState<DomainDiff[] | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<DomainRestoreResult[] | null>(null);

  const resetPreview = () => { setBundle(null); setCtx(null); setDiffs(null); setResults(null); setSelected({}); };

  const handleFile = async (file: File | null) => {
    setError(null); setManifest(null); setFileText(null); resetPreview();
    if (!file) return;
    try {
      const text = await readFileText(file);
      const m = inspectBackup(text);
      setFileText(text);
      setManifest(m);
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  };

  const handlePreview = async () => {
    if (!fileText) return;
    setBusy(true); setError(null); setResults(null);
    try {
      const { bundle: b, ctx: c, diffs: d } = await prepareRestore(fileText, password, policy);
      setBundle(b); setCtx(c); setDiffs(d);
      const sel: Record<string, boolean> = {};
      d.forEach((x) => { sel[x.key] = x.newCount > 0 || x.newer > 0; });
      setSelected(sel);
    } catch (e: any) {
      const msg = e?.message || String(e);
      console.error('[backup] preview failed:', msg);
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async () => {
    if (!bundle || !ctx || !diffs) return;
    const keys = diffs.filter((d) => selected[d.key]).map((d) => d.key);
    if (keys.length === 0) { setError('Select at least one section to import.'); return; }
    setBusy(true); setError(null);
    try {
      const res = await runRestore(bundle, ctx, keys, policy);
      setResults(res);
    } catch (e: any) {
      const msg = e?.message || String(e);
      console.error('[backup] import failed:', msg);
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div style={card}>
        <label style={label}>Choose a backup file (.myday / .json)</label>
        <input type="file" accept=".myday,.json,application/json" onChange={(e) => handleFile(e.target.files?.[0] || null)} />
      </div>

      {error && <div style={{ ...errorBox, marginBottom: '1rem' }}>⚠️ {error}</div>}

      {manifest && (
        <div style={card}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>Backup details</div>
          <div style={{ fontSize: '0.85rem', color: '#374151', lineHeight: 1.7 }}>
            <div>Created: <strong>{new Date(manifest.createdAt).toLocaleString()}</strong></div>
            {manifest.deviceLabel && <div>Device: <strong>{manifest.deviceLabel}</strong></div>}
            <div>App version: {manifest.appVersion}</div>
            <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>ID: {manifest.backupId} · owner {manifest.userTag}</div>
            <div style={{ marginTop: '0.35rem' }}>
              {Object.entries(manifest.domainCounts).map(([k, v]) => `${k}: ${v}`).join(' · ')}
            </div>
          </div>
        </div>
      )}

      {manifest && !results && (
        <div style={card}>
          <div style={{ marginBottom: '0.85rem' }}>
            <label style={label}>Safe master password</label>
            <input style={input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password used when this backup was made" autoComplete="off" />
          </div>
          <div style={{ marginBottom: '0.85rem' }}>
            <label style={label}>On duplicates</label>
            <select style={input} value={policy} onChange={(e) => { setPolicy(e.target.value as DuplicatePolicy); resetPreview(); }}>
              <option value="skip">Skip items that already exist (safe)</option>
              <option value="update-if-newer">Update existing items if the backup's copy is newer</option>
            </select>
          </div>
          <button className="ck-btn" onClick={handlePreview} disabled={busy || !password} style={{ fontWeight: 800 }}>
            {busy ? 'Unlocking…' : '🔍 Unlock & preview'}
          </button>
        </div>
      )}

      {diffs && !results && (
        <div style={card}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>What will be imported</div>
          <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#6b7280' }}>
                <th style={{ padding: '0.35rem 0.25rem' }}></th>
                <th style={{ padding: '0.35rem 0.25rem' }}>Section</th>
                <th style={{ padding: '0.35rem 0.25rem', textAlign: 'right' }}>New</th>
                <th style={{ padding: '0.35rem 0.25rem', textAlign: 'right' }}>Duplicate</th>
                {policy === 'update-if-newer' && <th style={{ padding: '0.35rem 0.25rem', textAlign: 'right' }}>Newer</th>}
              </tr>
            </thead>
            <tbody>
              {diffs.map((d) => (
                <tr key={d.key} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '0.35rem 0.25rem' }}>
                    <input type="checkbox" checked={!!selected[d.key]} onChange={(e) => setSelected((s) => ({ ...s, [d.key]: e.target.checked }))} />
                  </td>
                  <td style={{ padding: '0.35rem 0.25rem' }}>{d.label}</td>
                  <td style={{ padding: '0.35rem 0.25rem', textAlign: 'right', color: d.newCount ? '#166534' : '#9ca3af', fontWeight: d.newCount ? 700 : 400 }}>{d.newCount}</td>
                  <td style={{ padding: '0.35rem 0.25rem', textAlign: 'right', color: '#9ca3af' }}>{d.duplicate}</td>
                  {policy === 'update-if-newer' && <td style={{ padding: '0.35rem 0.25rem', textAlign: 'right', color: d.newer ? '#b45309' : '#9ca3af' }}>{d.newer}</td>}
                </tr>
              ))}
            </tbody>
          </table>
          <button className="ck-btn" onClick={handleImport} disabled={busy} style={{ marginTop: '0.85rem', fontWeight: 800, background: '#4f46e5', color: '#fff' }}>
            {busy ? 'Importing…' : '⬆️ Import selected'}
          </button>
        </div>
      )}

      {results && (
        <div style={{ ...okBox, marginBottom: '1rem' }}>
          ✅ Restore complete.
          <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse', marginTop: '0.5rem', color: '#166534' }}>
            <tbody>
              {results.map((r) => (
                <tr key={r.key}>
                  <td style={{ padding: '0.2rem 0.25rem' }}>{r.label}</td>
                  <td style={{ padding: '0.2rem 0.25rem', textAlign: 'right' }}>
                    +{r.added} added{r.updated ? `, ${r.updated} updated` : ''}, {r.skipped} skipped
                    {r.failed ? `, ${r.failed} failed` : ''}
                    {r.error ? ` — ${r.error}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: '0.5rem', fontSize: '0.78rem' }}>Reload the app to see restored data everywhere.</div>
        </div>
      )}
    </div>
  );
};

export default BackupRestorePanel;
