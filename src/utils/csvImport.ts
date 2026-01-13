/**
 * CSV Import Utilities for Safe Section
 * 
 * Handles parsing KeePass CSV format and auto-detecting categories
 */

import { SafeEntry, SafeEntryEncryptedData, SafeTag } from '../types';
import { encryptData } from './encryption';
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
  skipped: number;
  categoryMapping: Record<string, number>;
  errors: string[];
}

/**
 * Category detection keywords
 */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Credit Card': ['credit card', 'cc ', 'amex', 'visa', 'mastercard', 'discover', 'card number', 'cvv', 'expiry'],
  'Bank Account': ['bank', 'checking', 'savings', 'account', 'icici', 'chase', 'sbi', 'hdfc', 'bofa', 'wells fargo', 'routing', 'account number'],
  'Insurance': ['insurance', 'lic', 'progressive', 'cigna', 'allstate', 'policy', 'premium'],
  'Medical': ['medical', 'health', 'doctor', 'hospital', 'clinic', 'prescription', 'rx'],
  'License/Software': ['license', 'software', 'product key', 'serial', 'activation'],
  'API Key': ['api key', 'api', 'secret key', 'access token', 'client id', 'client secret'],
  'WiFi': ['wifi', 'wifi', 'network', 'router', 'ssid', 'wireless'],
  'Gift Card': ['gift card', 'giftcard', 'voucher', 'prepaid card'],
  'Identity Documents': ['passport', 'aadhar', 'aadhaar', 'pan', 'ssn', 'dl', 'driving license', 'license plate', 'vin'],
  'Stock Trading Account': ['trading', 'broker', 'fidelity', 'etrade', 'robinhood', 'schwab', 'td ameritrade']
};

/**
 * Detect category from title, comments, and URL
 */
function detectCategory(row: ParsedCSVRow, categoryTags: SafeTag[]): { categoryId: string | undefined; confidence: 'high' | 'medium' | 'low' } {
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
 */
export function parseKeePassCSV(csvContent: string): ParsedCSVRow[] {
  const lines = csvContent.split('\n').filter(line => line.trim());
  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }
  
  // Skip header row
  const dataLines = lines.slice(1);
  const rows: ParsedCSVRow[] = [];
  
  for (const line of dataLines) {
    if (!line.trim()) continue;
    
    // Parse CSV line (handling quoted fields with commas)
    const fields: string[] = [];
    let currentField = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          currentField += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator
        fields.push(currentField.trim());
        currentField = '';
      } else {
        currentField += char;
      }
    }
    
    // Add last field
    fields.push(currentField.trim());
    
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
  
  return rows;
}

/**
 * Generate preview entries from parsed CSV
 */
export function generatePreview(
  rows: ParsedCSVRow[],
  categoryTags: SafeTag[],
  limit: number = 10
): PreviewEntry[] {
  return rows.slice(0, limit).map(row => {
    const { categoryId, confidence } = detectCategory(row, categoryTags);
    const categoryName = categoryId 
      ? categoryTags.find(t => t.id === categoryId)?.name || 'Login/Credentials'
      : 'Login/Credentials';
    
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
  categoryTags: SafeTag[]
): Record<string, number> {
  const mapping: Record<string, number> = {};
  
  for (const row of rows) {
    const { categoryId } = detectCategory(row, categoryTags);
    const categoryName = categoryId 
      ? categoryTags.find(t => t.id === categoryId)?.name || 'Login/Credentials'
      : 'Login/Credentials';
    
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
  categoryTags: SafeTag[],
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
        ? categoryTags.find(t => t.id === categoryId)?.name || 'Login/Credentials'
        : 'Login/Credentials';
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
  categoryTags: SafeTag[],
  selectedTagId: string,
  existingEntries: SafeEntry[]
): Promise<SafeEntry[]> {
  const entries: SafeEntry[] = [];
  // Create a set of existing entry keys (title + url) for duplicate detection
  const existingKeys = new Set(
    existingEntries.map(e => {
      const title = (e.title || '').toLowerCase().trim();
      const url = (e.url || '').toLowerCase().trim();
      return `${title}|${url}`;
    })
  );
  
  for (const row of rows) {
    // Check for duplicate (same title and URL)
    const title = (row.account || '').toLowerCase().trim();
    const url = (row.webSite || '').toLowerCase().trim();
    const key = `${title}|${url}`;
    
    if (existingKeys.has(key)) {
      continue; // Skip duplicate
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
    
    // Create entry
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

