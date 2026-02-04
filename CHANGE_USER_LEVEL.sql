-- =====================================================
-- CHANGE USER LEVEL (MANUAL SCRIPT)
-- =====================================================

-- =====================================================
-- STEP 1: VIEW ALL USERS AND THEIR CURRENT LEVELS
-- =====================================================

SELECT 
    u.id,
    u.email,
    ul.id as current_level_id,
    ul.display_name as current_level,
    ul.tier_order,
    ula.assigned_at,
    ula.expires_at
FROM auth.users u
LEFT JOIN myday_user_level_assignments ula ON u.id = ula.user_id AND ula.is_active = true
LEFT JOIN myday_user_levels ul ON ula.level_id = ul.id
ORDER BY u.email;

-- =====================================================
-- STEP 2: VIEW AVAILABLE LEVELS
-- =====================================================

SELECT 
    id,
    display_name,
    description,
    tier_order,
    icon,
    monthly_price,
    yearly_price
FROM myday_user_levels
ORDER BY tier_order;

-- =====================================================
-- STEP 3: CHANGE A USER'S LEVEL
-- =====================================================

-- INSTRUCTIONS:
-- 1. Copy the block below
-- 2. Replace 'USER_EMAIL_HERE' with the actual user email
-- 3. Replace 'NEW_LEVEL_ID' with one of: 'demo', 'free', 'basic', 'pro', 'premium'
-- 4. Optionally add notes and expiration date
-- 5. Run the query

DO $$
DECLARE
    target_user_id UUID;
    new_level TEXT := 'basic'; -- CHANGE THIS: 'demo', 'free', 'basic', 'pro', 'premium'
    user_email TEXT := 'user@example.com'; -- CHANGE THIS to actual email
    expiration_date TIMESTAMPTZ := NULL; -- OPTIONAL: Set expiration like '2026-12-31'::TIMESTAMPTZ
    assignment_notes TEXT := 'Manual level change'; -- OPTIONAL: Add notes
BEGIN
    -- Find user by email
    SELECT id INTO target_user_id
    FROM auth.users
    WHERE email = user_email;

    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'User not found: %', user_email;
    END IF;

    -- Deactivate existing assignments
    UPDATE myday_user_level_assignments
    SET is_active = false
    WHERE user_id = target_user_id;

    -- Create new assignment
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
        target_user_id,
        new_level,
        NOW(),
        expiration_date,
        true,
        assignment_notes
    );

    RAISE NOTICE 'Successfully changed % to % level', user_email, new_level;
END $$;

-- =====================================================
-- STEP 4: VERIFY THE CHANGE
-- =====================================================

SELECT 
    u.email,
    ul.display_name as new_level,
    ul.icon,
    ula.assigned_at,
    ula.expires_at,
    ula.notes
FROM auth.users u
JOIN myday_user_level_assignments ula ON u.id = ula.user_id
JOIN myday_user_levels ul ON ula.level_id = ul.id
WHERE ula.is_active = true
ORDER BY u.email;

-- =====================================================
-- QUICK CHANGE EXAMPLES (Copy & Modify as needed)
-- =====================================================

-- Example 1: Change user to PREMIUM
/*
DO $$
DECLARE target_user_id UUID;
BEGIN
    SELECT id INTO target_user_id FROM auth.users WHERE email = 'user@example.com';
    UPDATE myday_user_level_assignments SET is_active = false WHERE user_id = target_user_id;
    INSERT INTO myday_user_level_assignments (id, user_id, level_id, assigned_at, is_active, notes)
    VALUES (gen_random_uuid(), target_user_id, 'premium', NOW(), true, 'Upgraded to premium');
END $$;
*/

-- Example 2: Change user to DEMO (read-only)
/*
DO $$
DECLARE target_user_id UUID;
BEGIN
    SELECT id INTO target_user_id FROM auth.users WHERE email = 'demo@example.com';
    UPDATE myday_user_level_assignments SET is_active = false WHERE user_id = target_user_id;
    INSERT INTO myday_user_level_assignments (id, user_id, level_id, assigned_at, is_active, notes)
    VALUES (gen_random_uuid(), target_user_id, 'demo', NOW(), true, 'Demo account');
END $$;
*/

-- Example 3: Change user to PRO with expiration
/*
DO $$
DECLARE target_user_id UUID;
BEGIN
    SELECT id INTO target_user_id FROM auth.users WHERE email = 'user@example.com';
    UPDATE myday_user_level_assignments SET is_active = false WHERE user_id = target_user_id;
    INSERT INTO myday_user_level_assignments (id, user_id, level_id, assigned_at, expires_at, is_active, notes)
    VALUES (gen_random_uuid(), target_user_id, 'pro', NOW(), '2026-12-31'::TIMESTAMPTZ, true, '1 year pro subscription');
END $$;
*/

-- Example 4: Bulk change multiple users to BASIC
/*
DO $$
DECLARE
    user_record RECORD;
BEGIN
    FOR user_record IN 
        SELECT id FROM auth.users WHERE email IN ('user1@example.com', 'user2@example.com', 'user3@example.com')
    LOOP
        UPDATE myday_user_level_assignments SET is_active = false WHERE user_id = user_record.id;
        INSERT INTO myday_user_level_assignments (id, user_id, level_id, assigned_at, is_active, notes)
        VALUES (gen_random_uuid(), user_record.id, 'basic', NOW(), true, 'Bulk update to basic');
    END LOOP;
END $$;
*/
