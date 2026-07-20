/**
 * Unified Backup — destinations.
 *
 * v1 ships a Local (download) destination. Google Drive and Dropbox are defined
 * behind the same interface but not yet wired (they need OAuth scope changes +
 * serverless upload/list/download routes). They fail loudly rather than silently.
 */

import type { BackupEnvelope } from './backupTypes';

export interface BackupDestination {
  id: 'local' | 'gdrive' | 'dropbox';
  label: string;
  icon: string;
  available: boolean;
  /** Persist the envelope. `filename` is a suggested name. */
  save(envelope: BackupEnvelope, filename: string): Promise<void>;
}

function downloadJson(envelope: BackupEnvelope, filename: string) {
  const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const localDestination: BackupDestination = {
  id: 'local',
  label: 'Download (local file)',
  icon: '💾',
  available: true,
  async save(envelope, filename) {
    downloadJson(envelope, filename);
  },
};

function notImplemented(id: string, label: string): BackupDestination {
  return {
    id: id as BackupDestination['id'],
    label,
    icon: id === 'gdrive' ? '🟢' : '🔵',
    available: false,
    async save() {
      const msg = `${label} backup isn't wired up yet. Use "Download" and upload the file manually for now.`;
      console.warn(`[backup] ${msg}`);
      throw new Error(msg);
    },
  };
}

export const googleDriveDestination = notImplemented('gdrive', 'Google Drive');
export const dropboxDestination = notImplemented('dropbox', 'Dropbox');

export const ALL_DESTINATIONS: BackupDestination[] = [
  localDestination,
  googleDriveDestination,
  dropboxDestination,
];

/** Suggested filename, e.g. myday-backup-20260720-1135.myday */
export function suggestBackupFilename(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp = `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}`;
  return `myday-backup-${stamp}.myday`;
}
