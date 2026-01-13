/**
 * Safe Section Import/Export Utilities
 * 
 * Handles encrypted and unencrypted export/import of safe entries
 */

import { SafeEntry, SafeEntryEncryptedData, Tag } from '../types';
import { CryptoKey } from './encryption';
import { encryptData, decryptData } from './encryption';

/**
 * Export format for encrypted backup
 */
export interface EncryptedExport {
  version: string;
  exportDate: string;
  encryptedData: string; // Encrypted JSON of all entries
  encryptedDataIv: string; // IV for decryption
  metadata: {
    entryCount: number;
    categories: string[];
  };
}

/**
 * Export format for unencrypted export (for migration)
 */
export interface UnencryptedExport {
  version: string;
  exportDate: string;
  entries: Array<{
    title: string;
    url?: string;
    category?: string;
    tags?: string[];
    isFavorite: boolean;
    expiresAt?: string;
    encryptedData: SafeEntryEncryptedData; // Decrypted data
  }>;
}

/**
 * Export entries as encrypted backup
 * This requires the master password to decrypt
 */
export async function exportEncrypted(
  entries: SafeEntry[],
  encryptionKey: CryptoKey
): Promise<EncryptedExport> {
  // Prepare export data
  const exportData = {
    entries: entries.map(entry => ({
      id: entry.id,
      title: entry.title,
      url: entry.url,
      categoryTagId: entry.categoryTagId,
      tags: entry.tags,
      isFavorite: entry.isFavorite,
      expiresAt: entry.expiresAt,
      encryptedData: entry.encryptedData,
      encryptedDataIv: entry.encryptedDataIv,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt
    }))
  };

  // Encrypt the entire export
  const jsonData = JSON.stringify(exportData);
  const { encrypted, iv } = await encryptData(jsonData, encryptionKey);

  // Get unique categories
  const categories = Array.from(new Set(
    entries
      .map(e => e.categoryTagId)
      .filter((id): id is string => !!id)
  ));

  return {
    version: '1.0',
    exportDate: new Date().toISOString(),
    encryptedData: encrypted,
    encryptedDataIv: iv,
    metadata: {
      entryCount: entries.length,
      categories: categories
    }
  };
}

/**
 * Export entries as unencrypted JSON (for migration to other tools)
 * Includes decrypted data
 */
export async function exportUnencrypted(
  entries: SafeEntry[],
  encryptionKey: CryptoKey,
  tags: Tag[]
): Promise<UnencryptedExport> {
  const entriesWithDecrypted = await Promise.all(
    entries.map(async (entry) => {
      // Decrypt the encrypted data
      let decryptedData: SafeEntryEncryptedData = {};
      try {
        const decryptedJson = await decryptData(entry.encryptedData, entry.encryptedDataIv, encryptionKey);
        decryptedData = JSON.parse(decryptedJson);
      } catch (error) {
        console.error(`Error decrypting entry ${entry.id}:`, error);
      }

      // Get category name
      const category = entry.categoryTagId 
        ? tags.find(t => t.id === entry.categoryTagId)?.name || entry.categoryTagId
        : undefined;

      // Get tag names
      const tagNames = (entry.tags || [])
        .map(tagId => tags.find(t => t.id === tagId)?.name || tagId)
        .filter((name): name is string => !!name);

      return {
        title: entry.title,
        url: entry.url,
        category: category,
        tags: tagNames,
        isFavorite: entry.isFavorite,
        expiresAt: entry.expiresAt,
        encryptedData: decryptedData
      };
    })
  );

  return {
    version: '1.0',
    exportDate: new Date().toISOString(),
    entries: entriesWithDecrypted
  };
}

/**
 * Export entries as CSV (unencrypted, for basic migration)
 * Includes all fields including decrypted data
 */
