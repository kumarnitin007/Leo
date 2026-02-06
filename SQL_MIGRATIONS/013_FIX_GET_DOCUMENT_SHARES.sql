-- =====================================================
-- FIX: Update get_document_shares function return type
-- =====================================================
-- group_id is TEXT, not UUID
-- =====================================================

DROP FUNCTION IF EXISTS get_document_shares(TEXT);

CREATE OR REPLACE FUNCTION get_document_shares(p_document_id TEXT)
RETURNS TABLE (
  share_id UUID,
  group_id TEXT,
  group_name TEXT,
  share_mode TEXT,
  shared_at TIMESTAMPTZ,
  member_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ssd.id as share_id,
    ssd.group_id,
    g.name as group_name,
    ssd.share_mode,
    ssd.shared_at,
    COUNT(gm.user_id) as member_count
  FROM myday_shared_safe_documents ssd
  JOIN myday_groups g ON g.id = ssd.group_id
  LEFT JOIN myday_group_members gm ON gm.group_id = ssd.group_id
  WHERE ssd.document_id = p_document_id
    AND ssd.is_active = true
  GROUP BY ssd.id, ssd.group_id, g.name, ssd.share_mode, ssd.shared_at
  ORDER BY ssd.shared_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Fixed get_document_shares function';
  RAISE NOTICE '   - Changed group_id return type from UUID to TEXT';
  RAISE NOTICE '   - Added is_active filter';
END $$;
