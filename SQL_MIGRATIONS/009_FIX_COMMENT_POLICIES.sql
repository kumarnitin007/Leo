-- =====================================================
-- FIX: Update Comment RLS Policies
-- =====================================================
-- The policies in 004 still reference myday_safe_entries
-- This fixes them to use myday_encrypted_entries
-- =====================================================

-- Drop old policies
DROP POLICY IF EXISTS "Users can view comments on accessible entries" ON myday_entry_comments;
DROP POLICY IF EXISTS "Users can add comments to accessible entries" ON myday_entry_comments;

-- Recreate with correct table references
CREATE POLICY "Users can view comments on accessible entries"
  ON myday_entry_comments FOR SELECT
  USING (
    -- User owns the entry (check myday_encrypted_entries)
    EXISTS (
      SELECT 1 FROM myday_encrypted_entries ee
      WHERE ee.id::text = myday_entry_comments.entry_id
        AND ee.user_id = auth.uid()
    )
    OR
    -- User is in a group that has access (check myday_shared_safe_entries)
    EXISTS (
      SELECT 1 FROM myday_shared_safe_entries sse
      JOIN myday_group_members gm ON gm.group_id = sse.group_id
      WHERE sse.safe_entry_id = myday_entry_comments.entry_id
        AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add comments to accessible entries"
  ON myday_entry_comments FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND
    (
      -- User owns the entry
      EXISTS (
        SELECT 1 FROM myday_encrypted_entries ee
        WHERE ee.id::text = myday_entry_comments.entry_id
          AND ee.user_id = auth.uid()
      )
      OR
      -- User is in a group that has access
      EXISTS (
        SELECT 1 FROM myday_shared_safe_entries sse
        JOIN myday_group_members gm ON gm.group_id = sse.group_id
        WHERE sse.safe_entry_id = myday_entry_comments.entry_id
          AND gm.user_id = auth.uid()
      )
    )
  );

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Comment policies fixed';
  RAISE NOTICE '   - Updated to use myday_encrypted_entries';
  RAISE NOTICE '   - Policies now match actual schema';
END $$;
