-- =====================================================
-- FIX: Update user_has_document_access function
-- =====================================================
-- Fix table reference: myday_safe_documents → myday_document_vaults
-- =====================================================

CREATE OR REPLACE FUNCTION user_has_document_access(p_user_id UUID, p_document_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- User owns the document OR document is shared with user's group
  RETURN EXISTS (
    SELECT 1 FROM myday_document_vaults
    WHERE id::text = p_document_id AND user_id = p_user_id
  ) OR EXISTS (
    SELECT 1 
    FROM myday_shared_safe_documents ssd
    JOIN myday_group_members gm ON gm.group_id = ssd.group_id
    WHERE ssd.document_id = p_document_id AND gm.user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Fixed user_has_document_access function';
  RAISE NOTICE '   - Changed myday_safe_documents → myday_document_vaults';
  RAISE NOTICE '   - Added ::text casting for UUID comparison';
END $$;
