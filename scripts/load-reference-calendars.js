/**
 * Reference Calendars Data Loader
 * 
 * Loads reference calendar data from JSON files into Supabase.
 * Run after migration: node scripts/load-reference-calendars.js
 * 
 * Usage:
 *   node scripts/load-reference-calendars.js
 *   node scripts/load-reference-calendars.js --file reference/india-national.json (single file)
 *   node scripts/load-reference-calendars.js --dry-run (preview without saving)
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase setup
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables are required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const singleFile = args.find(arg => arg.endsWith('.json'))?.split('=')[1] || args.find(arg => arg.endsWith('.json'));

// Calendar files to load
const CALENDAR_FILES = [
  'india-national.json',
  'india-hindu-festivals.json',
  'india-state-holidays.json',
  'india-state-days.json',
  'us-federal-holidays.json',
  'us-cultural-holidays.json',
  'japan-national-holidays.json',
  'nobel-peace-birthdays.json',
  'corporate-earnings-major-tech.json'
];

const filesToLoad = singleFile 
  ? [singleFile.replace('reference/', '')]
  : CALENDAR_FILES;

// Type definitions (for reference - JS doesn't enforce these)
// Day: { id, monthDay?, date?, recurrence?, observedRule?, ...any }
// Event: { name, category?, importanceLevel?, significance?, ...any }
// CalendarData: { calendar: {...}, events?, days?, companies? }

async function loadCalendarData(filePath) {
  console.log(`\n📂 Loading: ${filePath}`);

  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const { calendar, events = [], days = [], companies = [] } = data;

    // Normalize events from different structures
    let allEvents = [];
    
    if (events.length > 0) {
      allEvents = events;
    } else if (days.length > 0) {
      allEvents = days;
    } else if (companies.length > 0) {
      // Flatten company events
      companies.forEach(company => {
        company.events.forEach(evt => {
          allEvents.push(evt);
        });
      });
    }

    console.log(`  📋 Calendar: ${calendar.name}`);
    console.log(`  📅 Events to process: ${allEvents.length}`);

    // Determine geography from country or geography field
    const geography = calendar.country || calendar.geography || 'GLOBAL';
    const domain = calendar.domain || calendar.calendarType || 'holiday';

    // Step 1: Insert or get calendar
    const { data: existingCal, error: fetchError } = await supabase
      .from('myday_reference_calendars')
      .select('id')
      .eq('id', calendar.id)
      .single();

    let calendarId;

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    if (existingCal) {
      console.log(`  ✓ Calendar already exists: ${calendar.id}`);
      calendarId = existingCal.id;
    } else {
      const { data: newCal, error: insertError } = await supabase
        .from('myday_reference_calendars')
        .insert({
          id: calendar.id,
          name: calendar.name,
          description: calendar.description || '',
          domain,
          geography,
          isPreloaded: calendar.isPreloaded ?? true,
          metadata: {
            calendarType: calendar.calendarType,
            religion: calendar.religion,
            source: calendar.source,
            version: calendar.version
          }
        })
        .select('id')
        .single();

      if (insertError) {
        console.error(`  ❌ Error inserting calendar: ${insertError.message}`);
        throw insertError;
      }

      console.log(`  ✓ Calendar inserted: ${newCal.id}`);
      calendarId = newCal.id;
    }

    // Step 2: Process events and insert days
    let daysInserted = 0;
    const dayIds = new Set();

    for (const { day, event } of allEvents) {
      if (!day.id) {
        console.warn(`  ⚠️  Skipping event without day.id: ${event.name}`);
        continue;
      }

      dayIds.add(day.id);

      const monthDay = day.monthDay || day.date || '';

      // Check if day already exists
      const { data: existingDay } = await supabase
        .from('myday_reference_days')
        .select('id')
        .eq('id', day.id)
        .single();

      if (!existingDay) {
        const { error: dayError } = await supabase
          .from('myday_reference_days')
          .insert({
            id: day.id,
            monthDay,
            recurrence: day.recurrence || 'YEARLY',
            name: event.name,
            category: event.category || 'observance',
            importanceLevel: event.importanceLevel ?? 50,
            description: event.significance || '',
            metadata: {
              observedRule: day.observedRule,
              culturalNotes: event.culturalNotes,
              localCustoms: event.localCustoms,
              sector: event.sector,
              volatilityImpact: event.volatilityImpact,
              urls: event.urls || (event.media && event.media.infoUrl),
              imageUrl: event.media && event.media.imageUrl,
              crossAssociationTags: event.crossAssociationTags
            }
          });

        if (dayError) {
          console.warn(`  ⚠️  Error inserting day ${day.id}: ${dayError.message}`);
          continue;
        }

        daysInserted++;
      }

      // Link day to calendar
      const { error: linkError } = await supabase
        .from('myday_calendar_days')
        .upsert({
          calendarId,
          dayId: day.id,
          ordinalPosition: daysInserted,
          notes: event.significance || ''
        }, {
          onConflict: 'calendarId,dayId'
        });

      if (linkError) {
        console.warn(`  ⚠️  Error linking day to calendar: ${linkError.message}`);
      }
    }

    console.log(`  ✓ Days inserted/updated: ${daysInserted}`);
    console.log(`  ✓ Total days in calendar: ${dayIds.size}`);

    return { calendarId, daysInserted, totalDays: dayIds.size };
  } catch (error) {
    console.error(`  ❌ Error loading ${filePath}:`, error);
    throw error;
  }
}

async function main() {
  console.log('🚀 Reference Calendars Data Loader');
  console.log(`📊 Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (saving to DB)'}`);
  console.log('');

  if (dryRun) {
    console.log('⚠️  DRY RUN - No data will be saved');
  }

  const results = {
    calendarsProcessed: 0,
    calendarsInserted: 0,
    daysInserted: 0,
    totalDays: 0,
    errors: 0
  };

  for (const fileName of filesToLoad) {
    const filePath = path.join(__dirname, '../reference', fileName);

    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      results.errors++;
      continue;
    }

    try {
      if (!dryRun) {
        const result = await loadCalendarData(filePath);
        results.calendarsProcessed++;
        results.calendarsInserted++;
        results.daysInserted += result.daysInserted;
        results.totalDays += result.totalDays;
      } else {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const events = data.events || data.days || (data.companies && data.companies.flatMap(c => c.events)) || [];
        console.log(`  [DRY RUN] Would load ${data.calendar.name} with ${events.length} events`);
        results.calendarsProcessed++;
      }
    } catch (error) {
      console.error(`  ❌ Failed to load ${fileName}:`, error);
      results.errors++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`✓ Calendars processed: ${results.calendarsProcessed}`);
  console.log(`✓ Calendars inserted: ${results.calendarsInserted}`);
  console.log(`✓ Days inserted/updated: ${results.daysInserted}`);
  console.log(`✓ Total days linked: ${results.totalDays}`);
  console.log(`❌ Errors: ${results.errors}`);
  console.log('='.repeat(60));

  if (results.errors > 0) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
