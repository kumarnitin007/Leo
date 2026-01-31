-- =====================================================
-- MIGRATION ORDER: 1 of 4
-- Run this file FIRST before any other migrations
-- =====================================================
-- LEO APP - BASE DATABASE SCHEMA
-- PRODUCTION SAFE: Only creates missing tables/policies
-- Will NOT delete or modify existing data
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. USERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS myday_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT,
    email TEXT,
    avatar_emoji TEXT DEFAULT '😊',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE myday_users ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Users can view own profile" ON myday_users FOR SELECT USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can update own profile" ON myday_users FOR UPDATE USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can insert own profile" ON myday_users FOR INSERT WITH CHECK (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- 2. USER SETTINGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS myday_user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    dashboard_layout TEXT DEFAULT 'uniform',
    theme TEXT DEFAULT 'default',
    location JSONB,
    notifications JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

ALTER TABLE myday_user_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Users can manage own settings" ON myday_user_settings FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- 3. TAGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS myday_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#667eea',
    section TEXT, -- 'tasks', 'events', 'journals', 'safe', etc.
    is_system_category BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE myday_tags ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Users can manage own tags" ON myday_tags FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- 4. TASKS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS myday_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    frequency TEXT DEFAULT 'daily', -- 'daily', 'weekly', 'monthly', 'one-time', 'count-based'
    frequency_count INTEGER,
    frequency_period TEXT, -- 'week', 'month'
    specific_days TEXT[], -- For weekly tasks
    date TEXT, -- For one-time tasks (YYYY-MM-DD)
    start_date TEXT,
    end_date TEXT,
    weightage INTEGER DEFAULT 5,
    color TEXT,
    tags TEXT[], -- Array of tag IDs
    is_on_hold BOOLEAN DEFAULT false,
    hold_until TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE myday_tasks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Users can manage own tasks" ON myday_tasks FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- 5. TASK COMPLETIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS myday_task_completions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES myday_tasks(id) ON DELETE CASCADE,
    date TEXT NOT NULL, -- YYYY-MM-DD
    completed_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,
    UNIQUE(user_id, task_id, date)
);

ALTER TABLE myday_task_completions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Users can manage own completions" ON myday_task_completions FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- 6. EVENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS myday_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    date TEXT NOT NULL, -- YYYY-MM-DD or MM-DD for yearly
    time TEXT, -- HH:MM
    frequency TEXT DEFAULT 'one-time', -- 'one-time', 'yearly'
    category TEXT,
    priority INTEGER DEFAULT 5,
    color TEXT,
    tags TEXT[],
    hide_from_dashboard BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE myday_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Users can manage own events" ON myday_events FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- 7. ITEMS TABLE (Shopping/Inventory)
-- =====================================================
CREATE TABLE IF NOT EXISTS myday_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT,
    quantity INTEGER DEFAULT 1,
    unit TEXT,
    notes TEXT,
    is_purchased BOOLEAN DEFAULT false,
    purchased_at TIMESTAMPTZ,
    tags TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE myday_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Users can manage own items" ON myday_items FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- 8. JOURNAL ENTRIES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS myday_journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    entry_date TEXT NOT NULL, -- YYYY-MM-DD
    content TEXT,
    mood TEXT, -- 'great', 'good', 'okay', 'bad', 'terrible'
    tags TEXT[],
    is_favorite BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, entry_date)
);

ALTER TABLE myday_journal_entries ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Users can manage own journal entries" ON myday_journal_entries FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- 9. ROUTINES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS myday_routines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    task_ids TEXT[], -- Array of task IDs
    time_of_day TEXT, -- 'morning', 'afternoon', 'evening'
    is_predefined BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE myday_routines ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Users can manage own routines" ON myday_routines FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- 10. RESOLUTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS myday_resolutions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    priority INTEGER DEFAULT 5,
    status TEXT DEFAULT 'active', -- 'active', 'completed', 'abandoned'
    progress INTEGER DEFAULT 0, -- 0-100
    linked_task_id UUID REFERENCES myday_tasks(id) ON DELETE SET NULL,
    tags TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE myday_resolutions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Users can manage own resolutions" ON myday_resolutions FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- 11. NOTIFY BEFORE DAYS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS myday_notifybeforedays (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES myday_events(id) ON DELETE CASCADE,
    days_before INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, event_id, days_before)
);

ALTER TABLE myday_notifybeforedays ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Users can manage own notifications" ON myday_notifybeforedays FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- 12. SAFE - MASTER KEYS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS myday_safe_master_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    salt TEXT NOT NULL,
    verification_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE myday_safe_master_keys ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Users can manage own master key" ON myday_safe_master_keys FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- 13. SAFE - ENCRYPTED ENTRIES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS myday_encrypted_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    url TEXT,
    category TEXT,
    encrypted_data TEXT NOT NULL, -- AES-GCM encrypted JSON
    iv TEXT NOT NULL, -- Initialization vector
    tags TEXT[],
    is_favorite BOOLEAN DEFAULT false,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE myday_encrypted_entries ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Users can manage own safe entries" ON myday_encrypted_entries FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- 14. DOCUMENT VAULTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS myday_document_vaults (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    encrypted_notes TEXT,
    notes_iv TEXT,
    encrypted_files JSONB, -- Array of encrypted file metadata
    tags TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE myday_document_vaults ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Users can manage own documents" ON myday_document_vaults FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- 15. REFERENCE CALENDARS TABLE (Public reference data)
