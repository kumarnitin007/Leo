/**
 * useFitbitAuth Hook
 *
 * Manages Fitbit OAuth connection state.
 * Handles the callback fragment (#fitbit_callback=...) after redirect.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  buildFitbitOAuthUrl,
  loadFitbitTokens,
  saveFitbitTokens,
  revokeFitbitTokens,
} from './FitbitAuthManager';
import { FITBIT_STATE_KEY, FITBIT_VERIFIER_KEY } from './constants';
import type { FitbitTokens } from './FitbitAuthManager';

export interface FitbitAuthState {
  loading: boolean;
  isConnected: boolean;
  tokens: FitbitTokens | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export function useFitbitAuth(): FitbitAuthState {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tokens, setTokens] = useState<FitbitTokens | null>(null);

  // Load tokens on mount
  useEffect(() => {
    if (!user?.id) { setLoading(false); return; }
    loadFitbitTokens(user.id).then(t => {
      setTokens(t);
      setLoading(false);
    });
  }, [user?.id]);

  // Handle OAuth callback from URL fragment
  useEffect(() => {
    if (!user?.id) return;
    const hash = window.location.hash;
    if (!hash.includes('fitbit_callback=')) return;

    const raw = hash.split('fitbit_callback=')[1];
    if (!raw) return;

    const params = new URLSearchParams(raw);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token') || '';
    const expiresIn = parseInt(params.get('expires_in') || '3600', 10);
    const fitbitUserId = params.get('user_id') || '';
    const scope = params.get('scope') || '';
    const state = params.get('state') || '';

    // Validate CSRF state
    const savedState = sessionStorage.getItem(FITBIT_STATE_KEY);
    if (state && savedState && state !== savedState) {
      console.error('[useFitbitAuth] State mismatch — possible CSRF');
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }

    if (!accessToken) {
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }

    sessionStorage.removeItem(FITBIT_STATE_KEY);
    sessionStorage.removeItem(FITBIT_VERIFIER_KEY);

    const scopes = scope.split(' ').filter(Boolean);

    saveFitbitTokens(user.id, accessToken, refreshToken, expiresIn, fitbitUserId, scopes)
      .then(() => loadFitbitTokens(user.id))
      .then(t => setTokens(t));

    window.history.replaceState(null, '', window.location.pathname);
  }, [user?.id]);

  const connect = useCallback(async () => {
    const url = await buildFitbitOAuthUrl();

    // Pass code_verifier via the redirect URI as a query param
    // so the serverless callback can use it for PKCE
    const verifier = sessionStorage.getItem(FITBIT_VERIFIER_KEY) || '';
    const finalUrl = url + `&code_verifier_hint=${encodeURIComponent(verifier)}`;

    window.location.href = finalUrl;
  }, []);

  const disconnect = useCallback(async () => {
    if (!user?.id || !tokens) return;
    await revokeFitbitTokens(user.id, tokens.accessToken);
    setTokens(null);
  }, [user?.id, tokens]);

  return {
    loading,
    isConnected: !!tokens,
    tokens,
    connect,
    disconnect,
  };
}
