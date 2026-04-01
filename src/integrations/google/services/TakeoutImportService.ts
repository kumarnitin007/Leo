/**
 * Google Takeout Import Service
 *
 * Parses Google Keep exports (JSON files from Takeout .zip)
 * and converts them into Leo Tasks or Journal entries.
 *
 * Supports:
 *  - Individual .json files (one Keep note each)
 *  - Preview before import (returns parsed items)
 *  - De-duplication on re-import using content hash
 */

export interface KeepNote {
  title: string;
  textContent: string;
  labels: { name: string }[];
  isArchived: boolean;
  isTrashed: boolean;
  isPinned: boolean;
  color: string;
  createdTimestampUsec: number;
  userEditedTimestampUsec: number;
}

export interface ParsedImportItem {
  title: string;
  body: string;
  tags: string[];
  createdAt: string;
  isPinned: boolean;
  hash: string;
  destination: 'tasks' | 'journal';
}

export interface ImportPreview {
  items: ParsedImportItem[];
  skippedArchived: number;
  skippedTrashed: number;
  total: number;
}

/**
 * Parse JSON files from a Google Takeout Keep export.
 * Returns a preview — no DB writes happen here.
 */
export function parseTakeoutFiles(
  files: File[],
  includeArchived = false,
): Promise<ImportPreview> {
  return new Promise(async (resolve) => {
    const items: ParsedImportItem[] = [];
    let skippedArchived = 0;
    let skippedTrashed = 0;

    for (const file of files) {
      if (!file.name.endsWith('.json')) continue;
      try {
        const text = await file.text();
        const note: KeepNote = JSON.parse(text);

        if (note.isTrashed) { skippedTrashed++; continue; }
        if (note.isArchived && !includeArchived) { skippedArchived++; continue; }

        const title = (note.title || '').trim();
        const body = (note.textContent || '').trim();
        if (!title && !body) continue;

        const tags = (note.labels || []).map(l => l.name);
        const createdAt = note.createdTimestampUsec
          ? new Date(note.createdTimestampUsec / 1000).toISOString()
          : new Date().toISOString();

        items.push({
          title: title || body.slice(0, 60),
          body,
          tags,
          createdAt,
          isPinned: note.isPinned || false,
          hash: hashContent(title, body),
          destination: 'tasks',
        });
      } catch {
        // Skip invalid JSON files
      }
    }

    resolve({
      items,
      skippedArchived,
      skippedTrashed,
      total: files.length,
    });
  });
}

/**
 * Parse files from a Takeout .zip.
 * Falls back to asking user to extract if zip reading fails.
 */
export async function parseTakeoutZip(_file: File): Promise<ImportPreview> {
  // JSZip is not bundled — ask the user to extract instead.
  // This avoids a ~100KB dependency for a rarely-used flow.
  throw new Error(
    'Please extract the .zip file first and upload the individual .json files. ' +
    '(Look inside the "Keep" folder in the extracted archive.)',
  );
}

/**
 * Simple content hash for de-duplication.
 */
function hashContent(title: string, body: string): string {
  const str = `${title}|${body}`.toLowerCase().trim();
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return `keep_${Math.abs(hash).toString(36)}`;
}
