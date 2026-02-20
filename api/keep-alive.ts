/**
 * Vercel Serverless Function - Keep Supabase Active
 * 
 * This endpoint is called by Vercel Cron every 3 days to prevent
 * Supabase free tier from pausing due to inactivity.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Verify this is called by Vercel Cron (optional security)
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }

    // Simple ping to keep database active
    const response = await fetch(`${supabaseUrl}/rest/v1/myday_tasks?select=id&limit=1`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`Supabase ping failed: ${response.status}`);
    }

    console.log('✅ Keep-alive ping successful');
    
    return res.status(200).json({ 
      success: true, 
      message: 'Supabase keep-alive ping successful',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('❌ Keep-alive ping failed:', error);
    
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}
