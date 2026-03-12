/**
 * Storage Dashboard Module
 * 
 * Dashboard loading, data aggregation, and helper functions
 */

import { AppData, TaskCompletion } from '../types';
import { requireAuth, getCacheKey, getCache, setCache, pendingRequests } from './core';
import { getTasks } from './tasks';
import { getCompletions } from './tasks';
import { getEvents } from './events';
import { getJournalEntries } from './journal';
import { getRoutines } from './routines';
import { getTags } from './tags';
import { getItems } from './items';

// ===== DATA OPERATIONS =====

export const loadData = async (): Promise<AppData> => {
  const [tasks, completions, events, journalEntries, routines, tags, items] = await Promise.all([
    getTasks(),
    getCompletions(),
    getEvents(),
    getJournalEntries(),
    getRoutines(),
    getTags(),
    getItems()
  ]);

  return {
    tasks,
    completions,
    spillovers: [],
    events,
    eventAcknowledgments: [],
    journalEntries,
    routines,
    tags,
    items,
    safeEntries: [],
    safeTags: []
  };
};

// ===== OPTIMIZED DASHBOARD LOADING =====

/**
 * Load only the data needed for dashboard view (much faster than loadData)
 * This loads all tasks but only recent completions for performance
 * Includes caching and request deduplication to prevent redundant queries
 */
export const loadDashboardData = async (selectedDate: string, daysToLoad: number = 30): Promise<AppData> => {
  const cacheKey = getCacheKey(selectedDate, daysToLoad);
  
  const cachedData = getCache(cacheKey);
  if (cachedData) {
    return cachedData;
  }
  
  const pendingRequest = pendingRequests.get(cacheKey);
  if (pendingRequest) {
    return pendingRequest;
  }
  
  const requestPromise = (async () => {
    try {
      const endDate = new Date(selectedDate + 'T00:00:00');
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - daysToLoad);
      const startDateStr = startDate.toISOString().split('T')[0];
      
      const [tasks, completions, events, tags] = await Promise.all([
        getTasks(),
        getCompletionsForDateRange(startDateStr, selectedDate),
        getEvents(),
        getTags()
      ]);

      const data: AppData = {
        tasks,
        completions,
        spillovers: [],
        events,
        eventAcknowledgments: [],
        journalEntries: [],
        routines: [],
        tags,
        items: [],
        safeEntries: [],
        safeTags: []
      };
      
      setCache(cacheKey, data);
      
      return data;
    } finally {
      pendingRequests.delete(cacheKey);
    }
  })();
  
  pendingRequests.set(cacheKey, requestPromise);
  
  return requestPromise;
};

/**
 * Get completions for a specific date range (optimized query)
 * Uses composite index (user_id, completion_date) for fast lookups
 */
export const getCompletionsForDateRange = async (startDate: string, endDate: string): Promise<TaskCompletion[]> => {
  const { client, userId } = await requireAuth();

  const { data, error } = await client
    .from('myday_task_completions')
    .select('*')
    .eq('user_id', userId)
    .gte('completion_date', startDate)
    .lte('completion_date', endDate);

  if (error) {
    console.error('Error fetching completions for date range:', error);
    return [];
  }

  return (data || []).map(c => ({
    taskId: c.task_id,
    date: c.completion_date,
    completedAt: c.completed_at,
    durationMinutes: c.duration_minutes,
    startedAt: c.started_at
  }));
};

// ===== HELPER FUNCTIONS FOR VIEWS =====

export const isTaskCompletedToday = (taskId: string, date: string, completions?: TaskCompletion[]): boolean => {
  if (!completions) {
    console.warn('isTaskCompletedToday called without completions data');
    return false;
  }
  return completions.some(c => c.taskId === taskId && c.date === date);
};

export const getTaskSpilloversForDate = async (_date: string): Promise<unknown[]> => {
  return [];
};

export const moveTaskToNextDay = async (_taskId: string, _fromDate: string, _toDate: string): Promise<void> => {
  console.log('Move to next day not yet implemented');
};

export const getCompletionCountForPeriod = async (taskId: string, startDate: string, endDate: string): Promise<number> => {
  const completions = await getCompletions();
  return completions.filter(c => c.taskId === taskId && c.date >= startDate && c.date <= endDate).length;
};
