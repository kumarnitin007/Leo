-- =====================================================
-- MIGRATION ORDER: 6 of 6
-- Run this file AFTER 05_add_sharing_events_todos.sql
-- =====================================================
-- Add voice creation tracking columns to relevant tables
-- This allows filtering/identifying voice-created entries
-- =====================================================

-- 1. Add voice tracking columns to myday_tasks
ALTER TABLE myday_tasks 
ADD COLUMN IF NOT EXISTS created_via_voice BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS voice_command_id TEXT,
ADD COLUMN IF NOT EXISTS voice_confidence DECIMAL(3,2);

-- 2. Add voice tracking columns to myday_events
ALTER TABLE myday_events 
ADD COLUMN IF NOT EXISTS created_via_voice BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS voice_command_id TEXT,
ADD COLUMN IF NOT EXISTS voice_confidence DECIMAL(3,2);

-- 3. Add voice tracking columns to myday_journal_entries
ALTER TABLE myday_journal_entries 
ADD COLUMN IF NOT EXISTS created_via_voice BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS voice_command_id TEXT,
ADD COLUMN IF NOT EXISTS voice_confidence DECIMAL(3,2);

-- 4. Add voice tracking columns to myday_todo_items
ALTER TABLE myday_todo_items 
ADD COLUMN IF NOT EXISTS created_via_voice BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS voice_command_id TEXT,
ADD COLUMN IF NOT EXISTS voice_confidence DECIMAL(3,2);

-- 5. Add voice tracking columns to myday_items
ALTER TABLE myday_items 
ADD COLUMN IF NOT EXISTS created_via_voice BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS voice_command_id TEXT,
ADD COLUMN IF NOT EXISTS voice_confidence DECIMAL(3,2);

-- 6. Add voice tracking columns to myday_routines
ALTER TABLE myday_routines 
ADD COLUMN IF NOT EXISTS created_via_voice BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS voice_command_id TEXT,
ADD COLUMN IF NOT EXISTS voice_confidence DECIMAL(3,2);

-- 7. Add voice tracking columns to myday_milestones (if exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'myday_milestones') THEN
        EXECUTE 'ALTER TABLE myday_milestones ADD COLUMN IF NOT EXISTS created_via_voice BOOLEAN DEFAULT false';
        EXECUTE 'ALTER TABLE myday_milestones ADD COLUMN IF NOT EXISTS voice_command_id TEXT';
        EXECUTE 'ALTER TABLE myday_milestones ADD COLUMN IF NOT EXISTS voice_confidence DECIMAL(3,2)';
    END IF;
END $$;

-- 8. Create indexes for filtering voice-created entries
CREATE INDEX IF NOT EXISTS idx_tasks_voice_created ON myday_tasks(created_via_voice) WHERE created_via_voice = true;
CREATE INDEX IF NOT EXISTS idx_events_voice_created ON myday_events(created_via_voice) WHERE created_via_voice = true;
CREATE INDEX IF NOT EXISTS idx_journal_voice_created ON myday_journal_entries(created_via_voice) WHERE created_via_voice = true;
CREATE INDEX IF NOT EXISTS idx_todos_voice_created ON myday_todo_items(created_via_voice) WHERE created_via_voice = true;
CREATE INDEX IF NOT EXISTS idx_items_voice_created ON myday_items(created_via_voice) WHERE created_via_voice = true;

-- =====================================================
-- DONE! Voice-created entries can now be tracked via:
-- 1. created_via_voice column (boolean filter)
-- 2. voice_command_id (link to voice_command_logs)
-- 3. voice_confidence (confidence score from speech recognition)
-- 
-- Note: No system tag needed - UI can show 🎤 indicator 
-- based on created_via_voice column directly
-- =====================================================
