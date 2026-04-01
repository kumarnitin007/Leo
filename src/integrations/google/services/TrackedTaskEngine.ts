/**
 * Tracked Task Auto-Completion Engine
 *
 * Checks fitness data against tracked tasks and auto-completes them
 * when targets are met. Supports backfill — if a user syncs steps
 * after 3-4 days, earlier tasks get marked complete retroactively.
 *
 * Called from:
 *  - App startup (against cached fitness data)
 *  - After every Google Fit sync (fresh data)
 */

import { getSupabaseClient } from '../../../lib/supabase';
import type { DailyFitnessData } from '../types/fit.types';
import type { Task, TrackedMetric } from '../../../types';

export interface AutoCompleteResult {
  completed: { taskId: string; taskName: string; date: string; actual: number; target: number }[];
  skipped: number;
}

/**
 * Run the auto-completion engine.
 *
 * @param tasks       All user tasks (only those with trackedMetric + autoComplete are processed)
 * @param fitnessData Array of DailyFitnessData (can be from cache or fresh fetch)
 * @param userId      Supabase user ID
 */
export async function runAutoComplete(
  tasks: Task[],
  fitnessData: DailyFitnessData[],
  userId: string,
): Promise<AutoCompleteResult> {
  const trackedTasks = tasks.filter(
    t => t.trackedMetric?.autoComplete && !t.onHold,
  );

  if (!trackedTasks.length || !fitnessData.length) {
    return { completed: [], skipped: 0 };
  }

  const client = getSupabaseClient();
  if (!client) return { completed: [], skipped: 0 };

  const existingCompletions = await loadExistingCompletions(
    client, userId, trackedTasks.map(t => t.id), fitnessData.map(d => d.date),
  );

  const result: AutoCompleteResult = { completed: [], skipped: 0 };

  for (const task of trackedTasks) {
    const metric = task.trackedMetric!;

    for (const day of fitnessData) {
      const actual = extractMetricValue(day, metric);
      if (actual === null || actual < metric.target) {
        result.skipped++;
        continue;
      }

      const key = `${task.id}|${day.date}`;
      if (existingCompletions.has(key)) {
        continue;
      }

      if (!isTaskScheduledForDate(task, day.date)) {
        continue;
      }

      try {
        await client
          .from('myday_task_completions')
          .upsert([{
            user_id: userId,
            task_id: task.id,
            completion_date: day.date,
            completed_at: new Date().toISOString(),
            started_at: new Date().toISOString(),
          }], { onConflict: 'user_id,task_id,completion_date' });

        result.completed.push({
          taskId: task.id,
          taskName: task.name,
          date: day.date,
          actual,
          target: metric.target,
        });

        console.info(
          `[TrackedTask] ✓ Auto-completed "${task.name}" for ${day.date} ` +
          `(${actual} ${metric.unit} ≥ ${metric.target} ${metric.unit})`,
        );
      } catch (err: any) {
        console.warn(`[TrackedTask] Failed to auto-complete "${task.name}" for ${day.date}:`, err.message);
      }
    }
  }

  if (result.completed.length > 0) {
    console.info(
      `[TrackedTask] Auto-completed ${result.completed.length} task-day(s), skipped ${result.skipped}`,
    );
  }

  return result;
}

/**
 * Extract the relevant metric value from a DailyFitnessData record.
 */
function extractMetricValue(day: DailyFitnessData, metric: TrackedMetric): number | null {
  switch (metric.type) {
    case 'steps': return day.steps;
    case 'calories': return day.caloriesBurned ? Math.round(day.caloriesBurned) : null;
    case 'active_minutes': return day.activeMinutes;
    case 'distance': return day.distanceMeters ? Math.round(day.distanceMeters / 1000) : null;
    default: return null;
  }
}

/**
 * Check if a daily-frequency task should appear on a given date.
 * Respects start/end dates and frequency settings.
 */
function isTaskScheduledForDate(task: Task, dateStr: string): boolean {
  if (task.startDate && dateStr < task.startDate) return false;
  if (task.endDate && dateStr > task.endDate) return false;

  if (task.frequency === 'daily') return true;

  if (task.frequency === 'weekly' && task.daysOfWeek?.length) {
    const dayOfWeek = new Date(dateStr + 'T12:00:00').getDay();
    return task.daysOfWeek.includes(dayOfWeek);
  }

  // For other frequencies, allow auto-complete (user explicitly created a tracked task)
  return true;
}

/**
 * Load existing completions for the given task+date combos to avoid duplicates.
 */
async function loadExistingCompletions(
  client: ReturnType<typeof getSupabaseClient>,
  userId: string,
  taskIds: string[],
  dates: string[],
): Promise<Set<string>> {
  if (!client) return new Set();

  const { data } = await client
    .from('myday_task_completions')
    .select('task_id, completion_date')
    .eq('user_id', userId)
    .in('task_id', taskIds)
    .in('completion_date', dates);

  const set = new Set<string>();
  if (data) {
    for (const row of data) {
      set.add(`${row.task_id}|${row.completion_date}`);
    }
  }
  return set;
}
