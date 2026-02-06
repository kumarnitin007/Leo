-- =====================================================
-- MIGRATION 001: FAMILY SHARING DB IMPROVEMENTS
-- =====================================================
-- Run this first if not already run
-- This sets up the base group encryption and sharing tables
-- =====================================================

-- =====================================================
-- 1. ADD GROUP ENCRYPTION KEY TABLE
-- =====================================================

-- Store encrypted group keys (encrypted with each member's master password)
CREATE TABLE IF NOT EXISTS myday_group_encryption_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id TEXT NOT NULL REFERENCES myday_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- The group's encryption key, encrypted with this user's master key
    -- When user unlocks their safe, they can decrypt this to get the group key
    encrypted_group_key TEXT NOT NULL,
    encrypted_group_key_iv TEXT NOT NULL,
    
    -- Access control
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- When this member got the key
    revoked_at TIMESTAMPTZ, -- Set when member is removed
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(group_id, user_id)
);

-- Enable RLS
ALTER TABLE myday_group_encryption_keys ENABLE ROW LEVEL SECURITY;

-- Users can only see their own group keys
CREATE POLICY "Users can view their own group keys"
    ON myday_group_encryption_keys FOR SELECT
    USING (user_id = auth.uid());

-- Users can insert their own group keys
CREATE POLICY "Users can insert their own group keys"
    ON myday_group_encryption_keys FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Group owners/admins can insert keys for members
CREATE POLICY "Group admins can insert member keys"
    ON myday_group_encryption_keys FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM myday_group_members
            WHERE group_id = myday_group_encryption_keys.group_id
            AND user_id = auth.uid()
            AND role IN ('owner', 'admin')
        )
    );

-- =====================================================
-- 2. MODIFY SHARED ENTRIES TO STORE GROUP-ENCRYPTED DATA
-- =====================================================

-- Add columns to store the entry encrypted with group key
ALTER TABLE myday_shared_safe_entries
ADD COLUMN IF NOT EXISTS group_encrypted_data TEXT,
ADD COLUMN IF NOT EXISTS group_encrypted_data_iv TEXT,
ADD COLUMN IF NOT EXISTS entry_title TEXT, -- Store title so recipients can see it without RLS access to parent entry
ADD COLUMN IF NOT EXISTS entry_category TEXT; -- Store category so recipients can filter/view by category

-- The sharer will:
-- 1. Decrypt entry with their master key
-- 2. Re-encrypt with group key
-- 3. Store in group_encrypted_data

-- The recipient will:
-- 1. Decrypt group key with their master key
-- 2. Use group key to decrypt group_encrypted_data
-- 3. View the full entry (username, password, notes, etc.)

-- =====================================================
-- 3. ADD HELPER FUNCTION TO GET USER'S GROUP KEYS
-- =====================================================

CREATE OR REPLACE FUNCTION get_user_group_keys(user_uuid UUID)
RETURNS TABLE (
    group_id TEXT,
    group_name TEXT,
    encrypted_group_key TEXT,
    encrypted_group_key_iv TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gek.group_id,
        g.name as group_name,
        gek.encrypted_group_key,
        gek.encrypted_group_key_iv
    FROM myday_group_encryption_keys gek
    JOIN myday_groups g ON g.id = gek.group_id
    WHERE gek.user_id = user_uuid
    AND gek.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Check if tables exist:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN ('myday_group_encryption_keys');
