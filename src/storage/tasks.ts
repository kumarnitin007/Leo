/**
 * Storage Tasks Module
 * 
 * Task and Task Completion CRUD operations
 */

import { Task, TaskCompletion } from '../types';
import { requireAuth, generateUUID, clearDashboardCache, mapVoiceFieldsToDb, VoiceFields } from './core';

// ===== TASKS =====

export const getTasks = async (): Promise<Task[]> => {
  const { client } = await requireAuth();
  
  const { data, error } = await client
    .from('myday_tasks')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching tasks:', error);
    return [];
  }

  return (data || []).map(task => ({
    id: task.id,
    name: task.name,
    description: task.description || '',
    category: task.category,
    color: task.color,
    customBackgroundColor: task.custom_background_color,
    weightage: task.weightage,
    frequency: task.frequency,
    daysOfWeek: task.days_of_week,
    dayOfMonth: task.day_of_month,
    customFrequency: task.custom_frequency,
    frequencyCount: task.frequency_count,
    frequencyPeriod: task.frequency_period,
    intervalValue: task.interval_value,
    intervalUnit: task.interval_unit,
    intervalStartDate: task.interval_start_date,
    startDate: task.start_date,
    endDate: task.end_date,
    specificDate: task.specific_date,
    endTime: task.end_time,
    dependentTaskIds: task.dependent_task_ids || [],
    onHold: task.on_hold || false,
    holdStartDate: task.hold_start_date,
    holdEndDate: task.hold_end_date,
    holdReason: task.hold_reason,
    tags: task.tags || [],
    createdAt: task.created_at
  }));
};

export const addTask = async (task: Task): Promise<void> => {
  const { client, userId } = await requireAuth();

  const taskData = {
    id: generateUUID(),
    user_id: userId,
    name: task.name,
    description: task.description,
    category: task.category,
    color: task.color,
    custom_background_color: task.customBackgroundColor,
    weightage: task.weightage,
    frequency: task.frequency,
    days_of_week: task.daysOfWeek,
    day_of_month: task.dayOfMonth,
    custom_frequency: task.customFrequency,
    frequency_count: task.frequencyCount,
    frequency_period: task.frequencyPeriod,
    interval_value: task.intervalValue,
    interval_unit: task.intervalUnit,
    interval_start_date: task.intervalStartDate,
    start_date: task.startDate,
    end_date: task.endDate,
    specific_date: task.specificDate,
    end_time: task.endTime,
    dependent_task_ids: task.dependentTaskIds,
    on_hold: task.onHold,
    hold_start_date: task.holdStartDate,
    hold_end_date: task.holdEndDate,
    hold_reason: task.holdReason,
    tags: task.tags,
    created_at: task.createdAt
  };
  
  const { error } = await client
    .from('myday_tasks')
    .insert([taskData]);

  if (error) throw error;
  
  clearDashboardCache();
};

export const updateTask = async (taskId: string, updates: Partial<Task>): Promise<void> => {
  const { client } = await requireAuth();

  const dbUpdates: Record<string, unknown> = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.category !== undefined) dbUpdates.category = updates.category;
  if (updates.color !== undefined) dbUpdates.color = updates.color;
  if (updates.customBackgroundColor !== undefined) dbUpdates.custom_background_color = updates.customBackgroundColor;
  if (updates.weightage !== undefined) dbUpdates.weightage = updates.weightage;
  if (updates.frequency !== undefined) dbUpdates.frequency = updates.frequency;
  if (updates.daysOfWeek !== undefined) dbUpdates.days_of_week = updates.daysOfWeek;
  if (updates.dayOfMonth !== undefined) dbUpdates.day_of_month = updates.dayOfMonth;
  if (updates.customFrequency !== undefined) dbUpdates.custom_frequency = updates.customFrequency;
  if (updates.frequencyCount !== undefined) dbUpdates.frequency_count = updates.frequencyCount;
  if (updates.frequencyPeriod !== undefined) dbUpdates.frequency_period = updates.frequencyPeriod;
  if (updates.intervalValue !== undefined) dbUpdates.interval_value = updates.intervalValue;
  if (updates.intervalUnit !== undefined) dbUpdates.interval_unit = updates.intervalUnit;
  if (updates.intervalStartDate !== undefined) dbUpdates.interval_start_date = updates.intervalStartDate;
  if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate;
  if (updates.endDate !== undefined) dbUpdates.end_date = updates.endDate;
  if (updates.specificDate !== undefined) dbUpdates.specific_date = updates.specificDate;
  if (updates.endTime !== undefined) dbUpdates.end_time = updates.endTime;
  if (updates.dependentTaskIds !== undefined) dbUpdates.dependent_task_ids = updates.dependentTaskIds;
  if (updates.onHold !== undefined) dbUpdates.on_hold = updates.onHold;
  if (updates.holdStartDate !== undefined) dbUpdates.hold_start_date = updates.holdStartDate;
  if (updates.holdEndDate !== undefined) dbUpdates.hold_end_date = updates.holdEndDate;
  if (updates.holdReason !== undefined) dbUpdates.hold_reason = updates.holdReason;
  if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
  
  mapVoiceFieldsToDb(updates as VoiceFields, dbUpdates);

  const { error } = await client
    .from('myday_tasks')
    .update(dbUpdates)
    .eq('id', taskId);

  if (error) throw error;
  
  clearDashboardCache();
};

