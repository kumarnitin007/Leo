-- Reference Calendar Tables Schema
-- Run this in Supabase SQL Editor to create the necessary tables

-- ===== 1. Reference Calendars Table =====
CREATE TABLE IF NOT EXISTS myday_reference_calendars (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  domain TEXT, -- 'holiday', 'festival', 'religious', 'financial', 'observance'
  calendar_type TEXT, -- 'reference', 'user-created'
  geography TEXT, -- e.g., 'IN', 'US', 'JP', 'GLOBAL'
  religion TEXT, -- e.g., 'Hindu', 'Islamic', 'Judaism'
  is_preloaded BOOLEAN DEFAULT true,
  is_user_editable BOOLEAN DEFAULT false,
  version TEXT,
  color TEXT,
  icon TEXT,
  source TEXT,
  documentation_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 2. Reference Days Table =====
CREATE TABLE IF NOT EXISTS myday_reference_days (
  id TEXT PRIMARY KEY,
  calendar_id TEXT REFERENCES myday_reference_calendars(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date TEXT, -- ISO date string for fixed dates
  month_day TEXT, -- MM-DD format for recurring dates
  recurrence TEXT, -- 'YEARLY', 'MONTHLY', 'WEEKLY', 'QUADRENNIAL', etc.
  rule TEXT, -- Human-readable rule like "Third Monday of January"
  note TEXT, -- Additional notes like "2026: Jan 29, 2027: Feb 17"
  calendar_system TEXT DEFAULT 'gregorian',
  
  -- Event details
  category TEXT,
  importance_level INTEGER DEFAULT 50,
  significance TEXT,
  description TEXT,
  local_customs TEXT[],
  tags TEXT[],
  states TEXT[],
  
  -- Visual theme
  primary_color TEXT,
  mood TEXT,
  icon TEXT,
  
  -- Media
  image_url TEXT,
  info_url TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_reference_days_calendar ON myday_reference_days(calendar_id);
CREATE INDEX IF NOT EXISTS idx_reference_days_date ON myday_reference_days(date);
CREATE INDEX IF NOT EXISTS idx_reference_days_month_day ON myday_reference_days(month_day);

-- ===== 3. User Reference Calendars (Subscriptions) =====
CREATE TABLE IF NOT EXISTS myday_user_reference_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  calendar_id TEXT NOT NULL REFERENCES myday_reference_calendars(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, calendar_id)
);

-- Create index for faster user lookups
CREATE INDEX IF NOT EXISTS idx_user_reference_calendars_user ON myday_user_reference_calendars(user_id);
CREATE INDEX IF NOT EXISTS idx_user_reference_calendars_calendar ON myday_user_reference_calendars(calendar_id);

-- ===== Row Level Security (RLS) =====

-- Enable RLS
ALTER TABLE myday_reference_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE myday_reference_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE myday_user_reference_calendars ENABLE ROW LEVEL SECURITY;

-- Policies for myday_reference_calendars
CREATE POLICY "Allow read access to all calendars"
ON myday_reference_calendars FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to insert calendars"
ON myday_reference_calendars FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update calendars"
ON myday_reference_calendars FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to delete calendars"
ON myday_reference_calendars FOR DELETE
TO authenticated
USING (true);

-- Policies for myday_reference_days
CREATE POLICY "Allow read access to all days"
ON myday_reference_days FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to insert days"
ON myday_reference_days FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update days"
ON myday_reference_days FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to delete days"
ON myday_reference_days FOR DELETE
TO authenticated
USING (true);

-- Policies for myday_user_reference_calendars
CREATE POLICY "Users can read their own calendar subscriptions"
ON myday_user_reference_calendars FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own calendar subscriptions"
ON myday_user_reference_calendars FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calendar subscriptions"
ON myday_user_reference_calendars FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own calendar subscriptions"
ON myday_user_reference_calendars FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ===== Done! =====
-- Verify tables were created:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'myday_reference%';
