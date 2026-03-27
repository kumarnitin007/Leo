-- AI Personality Profile: optional fun inputs that make AI responses personal and entertaining.
-- Stored as JSONB on the user settings table for simplicity.

ALTER TABLE myday_user_settings
  ADD COLUMN IF NOT EXISTS ai_personality jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN myday_user_settings.ai_personality IS
  'Optional user-provided personality hints for AI personalisation (favourite places, characters, shows, superheroes, etc.)';
