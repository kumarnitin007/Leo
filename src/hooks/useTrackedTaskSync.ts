/**
 * useTrackedTaskSync
 *
 * Lightweight startup hook that checks cached fitness data against
 * tracked tasks and auto-completes them. Runs once on mount.
 * Works with any fitness provider (Google Fit, Fitbit, Garmin).
 *
 * Mount this in App.tsx or TodayView so it runs on every app load.
 */

import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getTasks } from '../storage/tasks';
import { loadCachedFitnessDataUnified } from '../integrations/fitness/UnifiedFitnessService';
import { runAutoComplete } from '../integrations/google/services/TrackedTaskEngine';

export function useTrackedTaskSync(): void {
  const { user } = useAuth();
  const hasRun = useRef(false);

  useEffect(() => {
    if (!user?.id || hasRun.current) return;
    hasRun.current = true;

    (async () => {
      try {
        const tasks = await getTasks();
        const hasTracked = tasks.some(t => t.trackedMetric?.autoComplete);
        if (!hasTracked) return;

        const cached = await loadCachedFitnessDataUnified(user.id, 7);
        if (!cached.length) return;

        const result = await runAutoComplete(tasks, cached, user.id);
        if (result.completed.length > 0) {
          console.info(
            `[TrackedTaskSync] Startup auto-completed ${result.completed.length} task-day(s)`,
          );
        }
      } catch (err) {
        // Silent — this is a best-effort background process
      }
    })();
  }, [user?.id]);
}
