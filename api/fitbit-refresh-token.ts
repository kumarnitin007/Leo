import { handleApiError, createErrorResponse } from './_utils/errorHandler.js';

/**
 * POST /api/fitbit-refresh-token
 *
 * Refreshes Fitbit access token server-side (client secret stays secure).
 *
 * Body: { refreshToken: string }
 * Returns: { access_token, refresh_token, expires_in, user_id, scope }
 */

const FITBIT_TOKEN_URL = 'https://api.fitbit.com/oauth2/token';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json(createErrorResponse('VALIDATION_ERROR', 'Method not allowed'));
  }

  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken) {
      return res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'Missing refreshToken'));
    }

    const clientId = process.env.FITBIT_CLIENT_ID;
    const clientSecret = process.env.FITBIT_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('[fitbit-refresh-token] Missing FITBIT_CLIENT_ID or FITBIT_CLIENT_SECRET');
      return res.status(500).json(createErrorResponse('CONFIG_ERROR'));
    }

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const tokenRes = await fetch(FITBIT_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error('[fitbit-refresh-token] Refresh failed:', errBody);
      return res.status(401).json(createErrorResponse('AUTH_ERROR', 'Token refresh failed'));
    }

    const tokens = await tokenRes.json();
    return res.status(200).json({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
      user_id: tokens.user_id,
      scope: tokens.scope,
    });
  } catch (err) {
    handleApiError(res, err, 'fitbit-refresh-token');
  }
}
