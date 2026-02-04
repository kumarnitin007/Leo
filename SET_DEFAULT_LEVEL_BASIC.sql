-- =====================================================
-- SET DEFAULT LEVEL TO BASIC FOR NEW USERS
-- =====================================================

-- Update the myday_user_levels table to set 'basic' as default
UPDATE myday_user_levels
SET is_default = false
WHERE id != 'basic';

UPDATE myday_user_levels
SET is_default = true
WHERE id = 'basic';

-- Verify the change
SELECT 
    id,
    display_name,
    tier_order,
    is_default
FROM myday_user_levels
ORDER BY tier_order;

-- =====================================================
-- CREATE TRIGGER TO AUTO-ASSIGN BASIC LEVEL TO NEW USERS
-- =====================================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS auto_assign_user_level ON auth.users;
DROP FUNCTION IF EXISTS assign_default_user_level();

-- Create function to assign default level
CREATE OR REPLACE FUNCTION assign_default_user_level()
RETURNS TRIGGER AS $$
DECLARE
    default_level_id TEXT;
BEGIN
    -- Get the default level (should be 'basic')
    SELECT id INTO default_level_id
    FROM myday_user_levels
    WHERE is_default = true
    LIMIT 1;

    -- If no default found, use 'basic'
    IF default_level_id IS NULL THEN
        default_level_id := 'basic';
    END IF;

    -- Insert level assignment for new user
    INSERT INTO myday_user_level_assignments (
        id,
        user_id,
        level_id,
        assigned_at,
        expires_at,
        is_active,
        notes
    )
    VALUES (
        gen_random_uuid(),
        NEW.id,
        default_level_id,
        NOW(),
        NULL, -- Never expires
        true,
        'Auto-assigned on signup'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users table
CREATE TRIGGER auto_assign_user_level
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION assign_default_user_level();

-- =====================================================
-- ASSIGN BASIC TO EXISTING USERS WITHOUT A LEVEL
-- =====================================================

-- Find users without level assignments
INSERT INTO myday_user_level_assignments (
    id,
    user_id,
    level_id,
    assigned_at,
    expires_at,
    is_active,
    notes
)
SELECT
    gen_random_uuid(),
    u.id,
    'basic',
    NOW(),
    NULL,
    true,
    'Backfilled to basic tier'
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 
    FROM myday_user_level_assignments ula 
    WHERE ula.user_id = u.id
);

-- Verify all users now have a level
SELECT 
    u.email,
    COALESCE(ul.display_name, 'NO LEVEL') as level_name,
    ula.assigned_at
FROM auth.users u
LEFT JOIN myday_user_level_assignments ula ON u.id = ula.user_id AND ula.is_active = true
LEFT JOIN myday_user_levels ul ON ula.level_id = ul.id
ORDER BY u.created_at DESC;
