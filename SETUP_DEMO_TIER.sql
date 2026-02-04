-- =====================================================
-- DEMO TIER SETUP
-- Create a restricted demo tier and assign leoplanner user to it
-- =====================================================

-- =====================================================
-- 1. CREATE DEMO LEVEL
-- =====================================================

INSERT INTO myday_user_levels (id, name, display_name, description, tier_order, color, icon, monthly_price, yearly_price, is_default)
VALUES (
    'demo',
    'demo',
    'Demo',
    'Read-only demo account with limited features',
    0, -- Lowest tier
    '#9ca3af', -- Gray color
    '👁️',
    0,
    0,
    false
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    tier_order = EXCLUDED.tier_order,
    color = EXCLUDED.color,
    icon = EXCLUDED.icon;

-- =====================================================
-- 2. DEMO TIER FEATURES (Very Limited)
-- =====================================================

-- First, remove any existing demo tier features
DELETE FROM myday_level_features WHERE level_id = 'demo';

-- Insert demo tier features (read-only, very limited)
INSERT INTO myday_level_features (level_id, feature_id, is_enabled, limit_value)
VALUES
    -- Core features (view only, cannot add)
    ('demo', 'tasks', true, 10),
    ('demo', 'events', true, 5),
    ('demo', 'journal', true, 5),
    ('demo', 'todos', true, 20),
    ('demo', 'items', true, 10),
    
    -- Advanced features (mostly disabled)
    ('demo', 'routines', false, NULL),
    ('demo', 'resolutions', true, 3), -- Can view sample resolutions
    ('demo', 'analytics', true, NULL), -- Can view analytics
    ('demo', 'safe', false, NULL), -- No safe access
    ('demo', 'documents', false, NULL),
    
    -- Premium features (all disabled)
    ('demo', 'voice_commands', false, NULL),
    ('demo', 'ai_insights', false, NULL),
    ('demo', 'sharing', false, NULL),
    ('demo', 'export', false, NULL),
    ('demo', 'themes', true, NULL), -- Basic themes only
    
    -- Limits (very restrictive)
    ('demo', 'task_limit', true, 10),
    ('demo', 'event_limit', true, 5),
    ('demo', 'journal_limit', true, 5),
    ('demo', 'safe_entries_limit', true, 0),
    ('demo', 'document_limit', true, 0);

-- =====================================================
-- 3. ASSIGN LEOPLANNER USER TO DEMO TIER
-- =====================================================

-- Get the leoplanner user ID
DO $$
DECLARE
    demo_user_id UUID;
BEGIN
    -- Find leoplanner user by email
    SELECT id INTO demo_user_id
    FROM auth.users
    WHERE email = 'leoplannerapp@gmail.com'
    LIMIT 1;

    IF demo_user_id IS NOT NULL THEN
        -- Remove any existing level assignments for this user
        DELETE FROM myday_user_level_assignments WHERE user_id = demo_user_id;
        
        -- Assign demo tier to leoplanner user
        INSERT INTO myday_user_level_assignments (
            id,
            user_id,
            level_id,
            assigned_at,
            expires_at,
            assigned_by,
            notes,
            is_active
        )
        VALUES (
            gen_random_uuid(),
            demo_user_id,
            'demo',
            NOW(),
            NULL, -- Never expires
            NULL,
            'Demo user - read-only access with limited features',
            true
        );
        
        RAISE NOTICE 'Successfully assigned leoplanner user (%) to demo tier', demo_user_id;
    ELSE
        RAISE NOTICE 'User leoplannerapp@gmail.com not found';
    END IF;
END $$;

-- =====================================================
-- 4. VERIFICATION
-- =====================================================

-- Show the demo user's current level
SELECT 
    u.email,
    u.id as user_id,
    ula.level_id,
    ul.display_name as level_name,
    ul.description,
    ula.assigned_at,
    ula.is_active
FROM auth.users u
LEFT JOIN myday_user_level_assignments ula ON u.id = ula.user_id
LEFT JOIN myday_user_levels ul ON ula.level_id = ul.id
WHERE u.email = 'leoplannerapp@gmail.com';

-- Show demo tier features
SELECT 
    lf.feature_id,
    f.display_name,
    lf.is_enabled,
    lf.limit_value
FROM myday_level_features lf
LEFT JOIN myday_features f ON lf.feature_id = f.id
WHERE lf.level_id = 'demo'
ORDER BY lf.feature_id;
