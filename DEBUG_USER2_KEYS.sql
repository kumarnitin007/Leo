-- Debug User2's group encryption keys
-- User2 ID: 09118e02-d4c6-4ff4-a5aa-f096d7c952e7

-- 1. Check if User2 has group keys
SELECT 
    gek.id,
    gek.group_id,
    g.name as group_name,
    gek.user_id,
    LENGTH(gek.encrypted_group_key) as key_length,
    LENGTH(gek.encrypted_group_key_iv) as iv_length,
    gek.is_active,
    gek.granted_at
FROM myday_group_encryption_keys gek
LEFT JOIN myday_groups g ON gek.group_id = g.id
WHERE gek.user_id = '09118e02-d4c6-4ff4-a5aa-f096d7c952e7';

-- 2. Check if User2 is a member of any groups
SELECT 
    gm.group_id,
    g.name as group_name,
    gm.role,
    gm.joined_at
FROM myday_group_members gm
JOIN myday_groups g ON gm.group_id = g.id
WHERE gm.user_id = '09118e02-d4c6-4ff4-a5aa-f096d7c952e7';

-- 3. Check shared entries for User2
SELECT 
    sse.id,
    sse.group_id,
    g.name as group_name,
    se.title as entry_title,
    LENGTH(sse.group_encrypted_data) as encrypted_length,
    sse.share_mode,
    sse.shared_at
FROM myday_shared_safe_entries sse
JOIN myday_groups g ON sse.group_id = g.id
LEFT JOIN myday_safe_entries se ON sse.safe_entry_id = se.id
WHERE sse.group_id IN (
    SELECT group_id FROM myday_group_members 
    WHERE user_id = '09118e02-d4c6-4ff4-a5aa-f096d7c952e7'
)
AND sse.is_active = true;

-- 4. CRITICAL: Check if the group key query works with RLS
-- This simulates what the app does
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims.sub TO '09118e02-d4c6-4ff4-a5aa-f096d7c952e7';

SELECT 
    group_id, 
    encrypted_group_key, 
    encrypted_group_key_iv
FROM myday_group_encryption_keys
WHERE user_id = '09118e02-d4c6-4ff4-a5aa-f096d7c952e7'
AND is_active = true;

RESET ROLE;
