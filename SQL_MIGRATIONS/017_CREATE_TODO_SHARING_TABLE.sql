-- =====================================================
-- TODO SHARING: Create Table
-- =====================================================
-- Create the myday_shared_todo_groups table
-- =====================================================

-- ============================================================================
-- CREATE SHARED TODO GROUPS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS myday_shared_todo_groups (
  id TEXT PRIMARY KEY,
  todo_group_id TEXT NOT NULL REFERENCES myday_todo_groups(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES myday_groups(id) ON DELETE CASCADE,
  shared_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_mode TEXT NOT NULL CHECK (share_mode IN ('readonly', 'editable')),
  shared_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  UNIQUE(todo_group_id, group_id)
);

-- ============================================================================
-- CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_shared_todo_groups_todo_group_id 
  ON myday_shared_todo_groups(todo_group_id);

CREATE INDEX IF NOT EXISTS idx_shared_todo_groups_group_id 
  ON myday_shared_todo_groups(group_id);

CREATE INDEX IF NOT EXISTS idx_shared_todo_groups_shared_by 
  ON myday_shared_todo_groups(shared_by);

CREATE INDEX IF NOT EXISTS idx_shared_todo_groups_is_active 
  ON myday_shared_todo_groups(is_active);

-- ============================================================================
-- ENABLE RLS
-- ============================================================================

ALTER TABLE myday_shared_todo_groups ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- VALIDATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ TODO Sharing table created successfully';
END $$;
