/**
 * CSV Import Utilities for Safe Section
 * 
 * Handles parsing KeePass CSV format and auto-detecting categories
 */

import { SafeEntry, SafeEntryEncryptedData, Tag } from '../types';
import { encryptData, decryptData } from './encryption';
import { CryptoKey } from './encryption';

/**
 * Parsed CSV row from KeePass format
 */
export interface ParsedCSVRow {
  account: string;      // Title
  loginName: string;    // Username
  password: string;     // Password
  webSite: string;      // URL
  comments: string;     // Notes
}

/**
 * Preview entry with detected category
 */
export interface PreviewEntry {
  title: string;
  url?: string;
  username?: string;
  password?: string;
  notes?: string;
  detectedCategory: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Import summary
 */
export interface ImportSummary {
  total: number;
  imported: number;
  updated?: number;
  skipped: number;
  categoryMapping: Record<string, number>;
  errors: string[];
}

/**
 * Category detection keywords
 */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Login/Credentials': ['login', 'credential', 'username', 'password', 'email', 'account'],
  'Credit Card': ['credit card', 'cc ', 'amex', 'visa', 'mastercard', 'discover', 'card number', 'cvv', 'expiry'],
  'Bank Account': ['bank', 'checking', 'savings', 'account', 'icici', 'chase', 'sbi', 'hdfc', 'bofa', 'wells fargo', 'routing', 'account number'],
  'Insurance': ['insurance', 'lic', 'progressive', 'cigna', 'allstate', 'policy', 'premium'],
  'Medical': ['medical', 'health', 'doctor', 'hospital', 'clinic', 'prescription', 'rx'],
  'License/Software': ['license', 'software', 'product key', 'serial', 'activation'],
  'API Key': ['api key', 'api', 'secret key', 'access token', 'client id', 'client secret'],
  'WiFi': ['wifi', 'wifi', 'network', 'router', 'ssid', 'wireless'],
  'Gift Card': ['gift card', 'giftcard', 'voucher', 'prepaid card'],
  'Identity Documents': ['passport', 'aadhar', 'aadhaar', 'pan', 'ssn', 'dl', 'driving license', 'license plate', 'vin'],
  'Stock Trading Account': ['trading', 'broker', 'fidelity', 'etrade', 'robinhood', 'schwab', 'td ameritrade'],
  'Address': ['address', 'street', 'zip code', 'zipcode', 'postal code', 'city', 'state', 'province', 'country', 'pin code', 'pincode', 'suite', 'apartment', 'apt', 'unit', 'building', 'locality', 'area', 'postcode', 'avenue', 'road', 'boulevard']
};

/**
 * Detect category from title, comments, and URL
 */
