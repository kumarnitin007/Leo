-- Journal: multiple entries per day + richer metadata
-- Professional journal apps (Day One, Daylio, Reflectly) capture more than just mood.

-- New columns for richer journaling
ALTER TABLE myday_journal_entries
  ADD COLUMN IF NOT EXISTS energy_level smallint CHECK (energy_level BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS weather text,
  ADD COLUMN IF NOT EXISTS activity text[],
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS word_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS entry_time time;

-- Drop any existing unique constraint on (user_id, entry_date) if present.
-- The app now supports multiple entries per day.
DO $$
BEGIN
  -- Try to drop common constraint names; ignore if they don't exist
  BEGIN ALTER TABLE myday_journal_entries DROP CONSTRAINT IF EXISTS myday_journal_entries_user_id_entry_date_key; EXCEPTION WHEN undefined_object THEN NULL; END;
  BEGIN ALTER TABLE myday_journal_entries DROP CONSTRAINT IF EXISTS unique_user_date; EXCEPTION WHEN undefined_object THEN NULL; END;
END $$;

-- Index for efficient date-based queries (multiple entries per day)
CREATE INDEX IF NOT EXISTS idx_journal_user_date ON myday_journal_entries (user_id, entry_date DESC);
