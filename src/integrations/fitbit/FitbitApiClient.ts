/**
 * Fitbit API Client
 *
 * Thin fetch wrapper with automatic token handling (same pattern as GoogleApiClient).
 * Auto-refreshes expired tokens via /api/fitbit-refresh-token.
 */

import { loadFitbitTokens, saveFitbitTokens, isFitbitTokenExpired } from './FitbitAuthManager';
import type { FitbitTokens } from './FitbitAuthManager';

let cachedTokens: FitbitTokens | null = null;
let cachedUserId: string | null = null;

async function getValidToken(userId: string): Promise<string> {
  if (!cachedTokens || cachedUserId !== userId) {
    cachedTokens = await loadFitbitTokens(userId);
    cachedUserId = userId;
  }

  if (!cachedTokens) {
    throw new Error('Fitbit account not connected');
  }

  if (!isFitbitTokenExpired(cachedTokens)) {
    return cachedTokens.accessToken;
  }

  const res = await fetch('/api/fitbit-refresh-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: cachedTokens.refreshToken }),
  });

  if (!res.ok) {
    clearFitbitCache();
    throw new Error('Fitbit token refresh failed — please reconnect');
  }

  const data = await res.json();
  await saveFitbitTokens(
    userId,
    data.access_token,
    data.refresh_token || cachedTokens.refreshToken,
    data.expires_in,
    cachedTokens.userId,
    cachedTokens.scopes,
  );

  cachedTokens = {
    ...cachedTokens,
    accessToken: data.access_token,
    refreshToken: data.refresh_token || cachedTokens.refreshToken,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };

  return cachedTokens.accessToken;
}

export function clearFitbitCache(): void {
  cachedTokens = null;
  cachedUserId = null;
}

export async function fitbitApiFetch<T = unknown>(
  userId: string,
  url: string,
): Promise<T> {
  const token = await getValidToken(userId);

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (res.status === 401) {
    clearFitbitCache();
    const refreshedToken = await getValidToken(userId);
    const retry = await fetch(url, {
      headers: {
        Authorization: `Bearer ${refreshedToken}`,
        Accept: 'application/json',
      },
    });
    if (!retry.ok) throw new Error(`Fitbit API error ${retry.status}`);
    return retry.json();
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Fitbit API error ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json();
}
