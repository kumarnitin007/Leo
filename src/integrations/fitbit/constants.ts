/**
 * Fitbit Integration Constants
 */

export const FITBIT_AUTH_URL = 'https://www.fitbit.com/oauth2/authorize';
export const FITBIT_TOKEN_URL = 'https://api.fitbit.com/oauth2/token';
export const FITBIT_API_BASE = 'https://api.fitbit.com';
export const FITBIT_REVOKE_URL = 'https://api.fitbit.com/oauth2/revoke';

export const FITBIT_CLIENT_ID = import.meta.env.VITE_FITBIT_CLIENT_ID || '';
export const FITBIT_REDIRECT_URI = import.meta.env.VITE_FITBIT_REDIRECT_URI || '';

export const FITBIT_SCOPES = [
  'activity',
  'heartrate',
  'sleep',
  'weight',
  'profile',
] as const;

export const FITBIT_STATE_KEY = 'myday_fitbit_oauth_state';
export const FITBIT_VERIFIER_KEY = 'myday_fitbit_pkce_verifier';
