-- Migration: Create myday_numerology_questions for the
-- per-user "Custom numerology questions" feature.
--
-- The user can save up to NUMEROLOGY_CUSTOM_Q_MAX questions (defined in
-- src/numerology/numerologyInsights.ts; 5 by default). Each question gets
-- an OpenAI answer that is cached daily in `myday_astro_cache` (no schema
-- change needed there). The answers themselves are NOT stored here — that
-- would invalidate the daily-refresh contract. We keep only the question
-- text + ordering metadata; a fresh answer is fetched / cached each day.
--
-- See docs/LEO_DB_SCHEMA.schema, table # 49 (MYNQ) for the master entry.

CREATE TABLE IF NOT EXISTS myday_numerology_questions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  question    TEXT NOT NULL CHECK (char_length(question) BETWEEN 3 AND 240),
  position    SMALLINT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_myday_numerology_questions_user_pos
  ON myday_numerology_questions(user_id, position);

-- updated_at trigger (uses the same pattern other tables use elsewhere)
CREATE OR REPLACE FUNCTION myday_numerology_questions_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_myday_numerology_questions_updated_at
  ON myday_numerology_questions;
CREATE TRIGGER trg_myday_numerology_questions_updated_at
  BEFORE UPDATE ON myday_numerology_questions
  FOR EACH ROW
  EXECUTE FUNCTION myday_numerology_questions_set_updated_at();

-- RLS: own rows only
ALTER TABLE myday_numerology_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own numerology questions"
  ON myday_numerology_questions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own numerology questions"
  ON myday_numerology_questions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own numerology questions"
  ON myday_numerology_questions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own numerology questions"
  ON myday_numerology_questions FOR DELETE
  USING (auth.uid() = user_id);
