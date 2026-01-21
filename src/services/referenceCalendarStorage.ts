/**
 * Reference Calendars Storage Layer
 * 
 * Manages reference days, calendars, and user calendar subscriptions
 */

import { getSupabaseClient } from '../lib/supabase';
import {
  ReferenceDay,
  ReferenceCalendar,
  UserReferenceCalendar,
  UserVisibleDay,
  CalendarDay,
  DayAssociation
} from '../types';

// ===== HELPER FUNCTIONS =====

const requireAuth = async () => {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase not configured. Please check your .env file.');
  }

  const { data: { user } } = await client.auth.getUser();
  if (!user) {
    throw new Error('User must be signed in to access data.');
  }

  return { client, userId: user.id };
};

// ===== REFERENCE DAYS QUERIES =====

/**
 * Get a single day by ID
 */
export const getReferenceDay = async (dayId: string): Promise<ReferenceDay | null> => {
  const { client } = await requireAuth();

  const { data, error } = await client
    .from('myday_reference_days')
    .select('*')
    .eq('id', dayId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data as ReferenceDay | null;
};

/**
 * Get all days for a specific date (across all calendars)
 * @param date - ISO date string (YYYY-MM-DD)
 */
export const getReferenceDaysByDate = async (date: string): Promise<ReferenceDay[]> => {
  const { client } = await requireAuth();

  const { data, error } = await client
    .from('myday_reference_days')
    .select('*')
    .eq('date', date)
    .order('importance_level', { ascending: false });

  if (error) throw error;
  return (data || []) as ReferenceDay[];
};

/**
 * Get days within a date range
 */
export const getReferenceDaysByRange = async (
  startDate: string,
  endDate: string
): Promise<ReferenceDay[]> => {
  const { client } = await requireAuth();

  const { data, error } = await client
    .from('myday_reference_days')
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });

  if (error) throw error;
  return (data || []) as ReferenceDay[];
};

/**
 * Get days by anchor (country, region, religion)
 */
export const getReferenceDaysByAnchor = async (
  anchorType: string,
  anchorKey: string
): Promise<ReferenceDay[]> => {
  const { client } = await requireAuth();

  const { data, error } = await client
    .from('myday_reference_days')
    .select('*')
    .eq('anchor_type', anchorType)
    .eq('anchor_key', anchorKey)
    .order('date', { ascending: true });

  if (error) throw error;
  return (data || []) as ReferenceDay[];
};

/**
 * Get days by month/day (for yearly recurring holidays)
 */
export const getReferenceDaysByMonthDay = async (
  month: number,
  day: number
): Promise<ReferenceDay[]> => {
  const { client } = await requireAuth();

  const { data, error } = await client
    .from('myday_reference_days')
    .select('*')
    .eq('month', month)
    .eq('day_of_month', day)
    .order('year', { ascending: true });

  if (error) throw error;
  return (data || []) as ReferenceDay[];
};

// ===== REFERENCE CALENDARS QUERIES =====

/**
 * Get all reference calendars
 */
export const getReferenceCalendars = async (): Promise<ReferenceCalendar[]> => {
  const { client } = await requireAuth();

  const { data, error } = await client
    .from('myday_reference_calendars')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;
  return (data || []) as ReferenceCalendar[];
};

/**
 * Get preloaded calendars only
 */
export const getPreloadedCalendars = async (): Promise<ReferenceCalendar[]> => {
  const { client } = await requireAuth();

  const { data, error } = await client
    .from('myday_reference_calendars')
    .select('*')
    .eq('is_preloaded', true)
    .order('name', { ascending: true });

  if (error) throw error;
  return (data || []) as ReferenceCalendar[];
};

/**
 * Get calendars by geography
 */
export const getCalendarsByGeography = async (geography: string): Promise<ReferenceCalendar[]> => {
  const { client } = await requireAuth();

  const { data, error } = await client
    .from('myday_reference_calendars')
    .select('*')
    .eq('geography', geography)
    .order('name', { ascending: true });

  if (error) throw error;
  return (data || []) as ReferenceCalendar[];
};

/**
 * Get calendars by domain (holiday, festival, religious, etc.)
 */
export const getCalendarsByDomain = async (domain: string): Promise<ReferenceCalendar[]> => {
  const { client } = await requireAuth();

  const { data, error } = await client
    .from('myday_reference_calendars')
    .select('*')
    .eq('domain', domain)
    .order('name', { ascending: true });

  if (error) throw error;
  return (data || []) as ReferenceCalendar[];
};

// ===== USER CALENDAR SUBSCRIPTIONS =====

/**
 * Get all calendars enabled for the current user
 */
