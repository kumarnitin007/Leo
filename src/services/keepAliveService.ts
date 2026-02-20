/**
 * Keep-Alive Service
 * 
 * Prevents Supabase free tier from pausing due to inactivity.
 * Pings the database every 6 days when user opens the app.
 */

import { getSupabaseClient } from '../lib/supabase';

const KEEP_ALIVE_KEY = 'last-keep-alive-ping';
const PING_INTERVAL_DAYS = 3;
const PING_INTERVAL_MS = PING_INTERVAL_DAYS * 24 * 60 * 60 * 1000;

/**
 * Check if we need to ping Supabase to keep it active
 */
export const checkAndPingKeepAlive = async (): Promise<void> => {
  try {
    const lastPing = localStorage.getItem(KEEP_ALIVE_KEY);
    const now = Date.now();
    
    // Check if we need to ping (more than 6 days since last ping)
    if (!lastPing || (now - parseInt(lastPing)) > PING_INTERVAL_MS) {
      console.log('🏓 Keep-alive: Pinging Supabase to prevent auto-pause...');
      
      const client = getSupabaseClient();
      if (!client) return;
      
      // Simple lightweight query to keep connection active
      await client.from('myday_tasks').select('id').limit(1);
      
      // Update last ping time
      localStorage.setItem(KEEP_ALIVE_KEY, now.toString());
      console.log('✅ Keep-alive: Ping successful');
    }
  } catch (error) {
    console.warn('Keep-alive ping failed (non-critical):', error);
    // Don't throw - this is non-critical background task
  }
};

/**
 * Get days until next ping is needed
 */
export const getDaysUntilNextPing = (): number => {
  const lastPing = localStorage.getItem(KEEP_ALIVE_KEY);
  if (!lastPing) return 0;
  
  const now = Date.now();
  const timeSinceLastPing = now - parseInt(lastPing);
  const timeUntilNextPing = PING_INTERVAL_MS - timeSinceLastPing;
  
  if (timeUntilNextPing <= 0) return 0;
  
  return Math.ceil(timeUntilNextPing / (24 * 60 * 60 * 1000));
};
