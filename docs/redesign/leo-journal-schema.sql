-- ============================================================
-- LEO JOURNAL — Supabase Schema Migration
-- Run this in your Supabase SQL Editor
-- ============================================================

-- ── USER PROFILES & SETTINGS ──────────────────────────────
create table if not exists user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists user_settings (
  id uuid primary key references auth.users(id) on delete cascade,
  -- Theme
  theme text default 'system' check (theme in ('light', 'dark', 'system')),
  accent_color text default 'purple' check (accent_color in ('purple','teal','coral','amber','rose')),
  font_style text default 'serif' check (font_style in ('serif','sans')),
  -- Journal preferences
  default_mood text,
  default_energy text,
  show_word_count boolean default true,
  show_weather boolean default true,
  show_steps boolean default true,
  ai_nudge_enabled boolean default true,
  ai_nudge_time time default '08:00',
  prompt_of_day_enabled boolean default true,
  on_this_day_enabled boolean default true,
  -- Notifications
  streak_reminder_enabled boolean default true,
  streak_reminder_time time default '20:00',
  -- Privacy
  lock_enabled boolean default false,
  lock_type text default 'none' check (lock_type in ('none','pin','biometric')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── JOURNAL ENTRIES ────────────────────────────────────────
create table if not exists journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Date the entry belongs to (not created_at — allows backdating)
  entry_date date not null default current_date,
  -- Entry ordering within a day (1, 2, 3…)
  day_sequence int not null default 1,
  -- Content
  title text,
  body text,
  body_html text,          -- rich text version if editor produces HTML
  is_voice_entry boolean default false,
  voice_url text,
  -- Mood & energy (stored as slugs: happy, good, neutral, tired, sad, anxious, grateful)
  mood text,
  energy text check (energy in ('low','medium','high','on_fire')),
  -- Context snapshot at time of writing
  weather_condition text,
  weather_temp_f numeric,
  weather_location text,
  steps_count int,
  steps_calories int,
  steps_active_minutes int,
  -- State
  is_draft boolean default false,
  is_pinned boolean default false,
  is_deleted boolean default false,   -- soft delete
  deleted_at timestamptz,
  word_count int default 0,
  -- Timestamps
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Ensure sequence is unique per user per day
create unique index if not exists idx_journal_entries_user_date_seq
  on journal_entries(user_id, entry_date, day_sequence)
  where is_deleted = false;

-- Fast lookup for entry list by user + date range
create index if not exists idx_journal_entries_user_date
  on journal_entries(user_id, entry_date desc)
  where is_deleted = false;

-- ── ACTIVITIES ─────────────────────────────────────────────
create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,          -- e.g. 'exercise', 'family'
  label text not null,                -- e.g. 'Exercise'
  emoji text,
  sort_order int default 0,
  is_system boolean default true      -- false = user-created
);

-- Seed default activities
insert into activities (slug, label, emoji, sort_order) values
  ('exercise',   'Exercise',   '🏃', 10),
  ('work',       'Work',       '💼', 20),
  ('reading',    'Reading',    '📖', 30),
  ('family',     'Family',     '👨‍👩‍👧', 40),
  ('cooking',    'Cooking',    '🍳', 50),
  ('travel',     'Travel',     '✈️', 60),
  ('meditation', 'Meditation', '🧘', 70),
  ('music',      'Music',      '🎵', 80),
  ('creative',   'Creative',   '🎨', 90),
  ('learning',   'Learning',   '📚', 100),
  ('shopping',   'Shopping',   '🛒', 110),
  ('nature',     'Nature',     '🌿', 120),
  ('social',     'Social',     '👥', 130),
  ('cleaning',   'Cleaning',   '🧹', 140),
  ('self_care',  'Self-Care',  '💆', 150)
on conflict (slug) do nothing;

create table if not exists entry_activities (
  entry_id uuid references journal_entries(id) on delete cascade,
  activity_slug text references activities(slug) on delete cascade,
  primary key (entry_id, activity_slug)
);

-- ── TAGS ───────────────────────────────────────────────────
create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  color text default 'gold',
  usage_count int default 0,
  created_at timestamptz default now(),
  unique(user_id, label)
);

