/**
 * Reference Calendar Data Loader
 * 
 * Loads reference calendars from JSON files and populates the database
 */

import { getSupabaseClient } from '../lib/supabase';
import { ReferenceDay, ReferenceCalendar } from '../types';

interface ImportedCalendarFile {
  calendar: {
    id: string;
    name: string;
    description?: string;
    domain: string;
    geography?: string;
    religion?: string;
    calendarType: string;
    isPreloaded: boolean;
    isUserEditable: boolean;
    version?: string;
    source?: string;
    documentationUrl?: string;
    color?: string;
    icon?: string;
  };
  days: Array<{
    day: {
      id: string;
      date: string;
      year?: number;
      month: number;
      dayOfMonth: number;
      calendarSystem?: string;
      anchorType?: string;
      anchorKey?: string;
    };
    event: {
      name: string;
      alternateNames?: string[];
      description?: string;
      category: string;
      type: string;
      importanceLevel: number;
      significance?: string;
      mythology?: string[];
      localCustoms?: string[];
      regionalVariations?: Array<{
        state?: string;
        region?: string;
        country?: string;
        custom?: string;
      }>;
      panchang?: Record<string, unknown>;
      isPublicHoliday?: boolean;
      isBankHoliday?: boolean;
      isSchoolHoliday?: boolean;
      observanceRule?: string;
      primaryColor?: string;
      mood?: string;
      icon?: string;
      imageUrl?: string;
      audioUrl?: string;
      source?: string;
      sourceConfidence?: string;
      urls?: Record<string, string>;
      tags?: string[];
      timeRelevance?: string;
    };
  }>;
  observedRule?: string;
}

const requireAuth = async () => {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { data: { user } } = await client.auth.getUser();
  if (!user) {
    throw new Error('User must be signed in');
  }

  return { client, userId: user.id };
};

/**
 * Load a reference calendar from a JSON file URL
 */