export const getUserEnabledCalendars = async (): Promise<UserReferenceCalendar[]> => {
  const { client, userId } = await requireAuth();

  const { data, error } = await client
    .from('myday_user_reference_calendars')
    .select('*')
    .eq('user_id', userId)
    .eq('is_enabled', true)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []) as UserReferenceCalendar[];
};

/**
 * Get all calendar subscriptions for the current user (enabled and disabled)
 */
export const getUserCalendarSubscriptions = async (): Promise<UserReferenceCalendar[]> => {
  const { client, userId } = await requireAuth();

  const { data, error } = await client
    .from('myday_user_reference_calendars')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []) as UserReferenceCalendar[];
};

/**
 * Check if a user has a specific calendar enabled
 */
export const isCalendarEnabled = async (calendarId: string): Promise<boolean> => {
  const { client, userId } = await requireAuth();

  const { data, error } = await client
    .from('myday_user_reference_calendars')
    .select('is_enabled')
    .eq('user_id', userId)
    .eq('calendar_id', calendarId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data?.is_enabled ?? false;
};

/**
 * Enable a calendar for the current user
 */
export const enableReferenceCalendar = async (calendarId: string): Promise<UserReferenceCalendar> => {
  const { client, userId } = await requireAuth();

  const { data, error } = await client
    .from('myday_user_reference_calendars')
    .upsert(
      {
        user_id: userId,
        calendar_id: calendarId,
        is_enabled: true,
        show_in_dashboard: true,
        notification_enabled: true
      },
      { onConflict: 'user_id,calendar_id' }
    )
    .select()
    .single();

  if (error) throw error;
  return data as UserReferenceCalendar;
};

/**
 * Disable a calendar for the current user
 */
export const disableReferenceCalendar = async (calendarId: string): Promise<void> => {
  const { client, userId } = await requireAuth();

  const { error } = await client
    .from('myday_user_reference_calendars')
    .update({ is_enabled: false })
    .eq('user_id', userId)
    .eq('calendar_id', calendarId);

  if (error) throw error;
};

/**
 * Update calendar preferences for the user
 */
export const updateCalendarPreferences = async (
  calendarId: string,
  preferences: Partial<UserReferenceCalendar>
): Promise<UserReferenceCalendar> => {
  const { client, userId } = await requireAuth();

  const { data, error } = await client
    .from('myday_user_reference_calendars')
    .update(preferences)
    .eq('user_id', userId)
    .eq('calendar_id', calendarId)
    .select()
    .single();

  if (error) throw error;
  return data as UserReferenceCalendar;
};

// ===== USER VISIBLE DAYS =====

/**
 * Get all days visible to the user based on enabled calendars
 * This is the main query for dashboard display
 */
export const getUserVisibleDays = async (startDate?: string, endDate?: string): Promise<UserVisibleDay[]> => {
  const { client, userId } = await requireAuth();

  let query = client
    .from('myday_user_visible_days')
    .select('*')
    .eq('user_id', userId);

  if (startDate) {
    query = query.gte('date', startDate);
  }
  if (endDate) {
    query = query.lte('date', endDate);
  }

  const { data, error } = await query.order('date', { ascending: true });

  if (error) throw error;
  return (data || []) as UserVisibleDay[];
};

/**
 * Get user visible days for a specific date
 */
export const getUserVisibleDaysByDate = async (date: string): Promise<UserVisibleDay[]> => {
  const { client, userId } = await requireAuth();

  const { data, error } = await client
    .from('myday_user_visible_days')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .order('importance_level', { ascending: false });

  if (error) throw error;
  return (data || []) as UserVisibleDay[];
};

/**
 * Get user visible days for a date range (month, year, etc.)
 */
export const getUserVisibleDaysByRange = async (
  startDate: string,
  endDate: string
): Promise<UserVisibleDay[]> => {
  const { client, userId } = await requireAuth();

  const { data, error } = await client
    .from('myday_user_visible_days')
    .select('*')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });

  if (error) throw error;
  return (data || []) as UserVisibleDay[];
};

/**
 * Get days visible to user grouped by calendar
 */
export const getUserVisibleDaysByCalendar = async (
  calendarId: string
): Promise<ReferenceDay[]> => {
  const { client, userId } = await requireAuth();

  const { data, error } = await client
    .from('myday_calendar_days')
    .select(`
      day_id,
      myday_reference_days!inner(*)
    `)
    .eq('calendar_id', calendarId);

  if (error) throw error;

  // Filter to only days from enabled calendars for this user
  const enabledCalendars = await getUserEnabledCalendars();
  const enabledCalendarIds = enabledCalendars.map(c => c.calendar_id);

  if (!enabledCalendarIds.includes(calendarId)) {
    return [];
  }

  return (data || []).map((item: any) => item.myday_reference_days) as ReferenceDay[];
};

