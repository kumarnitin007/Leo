-- Trades records (Vault → Trades)
-- Single encrypted JSON blob per user (mirrors myday_bank_records).
-- The `data` column stores JSON.stringify({ encrypted, iv }) of the
-- client-side AES-256-GCM encrypted TradesData document. Schema of the
-- decrypted document is intentionally NOT frozen (evolves without migration).

create table if not exists myday_trades_records (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       text not null,
  updated_at timestamptz not null default now()
);

alter table myday_trades_records enable row level security;

drop policy if exists "Users manage own trades records" on myday_trades_records;
create policy "Users manage own trades records"
  on myday_trades_records
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