function detectCategory(row: ParsedCSVRow, categoryTags: Tag[]): { categoryId: string | undefined; confidence: 'high' | 'medium' | 'low' } {
  const searchText = `${row.account} ${row.comments} ${row.webSite}`.toLowerCase();
  
  let bestMatch: { categoryId: string | undefined; score: number } = { categoryId: undefined, score: 0 };
  
  // Check each category
  for (const [categoryName, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    // Find matching category tag
    const categoryTag = categoryTags.find(t => t.name === categoryName && t.isSystemCategory);
    if (!categoryTag) continue;
    
    // Count keyword matches
    let score = 0;
    for (const keyword of keywords) {
      if (searchText.includes(keyword.toLowerCase())) {
        score += keyword.length; // Longer keywords = higher confidence
      }
    }
    
    // Title match = higher confidence
    if (row.account.toLowerCase().includes(categoryName.toLowerCase())) {
      score += 10;
    }
    
    if (score > bestMatch.score) {
      bestMatch = { categoryId: categoryTag.id, score };
    }
  }
  
  // Determine confidence
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (bestMatch.score >= 15) {
    confidence = 'high';
  } else if (bestMatch.score >= 5) {
    confidence = 'medium';
  }
  
  return {
    categoryId: bestMatch.categoryId,
    confidence
  };
}

/**
 * Parse CSV content (KeePass format)
 * Format: "Account","Login Name","Password","Web Site","Comments"
 * Properly handles multi-line content within quoted fields
 */
export function parseKeePassCSV(csvContent: string): ParsedCSVRow[] {
  if (!csvContent || !csvContent.trim()) {
    throw new Error('CSV file is empty');
  }
  
  const rows: ParsedCSVRow[] = [];
  const fields: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let isFirstRow = true; // Track header row
  
  // Normalize line endings to \n
  const normalizedContent = csvContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  for (let i = 0; i < normalizedContent.length; i++) {
    const char = normalizedContent[i];
    const nextChar = normalizedContent[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote (double quote)
        currentField += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator (only when not in quotes)
      fields.push(currentField);
      currentField = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      // End of record (newline outside quotes)
      // Add the last field before the newline
      if (currentField !== '' || fields.length > 0) {
        fields.push(currentField);
        currentField = '';
      }
      
      // Process the row if we have fields
      if (fields.length > 0) {
        if (isFirstRow) {
          // Skip header row
          isFirstRow = false;
        } else {
          // Ensure we have at least 5 fields (pad with empty strings if needed)
          while (fields.length < 5) {
            fields.push('');
          }
          
          rows.push({
            account: fields[0] || '',
            loginName: fields[1] || '',
            password: fields[2] || '',
            webSite: fields[3] || '',
            comments: fields[4] || ''
          });
        }
        
        // Reset for next row
        fields.length = 0;
      }
    } else {
      // Regular character (including newlines inside quotes)
      currentField += char;
    }
  }
  
  // Handle last row if file doesn't end with newline
  if (currentField !== '' || fields.length > 0) {
    fields.push(currentField);
    
    if (fields.length > 0 && !isFirstRow) {
      // Ensure we have at least 5 fields
      while (fields.length < 5) {
        fields.push('');
      }
      
      rows.push({
        account: fields[0] || '',
        loginName: fields[1] || '',
        password: fields[2] || '',
        webSite: fields[3] || '',
        comments: fields[4] || ''
      });
    }
  }
  
  return rows;
}

/**
 * Generate preview entries from parsed CSV
 */
export function generatePreview(
  rows: ParsedCSVRow[],
  categoryTags: Tag[],
  limit: number = 10
): PreviewEntry[] {
  return rows.slice(0, limit).map(row => {
    const { categoryId, confidence } = detectCategory(row, categoryTags);
    const categoryName = categoryId 
      ? categoryTags.find(t => t.id === categoryId)?.name || 'Unknown'
      : 'Uncategorized';
    
    return {
      title: row.account || 'Untitled',
      url: row.webSite || undefined,
      username: row.loginName || undefined,
      password: row.password ? '••••••••' : undefined,
      notes: row.comments || undefined,
      detectedCategory: categoryName,
      confidence
    };
  });
}

/**
 * Get category mapping summary
 */
export function getCategoryMapping(
  rows: ParsedCSVRow[],
  categoryTags: Tag[]
): Record<string, number> {
  const mapping: Record<string, number> = {};
  
  for (const row of rows) {
    const { categoryId } = detectCategory(row, categoryTags);
    const categoryName = categoryId 
      ? categoryTags.find(t => t.id === categoryId)?.name || 'Unknown'
      : 'Uncategorized';
    
    mapping[categoryName] = (mapping[categoryName] || 0) + 1;
  }
  
  return mapping;
}

/**
 * Import CSV entries into Safe section
 */
export async function importCSVEntries(
  rows: ParsedCSVRow[],
  encryptionKey: CryptoKey,
  categoryTags: Tag[],
  selectedTagId: string,
  existingEntries: SafeEntry[]
): Promise<ImportSummary> {
  const summary: ImportSummary = {
    total: rows.length,
    imported: 0,
    skipped: 0,
    categoryMapping: {},
    errors: []
  };
  
  // Check for duplicates (by title and URL)
  const existingKeys = new Set(
    existingEntries.map(e => `${e.title.toLowerCase()}|${(e.url || '').toLowerCase()}`)
  );
  
  for (const row of rows) {
    try {
      // Check for duplicate
      const key = `${row.account.toLowerCase()}|${(row.webSite || '').toLowerCase()}`;
      if (existingKeys.has(key)) {
        summary.skipped++;
        continue;
      }
      
      // Detect category
      const { categoryId } = detectCategory(row, categoryTags);
      
      // Prepare encrypted data
      const encryptedData: SafeEntryEncryptedData = {
        username: row.loginName || undefined,
        password: row.password || undefined,
        notes: row.comments || undefined
      };
      
      // Encrypt the data
      const jsonData = JSON.stringify(encryptedData);
      const { encrypted, iv } = await encryptData(jsonData, encryptionKey);
      
      // Track category mapping
      const categoryName = categoryId 
        ? categoryTags.find(t => t.id === categoryId)?.name || 'Unknown'
        : 'Uncategorized';
      summary.categoryMapping[categoryName] = (summary.categoryMapping[categoryName] || 0) + 1;
      
      // Note: The actual database insertion will be done in storage.ts
      // This function just prepares the data
      summary.imported++;
    } catch (error: any) {
      summary.errors.push(`Error importing "${row.account}": ${error.message}`);
    }
  }
  
  return summary;
}

/**
 * Convert CSV rows to SafeEntry format for database insertion
 */
export async function convertCSVRowsToEntries(
  rows: ParsedCSVRow[],
  encryptionKey: CryptoKey,
  categoryTags: Tag[],
  selectedTagId: string,
  existingEntries: SafeEntry[]
): Promise<SafeEntry[]> {
  const entries: SafeEntry[] = [];

  // Identity = title + username (the user keeps these stable across re-imports).
  // We decrypt existing entries once so we can compare ALL fields (password,
  // notes, url) and UPDATE in place when something changed — instead of
  // skipping the row as a duplicate. Reusing the existing entry's id makes
  // importSafeEntries() update that row rather than insert a new one.
  const identityKey = (title: string, username: string) =>
    `${(title || '').toLowerCase().trim()}|${(username || '').toLowerCase().trim()}`;

  interface ExistingMatch {
    entry: SafeEntry;
    data: SafeEntryEncryptedData | null; // null = could not decrypt (compare disabled)
  }
  const existingByIdentity = new Map<string, ExistingMatch>();

  for (const e of existingEntries) {
    let data: SafeEntryEncryptedData | null = null;
    try {
      const json = await decryptData(e.encryptedData, e.encryptedDataIv, encryptionKey);
      data = JSON.parse(json) as SafeEntryEncryptedData;
    } catch {
      data = null; // keep the entry registered, but we won't risk overwriting it
    }
    const username = data?.username || '';
    existingByIdentity.set(identityKey(e.title, username), { entry: e, data });
  }

  const norm = (s: string | undefined | null) => (s ?? '');

  for (const row of rows) {
    const match = existingByIdentity.get(identityKey(row.account, row.loginName));

    // Detect category from the row
    const { categoryId } = detectCategory(row, categoryTags);

    // Prepare encrypted data payload from the CSV row
    const encryptedData: SafeEntryEncryptedData = {
      username: row.loginName || undefined,
      password: row.password || undefined,
      notes: row.comments || undefined
    };

    if (match) {
      // If we couldn't decrypt the existing entry, don't risk clobbering it — skip.
      if (!match.data) {
        continue;
      }

      // Compare every field that the import can carry. Only update on a real change.
      const urlChanged = norm(match.entry.url).trim() !== norm(row.webSite).trim();
      const usernameChanged = norm(match.data.username) !== norm(row.loginName);
      const passwordChanged = norm(match.data.password) !== norm(row.password);
      const notesChanged = norm(match.data.notes) !== norm(row.comments);

      if (!urlChanged && !usernameChanged && !passwordChanged && !notesChanged) {
        continue; // True duplicate — nothing changed
      }

      // Record which fields changed so the detail view can show a change history.
      const changedFields: string[] = [];
      if (urlChanged) changedFields.push('URL');
      if (usernameChanged) changedFields.push('Username');
      if (passwordChanged) changedFields.push('Password');
      if (notesChanged) changedFields.push('Notes');

      const changeHistory = [
        ...(match.data.changeHistory || []),
        { date: new Date().toISOString(), fields: changedFields, source: 'Import' },
      ];

      // Something changed → update in place (reuse id + createdAt, keep
      // user's existing category, tags and favorite flag). Merge over the
      // existing decrypted data so we don't wipe fields the import doesn't
      // carry (custom fields, TOTP, category-specific values, prior history).
      const mergedData: SafeEntryEncryptedData = {
        ...match.data,
        username: row.loginName || undefined,
        password: row.password || undefined,
        notes: row.comments || undefined,
        changeHistory,
      };
      const jsonData = JSON.stringify(mergedData);
      const { encrypted, iv } = await encryptData(jsonData, encryptionKey);
      const existingTags = match.entry.tags || [];
      const mergedTags = selectedTagId && !existingTags.includes(selectedTagId)
        ? [...existingTags, selectedTagId]
        : existingTags;

      entries.push({
        id: match.entry.id,
        title: match.entry.title || row.account || 'Untitled',
        url: row.webSite || undefined,
        categoryTagId: match.entry.categoryTagId ?? categoryId,
        tags: mergedTags,
        isFavorite: match.entry.isFavorite || false,
        expiresAt: match.entry.expiresAt,
        encryptedData: encrypted,
        encryptedDataIv: iv,
        createdAt: match.entry.createdAt,
        updatedAt: new Date().toISOString(),
        lastAccessedAt: match.entry.lastAccessedAt
      });
      continue;
    }

    // No match → brand new entry
    const jsonData = JSON.stringify(encryptedData);
    const { encrypted, iv } = await encryptData(jsonData, encryptionKey);
    const now = new Date().toISOString();
    entries.push({
      id: crypto.randomUUID(),
      title: row.account || 'Untitled',
      url: row.webSite || undefined,
      categoryTagId: categoryId,
      tags: selectedTagId ? [selectedTagId] : [],
      isFavorite: false,
      expiresAt: undefined,
      encryptedData: encrypted,
      encryptedDataIv: iv,
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: now
    });
  }

  return entries;
}

