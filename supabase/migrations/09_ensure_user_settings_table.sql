-- =====================================================
-- MIGRATION: Ensure user settings table exists
-- Creates myday_user_settings if not exists
-- =====================================================

-- Create user settings table
CREATE TABLE IF NOT EXISTS myday_user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    theme TEXT DEFAULT 'purple',
    dashboard_layout TEXT DEFAULT 'uniform',
    notifications_enabled BOOLEAN DEFAULT true,
    location TEXT, -- JSON string with zipCode, city, country
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE myday_user_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own settings"
    ON myday_user_settings
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
    ON myday_user_settings
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
    ON myday_user_settings
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON myday_user_settings(user_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_settings_updated_at
    BEFORE UPDATE ON myday_user_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_user_settings_updated_at();
