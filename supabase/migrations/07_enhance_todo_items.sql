-- =====================================================
-- MIGRATION ORDER: 7 of 7
-- Run this file AFTER 06_add_voice_created_tracking.sql
-- =====================================================
-- Enhance TO-DO items with tags and show_on_dashboard
-- =====================================================

-- 1. Add tags column to myday_todo_items
ALTER TABLE myday_todo_items 
ADD COLUMN IF NOT EXISTS tags TEXT[];

-- 2. Add show_on_dashboard column (show incomplete todos with due date on dashboard)
ALTER TABLE myday_todo_items 
ADD COLUMN IF NOT EXISTS show_on_dashboard BOOLEAN DEFAULT false;

-- 3. Create index for dashboard todos (due date + incomplete + show_on_dashboard)
CREATE INDEX IF NOT EXISTS idx_todo_items_dashboard 
ON myday_todo_items(user_id, due_date, is_completed, show_on_dashboard) 
WHERE show_on_dashboard = true AND is_completed = false;

-- 4. Create index for tag filtering
CREATE INDEX IF NOT EXISTS idx_todo_items_tags ON myday_todo_items USING GIN(tags);

-- =====================================================
-- DONE! TO-DO items now support:
-- 1. tags - Array of tag IDs for categorization
-- 2. show_on_dashboard - Show on Home/Dashboard when due
-- 3. order_num (already exists) - For sorting within group
-- 4. due_date (already exists) - For dashboard integration
-- =====================================================
