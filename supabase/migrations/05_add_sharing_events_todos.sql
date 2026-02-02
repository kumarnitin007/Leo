-- =====================================================
-- MIGRATION ORDER: 5 of 5
-- Run this file AFTER 04_create_user_levels.sql
-- =====================================================
-- Add sharing support for Events and To-Do items
-- Tables: myday_shared_events, myday_shared_todos
-- =====================================================

-- 1. Create myday_shared_events table
CREATE TABLE IF NOT EXISTS myday_shared_events (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL, -- Reference to myday_events
    group_id TEXT NOT NULL REFERENCES myday_groups(id) ON DELETE CASCADE,
    shared_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    share_mode TEXT DEFAULT 'readonly' CHECK (share_mode IN ('readonly', 'copy')),
    shared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(event_id, group_id)
);

-- 2. Create myday_shared_todos table (for todo items)
CREATE TABLE IF NOT EXISTS myday_shared_todos (
    id TEXT PRIMARY KEY,
    todo_item_id TEXT NOT NULL, -- Reference to myday_todo_items
    group_id TEXT NOT NULL REFERENCES myday_groups(id) ON DELETE CASCADE,
    shared_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    share_mode TEXT DEFAULT 'readonly' CHECK (share_mode IN ('readonly', 'editable')),
    -- editable = group members can mark complete/incomplete
    shared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(todo_item_id, group_id)
);

-- 3. Create myday_shared_todo_groups table (for sharing entire todo groups)
CREATE TABLE IF NOT EXISTS myday_shared_todo_groups (
    id TEXT PRIMARY KEY,
    todo_group_id TEXT NOT NULL, -- Reference to myday_todo_groups
    group_id TEXT NOT NULL REFERENCES myday_groups(id) ON DELETE CASCADE,
    shared_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    share_mode TEXT DEFAULT 'readonly' CHECK (share_mode IN ('readonly', 'editable')),
    shared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(todo_group_id, group_id)
);

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_shared_events_group ON myday_shared_events(group_id);
CREATE INDEX IF NOT EXISTS idx_shared_events_event ON myday_shared_events(event_id);
CREATE INDEX IF NOT EXISTS idx_shared_events_shared_by ON myday_shared_events(shared_by);

CREATE INDEX IF NOT EXISTS idx_shared_todos_group ON myday_shared_todos(group_id);
CREATE INDEX IF NOT EXISTS idx_shared_todos_item ON myday_shared_todos(todo_item_id);
CREATE INDEX IF NOT EXISTS idx_shared_todos_shared_by ON myday_shared_todos(shared_by);

CREATE INDEX IF NOT EXISTS idx_shared_todo_groups_group ON myday_shared_todo_groups(group_id);
CREATE INDEX IF NOT EXISTS idx_shared_todo_groups_todo_group ON myday_shared_todo_groups(todo_group_id);

-- 5. Enable Row Level Security
ALTER TABLE myday_shared_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE myday_shared_todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE myday_shared_todo_groups ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for myday_shared_events
DO $$ BEGIN
    CREATE POLICY "Users can view shared events for their groups" ON myday_shared_events FOR SELECT
    USING (group_id IN (SELECT group_id FROM myday_group_members WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Event owner can share" ON myday_shared_events FOR INSERT WITH CHECK (shared_by = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Event owner can update share" ON myday_shared_events FOR UPDATE USING (shared_by = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Event owner can revoke share" ON myday_shared_events FOR DELETE USING (shared_by = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 7. RLS Policies for myday_shared_todos
DO $$ BEGIN
    CREATE POLICY "Users can view shared todos for their groups" ON myday_shared_todos FOR SELECT
    USING (group_id IN (SELECT group_id FROM myday_group_members WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Todo owner can share" ON myday_shared_todos FOR INSERT WITH CHECK (shared_by = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Todo owner can update share" ON myday_shared_todos FOR UPDATE USING (shared_by = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Todo owner can revoke share" ON myday_shared_todos FOR DELETE USING (shared_by = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 8. RLS Policies for myday_shared_todo_groups
DO $$ BEGIN
    CREATE POLICY "Users can view shared todo groups for their groups" ON myday_shared_todo_groups FOR SELECT
    USING (group_id IN (SELECT group_id FROM myday_group_members WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Todo group owner can share" ON myday_shared_todo_groups FOR INSERT WITH CHECK (shared_by = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Todo group owner can update share" ON myday_shared_todo_groups FOR UPDATE USING (shared_by = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Todo group owner can revoke share" ON myday_shared_todo_groups FOR DELETE USING (shared_by = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 9. Update myday_entry_copies to include event and todo types
-- Add to CHECK constraint (safe via new insert)
DO $$ BEGIN
    ALTER TABLE myday_entry_copies DROP CONSTRAINT IF EXISTS myday_entry_copies_entry_type_check;
    ALTER TABLE myday_entry_copies ADD CONSTRAINT myday_entry_copies_entry_type_check 
        CHECK (entry_type IN ('safe_entry', 'document', 'event', 'todo', 'todo_group'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- =====================================================
-- DONE! Sharing for Events and To-Dos is now available.
-- =====================================================
