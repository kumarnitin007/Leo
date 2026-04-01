-- Fitbit OAuth tokens (mirrors myday_google_tokens pattern)
create table if not exists myday_fitbit_tokens (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  fitbit_user_id text not null default '',
  access_token  text not null,
  refresh_token text not null,
  token_expiry  timestamptz,
  scopes        text[] default '{}',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

alter table myday_fitbit_tokens enable row level security;

create policy "Users manage own fitbit tokens"
  on myday_fitbit_tokens for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table myday_fitbit_tokens is
  'Stores Fitbit OAuth tokens per user. Same pattern as myday_google_tokens.';