create table if not exists entry_tags (
  entry_id uuid references journal_entries(id) on delete cascade,
  tag_id uuid references tags(id) on delete cascade,
  primary key (entry_id, tag_id)
);

-- ── STREAKS ────────────────────────────────────────────────
-- Materialised streak summary per user — updated by trigger
create table if not exists user_streaks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_streak int default 0,
  longest_streak int default 0,
  last_entry_date date,
  total_entries int default 0,
  total_days_logged int default 0,
  updated_at timestamptz default now()
);

-- Function: recalculate streak for a user
create or replace function recalculate_streak(p_user_id uuid)
returns void language plpgsql as $$
declare
  v_dates date[];
  v_current int := 0;
  v_longest int := 0;
  v_run int := 1;
  v_last date;
  i int;
begin
  -- Get distinct logged dates descending
  select array_agg(d order by d desc)
  into v_dates
  from (
    select distinct entry_date as d
    from journal_entries
    where user_id = p_user_id and is_deleted = false
  ) sub;

  if v_dates is null or array_length(v_dates, 1) = 0 then
    insert into user_streaks(user_id, current_streak, longest_streak, last_entry_date, total_days_logged)
    values(p_user_id, 0, 0, null, 0)
    on conflict(user_id) do update set current_streak=0, longest_streak=0, last_entry_date=null, updated_at=now();
    return;
  end if;

  v_last := v_dates[1];

  -- Current streak: count consecutive days from today or yesterday
  if v_last >= current_date - 1 then
    v_current := 1;
    for i in 2..array_length(v_dates,1) loop
      if v_dates[i] = v_dates[i-1] - 1 then
        v_current := v_current + 1;
      else
        exit;
      end if;
    end loop;
  end if;

  -- Longest streak
  v_run := 1;
  v_longest := 1;
  for i in 2..array_length(v_dates,1) loop
    if v_dates[i] = v_dates[i-1] - 1 then
      v_run := v_run + 1;
      if v_run > v_longest then v_longest := v_run; end if;
    else
      v_run := 1;
    end if;
  end loop;

  insert into user_streaks(user_id, current_streak, longest_streak, last_entry_date,
    total_days_logged, updated_at)
  values(p_user_id, v_current, v_longest, v_last,
    array_length(v_dates,1), now())
  on conflict(user_id) do update set
    current_streak = excluded.current_streak,
    longest_streak = greatest(user_streaks.longest_streak, excluded.longest_streak),
    last_entry_date = excluded.last_entry_date,
    total_days_logged = excluded.total_days_logged,
    updated_at = now();
end;
$$;

-- Trigger: recalculate streak after entry insert/update/delete
create or replace function trigger_recalculate_streak()
returns trigger language plpgsql as $$
begin
  perform recalculate_streak(coalesce(NEW.user_id, OLD.user_id));
  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists trg_streak_on_entry on journal_entries;
create trigger trg_streak_on_entry
  after insert or update or delete on journal_entries
  for each row execute function trigger_recalculate_streak();

-- ── AI INSIGHTS ────────────────────────────────────────────
-- Stores AI-generated nudges, patterns, and prompts
create table if not exists ai_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  insight_type text not null check (insight_type in (
    'daily_nudge',      -- morning personalised nudge
    'pattern',          -- detected pattern (e.g. "you write more on family days")
    'writing_prompt',   -- AI-generated prompt
    'daily_summary',    -- end-of-day digest
    'on_this_day'       -- memory from same date last year
  )),
  title text,
  message text not null,
  source_data jsonb,     -- what data drove this insight
  for_date date not null default current_date,
  is_dismissed boolean default false,
  dismissed_at timestamptz,
  was_used boolean default false,  -- user clicked "use as prompt"
  created_at timestamptz default now()
);

create index if not exists idx_ai_insights_user_date
  on ai_insights(user_id, for_date desc)
  where is_dismissed = false;

