-- AI Audit Log: every AI call is recorded for cost tracking, debugging, and user visibility.

create table if not exists myday_ai_audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  ability_id text not null,           -- 'daily_briefing' | 'journal_reflection' | future abilities
  request_payload jsonb,              -- full request body sent to API
  system_prompt text,                 -- the system prompt used
  user_message text,                  -- the user message constructed
  response_payload jsonb,             -- full parsed AI response
  raw_response text,                  -- raw text from OpenAI before parsing

  prompt_tokens int not null default 0,
  completion_tokens int not null default 0,
  total_tokens int not null default 0,
  model text not null,
  cost_usd numeric(10, 6) not null default 0,

  duration_ms int not null default 0,
  success boolean not null default true,
  error_message text,

  created_at timestamptz not null default now()
);

create index if not exists idx_ai_audit_user_ability
  on myday_ai_audit_log (user_id, ability_id, created_at desc);

create index if not exists idx_ai_audit_user_date
  on myday_ai_audit_log (user_id, created_at desc);

-- RLS
alter table myday_ai_audit_log enable row level security;

create policy "Users can read own audit log"
  on myday_ai_audit_log for select using (auth.uid() = user_id);

create policy "Users can insert own audit entries"
  on myday_ai_audit_log for insert with check (auth.uid() = user_id);
