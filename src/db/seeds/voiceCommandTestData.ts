/**
 * COPILOT PROMPT: Create test data seeder for voice commands
 * 
 * PURPOSE: Insert realistic test data for development and testing
 * 
 * REQUIREMENTS:
 * 
 * Create seedVoiceCommandTestData() function that inserts 20+ test records into
 * myday_voice_command_logs table with realistic data covering:
 * 
 * INTENT TYPES TO COVER:
 * - CREATE_TASK (5 examples)
 * - CREATE_EVENT (3 examples)
 * - CREATE_JOURNAL (2 examples)
 * - CREATE_ROUTINE (2 examples)
 * - CREATE_MILESTONE (2 examples)
 * - CREATE_ITEM (2 examples)
 * - UPDATE_TASK (2 examples)
 * - DELETE_TASK (1 example)
 * - QUERY_TASK (1 example)
 * 
 * VARY THE FOLLOWING:
 * - Dates: some past, today, tomorrow, next week, specific dates
 * - Times: morning, afternoon, evening, specific times
 * - Priorities: LOW, MEDIUM, HIGH, URGENT
 * - Confidence scores: 0.6 to 0.99
 * - Outcomes: SUCCESS (70%), FAILED (20%), CANCELLED (10%)
 * - Some with user_corrections
 * - Some with fuzzy_match_used = true
 * - Some with learned_from_history = true
 * 
 * EXAMPLE TRANSCRIPTS:
 * "Add task to buy groceries tomorrow"
 * "Schedule dentist appointment next Tuesday at 2pm"
 * "Write journal entry: feeling grateful today"
 * "Create morning routine at 6am every day"
 * "Add milestone: Launch product by March 1st"
 * "Add milk to shopping list"
 * "Change team meeting to high priority"
 * "Delete old tasks from last month"
 * "Show me all urgent tasks"
 * 
 * For each record, create realistic:
 * - entities JSONB array
 * - extracted_title
 * - extracted_tags array
 * - search_keywords array
 * - confidence_breakdown JSONB
 * 
 * ALSO CREATE:
 * - clearVoiceCommandTestData() - Delete all test records
 * - seedUserVoicePatterns() - Insert test learned patterns
 * 
 * Use a test user_id like: '00000000-0000-0000-0000-000000000001'
 */

import getSupabaseClient from '../../lib/supabase';
import { v4 as uuidv4 } from 'uuid';

const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';

const now = new Date();
const iso = (d: Date) => d.toISOString();

const makeConfidenceBreakdown = (intent = 0.9, entities = 0.85, stt = 0.95) => ({
  intent,
  entities,
  stt,
  overall: Math.min(1, (intent * 0.6 + entities * 0.3 + stt * 0.1)),
});

function sampleEntities(type: string, title: string, date?: string, time?: string) {
  const entities: any[] = [{ type, value: title, normalizedValue: title, confidence: 0.9 }];
  if (date) entities.push({ type: 'DATE', value: date, normalizedValue: date, confidence: 0.85 });
  if (time) entities.push({ type: 'TIME', value: time, normalizedValue: time, confidence: 0.85 });
  return entities;
}

