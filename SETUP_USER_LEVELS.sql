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
    id SERIAL PRIMARY KEY,
    level_id TEXT NOT NULL,
    feature_id TEXT NOT NULL,
    is_enabled BOOLEAN DEFAULT true,
    limit_value INTEGER, -- NULL = unlimited, number = max count
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(level_id, feature_id)
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
INSERT INTO myday_level_features (id, level_id, feature_id, is_enabled, limit_value)
VALUES
    -- Core features (limited)
    (DEFAULT, 'free', 'tasks', true, 50),
    (DEFAULT, 'free', 'events', true, 20),
    (DEFAULT, 'free', 'journal', true, 30),
    (DEFAULT, 'free', 'todos', true, 100),
    (DEFAULT, 'free', 'items', true, 50),
    
    -- Advanced features (disabled or limited)
    (DEFAULT, 'free', 'routines', false, NULL),
    (DEFAULT, 'free', 'resolutions', false, NULL),
    (DEFAULT, 'free', 'analytics', true, NULL), -- Basic analytics
    (DEFAULT, 'free', 'safe', true, 10),
    (DEFAULT, 'free', 'documents', false, NULL),
    
    -- Premium features (disabled)
    (DEFAULT, 'free', 'voice_commands', false, NULL),
    (DEFAULT, 'free', 'ai_insights', false, NULL),
    (DEFAULT, 'free', 'sharing', false, NULL),
    (DEFAULT, 'free', 'export', false, NULL),
    (DEFAULT, 'free', 'themes', true, NULL), -- Basic themes only
    
    -- Limits
    (DEFAULT, 'free', 'task_limit', true, 50),
    (DEFAULT, 'free', 'event_limit', true, 20),
    (DEFAULT, 'free', 'journal_limit', true, 30),
    (DEFAULT, 'free', 'safe_entries_limit', true, 10),
    (DEFAULT, 'free', 'document_limit', true, 0);

-- BASIC TIER - More features, higher limits
INSERT INTO myday_level_features (id, level_id, feature_id, is_enabled, limit_value)
VALUES
    -- Core features (higher limits)
    (DEFAULT, 'basic', 'tasks', true, 200),
    (DEFAULT, 'basic', 'events', true, 100),
    (DEFAULT, 'basic', 'journal', true, 100),
    (DEFAULT, 'basic', 'todos', true, 500),
    (DEFAULT, 'basic', 'items', true, 200),
    
    -- Advanced features (enabled)
    (DEFAULT, 'basic', 'routines', true, NULL),
    (DEFAULT, 'basic', 'resolutions', true, NULL),
    (DEFAULT, 'basic', 'analytics', true, NULL),
    (DEFAULT, 'basic', 'safe', true, 50),
    (DEFAULT, 'basic', 'documents', true, 20),
    
    -- Premium features (some enabled)
    (DEFAULT, 'basic', 'voice_commands', true, NULL),
    (DEFAULT, 'basic', 'ai_insights', false, NULL),
    (DEFAULT, 'basic', 'sharing', false, NULL),
    (DEFAULT, 'basic', 'export', true, NULL),
    (DEFAULT, 'basic', 'themes', true, NULL),
    
    -- Limits
    (DEFAULT, 'basic', 'task_limit', true, 200),
    (DEFAULT, 'basic', 'event_limit', true, 100),
    (DEFAULT, 'basic', 'journal_limit', true, 100),
    (DEFAULT, 'basic', 'safe_entries_limit', true, 50),
    (DEFAULT, 'basic', 'document_limit', true, 20);

-- PRO TIER - Professional features, very high limits
INSERT INTO myday_level_features (id, level_id, feature_id, is_enabled, limit_value)
VALUES
    -- Core features (very high limits)
    (DEFAULT, 'pro', 'tasks', true, 1000),
    (DEFAULT, 'pro', 'events', true, 500),
    (DEFAULT, 'pro', 'journal', true, 500),
    (DEFAULT, 'pro', 'todos', true, 2000),
    (DEFAULT, 'pro', 'items', true, 1000),
    
    -- Advanced features (all enabled)
    (DEFAULT, 'pro', 'routines', true, NULL),
    (DEFAULT, 'pro', 'resolutions', true, NULL),
    (DEFAULT, 'pro', 'analytics', true, NULL),
    (DEFAULT, 'pro', 'safe', true, 200),
    (DEFAULT, 'pro', 'documents', true, 100),
    
    -- Premium features (most enabled)
    (DEFAULT, 'pro', 'voice_commands', true, NULL),
    (DEFAULT, 'pro', 'ai_insights', true, NULL),
    (DEFAULT, 'pro', 'sharing', true, NULL),
    (DEFAULT, 'pro', 'export', true, NULL),
    (DEFAULT, 'pro', 'themes', true, NULL),
    
    -- Limits
    (DEFAULT, 'pro', 'task_limit', true, 1000),
    (DEFAULT, 'pro', 'event_limit', true, 500),
    (DEFAULT, 'pro', 'journal_limit', true, 500),
    (DEFAULT, 'pro', 'safe_entries_limit', true, 200),
    (DEFAULT, 'pro', 'document_limit', true, 100);

-- PREMIUM TIER - All features unlimited
INSERT INTO myday_level_features (id, level_id, feature_id, is_enabled, limit_value)
VALUES
    -- Core features (unlimited)
    (DEFAULT, 'premium', 'tasks', true, NULL),
    (DEFAULT, 'premium', 'events', true, NULL),
    (DEFAULT, 'premium', 'journal', true, NULL),
    (DEFAULT, 'premium', 'todos', true, NULL),
    (DEFAULT, 'premium', 'items', true, NULL),
    
    -- Advanced features (all enabled, unlimited)
    (DEFAULT, 'premium', 'routines', true, NULL),
    (DEFAULT, 'premium', 'resolutions', true, NULL),
    (DEFAULT, 'premium', 'analytics', true, NULL),
    (DEFAULT, 'premium', 'safe', true, NULL),
    (DEFAULT, 'premium', 'documents', true, NULL),
    
    -- Premium features (all enabled)
    (DEFAULT, 'premium', 'voice_commands', true, NULL),
    (DEFAULT, 'premium', 'ai_insights', true, NULL),
    (DEFAULT, 'premium', 'sharing', true, NULL),
    (DEFAULT, 'premium', 'export', true, NULL),
    (DEFAULT, 'premium', 'themes', true, NULL),
    
    -- Limits (unlimited)
    (DEFAULT, 'premium', 'task_limit', true, NULL),
    (DEFAULT, 'premium', 'event_limit', true, NULL),
    (DEFAULT, 'premium', 'journal_limit', true, NULL),
    (DEFAULT, 'premium', 'safe_entries_limit', true, NULL),
    (DEFAULT, 'premium', 'document_limit', true, NULL);

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
