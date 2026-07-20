-- Trades: cache the last-fetched option mark per leg (like myday_ticker_quotes
-- does for stocks) so the "Open options" tab paints Mark / Market value from the
-- DB on load instead of showing blanks until the user hits "Refresh prices".
-- NON-sensitive (public market data). Per-user rows with RLS.
create table if not exists myday_option_marks (
  user_id     uuid not null references auth.users(id) on delete cascade,
  leg_key     text not null,        -- SYMBOL|OPTIONTYPE|STRIKE|EXPIRATION
  symbol      text not null,
  option_type text,
  strike      numeric,
  expiration  date,
  mark        numeric,
  bid         numeric,
  ask         numeric,
  last        numeric,
  as_of       timestamptz,
  updated_at  timestamptz not null default now(),
  primary key (user_id, leg_key)
);

alter table myday_option_marks enable row level security;
drop policy if exists "Users manage own option marks" on myday_option_marks;
create policy "Users manage own option marks"
  on myday_option_marks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