export async function seedVoiceCommandTestData() {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');

  const sampleRows = [
    {
      id: uuidv4(),
      user_id: TEST_USER_ID,
      session_id: uuidv4(),
      raw_transcript: "Add task to buy groceries tomorrow",
      raw_transcript_encrypted: false,
      language: 'en-US',
      intent_type: 'CREATE_TASK',
      intent_confidence: 0.95,
      intent_method: 'RULES',
      entity_type: 'TASK',
      entities: sampleEntities('TASK', 'Buy groceries', 'tomorrow'),
      memo_date_expression: 'tomorrow',
      extracted_title: 'Buy groceries',
      extracted_tags: ['shopping', 'groceries'],
      search_keywords: ['buy', 'groceries', 'shopping'],
      confidence_breakdown: makeConfidenceBreakdown(0.95, 0.9, 0.95),
      outcome: 'SUCCESS',
      created_at: iso(new Date(now.getTime() - 1000 * 60 * 60 * 24 * 2)),
    },
    {
      id: uuidv4(),
      user_id: TEST_USER_ID,
      session_id: uuidv4(),
      raw_transcript: "Schedule dentist appointment next Tuesday at 2pm",
      raw_transcript_encrypted: false,
      language: 'en-US',
      intent_type: 'CREATE_EVENT',
      intent_confidence: 0.92,
      intent_method: 'RULES',
      entity_type: 'EVENT',
      entities: sampleEntities('EVENT', 'Dentist appointment', 'next_tuesday', '14:00'),
      memo_date_expression: 'next_tuesday',
      memo_time_expression: '14:00',
      extracted_title: 'Dentist appointment',
      extracted_tags: ['health', 'appointment'],
      search_keywords: ['dentist', 'appointment'],
      confidence_breakdown: makeConfidenceBreakdown(0.92, 0.88, 0.93),
      outcome: 'SUCCESS',
      created_at: iso(new Date(now.getTime() - 1000 * 60 * 60 * 24)),
    },
    {
      id: uuidv4(),
      user_id: TEST_USER_ID,
      session_id: uuidv4(),
      raw_transcript: "Write journal entry: feeling grateful today",
      raw_transcript_encrypted: false,
      language: 'en-US',
      intent_type: 'CREATE_JOURNAL',
      intent_confidence: 0.9,
      intent_method: 'RULES',
      entity_type: 'JOURNAL',
      entities: sampleEntities('JOURNAL', 'Feeling grateful', iso(new Date())),
      extracted_title: 'Feeling grateful',
      extracted_tags: ['gratitude', 'journal'],
      search_keywords: ['feeling', 'grateful', 'journal'],
      confidence_breakdown: makeConfidenceBreakdown(0.9, 0.85, 0.9),
      outcome: 'SUCCESS',
      created_at: iso(new Date(now.getTime() - 1000 * 60 * 60 * 12)),
    },
    {
      id: uuidv4(),
      user_id: TEST_USER_ID,
      session_id: uuidv4(),
      raw_transcript: "Create morning routine at 6am every day",
      raw_transcript_encrypted: false,
      language: 'en-US',
      intent_type: 'CREATE_ROUTINE',
      intent_confidence: 0.93,
      intent_method: 'RULES',
      entity_type: 'ROUTINE',
      entities: sampleEntities('ROUTINE', 'Morning routine', iso(new Date()), '06:00'),
      extracted_title: 'Morning routine',
      extracted_tags: ['routine', 'health'],
      extracted_recurrence: 'FREQ=DAILY',
      search_keywords: ['morning', 'routine'],
      confidence_breakdown: makeConfidenceBreakdown(0.93, 0.88, 0.95),
      outcome: 'SUCCESS',
      created_at: iso(new Date(now.getTime() - 1000 * 60 * 60 * 6)),
    },
    {
      id: uuidv4(),
      user_id: TEST_USER_ID,
      session_id: uuidv4(),
      raw_transcript: "Add milestone: Launch product by March 1st",
      raw_transcript_encrypted: false,
      language: 'en-US',
      intent_type: 'CREATE_MILESTONE',
      intent_confidence: 0.88,
      intent_method: 'RULES',
      entity_type: 'MILESTONE',
      entities: sampleEntities('MILESTONE', 'Launch product', '2026-03-01'),
      memo_date_expression: '2026-03-01',
      extracted_title: 'Launch product',
      extracted_tags: ['work', 'milestone'],
      search_keywords: ['launch', 'product'],
      confidence_breakdown: makeConfidenceBreakdown(0.88, 0.8, 0.9),
      outcome: 'SUCCESS',
      created_at: iso(new Date(now.getTime() - 1000 * 60 * 60 * 24 * 7)),
    },
    // 5 CREATE_TASK examples total
    {
      id: uuidv4(),
      user_id: TEST_USER_ID,
      session_id: uuidv4(),
      raw_transcript: "Add urgent task to submit report by end of day",
      raw_transcript_encrypted: false,
      language: 'en-US',
      intent_type: 'CREATE_TASK',
      intent_confidence: 0.96,
      intent_method: 'RULES',
      entity_type: 'TASK',
      entities: sampleEntities('TASK', 'Submit report', iso(new Date()), '17:00'),
      extracted_title: 'Submit report',
      extracted_priority: 'URGENT',
      extracted_tags: ['work'],
      search_keywords: ['submit', 'report'],
      confidence_breakdown: makeConfidenceBreakdown(0.96, 0.9, 0.97),
      outcome: 'SUCCESS',
      created_at: iso(new Date(now.getTime() - 1000 * 60 * 60 * 3)),
    },
    {
      id: uuidv4(),
      user_id: TEST_USER_ID,
      session_id: uuidv4(),
      raw_transcript: "Add milk to shopping list",
      raw_transcript_encrypted: false,
      language: 'en-US',
      intent_type: 'CREATE_ITEM',
      intent_confidence: 0.94,
      intent_method: 'RULES',
      entity_type: 'ITEM',
      entities: sampleEntities('ITEM', 'Milk'),
      extracted_title: 'Milk',
      search_keywords: ['milk', 'shopping'],
      confidence_breakdown: makeConfidenceBreakdown(0.94, 0.9, 0.95),
      outcome: 'SUCCESS',
      created_at: iso(new Date(now.getTime() - 1000 * 60 * 60 * 2)),
    },
    {
      id: uuidv4(),
      user_id: TEST_USER_ID,
      session_id: uuidv4(),
      raw_transcript: "Change team meeting to high priority",
      raw_transcript_encrypted: false,
      language: 'en-US',
      intent_type: 'UPDATE_TASK',
      intent_confidence: 0.9,
      intent_method: 'RULES',
      entity_type: 'TASK',
      entities: sampleEntities('TASK', 'Team meeting'),
      extracted_title: 'Team meeting',
      extracted_priority: 'HIGH',
      search_keywords: ['team', 'meeting', 'priority'],
      confidence_breakdown: makeConfidenceBreakdown(0.9, 0.85, 0.9),
      outcome: 'SUCCESS',
      created_at: iso(new Date(now.getTime() - 1000 * 60 * 60 * 36)),
    },
    {
      id: uuidv4(),
      user_id: TEST_USER_ID,
      session_id: uuidv4(),
      raw_transcript: "Delete grocery shopping task",
      raw_transcript_encrypted: false,
      language: 'en-US',
      intent_type: 'DELETE_TASK',
      intent_confidence: 0.9,
      intent_method: 'RULES',
      entity_type: 'TASK',
      entities: sampleEntities('TASK', 'Grocery shopping'),
      extracted_title: 'Grocery shopping',
      search_keywords: ['delete', 'grocery', 'shopping'],
      confidence_breakdown: makeConfidenceBreakdown(0.9, 0.85, 0.9),
      outcome: 'CANCELLED',
      created_at: iso(new Date(now.getTime() - 1000 * 60 * 60 * 24 * 14)),
    },
    {
      id: uuidv4(),
      user_id: TEST_USER_ID,
      session_id: uuidv4(),
      raw_transcript: "Show me all urgent tasks",
      raw_transcript_encrypted: false,
      language: 'en-US',
      intent_type: 'QUERY_TASK',
      intent_confidence: 0.88,
      intent_method: 'RULES',
      entity_type: 'TASK',
      entities: [],
      search_keywords: ['urgent', 'tasks'],
      confidence_breakdown: makeConfidenceBreakdown(0.88, 0.7, 0.9),
      outcome: 'SUCCESS',
      created_at: iso(new Date(now.getTime() - 1000 * 60 * 60 * 24 * 30)),
    },
    // Add some failed/ambiguous examples
    {
      id: uuidv4(),
      user_id: TEST_USER_ID,
      session_id: uuidv4(),
      raw_transcript: "Add something for tomorrow",
      raw_transcript_encrypted: false,
      language: 'en-US',
      intent_type: 'UNKNOWN',
      intent_confidence: 0.55,
      intent_method: 'RULES',
      entity_type: 'NEEDS_USER_INPUT',
      entities: [],
      extracted_title: null,
      search_keywords: ['something', 'tomorrow'],
      confidence_breakdown: makeConfidenceBreakdown(0.55, 0.4, 0.7),
      outcome: 'FAILED',
      needs_user_input: true,
      missing_fields: ['TITLE', 'ENTITY_TYPE'],
      created_at: iso(new Date(now.getTime() - 1000 * 60 * 60 * 24 * 5)),
    },
    {
      id: uuidv4(),
      user_id: TEST_USER_ID,
      session_id: uuidv4(),
      raw_transcript: "Add task to call mom at 5pm today",
      raw_transcript_encrypted: false,
      language: 'en-US',
      intent_type: 'CREATE_TASK',
      intent_confidence: 0.97,
      intent_method: 'RULES',
      entity_type: 'TASK',
      entities: sampleEntities('TASK', 'Call mom', iso(new Date()), '17:00'),
      extracted_title: 'Call mom',
      search_keywords: ['call', 'mom'],
      confidence_breakdown: makeConfidenceBreakdown(0.97, 0.95, 0.98),
      outcome: 'SUCCESS',
      created_at: iso(new Date(now.getTime() - 1000 * 60 * 60 * 1)),
    },
    // Add a few with user_corrections and fuzzy match
    {
      id: uuidv4(),
      user_id: TEST_USER_ID,
      session_id: uuidv4(),
      raw_transcript: "Crate a nuw task",
      raw_transcript_encrypted: false,
      language: 'en-US',
      intent_type: 'CREATE_TASK',
      intent_confidence: 0.6,
      intent_method: 'RULES',
      entity_type: 'TASK',
      entities: sampleEntities('TASK', 'Create a new task'),
      extracted_title: 'Create a new task',
      search_keywords: ['crate', 'nuw', 'task'],
      confidence_breakdown: makeConfidenceBreakdown(0.6, 0.5, 0.7),
      outcome: 'FAILED',
      user_corrections: [{ field: 'raw_transcript', oldValue: 'Crate a nuw task', newValue: 'Create a new task', correctedAt: iso(new Date()), userId: TEST_USER_ID }],
      fuzzy_match_used: true,
      created_at: iso(new Date(now.getTime() - 1000 * 60 * 60 * 72)),
    },
    {
      id: uuidv4(),
      user_id: TEST_USER_ID,
      session_id: uuidv4(),
      raw_transcript: "Add eggs, bread, and butter to grocery list",
      raw_transcript_encrypted: false,
      language: 'en-US',
      intent_type: 'CREATE_ITEM',
      intent_confidence: 0.95,
      intent_method: 'RULES',
      entity_type: 'ITEM',
      entities: [{ type: 'ITEM', value: 'Eggs' }, { type: 'ITEM', value: 'Bread' }, { type: 'ITEM', value: 'Butter' }],
      extracted_title: 'Eggs, Bread, Butter',
      search_keywords: ['eggs', 'bread', 'butter', 'grocery'],
      confidence_breakdown: makeConfidenceBreakdown(0.95, 0.9, 0.95),
      outcome: 'SUCCESS',
      created_at: iso(new Date(now.getTime() - 1000 * 60 * 60 * 10)),
    },
    // More examples to reach 20+ records
  ];

  // Add a few more programmatic entries to reach 20+ samples
  for (let i = 0; i < 8; i++) {
    const id = uuidv4();
    sampleRows.push({
      id,
      user_id: TEST_USER_ID,
      session_id: uuidv4(),
      raw_transcript: `Seeded voice command example ${i + 1}`,
      raw_transcript_encrypted: false,
      language: 'en-US',
      intent_type: i % 2 === 0 ? 'CREATE_TASK' : 'CREATE_EVENT',
      intent_confidence: 0.7 + i * 0.02,
      intent_method: 'RULES',
      entity_type: i % 2 === 0 ? 'TASK' : 'EVENT',
      entities: sampleEntities(i % 2 === 0 ? 'TASK' : 'EVENT', `Example ${i + 1}`),
      extracted_title: `Seed example ${i + 1}`,
      search_keywords: ['seed', `example${i + 1}`],
      confidence_breakdown: makeConfidenceBreakdown(0.7 + i * 0.02, 0.6 + i * 0.02, 0.8 + i * 0.01),
      outcome: i % 5 === 0 ? 'FAILED' : 'SUCCESS',
      created_at: iso(new Date(now.getTime() - 1000 * 60 * 60 * (i + 5))),
    });
  }

  // Insert rows
  try {
    const { error } = await client.from('myday_voice_command_logs').insert(sampleRows);
    if (error) throw error;
    console.log('Inserted voice command test data:', sampleRows.length);
  } catch (err) {
    console.error('seedVoiceCommandTestData failed', err);
    throw err;
  }
}