export async function exportCSV(
  entries: SafeEntry[],
  encryptionKey: CryptoKey,
  tags: Tag[]
): Promise<string> {
  const headers = [
    'Title', 'URL', 'Category', 'Tags', 'Favorite', 'Expires At',
    'Username/Email', 'Password', 'Notes',
    'Card Number', 'CVV', 'Cardholder Name', 'Billing Address', 'PIN',
    'Bank Name', 'Account Number', 'Routing Number', 'Account Type', 'SWIFT Code', 'IBAN',
    'Broker Name', 'Trading Platform', 'Account Holder',
    'TOTP Secret', 'TOTP Issuer', 'TOTP Account',
    'Created', 'Updated'
  ];

  const rows = await Promise.all(
    entries.map(async (entry) => {
      // Decrypt the encrypted data
      let decryptedData: SafeEntryEncryptedData = {};
      try {
        const decryptedJson = await decryptData(entry.encryptedData, entry.encryptedDataIv, encryptionKey);
        decryptedData = JSON.parse(decryptedJson);
      } catch (error) {
        console.error(`Error decrypting entry ${entry.id}:`, error);
      }

      // Get category name
      const category = entry.categoryTagId 
        ? tags.find(t => t.id === entry.categoryTagId)?.name || entry.categoryTagId
        : '';

      // Get tag names
      const tagNames = (entry.tags || [])
        .map(tagId => tags.find(t => t.id === tagId)?.name || tagId)
        .filter((name): name is string => !!name)
        .join('; ');

      return [
        entry.title,
        entry.url || '',
        category,
        tagNames,
        entry.isFavorite ? 'Yes' : 'No',
        entry.expiresAt || '',
        // Encrypted fields
        decryptedData.username || '',
        decryptedData.password || '',
        decryptedData.notes || '',
        // Credit Card fields
        decryptedData.cardNumber || '',
        decryptedData.cvv || '',
        decryptedData.cardholderName || '',
        decryptedData.billingAddress || '',
        decryptedData.pin || '',
        // Bank Account fields
        decryptedData.bankName || '',
        decryptedData.accountNumber || '',
        decryptedData.routingNumber || '',
        decryptedData.accountType || '',
        decryptedData.swiftCode || '',
        decryptedData.iban || '',
        // Stock Trading fields
        decryptedData.brokerName || '',
        decryptedData.tradingPlatform || '',
        decryptedData.accountHolder || '',
        // TOTP fields
        decryptedData.totpSecret || '',
        decryptedData.totpIssuer || '',
        decryptedData.totpAccount || '',
        // Metadata
        entry.createdAt,
        entry.updatedAt
      ];
    })
  );

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  return csvContent;
}

/**
 * Import encrypted backup
 * Requires master password to decrypt
 */
export async function importEncrypted(
  exportData: EncryptedExport,
  encryptionKey: CryptoKey
): Promise<SafeEntry[]> {
  try {
    // Decrypt the export
    const decryptedJson = await decryptData(exportData.encryptedData, exportData.encryptedDataIv, encryptionKey);
    const data = JSON.parse(decryptedJson);

    // Validate structure
    if (!data.entries || !Array.isArray(data.entries)) {
      throw new Error('Invalid export format: missing entries array');
    }

    // Return entries (they're already in the correct format)
    return data.entries.map((entry: any) => ({
      id: entry.id,
      title: entry.title,
      url: entry.url,
      categoryTagId: entry.categoryTagId,
      tags: entry.tags || [],
      isFavorite: entry.isFavorite || false,
      expiresAt: entry.expiresAt,
      encryptedData: entry.encryptedData,
      encryptedDataIv: entry.encryptedDataIv,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      lastAccessedAt: entry.lastAccessedAt
    }));
  } catch (error) {
    console.error('Error importing encrypted backup:', error);
    throw new Error('Failed to decrypt backup. Please verify your master password is correct.');
  }
}

/**
 * Download file helper
 */
export function downloadFile(content: string, filename: string, mimeType: string = 'application/json') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Read file helper
 */
export function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        resolve(e.target.result as string);
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

