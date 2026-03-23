-- Align attendee column with app code (extracted_attendees text[]).
-- Fixes PostgREST PGRST204 when the DB had extracted_attendee (singular) or the column was missing.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'myday_voice_command_logs'
  ) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'myday_voice_command_logs' AND column_name = 'extracted_attendees'
  ) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'myday_voice_command_logs' AND column_name = 'extracted_attendee'
  ) THEN
    ALTER TABLE public.myday_voice_command_logs RENAME COLUMN extracted_attendee TO extracted_attendees;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'myday_voice_command_logs'
        AND column_name = 'extracted_attendees' AND data_type IN ('text', 'character varying')
    ) THEN
      ALTER TABLE public.myday_voice_command_logs
        ALTER COLUMN extracted_attendees TYPE text[] USING (
          CASE
            WHEN extracted_attendees IS NULL THEN ARRAY[]::text[]
            WHEN trim(extracted_attendees::text) = '' THEN ARRAY[]::text[]
            ELSE ARRAY[extracted_attendees::text]
          END
        );
    END IF;
  ELSE
    ALTER TABLE public.myday_voice_command_logs
      ADD COLUMN extracted_attendees text[] DEFAULT '{}';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
