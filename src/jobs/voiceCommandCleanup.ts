/**
 * COPILOT PROMPT: Create voice command cleanup cron job
 * 
 * PURPOSE: Automatically delete expired voice command logs (privacy requirement)
 * 
 * REQUIREMENTS:
 * 
 * 1. Create a cron job that runs DAILY at 2:00 AM
 *    - Use cron syntax: '0 2 * * *'
 *    - Use 'node-cron' package (or your preferred scheduler)
 * 
 * 2. Job should:
 *    - Call VoiceCommandDatabaseService.purgeExpired()
 *    - Log the number of deleted records
 *    - Log timestamp of job execution
 *    - Catch and log any errors
 *    - Send alert if deletion fails (console.error for now)
 * 
 * 3. Export startVoiceCommandCleanupJob() function
 *    - Should be called once when server starts
 *    - Should not block server startup
 * 
 * 4. Export stopVoiceCommandCleanupJob() function
 *    - For graceful shutdown
 *    - Stop the cron job
 * 
 * 5. Also create manual cleanup function:
 *    purgeOlderThan(days: number): Promise<number>
 *    - Delete all records older than X days
 *    - Return count of deleted records
 * 
 * EXAMPLE USAGE:
 * // In your server startup file:
 * import { startVoiceCommandCleanupJob } from './jobs/voiceCommandCleanup';
 * startVoiceCommandCleanupJob();
 * 
 * // For manual cleanup:
 * import { purgeOlderThan } from './jobs/voiceCommandCleanup';
 * await purgeOlderThan(60); // Delete records older than 60 days
 * 
 * DEPENDENCIES:
 * npm install node-cron
 * npm install @types/node-cron --save-dev
 */

import cron from 'node-cron';
import { getSupabaseClient } from '../lib/supabase';
import dbService from '../services/voice/VoiceCommandDatabaseService';

let scheduledTask: cron.ScheduledTask | null = null;

/** Run the daily cleanup: purge expired records using dbService.purgeExpired() */
async function runCleanupOnce(): Promise<number> {
  try {
    const deleted = await dbService.purgeExpired();
    console.log(`[voiceCommandCleanup] Purged ${deleted} expired voice command logs at ${new Date().toISOString()}`);
    return deleted;
  } catch (err) {
    console.error('[voiceCommandCleanup] purgeExpired failed', err);
    return 0;
  }
}

/**
 * Start the scheduled daily cleanup job at 2:00 AM server time (cron: '0 2 * * *').
 * Returns true if job started, false if it was already running.
 */
export function startVoiceCommandCleanupJob(): boolean {
  if (scheduledTask) {
    console.warn('[voiceCommandCleanup] Job already started');
    return false;
  }

  // Schedule at 2:00 AM daily
  scheduledTask = cron.schedule(
    '0 2 * * *',
    async () => {
      try {
        console.log('[voiceCommandCleanup] Running scheduled cleanup at', new Date().toISOString());
        const deleted = await runCleanupOnce();
        if (deleted === 0) {
          // If nothing deleted, still log success; if desired we could alert on failures only
          console.log('[voiceCommandCleanup] No expired records found');
        }
      } catch (err) {
        console.error('[voiceCommandCleanup] Scheduled cleanup error', err);
      }
    },
    { scheduled: true }
  );

  // Start immediately (task is scheduled to run in background)
  try {
    scheduledTask.start();
  } catch (err) {
    console.warn('[voiceCommandCleanup] scheduledTask.start() warning', err);
  }

  console.log('[voiceCommandCleanup] Job scheduled (daily at 02:00)');
  return true;
}

/** Stop the scheduled cleanup job for graceful shutdown */
export function stopVoiceCommandCleanupJob(): void {
  if (!scheduledTask) return;
  try {
    scheduledTask.stop();
    scheduledTask = null;
    console.log('[voiceCommandCleanup] Job stopped');
  } catch (err) {
    console.error('[voiceCommandCleanup] Failed to stop job', err);
  }
}

/**
 * Manual purge: delete all records older than `days` days from created_at.
 * Returns the number of deleted records.
 */
export async function purgeOlderThan(days: number): Promise<number> {
  if (!Number.isFinite(days) || days <= 0) throw new Error('days must be a positive number');
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase client not configured');

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  try {
    const { data, error } = await client
      .from('myday_voice_command_logs')
      .delete()
      .lt('created_at', cutoff)
      .select('id');

    if (error) {
      console.error('[voiceCommandCleanup] purgeOlderThan delete error', error);
      throw error;
    }

    const count = Array.isArray(data) ? data.length : 0;
    console.log(`[voiceCommandCleanup] Purged ${count} voice command logs older than ${days} days (${cutoff})`);
    return count;
  } catch (err) {
    console.error('[voiceCommandCleanup] purgeOlderThan failed', err);
    throw err;
  }
}

// Export default helpers for convenience
export default {
  startVoiceCommandCleanupJob,
  stopVoiceCommandCleanupJob,
  purgeOlderThan,
};
