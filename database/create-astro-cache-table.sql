-- myday_astro_cache: Generic cache for all AstroAPI responses.
-- Falls back to the last successful response when current API calls fail.

CREATE TABLE IF NOT EXISTS myday_astro_cache (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid        NOT NULL,
  api_action text        NOT NULL,
  call_key   text        NOT NULL,
  response_data jsonb    NOT NULL,
  fetched_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, api_action, call_key)
);

-- Index for fallback queries (last successful response per action)
CREATE INDEX IF NOT EXISTS idx_astro_cache_user_action_date
  ON myday_astro_cache (user_id, api_action, fetched_at DESC);

-- RLS: users can only access their own cache rows
ALTER TABLE myday_astro_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own astro cache"
  ON myday_astro_cache FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own astro cache"
  ON myday_astro_cache FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own astro cache"
  ON myday_astro_cache FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own astro cache"
  ON myday_astro_cache FOR DELETE
  USING (auth.uid() = user_id);
