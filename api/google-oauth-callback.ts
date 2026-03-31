import { handleApiError, createErrorResponse } from './_utils/errorHandler.js';

/**
 * GET /api/google-oauth-callback
 *
 * Google redirects here after user grants consent.
 * Exchanges the authorization code for access + refresh tokens,
 * then redirects back to the app with tokens in a fragment (never in URL params
 * that could be logged by servers).
 *
 * Environment variables (server-side only):
 *   GOOGLE_CLIENT_ID     — same as VITE_GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET — NEVER exposed to the browser
 */

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json(createErrorResponse('VALIDATION_ERROR', 'Method not allowed'));
  }

  try {
    const { code, state, error: oauthError } = req.query;

    if (oauthError) {
      return redirectWithError(res, `OAuth error: ${oauthError}`);
    }
    if (!code) {
      return redirectWithError(res, 'Missing authorization code');
    }

    // TODO: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in Vercel env vars
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.VITE_GOOGLE_REDIRECT_URI
      || process.env.GOOGLE_REDIRECT_URI
      || '';

    if (!clientId || !clientSecret) {
      console.error('[google-oauth-callback] Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
      return redirectWithError(res, 'Server misconfigured — missing Google credentials');
    }

    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code as string,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error('[google-oauth-callback] Token exchange failed:', errBody);
      return redirectWithError(res, 'Token exchange failed');
    }

    const tokens = await tokenRes.json();

    // Redirect back to app with tokens in fragment (hash) — never in query string
    const appUrl = new URL(redirectUri);
    const basePath = appUrl.origin;
    const fragment = new URLSearchParams({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || '',
      expires_in: String(tokens.expires_in),
      scope: tokens.scope || '',
      state: (state as string) || '',
    });

    return res.redirect(`${basePath}/integrations#google_callback=${fragment.toString()}`);
  } catch (err) {
    handleApiError(res, err, 'google-oauth-callback');
  }
}

function redirectWithError(res: any, message: string) {
  const encoded = encodeURIComponent(message);
  const base = process.env.VITE_GOOGLE_REDIRECT_URI
    ? new URL(process.env.VITE_GOOGLE_REDIRECT_URI).origin
    : '';
  return res.redirect(`${base}/integrations#google_error=${encoded}`);
}
