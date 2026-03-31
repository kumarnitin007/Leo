/**
 * Google OAuth / token types
 */

export interface GoogleTokenRow {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string | null;
  token_expiry: string | null;
  scopes_granted: string[] | null;
  connected_at: string;
  updated_at: string;
}

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scopesGranted: string[];
}

export interface OAuthCallbackPayload {
  code: string;
  state: string;
  scopes: string[];
}

export interface TokenRefreshPayload {
  refreshToken: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}
