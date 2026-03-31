/**
 * Google API Client
 *
 * Thin fetch wrapper that:
 *  1. Attaches the Bearer token automatically
 *  2. Checks token expiry before every request
 *  3. If expired, calls /api/google-refresh-token transparently
 *  4. Retries the original request once after a successful refresh
 *
 * All Google service files (FitService, ContactsService) use this
 * instead of raw fetch.
 */

import { loadTokens, saveTokens, isTokenExpired } from './GoogleAuthManager';
import type { GoogleTokens } from './types/auth.types';

let cachedTokens: GoogleTokens | null = null;
let cachedUserId: string | null = null;

async function getValidToken(userId: string): Promise<string> {
  if (!cachedTokens || cachedUserId !== userId) {
    cachedTokens = await loadTokens(userId);
    cachedUserId = userId;
  }

  if (!cachedTokens) {
    throw new Error('Google account not connected');
  }

  if (!isTokenExpired(cachedTokens)) {
    return cachedTokens.accessToken;
  }

  if (!cachedTokens.refreshToken) {
    throw new Error('No refresh token available — please reconnect Google');
  }

  const res = await fetch('/api/google-refresh-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: cachedTokens.refreshToken }),
  });

  if (!res.ok) {
    clearCache();
    throw new Error('Token refresh failed — please reconnect Google');
  }

  const data = await res.json();
  await saveTokens(
    userId,
    data.access_token,
    cachedTokens.refreshToken,
    data.expires_in,
    cachedTokens.scopesGranted,
  );

  cachedTokens = {
    ...cachedTokens,
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };

  return cachedTokens.accessToken;
}

export function clearCache(): void {
  cachedTokens = null;
  cachedUserId = null;
}

export interface GoogleApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
}

/**
 * Call any Google API endpoint with automatic token handling.
 *
 * @param userId   Supabase user id
 * @param url      Full Google API URL
 * @param options  Method, body, extra headers
 */
export async function googleApiFetch<T = unknown>(
  userId: string,
  url: string,
  options: GoogleApiOptions = {},
): Promise<T> {
  const token = await getValidToken(userId);

  const res = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401) {
    clearCache();
    const refreshedToken = await getValidToken(userId);
    const retry = await fetch(url, {
      method: options.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${refreshedToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (!retry.ok) throw new Error(`Google API error ${retry.status}`);
    return retry.json();
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Google API error ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json();
}
