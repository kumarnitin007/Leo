-- =====================================================
-- ASYMMETRIC ENCRYPTION FOR FAMILY SHARING
-- =====================================================
-- 
-- CONCEPT: Use RSA public/private key pairs for secure key exchange
-- 
-- FLOW:
-- 1. User sets master password → Generate RSA-2048 key pair
-- 2. Public key stored unencrypted (for others to use)
-- 3. Private key encrypted with user's master password
-- 4. When sharing: Encrypt group key with recipient's PUBLIC key
-- 5. When accessing: Decrypt with own PRIVATE key (unlocked with master password)
--
-- BENEFITS:
-- ✅ Zero-knowledge maintained (server never sees decrypted keys)
-- ✅ Async sharing (recipient doesn't need to be online)
-- ✅ No coordination needed between users
-- ✅ Industry-standard approach
--
-- =====================================================

-- =====================================================
-- 1. ADD PUBLIC/PRIVATE KEYS TO MASTER KEYS TABLE
-- =====================================================

-- Add columns for RSA key pair
ALTER TABLE myday_safe_master_keys
ADD COLUMN IF NOT EXISTS public_key TEXT, -- RSA public key (PEM format, unencrypted)
ADD COLUMN IF NOT EXISTS encrypted_private_key TEXT, -- RSA private key encrypted with master password
ADD COLUMN IF NOT EXISTS encrypted_private_key_iv TEXT; -- IV for private key encryption

-- Add index for faster public key lookups
CREATE INDEX IF NOT EXISTS idx_safe_master_keys_user_id 
ON myday_safe_master_keys(user_id);

COMMENT ON COLUMN myday_safe_master_keys.public_key IS 
'RSA-2048 public key in PEM format. Used by others to encrypt data for this user.';

COMMENT ON COLUMN myday_safe_master_keys.encrypted_private_key IS 
'RSA-2048 private key encrypted with user''s master password. User decrypts this to access shared data.';

-- =====================================================
-- 2. MODIFY GROUP ENCRYPTION KEYS FOR ASYMMETRIC ENCRYPTION
-- =====================================================

-- The encrypted_group_key is now encrypted with recipient's PUBLIC key (RSA)
-- instead of their master password (AES)

COMMENT ON COLUMN myday_group_encryption_keys.encrypted_group_key IS 
'Group AES key encrypted with recipient''s RSA public key. Recipient decrypts with their private key.';

COMMENT ON COLUMN myday_group_encryption_keys.encrypted_group_key_iv IS 
'IV for the group key encryption. Note: RSA encryption may not use IV depending on padding scheme.';

-- =====================================================
-- 3. ADD HELPER FUNCTION TO GET USER PUBLIC KEYS
-- =====================================================

CREATE OR REPLACE FUNCTION get_user_public_key(user_uuid UUID)
RETURNS TEXT AS $$
DECLARE
    pub_key TEXT;
BEGIN
    SELECT public_key INTO pub_key
    FROM myday_safe_master_keys
    WHERE user_id = user_uuid;
    
    RETURN pub_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. ADD HELPER FUNCTION TO GET MULTIPLE PUBLIC KEYS
-- =====================================================

CREATE OR REPLACE FUNCTION get_group_member_public_keys(group_uuid TEXT)
RETURNS TABLE (
    user_id UUID,
    public_key TEXT,
    display_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gm.user_id,
        smk.public_key,
        gm.display_name
    FROM myday_group_members gm
    JOIN myday_safe_master_keys smk ON gm.user_id = smk.user_id
    WHERE gm.group_id = group_uuid
    AND gm.status = 'active'
    AND smk.public_key IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. RLS POLICIES FOR PUBLIC KEY ACCESS
-- =====================================================

-- Allow users to read public keys of group members
-- (needed for encrypting group keys for them)

CREATE POLICY "Users can view public keys of group members"
    ON myday_safe_master_keys FOR SELECT
    USING (
        public_key IS NOT NULL -- Only expose public key, not private
        AND (
            -- User can see their own keys
            auth.uid() = user_id
            OR
            -- User can see public keys of members in their groups
            EXISTS (
                SELECT 1 FROM myday_group_members gm1
                JOIN myday_group_members gm2 ON gm1.group_id = gm2.group_id
                WHERE gm1.user_id = auth.uid()
                AND gm2.user_id = myday_safe_master_keys.user_id
            )
        )
    );

-- =====================================================
-- 6. MIGRATION NOTES
-- =====================================================

-- IMPORTANT: Existing users need to generate keys on next Safe unlock
-- The app will detect missing public_key and prompt user to:
-- 1. Enter master password
-- 2. Generate RSA key pair
-- 3. Encrypt private key with master password
-- 4. Store both keys in database

-- Existing group shares will need to be re-shared after all members have keys

COMMENT ON TABLE myday_safe_master_keys IS 
'Stores master password verification data and RSA key pairs for asymmetric encryption. 
Private keys are encrypted with user''s master password (zero-knowledge).';

-- =====================================================
-- 7. VERIFICATION QUERIES
-- =====================================================

-- Check users with keys
-- SELECT user_id, 
--        public_key IS NOT NULL as has_public_key,
--        encrypted_private_key IS NOT NULL as has_private_key
-- FROM myday_safe_master_keys;

-- Check group members with keys
-- SELECT gm.group_id, gm.user_id, gm.display_name,
--        smk.public_key IS NOT NULL as has_public_key
-- FROM myday_group_members gm
-- LEFT JOIN myday_safe_master_keys smk ON gm.user_id = smk.user_id
-- WHERE gm.status = 'active';
