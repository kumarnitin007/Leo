/**
 * Asymmetric Encryption Utilities (RSA)
 * 
 * Provides RSA key pair generation and encryption/decryption
 * for secure key exchange in family sharing.
 * 
 * SECURITY MODEL:
 * - Public key: Stored unencrypted in database (safe to share)
 * - Private key: Encrypted with user's master password (zero-knowledge)
 * - Group keys: Encrypted with recipient's public key (RSA)
 * - Entry data: Encrypted with group key (AES-GCM, faster)
 */

import { encryptData, decryptData } from './encryption';

/**
 * Generate RSA-2048 key pair for asymmetric encryption
 * 
 * @returns Object with publicKey (CryptoKey) and privateKey (CryptoKey)
 */
export async function generateRSAKeyPair(): Promise<{
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}> {
  console.log('[AsymmetricCrypto] 🔑 Generating RSA-2048 key pair...');
  
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]), // 65537
      hash: 'SHA-256',
    },
    true, // extractable
    ['encrypt', 'decrypt']
  );

  console.log('[AsymmetricCrypto] ✅ RSA key pair generated');
  return keyPair;
}

/**
 * Export public key to PEM format (for storage)
 * 
 * @param publicKey - CryptoKey public key
 * @returns PEM-formatted string
 */
export async function exportPublicKeyToPEM(publicKey: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey('spki', publicKey);
  const exportedAsString = String.fromCharCode(...new Uint8Array(exported));
  const exportedAsBase64 = btoa(exportedAsString);
  
  return `-----BEGIN PUBLIC KEY-----\n${exportedAsBase64}\n-----END PUBLIC KEY-----`;
}

/**
 * Import public key from PEM format
 * 
 * @param pem - PEM-formatted public key string
 * @returns CryptoKey public key
 */
export async function importPublicKeyFromPEM(pem: string): Promise<CryptoKey> {
  const pemContents = pem
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace(/\s/g, '');
  
  const binaryString = atob(pemContents);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return await window.crypto.subtle.importKey(
    'spki',
    bytes.buffer,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    true,
    ['encrypt']
  );
}

/**
 * Export private key to raw format (for encryption with master password)
 * 
 * @param privateKey - CryptoKey private key
 * @returns Base64-encoded private key
 */
export async function exportPrivateKey(privateKey: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey('pkcs8', privateKey);
  const exportedAsString = String.fromCharCode(...new Uint8Array(exported));
  return btoa(exportedAsString);
}

/**
 * Import private key from raw format
 * 
 * @param privateKeyBase64 - Base64-encoded private key
 * @returns CryptoKey private key
 */
export async function importPrivateKey(privateKeyBase64: string): Promise<CryptoKey> {
  const binaryString = atob(privateKeyBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return await window.crypto.subtle.importKey(
    'pkcs8',
    bytes.buffer,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    true,
    ['decrypt']
  );
}

/**
 * Encrypt private key with user's master password (AES-GCM)
 * 
 * @param privateKey - CryptoKey private key to encrypt
 * @param masterKey - User's master encryption key (derived from password)
 * @returns Object with encrypted private key and IV
 */
export async function encryptPrivateKey(
  privateKey: CryptoKey,
  masterKey: CryptoKey
): Promise<{ encrypted: string; iv: string }> {
  console.log('[AsymmetricCrypto] 🔒 Encrypting private key with master password...');
  
  const privateKeyRaw = await exportPrivateKey(privateKey);
  const { encrypted, iv } = await encryptData(privateKeyRaw, masterKey);
  
  console.log('[AsymmetricCrypto] ✅ Private key encrypted');
  return { encrypted, iv };
}

/**
 * Decrypt private key with user's master password (AES-GCM)
 * 
 * @param encryptedPrivateKey - Encrypted private key (base64)
 * @param iv - Initialization vector (base64)
 * @param masterKey - User's master encryption key
 * @returns CryptoKey private key
 */
export async function decryptPrivateKey(
  encryptedPrivateKey: string,
  iv: string,
  masterKey: CryptoKey
): Promise<CryptoKey> {
  console.log('[AsymmetricCrypto] 🔓 Decrypting private key with master password...');
  
  const privateKeyRaw = await decryptData(encryptedPrivateKey, iv, masterKey);
  const privateKey = await importPrivateKey(privateKeyRaw);
  
  console.log('[AsymmetricCrypto] ✅ Private key decrypted');
  return privateKey;
}

/**
 * Encrypt data with recipient's public key (RSA-OAEP)
 * 
 * Used to encrypt group keys for sharing
 * 
 * @param data - Data to encrypt (string)
 * @param publicKey - Recipient's public key
 * @returns Base64-encoded encrypted data
 */
export async function encryptWithPublicKey(
  data: string,
  publicKey: CryptoKey
): Promise<string> {
  console.log('[AsymmetricCrypto] 🔐 Encrypting with public key...');
  
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  
  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: 'RSA-OAEP',
    },
    publicKey,
    dataBuffer
  );

  const encryptedBase64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
  
  console.log('[AsymmetricCrypto] ✅ Data encrypted with public key');
  return encryptedBase64;
}