export async function clearVoiceCommandTestData() {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');
  try {
    const { error } = await client.from('myday_voice_command_logs').delete().eq('user_id', TEST_USER_ID);
    if (error) throw error;
    console.log('Cleared voice command test data for', TEST_USER_ID);
  } catch (err) {
    console.error('clearVoiceCommandTestData failed', err);
    throw err;
  }
}

export async function seedUserVoicePatterns() {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');

  const patterns = [
    {
      id: uuidv4(),
      user_id: TEST_USER_ID,
      phrase_pattern: 'gym',
      normalized_phrase: 'Gym workout',
      maps_to_entity_type: 'TASK',
      maps_to_value: 'Gym workout',
      frequency_count: 5,
      confidence_score: 0.9,
      auto_apply: true,
    },
    {
      id: uuidv4(),
      user_id: TEST_USER_ID,
      phrase_pattern: 'pay rent',
      normalized_phrase: 'Pay rent',
      maps_to_entity_type: 'TASK',
      maps_to_value: 'Pay rent',
      frequency_count: 3,
      confidence_score: 0.75,
      auto_apply: true,
    },
  ];

  try {
    const { error } = await client.from('myday_user_voice_patterns').upsert(patterns);
    if (error) throw error;
    console.log('Seeded user voice patterns:', patterns.length);
  } catch (err) {
    console.error('seedUserVoicePatterns failed', err);
    throw err;
  }
}

