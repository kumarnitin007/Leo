/**
 * Encryption Utilities for Safe Section
 * 
 * Uses Web Crypto API for client-side encryption
 * AES-256-GCM for authenticated encryption
 */

// Export CryptoKey type for use in other modules
export type CryptoKey = globalThis.CryptoKey;

/**
 * Derive encryption key from master password using PBKDF2
 */
export async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array,
  iterations: number = 100000
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: iterations,
      hash: 'SHA-256'
    },
    passwordKey,
    {
      name: 'AES-GCM',
      length: 256
    },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Generate a hash of the master password for verification
 * This hash is stored in the database (never the actual password)
 */
export async function hashMasterPassword(
  password: string,
  salt: Uint8Array
): Promise<string> {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 100000,
      hash: 'SHA-256'
    },
    passwordKey,
    256
  );

  // Convert to hex string for storage
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a random salt
 */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

/**
 * Generate a random IV (Initialization Vector) for AES-GCM
 */
export function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(12)); // 12 bytes for GCM
}

/**
 * Encrypt data using AES-256-GCM
 */
export async function encryptData(
  data: string,
  key: CryptoKey
): Promise<{ encrypted: string; iv: string }> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const iv = generateIV();

  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource
    },
    key,
    dataBuffer
  );

  // Convert to base64 for storage
  const encryptedArray = Array.from(new Uint8Array(encryptedBuffer));
  const encryptedBase64 = btoa(String.fromCharCode(...encryptedArray));
  const ivBase64 = btoa(String.fromCharCode(...iv));

  return {
    encrypted: encryptedBase64,
    iv: ivBase64
  };
}

/**
 * Decrypt data using AES-256-GCM
 */
export async function decryptData(
  encrypted: string,
  iv: string,
  key: CryptoKey
): Promise<string> {
  // Convert from base64
  const encryptedArray = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  const ivArray = Uint8Array.from(atob(iv), c => c.charCodeAt(0));

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: ivArray
    },
    key,
    encryptedArray
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

/**
 * Verify master password against stored hash
 */
export async function verifyMasterPassword(
  password: string,
  storedHash: string,
  salt: string
): Promise<boolean> {
  const saltArray = Uint8Array.from(atob(salt), c => c.charCodeAt(0));
  const computedHash = await hashMasterPassword(password, saltArray);
  return computedHash === storedHash;
}

/**
 * Calculate password strength (0-100)
 */
export function calculatePasswordStrength(password: string): number {
  if (!password) return 0;

  let strength = 0;
  const length = password.length;

  // Length contribution (max 40 points)
  if (length >= 12) strength += 40;
  else if (length >= 8) strength += 25;
  else if (length >= 4) strength += 10;

  // Character variety (max 60 points)
  let varietyScore = 0;
  if (/[a-z]/.test(password)) varietyScore += 10;
  if (/[A-Z]/.test(password)) varietyScore += 10;
  if (/[0-9]/.test(password)) varietyScore += 10;
  if (/[^a-zA-Z0-9]/.test(password)) varietyScore += 10;
  
  // Bonus for longer passwords with variety
  if (length >= 8 && varietyScore >= 30) varietyScore += 20;

  strength += varietyScore;
  return Math.min(100, strength);
}

/**
 * Generate a random password
 */
export function generatePassword(
  length: number = 16,
  includeUppercase: boolean = true,
  includeLowercase: boolean = true,
  includeNumbers: boolean = true,
  includeSymbols: boolean = true
): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  let charset = '';
  if (includeLowercase) charset += lowercase;
  if (includeUppercase) charset += uppercase;
  if (includeNumbers) charset += numbers;
  if (includeSymbols) charset += symbols;

  if (!charset) {
    charset = lowercase + uppercase + numbers; // Default fallback
  }

  const array = new Uint8Array(length);
  crypto.getRandomValues(array);

  return Array.from(array)
    .map(x => charset[x % charset.length])
    .join('');
}

