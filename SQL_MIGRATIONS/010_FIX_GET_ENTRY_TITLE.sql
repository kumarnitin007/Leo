-- =====================================================
-- FIX: Update get_entry_title function
-- =====================================================
-- Fix table references in get_entry_title function
-- =====================================================

CREATE OR REPLACE FUNCTION get_entry_title(p_entry_id TEXT, p_entry_type TEXT)
RETURNS TEXT AS $$
DECLARE
  v_title TEXT;
BEGIN
  CASE p_entry_type
    WHEN 'safe_entry' THEN
      SELECT title INTO v_title FROM myday_encrypted_entries WHERE id = p_entry_id;
    WHEN 'safe_document' THEN
      SELECT title INTO v_title FROM myday_document_vaults WHERE id = p_entry_id;
    WHEN 'document' THEN
      SELECT title INTO v_title FROM myday_document_vaults WHERE id = p_entry_id;
    WHEN 'todo' THEN
      SELECT title INTO v_title FROM myday_todo_items WHERE id = p_entry_id;
    WHEN 'event' THEN
      SELECT title INTO v_title FROM myday_events WHERE id = p_entry_id;
    WHEN 'journal' THEN
      SELECT title INTO v_title FROM myday_journal_entries WHERE id = p_entry_id;
    WHEN 'resolution' THEN
      SELECT title INTO v_title FROM myday_resolutions WHERE id = p_entry_id;
    WHEN 'routine' THEN
      SELECT title INTO v_title FROM myday_routines WHERE id = p_entry_id;
    WHEN 'gift_card' THEN
      SELECT name INTO v_title FROM myday_items WHERE id = p_entry_id AND category = 'Gift Card';
    ELSE
      v_title := 'Unknown Entry';
  END CASE;
  
  RETURN COALESCE(v_title, 'Untitled');
EXCEPTION WHEN OTHERS THEN
  RETURN 'Entry';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ get_entry_title function fixed';
  RAISE NOTICE '   - Updated to use myday_encrypted_entries';
  RAISE NOTICE '   - Updated to use myday_document_vaults';
END $$;