-- ── DAILY PROMPTS ──────────────────────────────────────────
-- Curated writing prompts (system + user-saved)
create table if not exists writing_prompts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade, -- null = system prompt
  prompt_text text not null,
  category text default 'general' check (category in (
    'general','gratitude','reflection','growth','relationships','creativity','wellbeing'
  )),
  is_system boolean default false,
  used_count int default 0,
  created_at timestamptz default now()
);

-- ── WORD COUNT TRIGGER ─────────────────────────────────────
create or replace function update_word_count()
returns trigger language plpgsql as $$
begin
  if NEW.body is not null then
    NEW.word_count := array_length(regexp_split_to_array(trim(NEW.body), '\s+'), 1);
  end if;
  NEW.updated_at := now();
  return NEW;
end;
$$;

drop trigger if exists trg_word_count on journal_entries;
create trigger trg_word_count
  before insert or update on journal_entries
  for each row execute function update_word_count();

-- ── AUTO DAY SEQUENCE ──────────────────────────────────────
create or replace function set_day_sequence()
returns trigger language plpgsql as $$
declare
  v_seq int;
begin
  select coalesce(max(day_sequence), 0) + 1
  into v_seq
  from journal_entries
  where user_id = NEW.user_id
    and entry_date = NEW.entry_date
    and is_deleted = false;
  NEW.day_sequence := v_seq;
  return NEW;
end;
$$;

drop trigger if exists trg_day_sequence on journal_entries;
create trigger trg_day_sequence
  before insert on journal_entries
  for each row execute function set_day_sequence();

-- ── ROW LEVEL SECURITY ─────────────────────────────────────
alter table user_profiles enable row level security;
alter table user_settings enable row level security;
alter table journal_entries enable row level security;
alter table entry_activities enable row level security;
alter table tags enable row level security;
alter table entry_tags enable row level security;
alter table user_streaks enable row level security;
alter table ai_insights enable row level security;
alter table writing_prompts enable row level security;

-- Users can only see/modify their own data
create policy "own_profile" on user_profiles for all using (auth.uid() = id);
create policy "own_settings" on user_settings for all using (auth.uid() = id);
create policy "own_entries" on journal_entries for all using (auth.uid() = user_id);
create policy "own_entry_activities" on entry_activities for all
  using (entry_id in (select id from journal_entries where user_id = auth.uid()));
create policy "own_tags" on tags for all using (auth.uid() = user_id);
create policy "own_entry_tags" on entry_tags for all
  using (entry_id in (select id from journal_entries where user_id = auth.uid()));
create policy "own_streaks" on user_streaks for all using (auth.uid() = user_id);
create policy "own_ai_insights" on ai_insights for all using (auth.uid() = user_id);
create policy "own_writing_prompts" on writing_prompts for all
  using (auth.uid() = user_id or user_id is null);
-- Activities table is public read
alter table activities enable row level security;
create policy "activities_public_read" on activities for select using (true);

-- ── USEFUL VIEWS ───────────────────────────────────────────

-- Entry list with tag and activity counts (for sidebar)
create or replace view entry_list as
select
  je.id,
  je.user_id,
  je.entry_date,
  je.day_sequence,
  je.title,
  left(je.body, 150) as body_preview,
  je.mood,
  je.energy,
  je.word_count,
  je.is_draft,
  je.is_voice_entry,
  je.created_at,
  (select count(*) from journal_entries j2
   where j2.user_id = je.user_id and j2.entry_date = je.entry_date
   and j2.is_deleted = false) as entries_that_day,
  array_agg(distinct t.label) filter (where t.label is not null) as tags,
  array_agg(distinct ea.activity_slug) filter (where ea.activity_slug is not null) as activities
from journal_entries je
left join entry_tags et on et.entry_id = je.id
left join tags t on t.id = et.tag_id
left join entry_activities ea on ea.entry_id = je.id
where je.is_deleted = false
group by je.id;

-- Last 14 days calendar view (for streak dots)
create or replace view streak_calendar as
select
  je.user_id,
  je.entry_date,
  count(*) as entry_count,
  array_agg(distinct je.mood) as moods,
  bool_or(not je.is_draft) as has_saved_entry
from journal_entries je
where je.is_deleted = false
  and je.entry_date >= current_date - 13
group by je.user_id, je.entry_date;
