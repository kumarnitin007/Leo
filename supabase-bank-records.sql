-- Bank Records Table for Leo Planner Safe Section
-- Run this in your Supabase SQL Editor

-- Create table
create table if not exists bank_records (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  data text not null,  -- Encrypted JSON containing deposits, accounts, bills, actions
  updated_at timestamptz default now()
);

-- Each user has exactly one bank_records row
create unique index if not exists bank_records_user_idx on bank_records(user_id);

-- Enable Row Level Security
alter table bank_records enable row level security;

-- RLS Policies
create policy "Users can read own bank records"
  on bank_records for select
  using (auth.uid() = user_id);

create policy "Users can insert own bank records"
  on bank_records for insert
  with check (auth.uid() = user_id);

create policy "Users can update own bank records"
  on bank_records for update
  using (auth.uid() = user_id);

create policy "Users can delete own bank records"
  on bank_records for delete
  using (auth.uid() = user_id);

-- Create updated_at trigger
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_bank_records_updated_at
  before update on bank_records
  for each row
  execute function update_updated_at_column();

-- Grant permissions
grant all on bank_records to authenticated;
