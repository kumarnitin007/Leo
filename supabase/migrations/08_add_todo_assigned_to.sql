-- =====================================================
-- MIGRATION ORDER: 8 of 8
-- Run this file AFTER 07_enhance_todo_items.sql
-- =====================================================
-- Add "assigned to" column for TO-DO items
-- References users from connected family/sharing groups
-- =====================================================

-- 1. Add assigned_to column (references auth.users)
ALTER TABLE myday_todo_items 
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Add assigned_at timestamp (when was it assigned)
ALTER TABLE myday_todo_items 
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;

-- 3. Add assigned_by (who assigned this todo)
ALTER TABLE myday_todo_items 
ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 4. Create index for assigned todos
CREATE INDEX IF NOT EXISTS idx_todo_items_assigned_to 
ON myday_todo_items(assigned_to) WHERE assigned_to IS NOT NULL;

-- =====================================================
-- DONE! TO-DO items now support:
-- assigned_to - UUID of user this todo is assigned to
-- assigned_at - When it was assigned
-- assigned_by - Who assigned it
-- =====================================================
