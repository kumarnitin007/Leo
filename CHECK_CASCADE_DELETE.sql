-- Check if myday_shared_safe_entries has CASCADE DELETE on safe_entry_id

-- 1. Check the foreign key constraint
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.table_name = 'myday_shared_safe_entries'
AND kcu.column_name = 'safe_entry_id';

-- 2. If no CASCADE, add it
-- Uncomment and run if delete_rule is 'NO ACTION' or 'RESTRICT':

/*
-- First, drop the old constraint (replace constraint_name with actual name from query above)
ALTER TABLE myday_shared_safe_entries 
DROP CONSTRAINT IF EXISTS myday_shared_safe_entries_safe_entry_id_fkey;

-- Add new constraint with CASCADE DELETE
ALTER TABLE myday_shared_safe_entries
ADD CONSTRAINT myday_shared_safe_entries_safe_entry_id_fkey
FOREIGN KEY (safe_entry_id) 
REFERENCES myday_safe_entries(id) 
ON DELETE CASCADE;
*/
