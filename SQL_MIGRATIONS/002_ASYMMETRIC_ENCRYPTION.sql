-- =====================================================
-- MIGRATION 002: ASYMMETRIC ENCRYPTION (RSA)
-- =====================================================
-- Run this second
-- Adds RSA key pair support for secure group key exchange
-- =====================================================

-- =====================================================
-- 1. ADD RSA KEY COLUMNS TO MASTER KEYS TABLE
-- =====================================================

ALTER TABLE myday_safe_master_keys
ADD COLUMN IF NOT EXISTS public_key TEXT,
ADD COLUMN IF NOT EXISTS encrypted_private_key TEXT,
ADD COLUMN IF NOT EXISTS encrypted_private_key_iv TEXT;

COMMENT ON COLUMN myday_safe_master_keys.public_key IS
'RSA public key in PEM format. Used to encrypt group keys for this user.';

COMMENT ON COLUMN myday_safe_master_keys.encrypted_private_key IS
'RSA private key encrypted with user''s master password. User decrypts this to decrypt group keys.';

COMMENT ON COLUMN myday_safe_master_keys.encrypted_private_key_iv IS
'IV for the encrypted private key.';

-- =====================================================
-- 2. UPDATE GROUP ENCRYPTION KEY COMMENTS
-- =====================================================

COMMENT ON COLUMN myday_group_encryption_keys.encrypted_group_key IS
'Group AES key encrypted with recipient''s RSA public key. Recipient decrypts with their private key.';

COMMENT ON COLUMN myday_group_encryption_keys.encrypted_group_key_iv IS
'IV for the group key encryption. Note: RSA encryption may not use IV depending on padding scheme.';

-- =====================================================
-- 3. HELPER FUNCTIONS FOR RSA KEY MANAGEMENT
-- =====================================================

CREATE OR REPLACE FUNCTION get_user_public_key(user_uuid UUID)
RETURNS TEXT AS $$
BEGIN
    RETURN (
        SELECT public_key 
        FROM myday_safe_master_keys 
        WHERE user_id = user_uuid
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_group_member_public_keys(group_uuid TEXT)
RETURNS TABLE (
    user_id UUID,
    public_key TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gm.user_id,
        smk.public_key
    FROM myday_group_members gm
    JOIN myday_safe_master_keys smk ON smk.user_id = gm.user_id
    WHERE gm.group_id = group_uuid
    AND smk.public_key IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. RLS POLICY FOR PUBLIC KEY ACCESS
-- =====================================================

CREATE POLICY "Users can view public keys of group members"
    ON myday_safe_master_keys FOR SELECT
    USING (
        -- Users can see public keys of members in their groups
        EXISTS (
            SELECT 1 FROM myday_group_members gm1
            JOIN myday_group_members gm2 ON gm2.group_id = gm1.group_id
            WHERE gm1.user_id = auth.uid()
            AND gm2.user_id = myday_safe_master_keys.user_id
        )
        OR
        -- Users can see their own keys
        user_id = auth.uid()
    );

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Check if columns were added:
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'myday_safe_master_keys' 
-- AND column_name IN ('public_key', 'encrypted_private_key', 'encrypted_private_key_iv');
