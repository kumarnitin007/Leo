/**
 * useGoogleAuth Hook
 *
 * Provides Google connection status, connect/disconnect handlers,
 * and listens for the OAuth callback redirect.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import {
  buildOAuthUrl,
  loadTokens,
  saveTokens,
  revokeTokens,
  hasFitScopes,
  hasContactsScope,
} from '../GoogleAuthManager';
import { clearCache } from '../GoogleApiClient';
import { GOOGLE_STATE_KEY, GOOGLE_PENDING_SERVICE_KEY } from '../constants';
import type { GoogleTokens } from '../types/auth.types';

export interface GoogleAuthState {
  tokens: GoogleTokens | null;
  loading: boolean;
  isFitConnected: boolean;
  isContactsConnected: boolean;
  tokenExpired: boolean;
  connectService: (serviceId: string) => void;
  disconnectGoogle: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useGoogleAuth(): GoogleAuthState {
  const { user } = useAuth();
  const [tokens, setTokens] = useState<GoogleTokens | null>(null);
  const [loading, setLoading] = useState(true);
  const [tokenExpired, setTokenExpired] = useState(false);

  const refresh = useCallback(async () => {
    if (!user?.id) { setTokens(null); setLoading(false); return; }
    setLoading(true);
    const t = await loadTokens(user.id);
    setTokens(t);

    if (t && t.refreshToken) {
      try {
        const res = await fetch('/api/google-refresh-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: t.refreshToken }),
        });
        if (!res.ok) {
          console.warn('[GoogleAuth] Token health check failed — token expired/revoked');
          setTokenExpired(true);
        } else {
          setTokenExpired(false);
          const data = await res.json();
          await saveTokens(user.id, data.access_token, t.refreshToken, data.expires_in, t.scopesGranted);
        }
      } catch {
        setTokenExpired(true);
      }
    } else if (t) {
      setTokenExpired(true);
    } else {
      setTokenExpired(false);
    }

    setLoading(false);
  }, [user?.id]);

  // Initial load
  useEffect(() => { refresh(); }, [refresh]);

  // Handle OAuth callback fragment (#google_callback=... or #google_error=...)
  useEffect(() => {
    if (!user?.id) return;
    const hash = window.location.hash;
    if (!hash) return;

    if (hash.includes('google_callback=')) {
      const fragment = hash.split('google_callback=')[1];
      const params = new URLSearchParams(fragment);

      const savedState = sessionStorage.getItem(GOOGLE_STATE_KEY);
      const returnedState = params.get('state');
      if (savedState && returnedState && savedState !== returnedState) {
        console.error('[GoogleAuth] State mismatch — possible CSRF');
        cleanupHash();
        return;
      }

      const accessToken = params.get('access_token') || '';
      const refreshToken = params.get('refresh_token') || '';
      const expiresIn = Number(params.get('expires_in') || '3600');
      const scope = params.get('scope') || '';
      const scopes = scope.split(' ').filter(Boolean);

      if (accessToken) {
        saveTokens(user.id, accessToken, refreshToken || null, expiresIn, scopes)
          .then(() => refresh())
          .catch(err => console.error('[GoogleAuth] Failed to save tokens:', err));
      }

      sessionStorage.removeItem(GOOGLE_STATE_KEY);
      sessionStorage.removeItem(GOOGLE_PENDING_SERVICE_KEY);
      cleanupHash();
    }

    if (hash.includes('google_error=')) {
      const msg = decodeURIComponent(hash.split('google_error=')[1]);
      console.error('[GoogleAuth] OAuth error:', msg);
      cleanupHash();
    }
  }, [user?.id, refresh]);

  const connectService = useCallback((serviceId: string) => {
    const existingScopes = tokens?.scopesGranted ?? [];
    const url = buildOAuthUrl(serviceId, existingScopes);
    window.location.href = url;
  }, [tokens]);

  const disconnectGoogle = useCallback(async () => {
    if (!user?.id || !tokens) return;
    await revokeTokens(user.id, tokens.accessToken);
    clearCache();
    setTokens(null);
  }, [user?.id, tokens]);

  return {
    tokens,
    loading,
    isFitConnected: tokens ? hasFitScopes(tokens) && !tokenExpired : false,
    isContactsConnected: tokens ? hasContactsScope(tokens) && !tokenExpired : false,
    tokenExpired,
    connectService,
    disconnectGoogle,
    refresh,
  };
}

function cleanupHash() {
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
}