-- =====================================================
CREATE TABLE IF NOT EXISTS myday_reference_calendars (
    id TEXT PRIMARY KEY, -- e.g., 'indian-hindu', 'us-federal'
    name TEXT NOT NULL,
    description TEXT,
    region TEXT,
    type TEXT, -- 'religious', 'federal', 'cultural'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS even for public data to satisfy Supabase warnings
ALTER TABLE myday_reference_calendars ENABLE ROW LEVEL SECURITY;

-- Public read access (anyone authenticated can view)
DO $$ BEGIN
    CREATE POLICY "Anyone can view reference calendars" ON myday_reference_calendars FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Only service role can insert/update/delete (admin operations)
DO $$ BEGIN
    CREATE POLICY "Service role can manage reference calendars" ON myday_reference_calendars FOR ALL USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- 16. REFERENCE CALENDAR DAYS TABLE (Public reference data)
-- =====================================================
CREATE TABLE IF NOT EXISTS myday_reference_days (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    calendar_id TEXT NOT NULL REFERENCES myday_reference_calendars(id) ON DELETE CASCADE,
    date TEXT NOT NULL, -- YYYY-MM-DD
    event_name TEXT NOT NULL,
    significance TEXT,
    is_holiday BOOLEAN DEFAULT false,
    primary_color TEXT,
    icon TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS even for public data to satisfy Supabase warnings
ALTER TABLE myday_reference_days ENABLE ROW LEVEL SECURITY;

-- Public read access (anyone authenticated can view)
DO $$ BEGIN
    CREATE POLICY "Anyone can view reference days" ON myday_reference_days FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Only service role can insert/update/delete (admin operations)
DO $$ BEGIN
    CREATE POLICY "Service role can manage reference days" ON myday_reference_days FOR ALL USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- 17. USER REFERENCE CALENDAR PREFERENCES
-- =====================================================
CREATE TABLE IF NOT EXISTS myday_user_reference_calendars (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    calendar_id TEXT NOT NULL REFERENCES myday_reference_calendars(id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT true,
    display_color TEXT,
    priority INTEGER DEFAULT 5,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, calendar_id)
);

ALTER TABLE myday_user_reference_calendars ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Users can manage own calendar preferences" ON myday_user_reference_calendars FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- 18. USER VISIBLE DAYS 
-- NOTE: This may exist as a VIEW in some databases.
-- We create as TABLE only if nothing exists with this name.
-- RLS is only enabled if it's a table, not a view.
-- =====================================================

-- Create table only if no object with this name exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'myday_user_visible_days'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.views 
        WHERE table_schema = 'public' AND table_name = 'myday_user_visible_days'
    ) THEN
        CREATE TABLE myday_user_visible_days (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            date TEXT NOT NULL,
            event_name TEXT NOT NULL,
            significance TEXT,
            is_holiday BOOLEAN DEFAULT false,
            primary_color TEXT,
            icon TEXT,
            calendar_names TEXT[],
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    END IF;
END $$;

-- Enable RLS only if it's a table (not a view)
DO $$ 
BEGIN
    -- Check if myday_user_visible_days exists as a BASE TABLE (not a view)
    IF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' 
        AND c.relname = 'myday_user_visible_days'
        AND c.relkind = 'r'  -- 'r' = ordinary table, 'v' = view
    ) THEN
        ALTER TABLE myday_user_visible_days ENABLE ROW LEVEL SECURITY;
    END IF;
EXCEPTION WHEN OTHERS THEN 
    -- Silently ignore if it's a view or doesn't exist
    NULL;
END $$;

-- Create policies only if it's a table (not a view)
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' 
        AND c.relname = 'myday_user_visible_days'
        AND c.relkind = 'r'  -- 'r' = ordinary table
    ) THEN
        BEGIN
            CREATE POLICY "Users can view own visible days" ON myday_user_visible_days FOR SELECT USING (auth.uid() = user_id);
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
        BEGIN
            CREATE POLICY "Users can insert own visible days" ON myday_user_visible_days FOR INSERT WITH CHECK (auth.uid() = user_id);
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
        BEGIN
            CREATE POLICY "Users can update own visible days" ON myday_user_visible_days FOR UPDATE USING (auth.uid() = user_id);
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
        BEGIN
            CREATE POLICY "Users can delete own visible days" ON myday_user_visible_days FOR DELETE USING (auth.uid() = user_id);
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
    END IF;
END $$;

