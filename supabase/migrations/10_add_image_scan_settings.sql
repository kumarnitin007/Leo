-- =====================================================
-- MIGRATION ORDER: 10 of 10
-- Run this file AFTER 09_add_notification_settings.sql
-- =====================================================
-- Add image scanning settings
-- =====================================================

-- Add AI scanning consent column to user settings
ALTER TABLE myday_user_settings
ADD COLUMN IF NOT EXISTS ai_scan_enabled BOOLEAN DEFAULT false;

-- Add column to track if user has been warned about sensitive images
ALTER TABLE myday_user_settings
ADD COLUMN IF NOT EXISTS ai_scan_warning_shown BOOLEAN DEFAULT false;

-- =====================================================
-- DONE! Image scanning settings added.
-- Users must explicitly enable AI scanning
-- =====================================================
