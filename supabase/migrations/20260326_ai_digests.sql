-- AI Digests: stores briefing responses + compressed content digests
-- Content digests allow subsequent AI calls to send compact representations
-- instead of full journal/task text, reducing token cost significantly.

create table if not exists myday_ai_digests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- What type of digest this is
  digest_type text not null,  -- 'daily_briefing' | 'journal_digest' | 'task_digest'

  -- For daily briefings: the cached AI response
  response_text text,
  response_date date,  -- which day this briefing is for (one per day)

  -- Content digest / tokens: compressed representation of user content
  -- AI generates these alongside the main response so future calls can
  -- send the digest instead of raw text (saves input tokens)
  source_type text,           -- 'journal' | 'tasks' | 'events' | 'financial'
  source_date_from date,      -- date range the digest covers
  source_date_to date,
  content_digest text,        -- AI-generated compressed summary / tokens
  source_hash text,           -- hash of source content to detect changes

  -- Token usage tracking
  prompt_tokens int,
  completion_tokens int,
  model text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Fast lookups: today's briefing for a user
create index if not exists idx_ai_digests_user_type_date
  on myday_ai_digests (user_id, digest_type, response_date);

-- Fast lookups: content digests by source
create index if not exists idx_ai_digests_user_source
  on myday_ai_digests (user_id, source_type, source_date_to desc);

-- RLS
alter table myday_ai_digests enable row level security;

create policy "Users can read own digests"
  on myday_ai_digests for select using (auth.uid() = user_id);

create policy "Users can insert own digests"
  on myday_ai_digests for insert with check (auth.uid() = user_id);

create policy "Users can update own digests"
  on myday_ai_digests for update using (auth.uid() = user_id);

create policy "Users can delete own digests"
  on myday_ai_digests for delete using (auth.uid() = user_id);