-- =====================================================
-- 19. VOICE COMMAND LOGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS myday_voice_command_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    session_id TEXT,
    raw_text TEXT,
    detected_category TEXT,
    extracted_title TEXT,
    extracted_priority TEXT,
    extracted_tags TEXT[],
    extracted_recurrence TEXT,
    memo_date TEXT,
    memo_time TEXT,
    overall_confidence DECIMAL(5,4),
    confidence_breakdown JSONB,
    entities JSONB,
    outcome TEXT DEFAULT 'PENDING', -- 'PENDING', 'SUCCESS', 'CANCELLED', 'FAILED', 'UNDONE'
    created_item_id TEXT,
    created_item_type TEXT,
    user_corrections JSONB,
    search_keywords TEXT[],
    expires_at TIMESTAMPTZ,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE myday_voice_command_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Users can manage own voice logs" ON myday_voice_command_logs FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- 20. USER VOICE PATTERNS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS myday_user_voice_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    pattern_type TEXT NOT NULL, -- 'phrase', 'entity', 'intent'
    pattern_value TEXT NOT NULL,
    frequency_count INTEGER DEFAULT 1,
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    confidence_score DECIMAL(5,4),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE myday_user_voice_patterns ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Users can manage own voice patterns" ON myday_user_voice_patterns FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- 21. VOICE COMMAND ANALYTICS TABLE (Aggregated/anonymized)
-- =====================================================
CREATE TABLE IF NOT EXISTS myday_voice_command_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_hash TEXT, -- Anonymized user ID
    intent_type TEXT,
    date TEXT, -- YYYY-MM-DD
    hour_of_day INTEGER,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    avg_confidence DECIMAL(5,4),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for analytics (anonymized but still need security)
ALTER TABLE myday_voice_command_analytics ENABLE ROW LEVEL SECURITY;

-- Public read for analytics (anyone authenticated)
DO $$ BEGIN
    CREATE POLICY "Anyone can view aggregated analytics" ON myday_voice_command_analytics FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Only service role can insert/update analytics
DO $$ BEGIN
    CREATE POLICY "Service role can manage analytics" ON myday_voice_command_analytics FOR ALL USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- 22. TASK SPILLOVERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS myday_task_spillovers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES myday_tasks(id) ON DELETE CASCADE,
    original_date TEXT NOT NULL,
    spillover_date TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, task_id, original_date, spillover_date)
);

ALTER TABLE myday_task_spillovers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Users can manage own spillovers" ON myday_task_spillovers FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- 23. MILESTONES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS myday_milestones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    date TEXT NOT NULL, -- YYYY-MM-DD
    category TEXT,
    icon TEXT DEFAULT '🎯',
    color TEXT DEFAULT '#6366f1',
    is_achieved BOOLEAN DEFAULT false,
    achieved_at TIMESTAMPTZ,
    tags TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE myday_milestones ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Users can manage own milestones" ON myday_milestones FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
-- Safe indexes (user_id columns always exist)
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON myday_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON myday_events(user_id);
CREATE INDEX IF NOT EXISTS idx_items_user_id ON myday_items(user_id);
CREATE INDEX IF NOT EXISTS idx_encrypted_entries_user ON myday_encrypted_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_logs_user ON myday_voice_command_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_milestones_user_id ON myday_milestones(user_id);

-- Conditional indexes for columns that may not exist in older schemas
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'myday_tags' AND column_name = 'section') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_tags_user_section ON myday_tags(user_id, section)';
    ELSE
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_tags_user_id ON myday_tags(user_id)';
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'myday_reference_days' AND column_name = 'calendar_id') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_reference_days_calendar ON myday_reference_days(calendar_id)';
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Date-based indexes (conditional - only if column exists)
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'myday_tasks' AND column_name = 'date') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_tasks_date ON myday_tasks(date)';
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'myday_task_completions' AND column_name = 'date') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_task_completions_user_date ON myday_task_completions(user_id, date)';
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'myday_events' AND column_name = 'date') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_events_date ON myday_events(date)';
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'myday_journal_entries' AND column_name = 'entry_date') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_journal_entries_user_date ON myday_journal_entries(user_id, entry_date)';
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'myday_reference_days' AND column_name = 'date') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_reference_days_date ON myday_reference_days(date)';
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'myday_milestones' AND column_name = 'date') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_milestones_date ON myday_milestones(date)';
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Create index only if myday_user_visible_days is a table (not a view) with date column
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' 
        AND c.relname = 'myday_user_visible_days'
        AND c.relkind = 'r'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'myday_user_visible_days' AND column_name = 'date'
    ) THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_visible_days_user_date ON myday_user_visible_days(user_id, date)';
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- =====================================================
-- 23. TIMER SCHEDULES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS myday_timer_schedules (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    activities JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE myday_timer_schedules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Users can view own timer schedules" ON myday_timer_schedules FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can insert own timer schedules" ON myday_timer_schedules FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can update own timer schedules" ON myday_timer_schedules FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can delete own timer schedules" ON myday_timer_schedules FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_timer_schedules_user_id ON myday_timer_schedules(user_id);

-- =====================================================
-- DONE! Run migration 02 next.
-- =====================================================
