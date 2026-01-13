/**
 * TOTP (Time-based One-Time Password) Utilities
 * 
 * Implements RFC 6238 TOTP algorithm
 * Uses Web Crypto API for HMAC-SHA1
 */

/**
 * Generate a random TOTP secret (Base32 encoded)
 */
export function generateTOTPSecret(): string {
  // Generate 20 random bytes (160 bits) for secret
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  
  // Convert to Base32
  return base32Encode(bytes);
}

/**
 * Base32 encode (RFC 4648)
 */
function base32Encode(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;

    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }

  // Add padding
  while (output.length % 8 !== 0) {
    output += '=';
  }

  return output;
}

/**
 * Base32 decode
 */
function base32Decode(encoded: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  encoded = encoded.toUpperCase().replace(/=+$/, '');
  
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (let i = 0; i < encoded.length; i++) {
    const char = encoded[i];
    const index = alphabet.indexOf(char);
    
    if (index === -1) continue;

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return new Uint8Array(output);
}

/**
 * Generate TOTP code from secret
 * @param secret Base32 encoded secret
 * @param timeStep Time step (default 30 seconds)
 * @returns 6-digit TOTP code
 */
export async function generateTOTP(secret: string, timeStep: number = 30): Promise<string> {
  try {
    // Decode secret
    const secretBytes = base32Decode(secret);
    
    // Calculate time counter
    const time = Math.floor(Date.now() / 1000 / timeStep);
    
    // Convert time to 8-byte big-endian
    const timeBytes = new ArrayBuffer(8);
    const timeView = new DataView(timeBytes);
    timeView.setUint32(4, time, false); // Big-endian
    
    // Import secret as key
    const key = await crypto.subtle.importKey(
      'raw',
      secretBytes as BufferSource,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );
    
    // Compute HMAC-SHA1
    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      timeBytes
    );
    
    // Dynamic truncation (RFC 4226)
    const sigArray = new Uint8Array(signature);
    const offset = sigArray[19] & 0x0f;
    const code = ((sigArray[offset] & 0x7f) << 24) |
                 ((sigArray[offset + 1] & 0xff) << 16) |
                 ((sigArray[offset + 2] & 0xff) << 8) |
                 (sigArray[offset + 3] & 0xff);
    
    // Return 6-digit code
    return String(code % 1000000).padStart(6, '0');
  } catch (error) {
    console.error('Error generating TOTP:', error);
    throw new Error('Failed to generate TOTP code');
  }
}

/**
 * Generate TOTP URI for QR code
 * @param secret Base32 encoded secret
 * @param issuer Service name (e.g., "Gmail")
 * @param account Account identifier (e.g., "user@example.com")
 * @returns otpauth:// URI
 */
export function generateTOTPURI(secret: string, issuer: string, account: string): string {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedAccount = encodeURIComponent(account);
  return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Get remaining seconds until TOTP code expires
 */
export function getTOTPRemainingSeconds(): number {
  const timeStep = 30;
  const elapsed = Math.floor(Date.now() / 1000) % timeStep;
  return timeStep - elapsed;
}

