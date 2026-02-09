// =====================================================
// REFERENCE CALENDARS: Service for Enriched Data
// =====================================================

import getSupabaseClient from '../lib/supabase';
import type { EnrichedCalendarDay } from '../types/calendar';

/**
 * Fetch enriched calendar data for a specific day identifier
 * @param dayIdentifier - Unique identifier for the day (e.g., "valentines-day")
 * @returns Complete enriched calendar data or null if not found
 */
export async function getEnrichedCalendarDay(
  dayIdentifier: string
): Promise<EnrichedCalendarDay | null> {
  try {
    const supabase = getSupabaseClient();
    
    // Fetch core enrichment
    const { data: enrichment, error: enrichmentError } = await supabase
      .from('myday_calendar_enrichments')
      .select('*')
      .eq('day_identifier', dayIdentifier)
      .single();

    if (enrichmentError || !enrichment) {
      console.warn(`[ReferenceCalendar] No enrichment found for: ${dayIdentifier}`);
      return null;
    }

    // Fetch all related data in parallel
    const [
      { data: facts },
      { data: statistics },
      { data: tips },
      { data: timelineItems },
      { data: quickIdeas },
      { data: externalResources },
      { data: actionItems },
    ] = await Promise.all([
      supabase
        .from('myday_calendar_facts')
        .select('*')
        .eq('day_identifier', dayIdentifier)
        .order('priority', { ascending: false }),
      
      supabase
        .from('myday_calendar_statistics')
        .select('*')
        .eq('day_identifier', dayIdentifier)
        .order('display_order', { ascending: true }),
      
      supabase
        .from('myday_calendar_tips')
        .select('*')
        .eq('day_identifier', dayIdentifier)
        .order('urgency_level', { ascending: false }),
      
      supabase
        .from('myday_calendar_timeline_items')
        .select('*')
        .eq('day_identifier', dayIdentifier)
        .order('display_order', { ascending: true }),
      
      supabase
        .from('myday_calendar_quick_ideas')
        .select('*')
        .eq('day_identifier', dayIdentifier)
        .order('display_order', { ascending: true }),
      
      supabase
        .from('myday_calendar_external_resources')
        .select('*')
        .eq('day_identifier', dayIdentifier)
        .order('display_order', { ascending: true })
        .limit(4),
      
      supabase
        .from('myday_calendar_action_items')
        .select('*')
        .eq('day_identifier', dayIdentifier)
        .order('is_primary', { ascending: false })
        .order('display_order', { ascending: true }),
    ]);

    // Convert snake_case to camelCase
    const enrichedData: EnrichedCalendarDay = {
      enrichment: {
        id: enrichment.id,
        dayIdentifier: enrichment.day_identifier,
        dayName: enrichment.day_name,
        templateCategory: enrichment.template_category,
        primaryColor: enrichment.primary_color,
        secondaryColor: enrichment.secondary_color,
        gradientStart: enrichment.gradient_start,
        gradientEnd: enrichment.gradient_end,
        iconEmoji: enrichment.icon_emoji,
        backgroundEmoji: enrichment.background_emoji,
        tagline: enrichment.tagline,
        originStory: enrichment.origin_story,
        importancePercentage: enrichment.importance_percentage,
        isMajorHoliday: enrichment.is_major_holiday,
      },
      facts: (facts || []).map((f) => ({
        id: f.id,
        dayIdentifier: f.day_identifier,
        factType: f.fact_type,
        content: f.content,
        highlightValue: f.highlight_value,
        priority: f.priority,
        sourceName: f.source_name,
        sourceUrl: f.source_url,
      })),
      statistics: (statistics || []).map((s) => ({
        id: s.id,
        dayIdentifier: s.day_identifier,
        statValue: s.stat_value,
        statLabel: s.stat_label,
        statIcon: s.stat_icon,
        displayOrder: s.display_order,
      })),
      tips: (tips || []).map((t) => ({
        id: t.id,
        dayIdentifier: t.day_identifier,
        tipType: t.tip_type,
        title: t.title,
        content: t.content,
        iconEmoji: t.icon_emoji,
        urgencyLevel: t.urgency_level,
        daysBeforeToShow: t.days_before_to_show,
      })),
      timelineItems: (timelineItems || []).map((ti) => ({
        id: ti.id,
        dayIdentifier: ti.day_identifier,
        title: ti.title,
        description: ti.description,
        iconEmoji: ti.icon_emoji,
        daysBefore: ti.days_before,
        displayOrder: ti.display_order,
      })),
      quickIdeas: (quickIdeas || []).map((qi) => ({
        id: qi.id,
        dayIdentifier: qi.day_identifier,
        ideaLabel: qi.idea_label,
        ideaEmoji: qi.idea_emoji,
        ideaCategory: qi.idea_category,
        displayOrder: qi.display_order,
      })),
      externalResources: (externalResources || []).map((er) => ({
        id: er.id,
        dayIdentifier: er.day_identifier,
        resourceTitle: er.resource_title,
        resourceDescription: er.resource_description,
        resourceUrl: er.resource_url,
        resourceType: er.resource_type,
        iconEmoji: er.icon_emoji,
        estimatedTime: er.estimated_time,
        displayOrder: er.display_order,
      })),
      actionItems: (actionItems || []).map((ai) => ({
        id: ai.id,
        dayIdentifier: ai.day_identifier,
        actionType: ai.action_type,
        actionLabel: ai.action_label,
        actionIcon: ai.action_icon,
        actionTarget: ai.action_target,
        isPrimary: ai.is_primary,
        displayOrder: ai.display_order,
      })),
    };

    return enrichedData;
  } catch (error) {
    console.error('[ReferenceCalendar] Error fetching enriched data:', error);
    return null;
  }
}