// ===== CALENDAR STATISTICS =====

/**
 * Get calendar statistics (day count, date range, etc.)
 */
export const getCalendarStats = async (calendarId: string): Promise<{
  dayCount: number;
  earliestDay: string | null;
  latestDay: string | null;
}> => {
  const { client } = await requireAuth();

  const { data, error } = await client
    .from('calendar_stats')
    .select('day_count, earliest_day, latest_day')
    .eq('id', calendarId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;

  return {
    dayCount: data?.day_count || 0,
    earliestDay: data?.earliest_day || null,
    latestDay: data?.latest_day || null
  };
};

/**
 * Get day associations (how many calendars a day belongs to)
 */
export const getDayAssociation = async (dayId: string): Promise<DayAssociation | null> => {
  const { client } = await requireAuth();

  const { data, error } = await client
    .from('day_associations')
    .select('*')
    .eq('day_id', dayId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data as DayAssociation | null;
};

/**
 * Get days that appear in multiple calendars
 */
export const getDuplicateDays = async (minCalendarCount: number = 2): Promise<DayAssociation[]> => {
  const { client } = await requireAuth();

  const { data, error } = await client
    .from('day_associations')
    .select('*')
    .gte('calendar_count', minCalendarCount)
    .order('calendar_count', { ascending: false });

  if (error) throw error;
  return (data || []) as DayAssociation[];
};

// ===== CALENDAR LOADING & INITIALIZATION =====

/**
 * Initialize reference calendars for a new user
 * Subscribes user to default calendars based on preferences
 */
export const initializeUserCalendars = async (defaultCalendarIds: string[]): Promise<void> => {
  const { client, userId } = await requireAuth();

  const subscriptions = defaultCalendarIds.map(calendarId => ({
    user_id: userId,
    calendar_id: calendarId,
    is_enabled: true,
    show_in_dashboard: true,
    notification_enabled: true
  }));

  const { error } = await client
    .from('myday_user_reference_calendars')
    .insert(subscriptions);

  if (error) throw error;
};

/**
 * Get recommended calendars for user based on geography
 */
export const getRecommendedCalendars = async (
  geography?: string,
  domain?: string
): Promise<ReferenceCalendar[]> => {
  const { client } = await requireAuth();

  let query = client
    .from('myday_reference_calendars')
    .select('*')
    .eq('is_preloaded', true);

  if (geography) {
    query = query.eq('geography', geography);
  }
  if (domain) {
    query = query.eq('domain', domain);
  }

  const { data, error } = await query.order('importance_level', { ascending: false });

  if (error) throw error;
  return (data || []) as ReferenceCalendar[];
};

// ===== SEARCH & FILTER =====

/**
 * Search days by name or keywords
 */
export const searchReferenceDays = async (
  query: string,
  limit: number = 20
): Promise<ReferenceDay[]> => {
  const { client } = await requireAuth();

  const { data, error } = await client
    .from('myday_reference_days')
    .select('*')
    .or(`event_name.ilike.%${query}%,significance.ilike.%${query}%,tags.cs.{${query}}`)
    .limit(limit);

  if (error) throw error;
  return (data || []) as ReferenceDay[];
};

/**
 * Get days by importance level
 */
export const getReferenceDaysByImportance = async (
  minLevel: number,
  maxLevel: number = 100
): Promise<ReferenceDay[]> => {
  const { client } = await requireAuth();

  const { data, error } = await client
    .from('myday_reference_days')
    .select('*')
    .gte('importance_level', minLevel)
    .lte('importance_level', maxLevel)
    .order('importance_level', { ascending: false });

  if (error) throw error;
  return (data || []) as ReferenceDay[];
};

/**
 * Get days by event category
 */
export const getReferenceDaysByCategory = async (
  category: string
): Promise<ReferenceDay[]> => {
  const { client } = await requireAuth();

  const { data, error } = await client
    .from('myday_reference_days')
    .select('*')
    .eq('event_category', category)
    .order('date', { ascending: true });

  if (error) throw error;
  return (data || []) as ReferenceDay[];
};

/**
 * Get days by tags
 */
export const getReferenceDaysByTags = async (tags: string[]): Promise<ReferenceDay[]> => {
  const { client } = await requireAuth();

  const { data, error } = await client
    .from('myday_reference_days')
    .select('*')
    .overlaps('tags', tags)
    .order('date', { ascending: true });

  if (error) throw error;
  return (data || []) as ReferenceDay[];
};
