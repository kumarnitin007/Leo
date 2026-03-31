-- Google OAuth tokens storage
-- Stores access/refresh tokens per user for Google API access

create table if not exists myday_google_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  access_token text not null,
  refresh_token text,
  token_expiry timestamptz,
  scopes_granted text[],
  connected_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id)
);

alter table myday_google_tokens enable row level security;

create policy "Users can manage own tokens"
  on myday_google_tokens for all
  using (auth.uid() = user_id);
