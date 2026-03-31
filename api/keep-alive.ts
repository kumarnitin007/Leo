/**
 * Vercel Serverless Function - Keep Supabase Active
 * 
 * This endpoint is called by Vercel Cron every 3 days to prevent
 * Supabase free tier from pausing due to inactivity.
 */

import { handleApiError, createErrorResponse } from './_utils/errorHandler.js';

export default async function handler(req: any, res: any) {
  // Verify this is called by Vercel Cron (optional security)
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json(createErrorResponse('AUTH_ERROR', 'Unauthorized'));
  }

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json(createErrorResponse('CONFIG_ERROR'));
    }

    // Simple ping to keep database active
    const response = await fetch(`${supabaseUrl}/rest/v1/myday_tasks?select=id&limit=1`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    if (!response.ok) {
      console.error('Supabase ping failed:', response.status);
      return res.status(500).json(createErrorResponse('EXTERNAL_API_ERROR', 'Ping failed'));
    }

    console.log('✅ Keep-alive ping successful');
    
    return res.status(200).json({ 
      success: true, 
      message: 'Supabase keep-alive ping successful',
      timestamp: new Date().toISOString()
    });
  } catch (error: unknown) {
    handleApiError(res, error, 'keep-alive', 500, 'SERVER_ERROR');
  }
}
