/**
 * Google Integration — barrel export
 */

export { useGoogleAuth } from './hooks/useGoogleAuth';
export { useGoogleFit } from './hooks/useGoogleFit';
export { useGoogleContacts } from './hooks/useGoogleContacts';
export {
  buildOAuthUrl,
  loadTokens,
  hasFitScopes,
  hasContactsScope,
} from './GoogleAuthManager';
export { googleApiFetch } from './GoogleApiClient';
export { GOOGLE_SCOPES, SERVICE_SCOPES } from './constants';
export type { DailyFitnessData } from './types/fit.types';
export type { GoogleTokens } from './types/auth.types';
export type { GoogleContact } from './types/contacts.types';
