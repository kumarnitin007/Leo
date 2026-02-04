-- Check if the group exists and if you're a member
-- Replace 'bc2b3b07-070d-4f49-aac4-82c9208fa968' with your user ID

-- 1. Check if group exists
SELECT 
    id,
    name,
    created_by,
    created_at
FROM myday_groups
WHERE id = '1769848601712-zjli9i7';

-- 2. Check if you're a member of this group
SELECT 
    gm.group_id,
    g.name as group_name,
    gm.user_id,
    u.email,
    gm.role,
    gm.joined_at
FROM myday_group_members gm
JOIN myday_groups g ON gm.group_id = g.id
JOIN auth.users u ON gm.user_id = u.id
WHERE gm.group_id = '1769848601712-zjli9i7'
AND gm.user_id = 'bc2b3b07-070d-4f49-aac4-82c9208fa968';

-- 3. Check all your groups
SELECT 
    g.id,
    g.name,
    gm.role,
    gm.joined_at
FROM myday_group_members gm
JOIN myday_groups g ON gm.group_id = g.id
WHERE gm.user_id = 'bc2b3b07-070d-4f49-aac4-82c9208fa968';

-- 4. Check if any group keys exist for you
SELECT 
    gek.group_id,
    g.name as group_name,
    gek.granted_at,
    gek.is_active,
    LENGTH(gek.encrypted_group_key) as key_length
FROM myday_group_encryption_keys gek
JOIN myday_groups g ON gek.group_id = g.id
WHERE gek.user_id = 'bc2b3b07-070d-4f49-aac4-82c9208fa968';