export const deleteTask = async (taskId: string): Promise<void> => {
  const { client } = await requireAuth();

  const { error } = await client
    .from('myday_tasks')
    .delete()
    .eq('id', taskId);

  if (error) throw error;
  
  clearDashboardCache();
};

// ===== TASK COMPLETIONS =====

export const completeTask = async (taskId: string, date: string, durationMinutes?: number): Promise<void> => {
  const { client, userId } = await requireAuth();

  const { data: task } = await client
    .from('myday_tasks')
    .select('dependent_task_ids')
    .eq('id', taskId)
    .single();

  const { error } = await client
    .from('myday_task_completions')
    .upsert([{
      user_id: userId,
      task_id: taskId,
      completion_date: date,
      duration_minutes: durationMinutes,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString()
    }], {
      onConflict: 'user_id,task_id,completion_date'
    });

  if (error) throw error;
  
  clearDashboardCache();

  // Update linked resolutions' progress
  try {
    const { data: resolutions } = await client
      .from('myday_resolutions')
      .select('*')
      .contains('linked_task_ids', [taskId]);

    if (resolutions && resolutions.length > 0) {
      for (const resolution of resolutions) {
        if (resolution.progress_metric === 'count' || resolution.progress_metric === 'percentage') {
          const newValue = (resolution.current_value || 0) + 1;
          await client
            .from('myday_resolutions')
            .update({ 
              current_value: newValue,
              updated_at: new Date().toISOString()
            })
            .eq('id', resolution.id);
        }
      }
    }
  } catch (resError) {
    console.error('Error updating resolution progress:', resError);
  }

  // If task has dependents, mark them as complete too
  if (task?.dependent_task_ids && task.dependent_task_ids.length > 0) {
    for (const dependentId of task.dependent_task_ids) {
      await completeTask(dependentId, date, durationMinutes);
    }
  }
};

export const uncompleteTask = async (taskId: string, date: string): Promise<void> => {
  const { client } = await requireAuth();

  const { error } = await client
    .from('myday_task_completions')
    .delete()
    .eq('task_id', taskId)
    .eq('completion_date', date);

  if (error) throw error;

  // Update linked resolutions' progress (decrement)
  try {
    const { data: resolutions } = await client
      .from('myday_resolutions')
      .select('*')
      .contains('linked_task_ids', [taskId]);

    if (resolutions && resolutions.length > 0) {
      for (const resolution of resolutions) {
        if (resolution.progress_metric === 'count' || resolution.progress_metric === 'percentage') {
          const newValue = Math.max(0, (resolution.current_value || 0) - 1);
          await client
            .from('myday_resolutions')
            .update({ 
              current_value: newValue,
              updated_at: new Date().toISOString()
            })
            .eq('id', resolution.id);
        }
      }
    }
  } catch (resError) {
    console.error('Error updating resolution progress:', resError);
  }
};

export const getCompletions = async (): Promise<TaskCompletion[]> => {
  const { client } = await requireAuth();

  const { data, error } = await client
    .from('myday_task_completions')
    .select('*');

  if (error) {
    console.error('Error fetching completions:', error);
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

// Alias for getCompletions (for backward compatibility)
export const getTaskHistory = getCompletions;
