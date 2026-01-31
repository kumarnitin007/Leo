-- =====================================================
-- MIGRATION ORDER: 4 of 4
-- Run this file LAST after all other migrations
-- =====================================================
-- User Level/Category System Migration
-- Enables paid vs unpaid user feature gating
-- =====================================================

-- 1. Create user levels/tiers definition table
CREATE TABLE IF NOT EXISTS myday_user_levels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    tier_order INTEGER NOT NULL DEFAULT 0, -- For sorting (higher = better)
    color TEXT DEFAULT '#6b7280',
    icon TEXT DEFAULT '👤',
    monthly_price DECIMAL(10, 2) DEFAULT 0,
    yearly_price DECIMAL(10, 2) DEFAULT 0,
    is_default BOOLEAN DEFAULT false, -- New users get this level
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create features definition table
CREATE TABLE IF NOT EXISTS myday_features (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    category TEXT, -- e.g., 'core', 'safe', 'sharing', 'analytics', 'voice'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create level-feature mapping (which levels have which features)
CREATE TABLE IF NOT EXISTS myday_level_features (
    id TEXT PRIMARY KEY,
    level_id TEXT NOT NULL REFERENCES myday_user_levels(id) ON DELETE CASCADE,
    feature_id TEXT NOT NULL REFERENCES myday_features(id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT true,
    limit_value INTEGER, -- For features with limits (e.g., max entries, max groups)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(level_id, feature_id)
);

-- 4. Create user level assignments (which user has which level)
CREATE TABLE IF NOT EXISTS myday_user_level_assignments (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    level_id TEXT NOT NULL REFERENCES myday_user_levels(id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ, -- For trial periods or subscriptions
    assigned_by UUID REFERENCES auth.users(id), -- Admin who assigned
    notes TEXT,
    subscription_id TEXT, -- External payment reference
    is_active BOOLEAN DEFAULT true
);

-- 5. Create indexes
CREATE INDEX IF NOT EXISTS idx_user_levels_tier ON myday_user_levels(tier_order);
CREATE INDEX IF NOT EXISTS idx_level_features_level ON myday_level_features(level_id);
CREATE INDEX IF NOT EXISTS idx_level_features_feature ON myday_level_features(feature_id);
CREATE INDEX IF NOT EXISTS idx_user_assignments_user ON myday_user_level_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_assignments_level ON myday_user_level_assignments(level_id);

-- 6. Enable RLS
ALTER TABLE myday_user_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE myday_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE myday_level_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE myday_user_level_assignments ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies (safe - ignores if exists)

DO $$ BEGIN
    CREATE POLICY "Anyone can view user levels" ON myday_user_levels FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Only service role can manage user levels (admin operations)
DO $$ BEGIN
    CREATE POLICY "Service role can manage user levels" ON myday_user_levels FOR ALL USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Anyone can view features" ON myday_features FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Only service role can manage features (admin operations)
DO $$ BEGIN
    CREATE POLICY "Service role can manage features" ON myday_features FOR ALL USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Anyone can view level features" ON myday_level_features FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Only service role can manage level features (admin operations)
DO $$ BEGIN
    CREATE POLICY "Service role can manage level features" ON myday_level_features FOR ALL USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can view their own level assignment" ON myday_user_level_assignments FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Only service role can manage user assignments (admin operations)
DO $$ BEGIN
    CREATE POLICY "Service role can manage user assignments" ON myday_user_level_assignments FOR ALL USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 8. Insert default user levels
INSERT INTO myday_user_levels (id, name, display_name, description, tier_order, color, icon, monthly_price, yearly_price, is_default)
VALUES 
    ('free', 'free', 'Free', 'Basic features for personal use', 0, '#6b7280', '👤', 0, 0, true),
    ('basic', 'basic', 'Basic', 'Essential features with increased limits', 1, '#3b82f6', '⭐', 4.99, 49.99, false),
    ('pro', 'pro', 'Pro', 'All features with higher limits', 2, '#8b5cf6', '💎', 9.99, 99.99, false),
    ('premium', 'premium', 'Premium', 'Unlimited access to all features', 3, '#f59e0b', '👑', 19.99, 199.99, false)
ON CONFLICT (id) DO NOTHING;

-- 9. Insert default features
INSERT INTO myday_features (id, name, display_name, description, category)
VALUES 
    -- Core features
    ('tasks', 'tasks', 'Tasks', 'Create and manage tasks', 'core'),
    ('events', 'events', 'Events', 'Create and manage events', 'core'),
    ('journals', 'journals', 'Journal', 'Daily journal entries', 'core'),
    ('routines', 'routines', 'Routines', 'Create routines', 'core'),
    
    -- Safe features
    ('safe_entries', 'safe_entries', 'Safe Entries', 'Password manager entries', 'safe'),
    ('safe_documents', 'safe_documents', 'Documents Vault', 'Secure document storage', 'safe'),
    ('safe_sharing', 'safe_sharing', 'Safe Sharing', 'Share safe entries with groups', 'sharing'),
    
    -- Advanced features
    ('reference_calendars', 'reference_calendars', 'Reference Calendars', 'Holiday and observance calendars', 'calendars'),
    ('voice_commands', 'voice_commands', 'Voice Commands', 'Create items via voice', 'voice'),
    ('analytics', 'analytics', 'Analytics', 'View detailed analytics', 'analytics'),
    ('smart_coach', 'smart_coach', 'Smart Coach', 'AI-powered productivity insights', 'ai'),
    ('todo_groups', 'todo_groups', 'To-Do Groups', 'Organize to-dos into groups', 'core'),
    ('milestones', 'milestones', 'Milestones', 'Track life milestones', 'core'),
    ('resolutions', 'resolutions', 'Resolutions', 'Annual resolutions tracker', 'core'),
    
    -- Sharing features
    ('groups', 'groups', 'Groups', 'Create and manage sharing groups', 'sharing'),
    ('group_invitations', 'group_invitations', 'Group Invitations', 'Invite others to groups', 'sharing')
ON CONFLICT (id) DO NOTHING;

-- 10. Insert default level-feature mappings

-- Free tier features
INSERT INTO myday_level_features (id, level_id, feature_id, is_enabled, limit_value)
VALUES 
    ('free_tasks', 'free', 'tasks', true, 50),
    ('free_events', 'free', 'events', true, 20),
    ('free_journals', 'free', 'journals', true, NULL), -- Unlimited
    ('free_routines', 'free', 'routines', true, 3),
    ('free_safe_entries', 'free', 'safe_entries', true, 10),
    ('free_safe_documents', 'free', 'safe_documents', true, 5),
    ('free_reference_calendars', 'free', 'reference_calendars', true, 2),
    ('free_todo_groups', 'free', 'todo_groups', true, 2)
ON CONFLICT (id) DO NOTHING;

-- Basic tier features
INSERT INTO myday_level_features (id, level_id, feature_id, is_enabled, limit_value)
VALUES 
    ('basic_tasks', 'basic', 'tasks', true, 200),
    ('basic_events', 'basic', 'events', true, 100),
    ('basic_journals', 'basic', 'journals', true, NULL),
    ('basic_routines', 'basic', 'routines', true, 10),
    ('basic_safe_entries', 'basic', 'safe_entries', true, 50),
    ('basic_safe_documents', 'basic', 'safe_documents', true, 25),
    ('basic_reference_calendars', 'basic', 'reference_calendars', true, 5),
    ('basic_voice_commands', 'basic', 'voice_commands', true, 50),
    ('basic_analytics', 'basic', 'analytics', true, NULL),
    ('basic_todo_groups', 'basic', 'todo_groups', true, 10),
    ('basic_milestones', 'basic', 'milestones', true, 20),
    ('basic_resolutions', 'basic', 'resolutions', true, 10)
ON CONFLICT (id) DO NOTHING;

-- Pro tier features
INSERT INTO myday_level_features (id, level_id, feature_id, is_enabled, limit_value)
VALUES 
    ('pro_tasks', 'pro', 'tasks', true, NULL), -- Unlimited
    ('pro_events', 'pro', 'events', true, NULL),
    ('pro_journals', 'pro', 'journals', true, NULL),
    ('pro_routines', 'pro', 'routines', true, NULL),
    ('pro_safe_entries', 'pro', 'safe_entries', true, 200),
    ('pro_safe_documents', 'pro', 'safe_documents', true, 100),
    ('pro_safe_sharing', 'pro', 'safe_sharing', true, NULL),
    ('pro_reference_calendars', 'pro', 'reference_calendars', true, NULL),
    ('pro_voice_commands', 'pro', 'voice_commands', true, NULL),
    ('pro_analytics', 'pro', 'analytics', true, NULL),
    ('pro_smart_coach', 'pro', 'smart_coach', true, 10), -- 10 AI queries/day
    ('pro_todo_groups', 'pro', 'todo_groups', true, NULL),
    ('pro_milestones', 'pro', 'milestones', true, NULL),
    ('pro_resolutions', 'pro', 'resolutions', true, NULL),
    ('pro_groups', 'pro', 'groups', true, 3),
    ('pro_group_invitations', 'pro', 'group_invitations', true, 15)
ON CONFLICT (id) DO NOTHING;

-- Premium tier features (unlimited everything)
INSERT INTO myday_level_features (id, level_id, feature_id, is_enabled, limit_value)
VALUES 
    ('premium_tasks', 'premium', 'tasks', true, NULL),
    ('premium_events', 'premium', 'events', true, NULL),
    ('premium_journals', 'premium', 'journals', true, NULL),
    ('premium_routines', 'premium', 'routines', true, NULL),
    ('premium_safe_entries', 'premium', 'safe_entries', true, NULL),
    ('premium_safe_documents', 'premium', 'safe_documents', true, NULL),
    ('premium_safe_sharing', 'premium', 'safe_sharing', true, NULL),
    ('premium_reference_calendars', 'premium', 'reference_calendars', true, NULL),
    ('premium_voice_commands', 'premium', 'voice_commands', true, NULL),
    ('premium_analytics', 'premium', 'analytics', true, NULL),
    ('premium_smart_coach', 'premium', 'smart_coach', true, NULL),
    ('premium_todo_groups', 'premium', 'todo_groups', true, NULL),
    ('premium_milestones', 'premium', 'milestones', true, NULL),
    ('premium_resolutions', 'premium', 'resolutions', true, NULL),
    ('premium_groups', 'premium', 'groups', true, NULL),
    ('premium_group_invitations', 'premium', 'group_invitations', true, NULL)
ON CONFLICT (id) DO NOTHING;

-- 11. Function to get user's current level
CREATE OR REPLACE FUNCTION get_user_level(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_level_id TEXT;
BEGIN
    SELECT level_id INTO v_level_id
    FROM myday_user_level_assignments
    WHERE user_id = p_user_id
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY assigned_at DESC
    LIMIT 1;
    
    IF v_level_id IS NULL THEN
        -- Return default level
        SELECT id INTO v_level_id
        FROM myday_user_levels
        WHERE is_default = true
        LIMIT 1;
    END IF;
    
    RETURN COALESCE(v_level_id, 'free');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Function to check if user has feature
CREATE OR REPLACE FUNCTION user_has_feature(p_user_id UUID, p_feature_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_level_id TEXT;
    v_has_feature BOOLEAN;
BEGIN
    v_level_id := get_user_level(p_user_id);
    
    SELECT is_enabled INTO v_has_feature
    FROM myday_level_features
    WHERE level_id = v_level_id
      AND feature_id = p_feature_id;
    
    RETURN COALESCE(v_has_feature, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. Function to get feature limit for user
CREATE OR REPLACE FUNCTION get_user_feature_limit(p_user_id UUID, p_feature_id TEXT)
RETURNS INTEGER AS $$
DECLARE
    v_level_id TEXT;
    v_limit INTEGER;
BEGIN
    v_level_id := get_user_level(p_user_id);
    
    SELECT limit_value INTO v_limit
    FROM myday_level_features
    WHERE level_id = v_level_id
      AND feature_id = p_feature_id;
    
    RETURN v_limit; -- NULL means unlimited
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- ALL MIGRATIONS COMPLETE!
-- =====================================================
