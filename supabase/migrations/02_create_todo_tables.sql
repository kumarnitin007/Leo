-- =====================================================
-- MIGRATION ORDER: 2 of 4
-- Run this file AFTER 01_base_schema.sql
-- =====================================================
-- To-Do List Tables Migration
-- Tables: myday_todo_groups, myday_todo_items
-- =====================================================

-- 1. Create myday_todo_groups table
CREATE TABLE IF NOT EXISTS myday_todo_groups (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6366f1',
    icon TEXT DEFAULT '📁',
    order_num INTEGER NOT NULL DEFAULT 0,
    is_expanded BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create myday_todo_items table
CREATE TABLE IF NOT EXISTS myday_todo_items (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    group_id TEXT REFERENCES myday_todo_groups(id) ON DELETE SET NULL,
    is_completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    due_date DATE,
    notes TEXT,
    order_num INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_todo_groups_user_id ON myday_todo_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_todo_items_user_id ON myday_todo_items(user_id);
CREATE INDEX IF NOT EXISTS idx_todo_items_group_id ON myday_todo_items(group_id);
CREATE INDEX IF NOT EXISTS idx_todo_items_is_completed ON myday_todo_items(is_completed);
CREATE INDEX IF NOT EXISTS idx_todo_items_due_date ON myday_todo_items(due_date);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE myday_todo_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE myday_todo_items ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies for myday_todo_groups (safe - ignores if exists)
DO $$ BEGIN
    CREATE POLICY "Users can view their own todo groups" ON myday_todo_groups FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can insert their own todo groups" ON myday_todo_groups FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can update their own todo groups" ON myday_todo_groups FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can delete their own todo groups" ON myday_todo_groups FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. Create RLS policies for myday_todo_items (safe - ignores if exists)
DO $$ BEGIN
    CREATE POLICY "Users can view their own todo items" ON myday_todo_items FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can insert their own todo items" ON myday_todo_items FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can update their own todo items" ON myday_todo_items FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can delete their own todo items" ON myday_todo_items FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 7. Create updated_at trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 8. Create triggers for updated_at
DROP TRIGGER IF EXISTS update_todo_groups_updated_at ON myday_todo_groups;
CREATE TRIGGER update_todo_groups_updated_at
    BEFORE UPDATE ON myday_todo_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_todo_items_updated_at ON myday_todo_items;
CREATE TRIGGER update_todo_items_updated_at
    BEFORE UPDATE ON myday_todo_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- DONE! Run migration 03 next.
-- =====================================================
