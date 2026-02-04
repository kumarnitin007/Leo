-- =====================================================
-- IMPROVED FAMILY PASSWORD SHARING ARCHITECTURE
-- =====================================================
-- 
-- CONCEPT: Simple hybrid encryption model
-- 1. User's own entries: Encrypted with their master password
-- 2. Shared entries: Encrypted with group key (group key encrypted per-member)
-- 3. Everyone in group sees ALL shares (no restrictions)
--
-- USE CASES HANDLED:
-- ✅ Share existing entry (decrypt with master, re-encrypt with group key)
-- ✅ Add new member (encrypt group key for them, they see ALL shares)
-- ✅ Update shared entry (re-encrypt with same group key, all see updates)
-- ✅ Remove member (mark their group key as revoked, they lose access)
--
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
    USING (auth.uid() = user_id);

CREATE POLICY "Group admins can insert group keys for members"
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
ADD COLUMN IF NOT EXISTS group_encrypted_data_iv TEXT;

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
    JOIN myday_groups g ON gek.group_id = g.id
    WHERE gek.user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. VERIFICATION QUERIES
-- =====================================================

-- Check if group keys table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'myday_group_encryption_keys'
);

-- View all group keys (for debugging)
SELECT 
    g.name as group_name,
    u.email as user_email,
    gek.created_at
FROM myday_group_encryption_keys gek
JOIN myday_groups g ON gek.group_id = g.id
JOIN auth.users u ON gek.user_id = u.id
ORDER BY g.name, u.email;

-- =====================================================
-- IMPLEMENTATION FLOW & USE CASES
-- =====================================================
/*

═══════════════════════════════════════════════════════════
USE CASE 1: SHARE EXISTING ENTRY AFTER 5 DAYS
═══════════════════════════════════════════════════════════

DAY 1: User1 creates "Netflix Password"
-----------------------------------------------
1. User1 creates entry in their Safe
2. Entry encrypted with User1's master key
3. Stored in myday_safe_entries (NOT shared yet)
   - encrypted_data: [encrypted with User1's key]
   - encrypted_data_iv: [IV]

DAY 5: User1 shares "Netflix" with "Family" group
-----------------------------------------------
1. User1 opens Safe, unlocks with master password
   → Master key is in memory (CryptoKey object)

2. User1 decrypts "Netflix" entry with master key
   → Gets plain text: { username, password, notes, ... }

3. User1 decrypts "Family" group key with master key
   → Gets group encryption key (CryptoKey)

4. User1 re-encrypts entry data with GROUP key
   → New encrypted blob: group_encrypted_data

5. Create record in myday_shared_safe_entries:
   INSERT INTO myday_shared_safe_entries (
     safe_entry_id: 'netflix-id',
     group_id: 'family',
     group_encrypted_data: '[encrypted with group key]',
     group_encrypted_data_iv: '[IV]',
     shared_by: user1_id,
     share_mode: 'readonly'
   )

RESULT:
✅ Original entry in myday_safe_entries: Still encrypted with User1's key
✅ Shared entry in myday_shared_safe_entries: Encrypted with group key
✅ All Family members can now decrypt and view full details
✅ User1 can update original entry, then re-share updated version


═══════════════════════════════════════════════════════════
USE CASE 2: ADD NEW MEMBER TO GROUP
═══════════════════════════════════════════════════════════

SCENARIO: "Family" group has User1 & User2, adding User3 on Day 10

SIMPLE APPROACH: New Member Sees Everything
-----------------------------------------------
1. User1 (admin) adds User3 to group

2. System does:
   a) Get existing "Family" group key (encrypted for User1)
   b) User1 decrypts group key with their master key
   c) Re-encrypt group key with User3's master key
   d) Store in myday_group_encryption_keys:
      INSERT (
        group_id: 'family',
        user_id: user3_id,
        encrypted_group_key: '[encrypted for User3]',
        granted_at: NOW(),
        is_active: true
      )

3. User3 now:
   ✅ Decrypts group key with their master key
   ✅ Sees ALL existing shared entries (including old ones)
   ✅ Can decrypt "Netflix" even though shared 5 days before they joined
   ✅ Can decrypt "Amazon", "Hulu", everything in the group

PHILOSOPHY: If you're adding someone to the group, you trust them.
No complicated restrictions - everyone sees everything in the group.


═══════════════════════════════════════════════════════════
USE CASE 3: UPDATE SHARED ENTRY
═══════════════════════════════════════════════════════════

DAY 15: User1 changes Netflix password
-----------------------------------------------
1. User1 updates entry in their own Safe
   - Decrypts with master key
   - Changes password
   - Re-encrypts with master key
   - Updates myday_safe_entries

2. User1 updates the share:
   - Decrypts entry with master key (gets new password)
   - Decrypts group key with master key
   - Re-encrypts entry with GROUP key
   - UPDATE myday_shared_safe_entries
     SET group_encrypted_data = '[new encrypted data]',
         updated_at = NOW()

3. All members (User2, User3) immediately see new password
   ✅ No re-sharing needed
   ✅ Same group key works


═══════════════════════════════════════════════════════════
USE CASE 4: REMOVE MEMBER FROM GROUP
═══════════════════════════════════════════════════════════

DAY 20: Remove User3 from group
-----------------------------------------------
1. User1 (admin) removes User3

2. System does:
   UPDATE myday_group_encryption_keys
   SET is_active = false,
       revoked_at = NOW()
   WHERE user_id = user3_id
     AND group_id = 'family'

3. User3:
   ❌ Can no longer decrypt group key (marked as revoked)
   ❌ Cannot view any shared entries
   ✅ Their own personal entries remain unaffected


═══════════════════════════════════════════════════════════
SECURITY CONSIDERATIONS
═══════════════════════════════════════════════════════════

Q: What if User3 saved passwords before removal?
A: They could have. This is inherent to sharing.
   - Only add trusted members to groups
   - Change passwords after removing member if needed

Q: Can server admin see passwords?
A: No. All encryption/decryption happens client-side.
   Server only stores encrypted blobs and encrypted keys.

Q: What if User1's master password is compromised?
A: Attacker gets:
   - User1's personal entries
   - Group keys User1 has access to
   - All shares in those groups
   Does NOT get:
   - Other users' personal entries
   - Groups User1 is not part of


═══════════════════════════════════════════════════════════
BENEFITS OF THIS APPROACH
═══════════════════════════════════════════════════════════

✅ Share existing entries (decrypt → re-encrypt with group key)
✅ Add new members easily (everyone sees everything)
✅ Full decryption - recipients see complete details
✅ Simple - no complicated access restrictions
✅ Zero-knowledge - server never sees plaintext
✅ Maintainable - update once, all members see it
✅ Secure - each user needs own master password
✅ Flexible - different groups for different purposes

*/
