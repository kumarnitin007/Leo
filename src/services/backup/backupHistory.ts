/**
 * Unified Backup — lightweight local history (localStorage).
 *
 * Records what backups the user has created so the UI can show a recent list.
 * This is metadata only (no data, no secrets).
 */

import { BackupHistoryEntry } from './backupTypes';

const KEY = 'myday_backup_history';
const MAX = 20;

export function getBackupHistory(): BackupHistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function addBackupHistory(entry: BackupHistoryEntry): void {
  try {
    const list = [entry, ...getBackupHistory().filter((e) => e.backupId !== entry.backupId)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('[backup] Could not save backup history:', e);
  }
}

export function clearBackupHistory(): void {
  try {
    localStorage.removeItem(KEY);
  } catch { /* ignore */ }
}
