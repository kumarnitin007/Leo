-- =====================================================
-- FIX: Add missing columns to myday_shared_safe_documents
-- =====================================================
-- Add is_active, expires_at, revoked_at columns
-- =====================================================

ALTER TABLE myday_shared_safe_documents
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

-- Add index for is_active for faster filtering
CREATE INDEX IF NOT EXISTS idx_shared_documents_active 
  ON myday_shared_safe_documents(is_active) 
  WHERE is_active = true;

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Fixed myday_shared_safe_documents table';
  RAISE NOTICE '   - Added is_active column (default: true)';
  RAISE NOTICE '   - Added expires_at column';
  RAISE NOTICE '   - Added revoked_at column';
  RAISE NOTICE '   - Added index on is_active';
END $$;
