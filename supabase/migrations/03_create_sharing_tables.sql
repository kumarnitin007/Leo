-- =====================================================
-- MIGRATION ORDER: 3 of 4
-- Run this file AFTER 02_create_todo_tables.sql
-- =====================================================
-- Sharing System Tables Migration
-- Tables: myday_groups, myday_group_members, myday_invitations,
--         myday_shared_safe_entries, myday_shared_documents
-- =====================================================

-- 1. Create myday_groups table (connection groups)
CREATE TABLE IF NOT EXISTS myday_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT '👥',
    color TEXT DEFAULT '#6366f1',
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    max_members INTEGER DEFAULT 5,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create myday_group_members table
CREATE TABLE IF NOT EXISTS myday_group_members (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES myday_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    display_name TEXT, -- User's display name in this group
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);

-- 3. Create myday_invitations table
CREATE TABLE IF NOT EXISTS myday_invitations (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES myday_groups(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- For existing users
    invited_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    -- For non-users (invite by email)
    invited_email TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
    message TEXT, -- Optional invitation message
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    -- Either user_id or email must be provided
    CONSTRAINT invitation_target CHECK (invited_user_id IS NOT NULL OR invited_email IS NOT NULL)
);

-- 4. Create myday_shared_safe_entries table
CREATE TABLE IF NOT EXISTS myday_shared_safe_entries (
    id TEXT PRIMARY KEY,
    safe_entry_id TEXT NOT NULL, -- Reference to the safe entry (from myday_safe_entries)
    group_id TEXT NOT NULL REFERENCES myday_groups(id) ON DELETE CASCADE,
    shared_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    share_mode TEXT DEFAULT 'readonly' CHECK (share_mode IN ('readonly', 'copy')),
    -- copy mode = can copy to local DB; readonly = view only, no copy
    shared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ, -- Optional expiration
    revoked_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(safe_entry_id, group_id)
);

-- 5. Create myday_shared_documents table
CREATE TABLE IF NOT EXISTS myday_shared_documents (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL, -- Reference to the document vault entry
    group_id TEXT NOT NULL REFERENCES myday_groups(id) ON DELETE CASCADE,
    shared_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    share_mode TEXT DEFAULT 'readonly' CHECK (share_mode IN ('readonly', 'copy')),
    shared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(document_id, group_id)
);

-- 6. Create myday_entry_copies table (track who copied what)
CREATE TABLE IF NOT EXISTS myday_entry_copies (
    id TEXT PRIMARY KEY,
    original_entry_id TEXT NOT NULL,
    original_owner_id UUID NOT NULL REFERENCES auth.users(id),
    copied_entry_id TEXT NOT NULL, -- The new entry ID in copier's local DB
    copied_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    entry_type TEXT NOT NULL CHECK (entry_type IN ('safe_entry', 'document')),
    copied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_groups_created_by ON myday_groups(created_by);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON myday_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON myday_group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_invitations_group_id ON myday_invitations(group_id);
CREATE INDEX IF NOT EXISTS idx_invitations_invited_user ON myday_invitations(invited_user_id);
CREATE INDEX IF NOT EXISTS idx_invitations_invited_email ON myday_invitations(invited_email);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON myday_invitations(status);
CREATE INDEX IF NOT EXISTS idx_shared_safe_group ON myday_shared_safe_entries(group_id);
CREATE INDEX IF NOT EXISTS idx_shared_safe_entry ON myday_shared_safe_entries(safe_entry_id);
CREATE INDEX IF NOT EXISTS idx_shared_docs_group ON myday_shared_documents(group_id);
CREATE INDEX IF NOT EXISTS idx_shared_docs_doc ON myday_shared_documents(document_id);

-- 8. Enable Row Level Security (RLS)
ALTER TABLE myday_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE myday_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE myday_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE myday_shared_safe_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE myday_shared_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE myday_entry_copies ENABLE ROW LEVEL SECURITY;

-- 9. RLS Policies for myday_groups (safe - ignores if exists)
DO $$ BEGIN
    CREATE POLICY "Users can view groups they belong to" ON myday_groups FOR SELECT
    USING (id IN (SELECT group_id FROM myday_group_members WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can create groups" ON myday_groups FOR INSERT WITH CHECK (auth.uid() = created_by);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Only owner can update group" ON myday_groups FOR UPDATE
    USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Only owner can delete group" ON myday_groups FOR DELETE USING (created_by = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 10. RLS Policies for myday_group_members (safe)
DO $$ BEGIN
    CREATE POLICY "Members can view group members" ON myday_group_members FOR SELECT
    USING (group_id IN (SELECT group_id FROM myday_group_members WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Group owner/admin can add members" ON myday_group_members FOR INSERT
    WITH CHECK (
        group_id IN (SELECT group_id FROM myday_group_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
        OR auth.uid() = user_id
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Group owner can update members" ON myday_group_members FOR UPDATE
    USING (group_id IN (SELECT group_id FROM myday_group_members WHERE user_id = auth.uid() AND role = 'owner'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Members can leave group" ON myday_group_members FOR DELETE
    USING (user_id = auth.uid() OR group_id IN (SELECT group_id FROM myday_group_members WHERE user_id = auth.uid() AND role = 'owner'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 11. RLS Policies for myday_invitations (safe)
DO $$ BEGIN
    CREATE POLICY "Users can view invitations they sent or received" ON myday_invitations FOR SELECT
    USING (invited_by = auth.uid() OR invited_user_id = auth.uid() OR invited_email IN (SELECT email FROM auth.users WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Group members can create invitations" ON myday_invitations FOR INSERT
    WITH CHECK (group_id IN (SELECT group_id FROM myday_group_members WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Inviter or invitee can update invitation" ON myday_invitations FOR UPDATE
    USING (invited_by = auth.uid() OR invited_user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Inviter can delete invitation" ON myday_invitations FOR DELETE USING (invited_by = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 12. RLS Policies for myday_shared_safe_entries (safe)
DO $$ BEGIN
    CREATE POLICY "Users can view shared entries for their groups" ON myday_shared_safe_entries FOR SELECT
    USING (group_id IN (SELECT group_id FROM myday_group_members WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Entry owner can share" ON myday_shared_safe_entries FOR INSERT WITH CHECK (shared_by = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Entry owner can update share" ON myday_shared_safe_entries FOR UPDATE USING (shared_by = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Entry owner can revoke share" ON myday_shared_safe_entries FOR DELETE USING (shared_by = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 13. RLS Policies for myday_shared_documents (safe)
DO $$ BEGIN
    CREATE POLICY "Users can view shared documents for their groups" ON myday_shared_documents FOR SELECT
    USING (group_id IN (SELECT group_id FROM myday_group_members WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Document owner can share" ON myday_shared_documents FOR INSERT WITH CHECK (shared_by = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Document owner can update share" ON myday_shared_documents FOR UPDATE USING (shared_by = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Document owner can revoke share" ON myday_shared_documents FOR DELETE USING (shared_by = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 14. RLS Policies for myday_entry_copies (safe)
DO $$ BEGIN
    CREATE POLICY "Users can view their copies" ON myday_entry_copies FOR SELECT
    USING (copied_by = auth.uid() OR original_owner_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can create copies" ON myday_entry_copies FOR INSERT WITH CHECK (copied_by = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 15. Triggers for updated_at
DROP TRIGGER IF EXISTS update_groups_updated_at ON myday_groups;
CREATE TRIGGER update_groups_updated_at
    BEFORE UPDATE ON myday_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- DONE! Run migration 04 next.
-- =====================================================
