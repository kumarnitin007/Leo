/**
 * Generate SQL import script from JSON calendar files
 * 
 * Usage: node scripts/generate-sql-import.js
 * Output: reference-calendars-import.sql
 */

const fs = require('fs');
const path = require('path');

const referenceDir = path.join(__dirname, '..', 'reference');
const outputFile = path.join(__dirname, '..', 'reference-calendars-import.sql');

const calendarFiles = [
  'china-public-holidays.json',
  'jewish-holidays-global.json',
  'health-awareness-calendar.json',
  'major-sports-events.json',
  'environmental-observances.json'
];

let sqlStatements = [];

// Header
sqlStatements.push('-- Reference Calendars Import Script');
sqlStatements.push('-- Generated: ' + new Date().toISOString());
sqlStatements.push('-- Total calendars: ' + calendarFiles.length);
sqlStatements.push('');
sqlStatements.push('-- Run this in Supabase SQL Editor');
sqlStatements.push('-- Note: This will fail if calendars already exist (use DELETE first if needed)');
sqlStatements.push('');

for (const fileName of calendarFiles) {
  const filePath = path.join(referenceDir, fileName);
  
  if (!fs.existsSync(filePath)) {
    console.warn(`Warning: ${fileName} not found, skipping...`);
    continue;
  }

  const fileContent = fs.readFileSync(filePath, 'utf8');
  const calendarData = JSON.parse(fileContent);
  const { calendar, events } = calendarData;

  sqlStatements.push(`-- ===== ${calendar.name} =====`);
  sqlStatements.push('');

  // Insert calendar
  sqlStatements.push(`-- Insert calendar: ${calendar.id}`);
  sqlStatements.push(`INSERT INTO myday_reference_calendars (id, name, description, geography, calendar_type, domain, religion, is_preloaded, is_user_editable, version, source)`);
  sqlStatements.push(`VALUES (`);
  sqlStatements.push(`  '${calendar.id}',`);
  sqlStatements.push(`  '${escapeSql(calendar.name)}',`);
  sqlStatements.push(`  ${calendar.description ? `'${escapeSql(calendar.description)}'` : 'NULL'},`);
  sqlStatements.push(`  ${calendar.geography || calendar.country ? `'${calendar.geography || calendar.country}'` : 'NULL'},`);
  sqlStatements.push(`  '${calendar.calendarType || 'reference'}',`);
  sqlStatements.push(`  '${calendar.domain || 'holiday'}',`);
  sqlStatements.push(`  ${calendar.religion ? `'${calendar.religion}'` : 'NULL'},`);
  sqlStatements.push(`  ${calendar.isPreloaded ?? true},`);
  sqlStatements.push(`  false,`);
  sqlStatements.push(`  '${calendar.version || '1.0'}',`);
  sqlStatements.push(`  ${calendar.source ? `'${escapeSql(calendar.source)}'` : 'NULL'}`);
  sqlStatements.push(`);`);
  sqlStatements.push('');

  // Insert days and events
  for (const eventData of events) {
    const { day, event } = eventData;

    // Insert day
    sqlStatements.push(`-- Day: ${day.id}`);
    sqlStatements.push(`INSERT INTO myday_reference_calendar_days (id, calendar_id, month_day, recurrence, rule, note, calendar_system)`);
    sqlStatements.push(`VALUES (`);
    sqlStatements.push(`  '${day.id}',`);
    sqlStatements.push(`  '${calendar.id}',`);
    sqlStatements.push(`  ${day.monthDay ? `'${day.monthDay}'` : 'NULL'},`);
    sqlStatements.push(`  '${day.recurrence || 'YEARLY'}',`);
    sqlStatements.push(`  ${day.rule ? `'${escapeSql(day.rule)}'` : 'NULL'},`);
    sqlStatements.push(`  ${day.note ? `'${escapeSql(day.note)}'` : 'NULL'},`);
    sqlStatements.push(`  '${day.calendarSystem || 'gregorian'}'`);
    sqlStatements.push(`);`);
    sqlStatements.push('');

    // Insert event
    sqlStatements.push(`INSERT INTO myday_reference_calendar_events (day_id, calendar_id, name, category, importance_level, significance, local_customs, tags, states)`);
    sqlStatements.push(`VALUES (`);
    sqlStatements.push(`  '${day.id}',`);
    sqlStatements.push(`  '${calendar.id}',`);
    sqlStatements.push(`  '${escapeSql(event.name)}',`);
    sqlStatements.push(`  ${event.category ? `'${event.category}'` : 'NULL'},`);
    sqlStatements.push(`  ${event.importanceLevel || 50},`);
    sqlStatements.push(`  ${event.significance ? `'${escapeSql(event.significance)}'` : 'NULL'},`);
    sqlStatements.push(`  ${event.localCustoms ? `ARRAY[${event.localCustoms.map(c => `'${escapeSql(c)}'`).join(', ')}]` : 'NULL'},`);
    sqlStatements.push(`  ${event.crossAssociationTags || event.tags ? `ARRAY[${(event.crossAssociationTags || event.tags).map(t => `'${escapeSql(t)}'`).join(', ')}]` : 'NULL'},`);
    sqlStatements.push(`  ${event.states ? `ARRAY[${event.states.map(s => `'${escapeSql(s)}'`).join(', ')}]` : 'NULL'}`);
    sqlStatements.push(`);`);
    sqlStatements.push('');

    // Insert enrichment if exists
    if (event.visualTheme || event.media) {
      sqlStatements.push(`INSERT INTO myday_reference_calendar_enrichments (day_id, calendar_id, primary_color, mood, icon, image_url, info_url)`);
      sqlStatements.push(`VALUES (`);
      sqlStatements.push(`  '${day.id}',`);
      sqlStatements.push(`  '${calendar.id}',`);
      sqlStatements.push(`  ${event.visualTheme?.primaryColor ? `'${event.visualTheme.primaryColor}'` : 'NULL'},`);
      sqlStatements.push(`  ${event.visualTheme?.mood ? `'${event.visualTheme.mood}'` : 'NULL'},`);
      sqlStatements.push(`  ${event.visualTheme?.icon ? `'${event.visualTheme.icon}'` : 'NULL'},`);
      sqlStatements.push(`  ${event.media?.imageUrl ? `'${escapeSql(event.media.imageUrl)}'` : 'NULL'},`);
      sqlStatements.push(`  ${event.media?.infoUrl ? `'${escapeSql(event.media.infoUrl)}'` : 'NULL'}`);
      sqlStatements.push(`);`);
      sqlStatements.push('');
    }
  }

  sqlStatements.push('');
}

// Footer
sqlStatements.push('-- Import complete!');
sqlStatements.push('-- Verify with: SELECT COUNT(*) FROM myday_reference_calendars;');

// Write to file
const sqlContent = sqlStatements.join('\n');
fs.writeFileSync(outputFile, sqlContent, 'utf8');

console.log(`✅ SQL import script generated: ${outputFile}`);
console.log(`📊 Total calendars: ${calendarFiles.length}`);
console.log(`\nTo import:`);
console.log(`1. Open Supabase Dashboard → SQL Editor`);
console.log(`2. Copy/paste the contents of ${path.basename(outputFile)}`);
console.log(`3. Click Run`);

// Helper function to escape SQL strings
function escapeSql(str) {
  if (!str) return '';
  return str.replace(/'/g, "''");
}
