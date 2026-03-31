/**
 * Google Integration Constants
 *
 * Scopes, API base URLs, storage keys, and config for all Google services.
 * Adding a new Google service = add its scope and base URL here.
 */

// ── OAuth ─────────────────────────────────────────────────────────────

export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

// TODO: Paste your Client ID from Google Cloud Console into .env as VITE_GOOGLE_CLIENT_ID
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
// TODO: Set VITE_GOOGLE_REDIRECT_URI in .env (e.g. http://localhost:5173/auth/google/callback for dev)
export const GOOGLE_REDIRECT_URI = import.meta.env.VITE_GOOGLE_REDIRECT_URI || '';

// ── Scopes (request only what user is connecting) ─────────────────────

export const GOOGLE_SCOPES = {
  FIT_ACTIVITY_READ: 'https://www.googleapis.com/auth/fitness.activity.read',
  FIT_BODY_READ: 'https://www.googleapis.com/auth/fitness.body.read',
  FIT_SLEEP_READ: 'https://www.googleapis.com/auth/fitness.sleep.read',
  CONTACTS: 'https://www.googleapis.com/auth/contacts',
} as const;

export type GoogleScope = (typeof GOOGLE_SCOPES)[keyof typeof GOOGLE_SCOPES];

export const SERVICE_SCOPES: Record<string, GoogleScope[]> = {
  fit: [
    GOOGLE_SCOPES.FIT_ACTIVITY_READ,
    GOOGLE_SCOPES.FIT_BODY_READ,
    GOOGLE_SCOPES.FIT_SLEEP_READ,
  ],
  contacts: [GOOGLE_SCOPES.CONTACTS],
};

// ── API Base URLs ─────────────────────────────────────────────────────

export const GOOGLE_API = {
  FITNESS: 'https://www.googleapis.com/fitness/v1/users/me',
  PEOPLE: 'https://people.googleapis.com/v1',
} as const;

// ── Local storage / state keys ────────────────────────────────────────

export const GOOGLE_STATE_KEY = 'myday_google_oauth_state';
export const GOOGLE_PENDING_SERVICE_KEY = 'myday_google_pending_service';

// ── Fitness data types (Google Fit aggregate) ─────────────────────────

export const FIT_DATA_TYPES = {
  STEPS: 'com.google.step_count.delta',
  CALORIES: 'com.google.calories.expended',
  DISTANCE: 'com.google.distance.delta',
  ACTIVE_MINUTES: 'com.google.active_minutes',
  HEART_RATE: 'com.google.heart_rate.bpm',
  SLEEP: 'com.google.sleep.segment',
  WEIGHT: 'com.google.weight',
  FLOORS: 'com.google.floor_count.delta',
} as const;
