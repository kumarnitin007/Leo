-- =====================================================
-- TODO SHARING: RLS Policies
-- =====================================================
-- Enable users to view TODO groups and items shared with them
-- =====================================================

-- ============================================================================
-- RLS POLICIES FOR TODO GROUPS
-- ============================================================================

-- Policy: Users can view their own TODO groups
CREATE POLICY IF NOT EXISTS "Users can view their own todo groups"
  ON myday_todo_groups FOR SELECT
  USING (user_id = auth.uid());

-- Policy: Users can view TODO groups shared with them
CREATE POLICY IF NOT EXISTS "Users can view shared todo groups"
  ON myday_todo_groups FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM myday_shared_todo_groups stg
      JOIN myday_group_members gm ON gm.group_id = stg.group_id
      WHERE stg.todo_group_id = myday_todo_groups.id
      AND gm.user_id = auth.uid()
      AND stg.is_active = true
    )
  );

-- Policy: Users can insert their own TODO groups
CREATE POLICY IF NOT EXISTS "Users can insert their own todo groups"
  ON myday_todo_groups FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can update their own TODO groups
CREATE POLICY IF NOT EXISTS "Users can update their own todo groups"
  ON myday_todo_groups FOR UPDATE
  USING (user_id = auth.uid());

-- Policy: Users can delete their own TODO groups
CREATE POLICY IF NOT EXISTS "Users can delete their own todo groups"
  ON myday_todo_groups FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================================
-- RLS POLICIES FOR TODO ITEMS
-- ============================================================================

-- Policy: Users can view their own TODO items
CREATE POLICY IF NOT EXISTS "Users can view their own todo items"
  ON myday_todo_items FOR SELECT
  USING (user_id = auth.uid());

-- Policy: Users can view TODO items in shared groups
CREATE POLICY IF NOT EXISTS "Users can view shared todo items"
  ON myday_todo_items FOR SELECT
  USING (
    group_id IN (
      SELECT stg.todo_group_id
      FROM myday_shared_todo_groups stg
      JOIN myday_group_members gm ON gm.group_id = stg.group_id
      WHERE gm.user_id = auth.uid()
      AND stg.is_active = true
    )
  );

-- Policy: Users can insert their own TODO items
CREATE POLICY IF NOT EXISTS "Users can insert their own todo items"
  ON myday_todo_items FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can update their own TODO items
CREATE POLICY IF NOT EXISTS "Users can update their own todo items"
  ON myday_todo_items FOR UPDATE
  USING (user_id = auth.uid());

-- Policy: Users can update TODO items in editable shared groups
CREATE POLICY IF NOT EXISTS "Users can update editable shared todo items"
  ON myday_todo_items FOR UPDATE
  USING (
    group_id IN (
      SELECT stg.todo_group_id
      FROM myday_shared_todo_groups stg
      JOIN myday_group_members gm ON gm.group_id = stg.group_id
      WHERE gm.user_id = auth.uid()
      AND stg.is_active = true
      AND stg.share_mode = 'editable'
    )
  );

-- Policy: Users can delete their own TODO items
CREATE POLICY IF NOT EXISTS "Users can delete their own todo items"
  ON myday_todo_items FOR DELETE
  USING (user_id = auth.uid());

-- Policy: Users can delete TODO items in editable shared groups
CREATE POLICY IF NOT EXISTS "Users can delete editable shared todo items"
  ON myday_todo_items FOR DELETE
  USING (
    group_id IN (
      SELECT stg.todo_group_id
      FROM myday_shared_todo_groups stg
      JOIN myday_group_members gm ON gm.group_id = stg.group_id
      WHERE gm.user_id = auth.uid()
      AND stg.is_active = true
      AND stg.share_mode = 'editable'
    )
  );

-- ============================================================================
-- RLS POLICIES FOR SHARED TODO GROUPS TABLE
-- ============================================================================

-- Policy: Users can view shares they created
CREATE POLICY IF NOT EXISTS "Users can view todo group shares they created"
  ON myday_shared_todo_groups FOR SELECT
  USING (shared_by = auth.uid());

-- Policy: Users can view shares for groups they're members of
CREATE POLICY IF NOT EXISTS "Users can view todo group shares for their groups"
  ON myday_shared_todo_groups FOR SELECT
  USING (
    group_id IN (
      SELECT group_id
      FROM myday_group_members
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can create shares for their own TODO groups
CREATE POLICY IF NOT EXISTS "Users can share their own todo groups"
  ON myday_shared_todo_groups FOR INSERT
  WITH CHECK (
    shared_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM myday_todo_groups
      WHERE id = myday_shared_todo_groups.todo_group_id
      AND user_id = auth.uid()
    )
  );

-- Policy: Users can revoke shares they created
CREATE POLICY IF NOT EXISTS "Users can revoke todo group shares they created"
  ON myday_shared_todo_groups FOR UPDATE
  USING (shared_by = auth.uid());

-- Policy: Users can delete shares they created
CREATE POLICY IF NOT EXISTS "Users can delete todo group shares they created"
  ON myday_shared_todo_groups FOR DELETE
  USING (shared_by = auth.uid());

-- ============================================================================
-- VALIDATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ TODO Sharing RLS policies created successfully';
END $$;