export const loadReferenceCalendarFromFile = async (
  fileUrl: string,
  replaceExisting: boolean = false
): Promise<{ success: boolean; message: string; dayCount: number }> => {
  try {
    const { client } = await requireAuth();

    // Fetch the JSON file
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${fileUrl}: ${response.statusText}`);
    }

    const fileData: ImportedCalendarFile = await response.json();

    // Validate file structure
    if (!fileData.calendar || !fileData.days || !Array.isArray(fileData.days)) {
      throw new Error('Invalid calendar file format');
    }

    const calendarData = fileData.calendar;
    const daysData = fileData.days;

    // Check if calendar already exists
    const { data: existingCalendar } = await client
      .from('reference_calendars')
      .select('id')
      .eq('id', calendarData.id)
      .single();

    if (existingCalendar && !replaceExisting) {
      return {
        success: false,
        message: `Calendar "${calendarData.name}" already exists. Use replaceExisting=true to update.`,
        dayCount: 0
      };
    }

    // 1. Create/Update the calendar
    const calendarRecord: ReferenceCalendar = {
      id: calendarData.id,
      name: calendarData.name,
      description: calendarData.description,
      domain: calendarData.domain as any,
      calendarType: calendarData.calendarType as any,
      geography: calendarData.geography,
      religion: calendarData.religion,
      isPreloaded: calendarData.isPreloaded,
      isUserEditable: calendarData.isUserEditable,
      version: calendarData.version,
      color: calendarData.color,
      icon: calendarData.icon,
      source: calendarData.source,
      documentationUrl: calendarData.documentationUrl,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const { error: calendarError } = await client
      .from('reference_calendars')
      .upsert(calendarRecord);

    if (calendarError) throw calendarError;

    // 2. Create/Update days and links
    const now = new Date().toISOString();
    const dayRecords: ReferenceDay[] = [];
    const calendarDayLinks: Array<{
      calendar_id: string;
      day_id: string;
    }> = [];

    for (const dayEntry of daysData) {
      const dayRecord: ReferenceDay = {
        id: dayEntry.day.id,
        date: dayEntry.day.date,
        year: dayEntry.day.year,
        month: dayEntry.day.month,
        dayOfMonth: dayEntry.day.dayOfMonth,
        calendarSystem: (dayEntry.day.calendarSystem || 'gregorian') as any,
        anchorType: dayEntry.day.anchorType as any,
        anchorKey: dayEntry.day.anchorKey,
        eventName: dayEntry.event.name,
        eventDescription: dayEntry.event.description,
        eventCategory: dayEntry.event.category as any,
        eventType: dayEntry.event.type as any,
        importanceLevel: dayEntry.event.importanceLevel,
        significance: dayEntry.event.significance,
        mythology: dayEntry.event.mythology,
        lunarMetadata: dayEntry.event.panchang as any,
        regionalVariations: dayEntry.event.regionalVariations as any,
        localCustoms: dayEntry.event.localCustoms,
        isPublicHoliday: dayEntry.event.isPublicHoliday,
        isBankHoliday: dayEntry.event.isBankHoliday,
        isSchoolHoliday: dayEntry.event.isSchoolHoliday,
        observanceRule: dayEntry.event.observanceRule || fileData.observedRule,
        primaryColor: dayEntry.event.primaryColor,
        mood: dayEntry.event.mood,
        icon: dayEntry.event.icon,
        imageUrl: dayEntry.event.imageUrl,
        audioUrl: dayEntry.event.audioUrl,
        source: dayEntry.event.source || calendarData.source,
        sourceConfidence: dayEntry.event.sourceConfidence as any,
        urls: dayEntry.event.urls,
        tags: dayEntry.event.tags,
        createdAt: now,
        updatedAt: now
      };

      dayRecords.push(dayRecord);

      // Prepare calendar-day link
      calendarDayLinks.push({
        calendar_id: calendarData.id,
        day_id: dayEntry.day.id
      });
    }

    // Insert days (upsert to handle duplicates across calendars)
    if (dayRecords.length > 0) {
      const { error: daysError } = await client
        .from('reference_days')
        .upsert(dayRecords);

      if (daysError) throw daysError;
    }

    // Insert calendar-day links (upsert for idempotence)
    if (calendarDayLinks.length > 0) {
      const { error: linksError } = await client
        .from('calendar_days')
        .upsert(calendarDayLinks);

      if (linksError) throw linksError;
    }

    // 3. Update day associations (for cross-calendar deduplication)
    // Get all days for this calendar and update their association counts
    const { data: allDaysInCalendar, error: daysQueryError } = await client
      .from('calendar_days')
      .select('day_id')
      .eq('calendar_id', calendarData.id);

    if (daysQueryError) throw daysQueryError;

    if (allDaysInCalendar && allDaysInCalendar.length > 0) {
      for (const dayLink of allDaysInCalendar) {
        // Count calendars this day appears in
        const { data: calendarCount, error: countError } = await client
          .from('calendar_days')
          .select('calendar_id')
          .eq('day_id', dayLink.day_id);

        if (countError) throw countError;

        const calendarIds = (calendarCount || []).map(d => d.calendar_id);

        // Update or create day association
        await client
          .from('day_associations')
          .upsert({
            day_id: dayLink.day_id,
            calendar_count: calendarIds.length,
            calendar_ids: calendarIds,
            is_duplicate: calendarIds.length > 1,
            updated_at: now
          });
      }
    }

    return {
      success: true,
      message: `Successfully loaded calendar "${calendarData.name}" with ${dayRecords.length} days`,
      dayCount: dayRecords.length
    };
  } catch (err) {
    console.error('loadReferenceCalendarFromFile error:', err);
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Unknown error occurred',
      dayCount: 0
    };
  }
};

/**
 * Load multiple reference calendars from file URLs
 */
export const loadMultipleReferenceCalendars = async (
  fileUrls: string[],
  replaceExisting: boolean = false
): Promise<{
  success: boolean;
  message: string;
  results: Array<{ url: string; success: boolean; dayCount: number; message: string }>;
}> => {
  const results = [];
  let totalDays = 0;
  let successCount = 0;

  for (const url of fileUrls) {
    const result = await loadReferenceCalendarFromFile(url, replaceExisting);
    results.push({ url, ...result });

    if (result.success) {
      totalDays += result.dayCount;
      successCount++;
    }
  }

  return {
    success: successCount === fileUrls.length,
    message: `Loaded ${successCount}/${fileUrls.length} calendars with total ${totalDays} days`,
    results
  };
};

/**
 * Load reference calendars from a folder of JSON files
 */
export const loadReferenceCalendarsFromFolder = async (
  folderUrl: string,
  pattern: string = 'reference-*.json',
  replaceExisting: boolean = false
): Promise<{ success: boolean; message: string; calendarsLoaded: number; totalDays: number }> => {
  try {
    // This would require a backend API to list files in a folder
    // For now, manually specify the files or use fetch to get a manifest
    throw new Error('Folder loading not yet implemented. Use loadMultipleReferenceCalendars instead.');
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Error loading calendars',
      calendarsLoaded: 0,
      totalDays: 0
    };
  }
};

/**
 * Verify calendar data integrity
 */
export const verifyCalendarData = async (calendarId: string): Promise<{
  isValid: boolean;
  errors: string[];
  dayCount: number;
  duplicateDays: number;
}> => {
  const { client } = await requireAuth();

  const errors: string[] = [];

  // Check if calendar exists
  const { data: calendar, error: calendarError } = await client
    .from('reference_calendars')
    .select('*')
    .eq('id', calendarId)
    .single();

  if (calendarError || !calendar) {
    errors.push(`Calendar "${calendarId}" not found`);
    return { isValid: false, errors, dayCount: 0, duplicateDays: 0 };
  }

  // Count days in calendar
  const { data: days, error: daysError } = await client
    .from('calendar_days')
    .select('day_id')
    .eq('calendar_id', calendarId);

  if (daysError) {
    errors.push(`Error retrieving days: ${daysError.message}`);
  }

  const dayCount = days?.length || 0;

  // Check for orphaned day links
  const { data: orphaned } = await client
    .from('calendar_days')
    .select('day_id')
    .eq('calendar_id', calendarId);

  let duplicateDays = 0;

  if (orphaned) {
    for (const link of orphaned) {
      const { data: dayExists } = await client
        .from('reference_days')
        .select('id')
        .eq('id', link.day_id);

      if (!dayExists || dayExists.length === 0) {
        errors.push(`Orphaned day link: ${link.day_id}`);
      } else {
        // Count how many calendars this day belongs to
        const { data: associations } = await client
          .from('day_associations')
          .select('calendar_count')
          .eq('day_id', link.day_id)
          .single();

        if (associations && associations.calendar_count > 1) {
          duplicateDays++;
        }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    dayCount,
    duplicateDays
  };
};
