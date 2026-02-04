-- =====================================================
-- FIND ALL USERS (to identify the demo user)
-- =====================================================

-- Show ALL users with their emails
SELECT 
    id,
    email,
    created_at,
    last_sign_in_at
FROM auth.users
ORDER BY created_at;

-- Show users with 'demo' in email
SELECT 
    id,
    email,
    created_at
FROM auth.users
WHERE email ILIKE '%demo%'
   OR email ILIKE '%leo%'
   OR email ILIKE '%test%';

-- Show all user level assignments
SELECT 
    u.email,
    ula.level_id,
    ul.display_name as level_name,
    ula.assigned_at
FROM myday_user_level_assignments ula
JOIN auth.users u ON ula.user_id = u.id
LEFT JOIN myday_user_levels ul ON ula.level_id = ul.id
ORDER BY u.email;
