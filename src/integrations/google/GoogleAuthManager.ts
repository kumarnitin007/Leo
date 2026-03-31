/**
 * Google OAuth Manager
 *
 * Handles the frontend side of the Authorization Code flow:
 *  - Build OAuth URL → redirect user
 *  - Store/load/delete tokens from Supabase
 *  - Check token expiry
 *  - Revoke tokens on disconnect
 *
 * The Client Secret NEVER touches this file — exchange + refresh
 * happen in Vercel serverless functions.
 */

import { getSupabaseClient } from '../../lib/supabase';
import {
  GOOGLE_AUTH_URL,
  GOOGLE_REVOKE_URL,
  GOOGLE_CLIENT_ID,
  GOOGLE_REDIRECT_URI,
  GOOGLE_STATE_KEY,
  GOOGLE_PENDING_SERVICE_KEY,
  SERVICE_SCOPES,
  type GoogleScope,
} from './constants';
import type { GoogleTokens, GoogleTokenRow } from './types/auth.types';

// ── OAuth URL ─────────────────────────────────────────────────────────

/**
 * Build the Google OAuth consent URL and store state for CSRF protection.
 * @param serviceId  e.g. 'fit' or 'contacts'
 * @param existingScopes  scopes already granted (for incremental consent)
 */
export function buildOAuthUrl(
  serviceId: string,
  existingScopes: string[] = [],
): string {
  const newScopes = SERVICE_SCOPES[serviceId] ?? [];
  const combined = Array.from(new Set([...existingScopes, ...newScopes]));

  const state = crypto.randomUUID();
  sessionStorage.setItem(GOOGLE_STATE_KEY, state);
  sessionStorage.setItem(GOOGLE_PENDING_SERVICE_KEY, serviceId);

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: combined.join(' '),
    state,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

// ── Token CRUD (Supabase) ─────────────────────────────────────────────

export async function loadTokens(userId: string): Promise<GoogleTokens | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data } = await client
    .from('myday_google_tokens')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (!data) return null;
  const row = data as GoogleTokenRow;

  return {
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    expiresAt: row.token_expiry ? new Date(row.token_expiry) : null,
    scopesGranted: row.scopes_granted ?? [],
  };
}

export async function saveTokens(
  userId: string,
  accessToken: string,
  refreshToken: string | null,
  expiresIn: number,
  scopes: string[],
): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;

  const tokenExpiry = new Date(Date.now() + expiresIn * 1000).toISOString();

  await client.from('myday_google_tokens').upsert(
    [{
      user_id: userId,
      access_token: accessToken,
      refresh_token: refreshToken,
      token_expiry: tokenExpiry,
      scopes_granted: scopes,
      updated_at: new Date().toISOString(),
    }],
    { onConflict: 'user_id' },
  );
}

export async function deleteTokens(userId: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  await client.from('myday_google_tokens').delete().eq('user_id', userId);
}

// ── Helpers ───────────────────────────────────────────────────────────

export function isTokenExpired(tokens: GoogleTokens): boolean {
  if (!tokens.expiresAt) return true;
  return tokens.expiresAt.getTime() - Date.now() < 60_000; // 1 min buffer
}

export function hasScope(tokens: GoogleTokens, scope: GoogleScope): boolean {
  return tokens.scopesGranted.includes(scope);
}

export function hasFitScopes(tokens: GoogleTokens): boolean {
  return SERVICE_SCOPES.fit.every(s => tokens.scopesGranted.includes(s));
}

export function hasContactsScope(tokens: GoogleTokens): boolean {
  return SERVICE_SCOPES.contacts.every(s => tokens.scopesGranted.includes(s));
}

export async function revokeTokens(userId: string, accessToken: string): Promise<void> {
  try {
    await fetch(`${GOOGLE_REVOKE_URL}?token=${accessToken}`, { method: 'POST' });
  } catch {
    // Revoke is best-effort; always clean up DB
  }
  await deleteTokens(userId);
}
