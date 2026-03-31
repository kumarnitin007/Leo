-- Google Fit / health data cache
-- Stores daily fitness metrics synced from Google Fit (or other providers)

create table if not exists myday_fitness_data (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  steps integer,
  calories_burned numeric(10,2),
  distance_meters numeric(10,2),
  active_minutes integer,
  heart_rate_avg integer,
  heart_rate_min integer,
  heart_rate_max integer,
  sleep_minutes integer,
  weight_kg numeric(5,2),
  floors_climbed integer,
  source text default 'google_fit',
  raw_data jsonb,
  synced_at timestamptz default now(),
  unique(user_id, date)
);

alter table myday_fitness_data enable row level security;

create policy "Users can manage own fitness data"
  on myday_fitness_data for all
  using (auth.uid() = user_id);
