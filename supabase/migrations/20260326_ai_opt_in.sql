-- AI opt-in: explicit user consent for AI-powered recommendations
-- Default false — user must opt in via Settings before any AI calls are made.

ALTER TABLE myday_user_settings
  ADD COLUMN IF NOT EXISTS ai_opt_in boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN myday_user_settings.ai_opt_in IS 'User has explicitly opted in to AI-powered recommendations (morning briefing, journal reflection, etc.)';
