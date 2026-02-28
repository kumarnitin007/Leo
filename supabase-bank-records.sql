-- Bank Records Table for Leo Planner Safe Section
-- Run this in your Supabase SQL Editor
-- 
-- Table Name: myday_bank_records
-- Acronym: MYBR
-- Description: Encrypted financial records (deposits, accounts, bills, actions)

-- Drop existing table if it exists (use with caution)
drop table if exists bank_records;
drop table if exists myday_bank_records cascade;

-- Create table with myday_ prefix
create table if not exists myday_bank_records (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  data text not null,  -- Encrypted JSON containing deposits, accounts, bills, actions
  updated_at timestamptz default now()
);

-- Each user has exactly one myday_bank_records row
create unique index if not exists myday_bank_records_user_idx on myday_bank_records(user_id);

-- Enable Row Level Security
alter table myday_bank_records enable row level security;

-- RLS Policies
create policy "Users can read own bank records"
  on myday_bank_records for select
  using (auth.uid() = user_id);

create policy "Users can insert own bank records"
  on myday_bank_records for insert
  with check (auth.uid() = user_id);

create policy "Users can update own bank records"
  on myday_bank_records for update
  using (auth.uid() = user_id);

create policy "Users can delete own bank records"
  on myday_bank_records for delete
  using (auth.uid() = user_id);

-- Create updated_at trigger
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_myday_bank_records_updated_at
  before update on myday_bank_records
  for each row
  execute function update_updated_at_column();

-- Grant permissions
grant all on myday_bank_records to authenticated;
