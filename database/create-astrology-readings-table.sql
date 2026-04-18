-- Migration: Create myday_astrology_readings table for Ask-the-Stars AI reading history
-- Stores every AI-powered astrology reading for history, comparison, and audit.

CREATE TABLE IF NOT EXISTS myday_astrology_readings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Snapshot of astrological context at time of query
  birth_snapshot   JSONB,           -- sun sign, day master, pillars, yogas, dasha
  moon_phase       TEXT,
  moon_sign        TEXT,
  tithi            TEXT,
  nakshatra        TEXT,

  -- The question and answer
  user_question    TEXT NOT NULL,
  ai_prompt_sent   TEXT,             -- full prompt for debugging
  ai_response_raw  TEXT,             -- raw JSON string from OpenAI
  simple_answer    TEXT,             -- parsed simple field
  detailed_answer  TEXT,             -- parsed detailed field
  timing_advice    TEXT,             -- parsed timing field (when to act)
  confidence       TEXT,             -- 'high' | 'medium' | 'low'

  -- Metadata
  model_used       TEXT DEFAULT 'gpt-4o-mini',
  prompt_tokens    INTEGER,
  completion_tokens INTEGER,
  total_tokens     INTEGER,
  cost_usd         NUMERIC(10,6),
  latency_ms       INTEGER
);

CREATE INDEX IF NOT EXISTS idx_myday_astrology_readings_user_id
  ON myday_astrology_readings(user_id);
CREATE INDEX IF NOT EXISTS idx_myday_astrology_readings_created_at
  ON myday_astrology_readings(created_at DESC);

-- RLS
ALTER TABLE myday_astrology_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own readings"
  ON myday_astrology_readings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own readings"
  ON myday_astrology_readings FOR INSERT
  WITH CHECK (auth.uid() = user_id);
