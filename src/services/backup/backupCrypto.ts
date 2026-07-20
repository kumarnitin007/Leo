/**
 * Unified Backup — crypto helpers.
 *
 * Thin wrappers over the app's existing Web Crypto utilities so the backup
 * envelope uses exactly the same AES-256-GCM + PBKDF2 primitives as the Safe.
 */

import {
  CryptoKey,
  PBKDF2_ITERATIONS,
  deriveKeyFromPassword,
  encryptData,
  decryptData,
  generateSalt,
} from '../../utils/encryption';

export { PBKDF2_ITERATIONS };

export function saltToBase64(salt: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < salt.length; i++) binary += String.fromCharCode(salt[i]);
  return btoa(binary);
}

export function base64ToSalt(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

/** Derive the backup key from the master password and a per-file salt. */
export async function deriveBackupKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  return deriveKeyFromPassword(password, salt);
}

/** Encrypt the JSON bundle. Returns a fresh salt + iv + ciphertext (base64). */
export async function encryptBundle(
  json: string,
  password: string
): Promise<{ salt: string; iv: string; payload: string }> {
  const saltBytes = generateSalt();
  const key = await deriveBackupKey(password, saltBytes);
  const { encrypted, iv } = await encryptData(json, key);
  return { salt: saltToBase64(saltBytes), iv, payload: encrypted };
}

/** Decrypt a payload given the stored salt + iv and the master password. */
export async function decryptBundle(
  payload: string,
  iv: string,
  saltB64: string,
  password: string
): Promise<string> {
  const key = await deriveBackupKey(password, base64ToSalt(saltB64));
  return decryptData(payload, iv, key);
}

/** SHA-256 hex digest of a string (used for payload checksum + user tag). */
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
