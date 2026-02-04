-- =====================================================
-- ASSIGN LEOPLANNER USER TO DEMO TIER (SIMPLE VERSION)
-- =====================================================

-- Step 1: Find the leoplanner user
SELECT 
    id as user_id,
    email,
    created_at
FROM auth.users
WHERE email = 'leoplannerapp@gmail.com';

-- Step 2: Delete existing assignment for leoplanner user
DELETE FROM myday_user_level_assignments
WHERE user_id IN (
    SELECT id FROM auth.users WHERE email = 'leoplannerapp@gmail.com'
);

-- Step 3: Insert new demo assignment
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
SELECT
    gen_random_uuid(),
    u.id,
    'demo',
    NOW(),
    NULL,
    NULL,
    'Demo user - restricted access',
    true
FROM auth.users u
WHERE u.email = 'leoplannerapp@gmail.com';

-- Step 4: Verify the assignment
SELECT 
    u.email,
    u.id as user_id,
    ula.level_id,
    ul.display_name as level_name,
    ula.assigned_at,
    ula.is_active
FROM auth.users u
LEFT JOIN myday_user_level_assignments ula ON u.id = ula.user_id
LEFT JOIN myday_user_levels ul ON ula.level_id = ul.id
WHERE u.email = 'leoplannerapp@gmail.com';

-- Step 5: Show ALL user assignments (to confirm others are still premium)
SELECT 
    u.email,
    ula.level_id,
    ul.display_name as level_name,
    ula.is_active
FROM auth.users u
LEFT JOIN myday_user_level_assignments ula ON u.id = ula.user_id
LEFT JOIN myday_user_levels ul ON ula.level_id = ul.id
ORDER BY u.email;
