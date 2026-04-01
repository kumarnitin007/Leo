/**
 * Fitbit OAuth Manager
 *
 * Handles OAuth 2.0 Authorization Code with PKCE for Fitbit.
 * Token exchange + refresh happen server-side (api/fitbit-oauth-callback.ts).
 * Tokens stored in myday_fitbit_tokens (Supabase).
 */

import { getSupabaseClient } from '../../lib/supabase';
import {
  FITBIT_AUTH_URL,
  FITBIT_CLIENT_ID,
  FITBIT_REDIRECT_URI,
  FITBIT_SCOPES,
  FITBIT_STATE_KEY,
  FITBIT_VERIFIER_KEY,
} from './constants';

export interface FitbitTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date | null;
  userId: string; // Fitbit user ID (not Supabase)
  scopes: string[];
}

interface FitbitTokenRow {
  user_id: string;
  fitbit_user_id: string;
  access_token: string;
  refresh_token: string;
  token_expiry: string | null;
  scopes: string[];
  updated_at: string;
}

// ── PKCE helpers ─────────────────────────────────────────────────────

function generateCodeVerifier(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ── Build OAuth URL ──────────────────────────────────────────────────

export async function buildFitbitOAuthUrl(): Promise<string> {
  const state = crypto.randomUUID();
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);

  sessionStorage.setItem(FITBIT_STATE_KEY, state);
  sessionStorage.setItem(FITBIT_VERIFIER_KEY, verifier);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: FITBIT_CLIENT_ID,
    redirect_uri: FITBIT_REDIRECT_URI,
    scope: FITBIT_SCOPES.join(' '),
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  return `${FITBIT_AUTH_URL}?${params.toString()}`;
}

// ── Token CRUD ───────────────────────────────────────────────────────

export async function loadFitbitTokens(userId: string): Promise<FitbitTokens | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data } = await client
    .from('myday_fitbit_tokens')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (!data) return null;
  const row = data as FitbitTokenRow;

  return {
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    expiresAt: row.token_expiry ? new Date(row.token_expiry) : null,
    userId: row.fitbit_user_id,
    scopes: row.scopes ?? [],
  };
}

export async function saveFitbitTokens(
  userId: string,
  accessToken: string,
  refreshToken: string,
  expiresIn: number,
  fitbitUserId: string,
  scopes: string[],
): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;

  const tokenExpiry = new Date(Date.now() + expiresIn * 1000).toISOString();

  await client.from('myday_fitbit_tokens').upsert(
    [{
      user_id: userId,
      fitbit_user_id: fitbitUserId,
      access_token: accessToken,
      refresh_token: refreshToken,
      token_expiry: tokenExpiry,
      scopes,
      updated_at: new Date().toISOString(),
    }],
    { onConflict: 'user_id' },
  );
}

export async function deleteFitbitTokens(userId: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  await client.from('myday_fitbit_tokens').delete().eq('user_id', userId);
}

export function isFitbitTokenExpired(tokens: FitbitTokens): boolean {
  if (!tokens.expiresAt) return true;
  return tokens.expiresAt.getTime() - Date.now() < 60_000;
}

export async function revokeFitbitTokens(userId: string, accessToken: string): Promise<void> {
  try {
    await fetch('https://api.fitbit.com/oauth2/revoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${accessToken}`,
      },
      body: new URLSearchParams({ token: accessToken }),
    });
  } catch {
    // best-effort
  }
  await deleteFitbitTokens(userId);
}