/**
 * Check if enriched data exists for a given day identifier
 * @param dayIdentifier - Unique identifier for the day
 * @returns true if enriched data exists
 */
export async function hasEnrichedData(dayIdentifier: string): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('myday_calendar_enrichments')
      .select('id')
      .eq('day_identifier', dayIdentifier)
      .single();

    return !error && !!data;
  } catch {
    return false;
  }
}

/**
 * Find enriched calendar data by event name and date
 * Handles cases where multiple holidays have the same name (e.g., "Independence Day")
 * @param eventName - Name of the event from myday_reference_days
 * @param eventDate - Date of the event (YYYY-MM-DD format)
 * @returns day_identifier if found, null otherwise
 */
export async function findEnrichmentByNameAndDate(
  eventName: string,
  eventDate: string
): Promise<string | null> {
  try {
    const supabase = getSupabaseClient();
    
    // Date-based mapping for holidays with duplicate names
    const dateMapping: Record<string, string> = {
      '2026-02-15': 'maha-shivratri',
      '2026-05-03': 'constitution-day-japan',
      '2026-05-05': 'childrens-day-japan',
      '2026-07-04': 'independence-day-usa',
      '2026-08-15': 'independence-day-india',
      '2026-07-18': 'nelson-mandela-birthday',
      '2026-09-11': 'september-11-remembrance',
      '2026-10-12': 'dussehra',
      '2026-10-26': 'muhammad-yunus-birthday',
      '2026-11-02': 'aung-san-suu-kyi-birthday',
      '2026-04-01': 'odisha-day-utkala-dibasa',
    };
    
    // Check if we have a date-specific mapping
    if (dateMapping[eventDate]) {
      return dateMapping[eventDate];
    }
    
    // Otherwise, try to generate identifier from name
    const dayIdentifier = eventName
      .toLowerCase()
      .replace(/['']/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    
    // Verify it exists
    const { data, error } = await supabase
      .from('myday_calendar_enrichments')
      .select('day_identifier')
      .eq('day_identifier', dayIdentifier)
      .single();
    
    return !error && data ? data.day_identifier : null;
  } catch {
    return null;
  }
}
