import { handleApiError, createErrorResponse } from './_utils/errorHandler.js';

/**
 * GET /api/fitbit-oauth-callback
 *
 * Fitbit redirects here after user grants consent.
 * Exchanges the authorization code for access + refresh tokens using PKCE.
 * The code_verifier is sent from the browser via a cookie or query param.
 *
 * Environment variables:
 *   FITBIT_CLIENT_ID
 *   FITBIT_CLIENT_SECRET
 *   VITE_FITBIT_REDIRECT_URI
 */

const FITBIT_TOKEN_URL = 'https://api.fitbit.com/oauth2/token';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json(createErrorResponse('VALIDATION_ERROR', 'Method not allowed'));
  }

  try {
    const { code, state, code_verifier } = req.query;

    if (!code) {
      return redirectWithError(res, 'Missing authorization code');
    }

    const clientId = process.env.FITBIT_CLIENT_ID;
    const clientSecret = process.env.FITBIT_CLIENT_SECRET;
    const redirectUri = process.env.VITE_FITBIT_REDIRECT_URI || '';

    if (!clientId || !clientSecret) {
      console.error('[fitbit-oauth-callback] Missing FITBIT_CLIENT_ID or FITBIT_CLIENT_SECRET');
      return redirectWithError(res, 'Server misconfigured — missing Fitbit credentials');
    }

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const body = new URLSearchParams({
      client_id: clientId,
      grant_type: 'authorization_code',
      code: code as string,
      redirect_uri: redirectUri,
    });

    if (code_verifier) {
      body.append('code_verifier', code_verifier as string);
    }

    const tokenRes = await fetch(FITBIT_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body,
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error('[fitbit-oauth-callback] Token exchange failed:', errBody);
      return redirectWithError(res, 'Token exchange failed');
    }

    const tokens = await tokenRes.json();

    const appUrl = redirectUri ? new URL(redirectUri).origin : '';
    const fragment = new URLSearchParams({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || '',
      expires_in: String(tokens.expires_in),
      user_id: tokens.user_id || '',
      scope: tokens.scope || '',
      state: (state as string) || '',
    });

    return res.redirect(`${appUrl}/integrations#fitbit_callback=${fragment.toString()}`);
  } catch (err) {
    handleApiError(res, err, 'fitbit-oauth-callback');
  }
}

function redirectWithError(res: any, message: string) {
  const encoded = encodeURIComponent(message);
  const base = process.env.VITE_FITBIT_REDIRECT_URI
    ? new URL(process.env.VITE_FITBIT_REDIRECT_URI).origin
    : '';
  return res.redirect(`${base}/integrations#fitbit_error=${encoded}`);
}
