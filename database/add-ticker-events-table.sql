-- Trades: cache upcoming corporate-event dates per user/ticker (earnings,
-- ex-dividend, dividend pay date). These are FACTUAL scheduled dates pulled from
-- the market data source (Yahoo calendarEvents) — used to show "Upcoming dates"
-- on the Trades dashboard and in the per-ticker detail panel. NON-sensitive
-- (public market data). Per-user rows with RLS.
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