/**
 * Decrypt data with own private key (RSA-OAEP)
 * 
 * Used to decrypt group keys shared with you
 * 
 * @param encryptedData - Base64-encoded encrypted data
 * @param privateKey - Your private key
 * @returns Decrypted data (string)
 */
export async function decryptWithPrivateKey(
  encryptedData: string,
  privateKey: CryptoKey
): Promise<string> {
  console.log('[AsymmetricCrypto] 🔓 Decrypting with private key...');
  
  const binaryString = atob(encryptedData);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: 'RSA-OAEP',
    },
    privateKey,
    bytes.buffer
  );

  const decoder = new TextDecoder();
  const decryptedString = decoder.decode(decrypted);
  
  console.log('[AsymmetricCrypto] ✅ Data decrypted with private key');
  return decryptedString;
}

/**
 * Encrypt AES group key with recipient's public key
 * 
 * @param groupKey - AES-GCM group key (CryptoKey)
 * @param recipientPublicKey - Recipient's RSA public key
 * @returns Base64-encoded encrypted group key
 */
export async function encryptGroupKeyForRecipient(
  groupKey: CryptoKey,
  recipientPublicKey: CryptoKey
): Promise<string> {
  console.log('[AsymmetricCrypto] 🔑 Encrypting group key for recipient...');
  
  // Export group key to raw format
  const groupKeyRaw = await window.crypto.subtle.exportKey('raw', groupKey);
  const groupKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(groupKeyRaw)));
  
  // Encrypt with recipient's public key
  const encrypted = await encryptWithPublicKey(groupKeyBase64, recipientPublicKey);
  
  console.log('[AsymmetricCrypto] ✅ Group key encrypted for recipient');
  return encrypted;
}

/**
 * Decrypt AES group key with own private key
 * 
 * @param encryptedGroupKey - Base64-encoded encrypted group key
 * @param privateKey - Your RSA private key
 * @returns AES-GCM group key (CryptoKey)
 */
export async function decryptGroupKeyFromRecipient(
  encryptedGroupKey: string,
  privateKey: CryptoKey
): Promise<CryptoKey> {
  console.log('[AsymmetricCrypto] 🔓 Decrypting group key with private key...');
  
  // Decrypt with private key
  const groupKeyBase64 = await decryptWithPrivateKey(encryptedGroupKey, privateKey);
  
  // Import as AES-GCM key
  const binaryString = atob(groupKeyBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const groupKey = await window.crypto.subtle.importKey(
    'raw',
    bytes.buffer,
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );
  
  console.log('[AsymmetricCrypto] ✅ Group key decrypted and imported');
  return groupKey;
}
