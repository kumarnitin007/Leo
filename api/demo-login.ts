import { createClient } from '@supabase/supabase-js';
import { randomBytes, pbkdf2Sync, randomUUID } from 'crypto';
import { applyRateLimit, RATE_LIMITS } from './_utils/rateLimit.js';
import { handleApiError, createErrorResponse } from './_utils/errorHandler.js';

// Simple Vercel serverless handler for demo login
// Expects server env vars (no VITE_ prefix): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEMO_EMAIL, DEMO_PASSWORD, DEMO_SAFE_PASSWORD (optional)

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // SEC-001: Apply strict rate limiting for authentication (prevents brute-force)
  if (!applyRateLimit(req, res, RATE_LIMITS.auth)) {
    return; // Response already sent by rate limiter
  }

  // SEC-007: Validate request origin to prevent CSRF
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
  const origin = req.headers.origin || req.headers.referer;
  const host = req.headers.host;
  
  // Allow same-origin requests or explicitly allowed origins
  const isAllowedOrigin = !origin || 
    origin.includes(host) || 
    allowedOrigins.some(allowed => origin.includes(allowed)) ||
    process.env.NODE_ENV === 'development';
  
  if (!isAllowedOrigin) {
    res.status(403).json(createErrorResponse('AUTH_ERROR', 'Invalid request origin'));
    return;
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const DEMO_EMAIL = process.env.DEMO_EMAIL;
  const DEMO_PASSWORD = process.env.DEMO_PASSWORD;
  const DEMO_SAFE_PASSWORD = process.env.DEMO_SAFE_PASSWORD || null;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    res.status(500).json(createErrorResponse('CONFIG_ERROR'));
    return;
  }

  if (!DEMO_EMAIL || !DEMO_PASSWORD) {
    res.status(500).json(createErrorResponse('CONFIG_ERROR', 'Demo not available'));
    return;
  }

  // SEC-002: Note - Service role key is necessary for admin.createUser
  // Consider using Supabase Edge Functions for more granular permissions
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Try signing in first
    let signInResult = await supabase.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD });

    // If user doesn't exist or signin failed due to missing user, try to create
    if (signInResult.error) {
      // Create user via admin
      try {
        const createRes = await supabase.auth.admin.createUser({
          email: DEMO_EMAIL,
          password: DEMO_PASSWORD,
          email_confirm: true
        });

        if (createRes.error) {
          // If user already exists, ignore
          // Otherwise, propagate
          if (!/already exists|duplicate/i.test(createRes.error.message || '')) {
            console.warn('createUser error:', createRes.error);
          }
        }
      } catch (createErr) {
        console.warn('createUser threw:', createErr);
      }

      // Try sign in again
      signInResult = await supabase.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
    }

    if (signInResult.error) {
      console.error('Demo sign-in failed:', signInResult.error);
      res.status(500).json(createErrorResponse('AUTH_ERROR', 'Failed to sign-in demo user'));
      return;
    }

    const session = signInResult.data.session;

    // If demo safe password is provided server-side, store a master key record for this user
    if (DEMO_SAFE_PASSWORD && session && session.user && session.user.id) {
      try {
        // Derive a PBKDF2 hash similar to client-side hashMasterPassword
        // SEC-008: Must match client-side PBKDF2_ITERATIONS constant
        const salt = randomBytes(16);
        const PBKDF2_ITERATIONS = 100000; // Keep in sync with src/utils/encryption.ts
        const derived = pbkdf2Sync(DEMO_SAFE_PASSWORD, salt, PBKDF2_ITERATIONS, 32, 'sha256');
        const keyHash = derived.toString('hex');
        const saltBase64 = salt.toString('base64');

        const now = new Date().toISOString();
        const masterRow = {
          id: randomUUID(),
          user_id: session.user.id,
          key_hash: keyHash,
          salt: saltBase64,
          created_at: now,
          updated_at: now
        };

        // Upsert: delete existing then insert to avoid conflicts
        await supabase.from('myday_safe_master_keys').delete().eq('user_id', session.user.id);
        await supabase.from('myday_safe_master_keys').insert(masterRow);
      } catch (e) {
        console.warn('Failed to set demo master password server-side:', e);
        // non-fatal
      }
    }

    // Set an httpOnly cookie flag (not the tokens) so server-side can detect demo login if needed
    res.setHeader('Set-Cookie', `myday_demo=1; HttpOnly; Path=/; Max-Age=${60 * 60 * 24}; SameSite=Lax`);

    // Return the session to the client (client will call supabase.auth.setSession)
    res.status(200).json({ session });
  } catch (err: unknown) {
    handleApiError(res, err, 'demo-login', 500, 'AUTH_ERROR');
  }
}
