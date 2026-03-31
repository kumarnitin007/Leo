import { handleApiError, createErrorResponse } from './_utils/errorHandler.js';

/**
 * POST /api/google-refresh-token
 *
 * Uses the refresh token to obtain a new access token.
 * Client Secret stays server-side.
 *
 * Body: { refreshToken: string }
 * Returns: { access_token, expires_in, scope, token_type }
 */

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json(createErrorResponse('VALIDATION_ERROR', 'Method not allowed'));
  }

  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken) {
      return res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'Missing refreshToken'));
    }

    // TODO: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in Vercel env vars
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('[google-refresh-token] Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
      return res.status(500).json(createErrorResponse('CONFIG_ERROR'));
    }

    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error('[google-refresh-token] Refresh failed:', errBody);
      return res.status(401).json(createErrorResponse('AUTH_ERROR', 'Token refresh failed'));
    }

    const tokens = await tokenRes.json();
    return res.status(200).json({
      access_token: tokens.access_token,
      expires_in: tokens.expires_in,
      scope: tokens.scope,
      token_type: tokens.token_type,
    });
  } catch (err) {
    handleApiError(res, err, 'google-refresh-token');
  }
}
