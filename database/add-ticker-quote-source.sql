-- Trades: mark how a cached quote's price was obtained.
-- 'api'    → fetched from the market API (Yahoo) — the default.
-- 'manual' → keyed in by the user for symbols the API can't price
--            (e.g. Fidelity 529-plan portfolio codes like NHX203002).
alter table myday_ticker_quotes
  add column if not exists price_source text not null default 'api';
