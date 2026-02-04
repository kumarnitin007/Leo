/**
 * Group Encryption Utilities
 * 
 * Handles encryption/decryption of group keys for family password sharing.
 * Each group has one shared encryption key, encrypted separately for each member.
 */

import { encryptData, decryptData } from './encryption';

/**
 * Generate a new group encryption key
 */
export async function generateGroupKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt group key with a user's master key
 * Returns base64-encoded encrypted key and IV
 */
export async function encryptGroupKeyForUser(
  groupKey: CryptoKey,
  userMasterKey: CryptoKey
): Promise<{ encryptedKey: string; iv: string }> {
  // Export group key to raw format
  const groupKeyRaw = await crypto.subtle.exportKey('raw', groupKey);
  
  // Convert to base64 for storage
  const groupKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(groupKeyRaw)));
  
  // Encrypt with user's master key
  const result = await encryptData(groupKeyBase64, userMasterKey);
  
  return {
    encryptedKey: result.encrypted,
    iv: result.iv
  };
}

/**
 * Decrypt group key using user's master key
 * Returns CryptoKey for encrypting/decrypting shared entries
 */
export async function decryptGroupKey(
  encryptedGroupKey: string,
  iv: string,
  userMasterKey: CryptoKey
): Promise<CryptoKey> {
  // Decrypt to get base64 group key
  const groupKeyBase64 = await decryptData(encryptedGroupKey, iv, userMasterKey);
  
  // Convert from base64 to raw bytes
  const groupKeyRaw = Uint8Array.from(atob(groupKeyBase64), c => c.charCodeAt(0));
  
  // Import as CryptoKey
  const groupKey = await crypto.subtle.importKey(
    'raw',
    groupKeyRaw,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  
  return groupKey;
}
