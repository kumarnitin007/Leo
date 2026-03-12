/**
 * Storage Routines Module
 * 
 * Routine CRUD operations and initialization
 */

import { Routine } from '../types';
import { requireAuth, generateUUID } from './core';

// ===== ROUTINES =====

export const getRoutines = async (): Promise<Routine[]> => {
  const { client } = await requireAuth();

  const { data, error } = await client
    .from('myday_routines')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching routines:', error);
    return [];
  }

  return (data || []).map(routine => ({
    id: routine.id,
    name: routine.name,
    description: routine.description,
    taskIds: routine.task_ids || [],
    timeOfDay: routine.time_of_day,
    isPreDefined: routine.is_predefined || false,
    isActive: routine.is_active !== false,
    createdAt: routine.created_at || new Date().toISOString()
  }));
};

export const saveRoutine = async (routine: Routine): Promise<void> => {
  const { client, userId } = await requireAuth();

  const { error } = await client
    .from('myday_routines')
    .upsert([{
      id: routine.id || generateUUID(),
      user_id: userId,
      name: routine.name,
      description: routine.description,
      task_ids: routine.taskIds,
      time_of_day: routine.timeOfDay,
      is_predefined: routine.isPreDefined || false,
      is_active: routine.isActive !== false
    }], {
      onConflict: 'id'
    });

  if (error) throw error;
};

export const deleteRoutine = async (routineId: string): Promise<void> => {
  const { client } = await requireAuth();

  const { error } = await client
    .from('myday_routines')
    .delete()
    .eq('id', routineId);

  if (error) throw error;
};

export const addRoutine = saveRoutine;

export const updateRoutine = async (routineId: string, updates: Partial<Routine>): Promise<void> => {
  const routines = await getRoutines();
  const routine = routines.find(r => r.id === routineId);
  if (!routine) throw new Error('Routine not found');
  await saveRoutine({ ...routine, ...updates });
};

export const initializeDefaultRoutines = async (): Promise<void> => {
  try {
    const { client, userId } = await requireAuth();
    
    const { data: existingRoutines, error: checkError } = await client
      .from('myday_routines')
      .select('id')
      .eq('user_id', userId)
      .eq('is_predefined', true);

    if (checkError) throw checkError;
    
    if (existingRoutines && existingRoutines.length > 0) {
      return;
    }

    const sampleRoutines = [
      {
        id: generateUUID(),
        user_id: userId,
        name: '🌅 Morning Energizer',
        description: 'Start your day with energy and focus',
        time_of_day: 'morning',
        task_ids: [],
        is_predefined: true,
        is_active: false,
        created_at: new Date().toISOString()
      },
      {
        id: generateUUID(),
        user_id: userId,
        name: '🌙 Evening Wind Down',
        description: 'Relax and prepare for restful sleep',
        time_of_day: 'evening',
        task_ids: [],
        is_predefined: true,
        is_active: false,
        created_at: new Date().toISOString()
      },
      {
        id: generateUUID(),
        user_id: userId,
        name: '💪 Workout Session',
        description: 'Complete workout and fitness routine',
        time_of_day: 'anytime',
        task_ids: [],
        is_predefined: true,
        is_active: false,
        created_at: new Date().toISOString()
      },
      {
        id: generateUUID(),
        user_id: userId,
        name: '🧘 Mindfulness Break',
        description: 'Meditation, breathing, and mental reset',
        time_of_day: 'anytime',
        task_ids: [],
        is_predefined: true,
        is_active: false,
        created_at: new Date().toISOString()
      },
      {
        id: generateUUID(),
        user_id: userId,
        name: '📚 Study Session',
        description: 'Focused learning and skill development',
        time_of_day: 'afternoon',
        task_ids: [],
        is_predefined: true,
        is_active: false,
        created_at: new Date().toISOString()
      },
      {
        id: generateUUID(),
        user_id: userId,
        name: '🏠 Home Reset',
        description: 'Quick cleaning and organization routine',
        time_of_day: 'anytime',
        task_ids: [],
        is_predefined: true,
        is_active: false,
        created_at: new Date().toISOString()
      }
    ];

    const { error: insertError } = await client
      .from('myday_routines')
      .insert(sampleRoutines);

    if (insertError) throw insertError;
    
    console.log('Sample routines initialized successfully');
  } catch (error) {
    console.error('Error initializing sample routines:', error);
  }
};
