-- =====================================================
-- USER LEVELS & FEATURE GATING SETUP
-- Run this SQL to populate all user level tables
-- =====================================================

-- =====================================================
-- 1. CREATE TABLES (if they don't exist)
-- =====================================================

-- User Levels (tiers: free, basic, pro, premium)
CREATE TABLE IF NOT EXISTS myday_user_levels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    tier_order INTEGER NOT NULL,
    color TEXT,
    icon TEXT,
    monthly_price DECIMAL(10, 2) DEFAULT 0,
    yearly_price DECIMAL(10, 2) DEFAULT 0,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- App Features (sections/features that can be gated)
CREATE TABLE IF NOT EXISTS myday_features (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Level-Feature Mappings (which features each level has access to)
CREATE TABLE IF NOT EXISTS myday_level_features (
    level_id TEXT NOT NULL,
    feature_id TEXT NOT NULL,
    is_enabled BOOLEAN DEFAULT true,
    limit_value INTEGER, -- NULL = unlimited, number = max count
    PRIMARY KEY (level_id, feature_id)
);

-- User Level Assignments (which level each user has)
CREATE TABLE IF NOT EXISTS myday_user_level_assignments (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    level_id TEXT NOT NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ, -- NULL = never expires
    assigned_by UUID REFERENCES auth.users(id),
    notes TEXT,
    subscription_id TEXT, -- For payment tracking
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_level_assignments_user_id ON myday_user_level_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_level_assignments_active ON myday_user_level_assignments(is_active);

-- =====================================================
-- 2. POPULATE USER LEVELS
-- =====================================================

INSERT INTO myday_user_levels (id, name, display_name, description, tier_order, color, icon, monthly_price, yearly_price, is_default)
VALUES
    ('free', 'free', 'Free', 'Basic features for personal use', 1, '#6b7280', '🆓', 0, 0, true),
    ('basic', 'basic', 'Basic', 'Enhanced features for power users', 2, '#3b82f6', '⭐', 4.99, 49.99, false),
    ('pro', 'pro', 'Pro', 'Professional features for serious planners', 3, '#8b5cf6', '💎', 9.99, 99.99, false),
    ('premium', 'premium', 'Premium', 'All features unlocked with priority support', 4, '#f59e0b', '👑', 19.99, 199.99, false)
ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    tier_order = EXCLUDED.tier_order,
    color = EXCLUDED.color,
    icon = EXCLUDED.icon,
    monthly_price = EXCLUDED.monthly_price,
    yearly_price = EXCLUDED.yearly_price;

-- =====================================================
-- 3. POPULATE APP FEATURES
-- =====================================================

INSERT INTO myday_features (id, name, display_name, description, category)
VALUES
    -- Core Features
    ('tasks', 'tasks', 'Tasks', 'Create and manage tasks', 'Core'),
    ('events', 'events', 'Events', 'Track important events and dates', 'Core'),
    ('journal', 'journal', 'Journal', 'Daily journaling and reflections', 'Core'),
    ('todos', 'todos', 'To-Do Lists', 'Organize to-dos in groups', 'Core'),
    ('items', 'items', 'Items', 'Track miscellaneous items', 'Core'),
    
    -- Advanced Features
    ('routines', 'routines', 'Routines', 'Create recurring routines', 'Advanced'),
    ('resolutions', 'resolutions', 'Resolutions', 'Set and track yearly goals', 'Advanced'),
    ('analytics', 'analytics', 'Analytics', 'View insights and reports', 'Advanced'),
    ('safe', 'safe', 'Safe', 'Encrypted password storage', 'Advanced'),
    ('documents', 'documents', 'Document Vault', 'Encrypted document storage', 'Advanced'),
    
    -- Premium Features
    ('voice_commands', 'voice_commands', 'Voice Commands', 'Create items via voice', 'Premium'),
    ('ai_insights', 'ai_insights', 'AI Insights', 'Smart suggestions and coaching', 'Premium'),
    ('sharing', 'sharing', 'Sharing & Collaboration', 'Share items with family/groups', 'Premium'),
    ('export', 'export', 'Data Export', 'Export your data in multiple formats', 'Premium'),
    ('themes', 'themes', 'Custom Themes', 'Personalize your experience', 'Premium'),
    
    -- Limits
    ('task_limit', 'task_limit', 'Task Limit', 'Maximum number of active tasks', 'Limits'),
    ('event_limit', 'event_limit', 'Event Limit', 'Maximum number of events', 'Limits'),
    ('journal_limit', 'journal_limit', 'Journal Limit', 'Maximum number of journal entries', 'Limits'),
    ('safe_entries_limit', 'safe_entries_limit', 'Safe Entries Limit', 'Maximum number of safe entries', 'Limits'),
    ('document_limit', 'document_limit', 'Document Limit', 'Maximum number of documents', 'Limits')
ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    category = EXCLUDED.category;

-- =====================================================
-- 4. POPULATE LEVEL-FEATURE MAPPINGS
-- =====================================================

-- Clear existing mappings
DELETE FROM myday_level_features;

-- FREE TIER - Basic features with limits
INSERT INTO myday_level_features (level_id, feature_id, is_enabled, limit_value)
VALUES
    -- Core features (limited)
    ('free', 'tasks', true, 50),
    ('free', 'events', true, 20),
    ('free', 'journal', true, 30),
    ('free', 'todos', true, 100),
    ('free', 'items', true, 50),
    
    -- Advanced features (disabled or limited)
    ('free', 'routines', false, NULL),
    ('free', 'resolutions', false, NULL),
    ('free', 'analytics', true, NULL), -- Basic analytics
    ('free', 'safe', true, 10),
    ('free', 'documents', false, NULL),
    
    -- Premium features (disabled)
    ('free', 'voice_commands', false, NULL),
    ('free', 'ai_insights', false, NULL),
    ('free', 'sharing', false, NULL),
    ('free', 'export', false, NULL),
    ('free', 'themes', true, NULL), -- Basic themes only
    
    -- Limits
    ('free', 'task_limit', true, 50),
    ('free', 'event_limit', true, 20),
    ('free', 'journal_limit', true, 30),
    ('free', 'safe_entries_limit', true, 10),
    ('free', 'document_limit', true, 0);

-- BASIC TIER - More features, higher limits
INSERT INTO myday_level_features (level_id, feature_id, is_enabled, limit_value)
VALUES
    -- Core features (higher limits)
    ('basic', 'tasks', true, 200),
    ('basic', 'events', true, 100),
    ('basic', 'journal', true, 100),
    ('basic', 'todos', true, 500),
    ('basic', 'items', true, 200),
    
    -- Advanced features (enabled)
    ('basic', 'routines', true, NULL),
    ('basic', 'resolutions', true, NULL),
    ('basic', 'analytics', true, NULL),
    ('basic', 'safe', true, 50),
    ('basic', 'documents', true, 20),
    
    -- Premium features (some enabled)
    ('basic', 'voice_commands', true, NULL),
    ('basic', 'ai_insights', false, NULL),
    ('basic', 'sharing', false, NULL),
    ('basic', 'export', true, NULL),
    ('basic', 'themes', true, NULL),
    
    -- Limits
    ('basic', 'task_limit', true, 200),
    ('basic', 'event_limit', true, 100),
    ('basic', 'journal_limit', true, 100),
    ('basic', 'safe_entries_limit', true, 50),
    ('basic', 'document_limit', true, 20);

-- PRO TIER - Professional features, very high limits
INSERT INTO myday_level_features (level_id, feature_id, is_enabled, limit_value)
VALUES
    -- Core features (very high limits)
    ('pro', 'tasks', true, 1000),
    ('pro', 'events', true, 500),
    ('pro', 'journal', true, 500),
    ('pro', 'todos', true, 2000),
    ('pro', 'items', true, 1000),
    
    -- Advanced features (all enabled)
    ('pro', 'routines', true, NULL),
    ('pro', 'resolutions', true, NULL),
    ('pro', 'analytics', true, NULL),
    ('pro', 'safe', true, 200),
    ('pro', 'documents', true, 100),
    
    -- Premium features (most enabled)
    ('pro', 'voice_commands', true, NULL),
    ('pro', 'ai_insights', true, NULL),
    ('pro', 'sharing', true, NULL),
    ('pro', 'export', true, NULL),
    ('pro', 'themes', true, NULL),
    
    -- Limits
    ('pro', 'task_limit', true, 1000),
    ('pro', 'event_limit', true, 500),
    ('pro', 'journal_limit', true, 500),
    ('pro', 'safe_entries_limit', true, 200),
    ('pro', 'document_limit', true, 100);

-- PREMIUM TIER - All features unlimited
INSERT INTO myday_level_features (level_id, feature_id, is_enabled, limit_value)
VALUES
    -- Core features (unlimited)
    ('premium', 'tasks', true, NULL),
    ('premium', 'events', true, NULL),
    ('premium', 'journal', true, NULL),
    ('premium', 'todos', true, NULL),
    ('premium', 'items', true, NULL),
    
    -- Advanced features (all enabled, unlimited)
    ('premium', 'routines', true, NULL),
    ('premium', 'resolutions', true, NULL),
    ('premium', 'analytics', true, NULL),
    ('premium', 'safe', true, NULL),
    ('premium', 'documents', true, NULL),
    
    -- Premium features (all enabled)
    ('premium', 'voice_commands', true, NULL),
    ('premium', 'ai_insights', true, NULL),
    ('premium', 'sharing', true, NULL),
    ('premium', 'export', true, NULL),
    ('premium', 'themes', true, NULL),
    
    -- Limits (unlimited)
    ('premium', 'task_limit', true, NULL),
    ('premium', 'event_limit', true, NULL),
    ('premium', 'journal_limit', true, NULL),
    ('premium', 'safe_entries_limit', true, NULL),
    ('premium', 'document_limit', true, NULL);

-- =====================================================
-- 5. ASSIGN ALL USERS TO PREMIUM LEVEL
-- =====================================================

-- This gives all existing users full access to all features
-- You can modify this later in the database to restrict specific users

INSERT INTO myday_user_level_assignments (id, user_id, level_id, assigned_at, expires_at, is_active, notes)
SELECT 
    'premium-' || id::text || '-' || EXTRACT(EPOCH FROM NOW())::text,
    id,
    'premium',
    NOW(),
    NULL, -- Never expires
    true,
    'Auto-assigned premium access for all features'
FROM auth.users
WHERE id NOT IN (
    SELECT user_id 
    FROM myday_user_level_assignments 
    WHERE is_active = true
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 6. VERIFICATION QUERIES
-- =====================================================

-- Check user levels
SELECT * FROM myday_user_levels ORDER BY tier_order;

-- Check features
SELECT * FROM myday_features ORDER BY category, id;

-- Check level-feature mappings for premium
SELECT 
    lf.level_id,
    lf.feature_id,
    f.display_name,
    lf.is_enabled,
    lf.limit_value
FROM myday_level_features lf
JOIN myday_features f ON lf.feature_id = f.id
WHERE lf.level_id = 'premium'
ORDER BY f.category, f.id;

-- Check user assignments
SELECT 
    u.email,
    ula.level_id,
    ul.display_name as level_name,
    ula.assigned_at,
    ula.expires_at,
    ula.is_active
FROM myday_user_level_assignments ula
JOIN auth.users u ON ula.user_id = u.id
JOIN myday_user_levels ul ON ula.level_id = ul.id
WHERE ula.is_active = true
ORDER BY u.email;

-- =====================================================
-- 7. EXAMPLE: RESTRICT A SPECIFIC USER
-- =====================================================

-- To restrict a specific user to FREE tier:
-- 
-- -- First, deactivate their current assignment
-- UPDATE myday_user_level_assignments
-- SET is_active = false
-- WHERE user_id = 'USER_UUID_HERE';
-- 
-- -- Then assign them to free tier
-- INSERT INTO myday_user_level_assignments (id, user_id, level_id, assigned_at, is_active, notes)
-- VALUES (
--     'free-' || 'USER_UUID_HERE' || '-' || EXTRACT(EPOCH FROM NOW())::text,
--     'USER_UUID_HERE',
--     'free',
--     NOW(),
--     true,
--     'Restricted to free tier'
-- );

-- =====================================================
-- 8. EXAMPLE: BLOCK SPECIFIC FEATURE FOR A USER
-- =====================================================

-- To block a specific feature for a user, you would need to:
-- 1. Create a custom level for that user, OR
-- 2. Modify the level-feature mapping for their tier
--
-- Example: Block 'safe' feature for all free users
-- UPDATE myday_level_features
-- SET is_enabled = false
-- WHERE level_id = 'free' AND feature_id = 'safe';

-- =====================================================
-- DONE!
-- =====================================================
-- All users now have premium access to all features.
-- You can modify individual user assignments in the database
-- by updating myday_user_level_assignments table.
