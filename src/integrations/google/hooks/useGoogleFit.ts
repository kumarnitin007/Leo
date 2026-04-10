/**
 * useGoogleFit Hook
 *
 * Used by JournalView (Milestone 1) and later by Analytics / Goals.
 * Provides fetch + cache of daily fitness data.
 * After every fetch, runs the Tracked Task auto-completion engine.
 */

import { useState, useCallback } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { fetchAndCacheFitnessData, loadCachedFitnessData } from '../services/FitService';
import { runAutoComplete } from '../services/TrackedTaskEngine';
import { getTasks } from '../../../storage/tasks';
import type { DailyFitnessData } from '../types/fit.types';
import type { AutoCompleteResult } from '../services/TrackedTaskEngine';

export interface GoogleFitState {
  data: DailyFitnessData[];
  loading: boolean;
  error: string | null;
  lastAutoComplete: AutoCompleteResult | null;
  fetchRecent: (days?: number) => Promise<void>;
  loadCached: (days?: number) => Promise<void>;
}

export function useGoogleFit(): GoogleFitState {
  const { user } = useAuth();
  const [data, setData] = useState<DailyFitnessData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAutoComplete, setLastAutoComplete] = useState<AutoCompleteResult | null>(null);

  const runTrackedAutoComplete = useCallback(async (fitnessData: DailyFitnessData[]) => {
    if (!user?.id || !fitnessData.length) return;
    try {
      const tasks = await getTasks();
      const hasTracked = tasks.some(t => t.trackedMetric?.autoComplete);
      if (!hasTracked) return;
      const result = await runAutoComplete(tasks, fitnessData, user.id);
      setLastAutoComplete(result);
    } catch (err) {
      console.warn('[useGoogleFit] Auto-complete check failed:', err);
    }
  }, [user?.id]);

  const fetchRecent = useCallback(async (days = 30) => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAndCacheFitnessData(user.id, days);
      setData(result);
      await runTrackedAutoComplete(result);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch fitness data');
    } finally {
      setLoading(false);
    }
  }, [user?.id, runTrackedAutoComplete]);

  const loadCached = useCallback(async (days = 30) => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const cached = await loadCachedFitnessData(user.id, days);
      setData(cached);
      await runTrackedAutoComplete(cached);
    } catch {
      // Cache miss is not an error
    } finally {
      setLoading(false);
    }
  }, [user?.id, runTrackedAutoComplete]);

  return { data, loading, error, lastAutoComplete, fetchRecent, loadCached };
}
