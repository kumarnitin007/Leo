/**
 * Storage Settings Module
 * 
 * User settings, dashboard layout, and onboarding operations
 */

import { UserSettings, DashboardLayout } from '../types';
import { requireAuth } from './core';

const USER_SETTINGS_KEY = 'routine-ruby-user-settings';
const ONBOARDING_KEY = 'routine-ruby-onboarding-complete';

// ===== USER SETTINGS =====

export const loadUserSettings = async (): Promise<UserSettings> => {
  try {
    const { client, userId } = await requireAuth();
    const { data, error } = await client
      .from('myday_user_settings')
      .select('theme, dashboard_layout, notifications_enabled, location')
      .eq('user_id', userId)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error loading user settings:', error);
    }
    
    if (data) {
      const parsedLocation = data.location ? JSON.parse(data.location) : undefined;
      return {
        theme: data.theme || 'purple',
        dashboardLayout: data.dashboard_layout || 'uniform',
        notifications: data.notifications_enabled ?? true,
        location: parsedLocation
      };
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('User must be signed in') || 
        errorMessage.includes('Supabase not configured')) {
      return {
        theme: 'purple',
        dashboardLayout: 'uniform',
        notifications: true,
        location: undefined
      };
    }
    console.error('Error loading user settings:', error);
  }
  
  return {
    theme: 'purple',
    dashboardLayout: 'uniform',
    notifications: true,
    location: undefined
  };
};

export const saveUserSettings = async (settings: Partial<UserSettings>): Promise<void> => {
  const { client, userId } = await requireAuth();
  
  const dbUpdates: Record<string, unknown> = {};
  if (settings.theme !== undefined) dbUpdates.theme = settings.theme;
  if (settings.dashboardLayout !== undefined) dbUpdates.dashboard_layout = settings.dashboardLayout;
  if (settings.notifications !== undefined) dbUpdates.notifications_enabled = settings.notifications;
  if (settings.location !== undefined) {
    dbUpdates.location = JSON.stringify(settings.location);
  }
  
  const { error } = await client
    .from('myday_user_settings')
    .upsert([{
      user_id: userId,
      ...dbUpdates
    }], {
      onConflict: 'user_id'
    });
  
  if (error) {
    console.error('Database error:', error);
    throw error;
  }
  
  try {
    const current = getUserSettingsSync();
    localStorage.setItem(USER_SETTINGS_KEY, JSON.stringify({ ...current, ...settings }));
  } catch (cacheError) {
    console.error('Error updating settings cache:', cacheError);
  }
};

export const getUserSettings = loadUserSettings;

export const getUserSettingsSync = (): UserSettings => {
  const stored = localStorage.getItem(USER_SETTINGS_KEY);
  if (!stored) {
    return {
      theme: 'purple',
      dashboardLayout: 'uniform',
      notifications: true,
      location: undefined
    };
  }
  return JSON.parse(stored);
};

export const getDashboardLayout = (): DashboardLayout => {
  const settings = getUserSettingsSync();
  return settings.dashboardLayout || 'uniform';
};

export const setDashboardLayout = async (layout: DashboardLayout): Promise<void> => {
  await saveUserSettings({ dashboardLayout: layout });
};

export const saveDashboardLayout = setDashboardLayout;

// ===== ONBOARDING =====

export const isFirstTimeUser = (): boolean => {
  return !localStorage.getItem(ONBOARDING_KEY);
};

export const markOnboardingComplete = (): void => {
  localStorage.setItem(ONBOARDING_KEY, 'true');
};

// ===== TASK ORDER (Local Storage) =====

export const saveTaskOrder = (taskIds: string[]): void => {
  localStorage.setItem('routine-ruby-task-order', JSON.stringify(taskIds));
};

export const loadTaskOrder = (): string[] => {
  try {
    const stored = localStorage.getItem('routine-ruby-task-order');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error loading task order:', error);
  }
  return [];
};
