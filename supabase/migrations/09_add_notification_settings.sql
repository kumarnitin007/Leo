-- =====================================================
-- MIGRATION ORDER: 9 of 9
-- Run this file AFTER 08_add_todo_assigned_to.sql
-- =====================================================
-- Add notification settings table for web push notifications
-- =====================================================

-- 1. Create notification settings table
CREATE TABLE IF NOT EXISTS myday_notification_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT false,
    
    -- Daily reminder settings
    daily_reminder_enabled BOOLEAN DEFAULT true,
    daily_reminder_time TEXT DEFAULT '08:00', -- HH:mm format
    
    -- Event reminder settings
    event_reminders_enabled BOOLEAN DEFAULT true,
    event_reminder_minutes INTEGER DEFAULT 60, -- Minutes before event
    
    -- Streak milestone settings
    streak_milestones_enabled BOOLEAN DEFAULT true,
    
    -- Resolution alert settings
    resolution_alerts_enabled BOOLEAN DEFAULT true,
    resolution_alert_frequency TEXT DEFAULT 'weekly', -- 'daily', 'weekly', 'monthly'
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE myday_notification_settings ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS policies
DO $$ BEGIN
    CREATE POLICY "Users can view own notification settings" 
    ON myday_notification_settings FOR SELECT 
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can update own notification settings" 
    ON myday_notification_settings FOR UPDATE 
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can insert own notification settings" 
    ON myday_notification_settings FOR INSERT 
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Create index
CREATE INDEX IF NOT EXISTS idx_notification_settings_user_id 
ON myday_notification_settings(user_id);

-- =====================================================
-- DONE! Notification settings table created.
-- Users can now configure:
-- - Daily reminders at preferred time
-- - Event reminders (X minutes before)
-- - Streak milestone notifications
-- - Resolution progress alerts
-- =====================================================
