-- Trades: ticker quote cache + watchlist / favorites
-- These tables hold NON-sensitive data (ticker symbols, public prices) so they
-- are stored as plain columns (not encrypted). Per-user rows with RLS.

-- 1) Quote cache — last fetched price per ticker. Used to paint the dashboard
--    without hitting the market API on every render, and as a fallback when the
--    live API is unreachable (older price shown until a newer one is fetched).
create table if not exists myday_ticker_quotes (
  user_id        uuid not null references auth.users(id) on delete cascade,
  ticker         text not null,
  price          numeric,
  currency       text,
  previous_close numeric,
  change         numeric,
  change_pct     numeric,
  as_of          timestamptz,
  -- 'api' (fetched from the market API) or 'manual' (keyed in by the user for
  -- symbols the API can't price, e.g. 529-plan portfolio codes).
  price_source   text not null default 'api',
  updated_at     timestamptz not null default now(),
  primary key (user_id, ticker)
);

alter table myday_ticker_quotes enable row level security;
drop policy if exists "Users manage own ticker quotes" on myday_ticker_quotes;
create policy "Users manage own ticker quotes"
  on myday_ticker_quotes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 2) Watchlist / favorites — tickers the user wants to track (name only, no
--    secure info). Performance is derived from the quote cache above.
create table if not exists myday_trade_watchlist (
  user_id    uuid not null references auth.users(id) on delete cascade,
  ticker     text not null,
  name       text,
  created_at timestamptz not null default now(),
  primary key (user_id, ticker)
);

alter table myday_trade_watchlist enable row level security;
drop policy if exists "Users manage own watchlist" on myday_trade_watchlist;
create policy "Users manage own watchlist"
  on myday_trade_watchlist
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3) Option mark cache — last fetched mark per open option leg. Same purpose as
--    the quote cache above: paint the "Open options" tab from the DB on load
--    instead of showing blank Mark / Market value until a manual refresh.
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

-- 4) Upcoming corporate-event dates — factual scheduled dates (next earnings,
--    ex-dividend, dividend pay) per ticker, shown on the dashboard + detail
--    panel. Cached to avoid re-hitting the market data source on every paint.
create table if not exists myday_ticker_events (
  user_id            uuid not null references auth.users(id) on delete cascade,
  ticker             text not null,
  next_earnings_date date,
  earnings_estimated boolean,
  ex_dividend_date   date,
  dividend_date      date,
  as_of              timestamptz,
  updated_at         timestamptz not null default now(),
  primary key (user_id, ticker)
);

alter table myday_ticker_events enable row level security;
drop policy if exists "Users manage own ticker events" on myday_ticker_events;
create policy "Users manage own ticker events"
  on myday_ticker_events
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
