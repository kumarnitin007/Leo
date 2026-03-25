-- Weather + Safe Financial defaults on user profile (myday_user_settings)
ALTER TABLE myday_user_settings
  ADD COLUMN IF NOT EXISTS temperature_unit text CHECK (temperature_unit IS NULL OR temperature_unit IN ('celsius', 'fahrenheit'));

ALTER TABLE myday_user_settings
  ADD COLUMN IF NOT EXISTS financial_preferences jsonb;

COMMENT ON COLUMN myday_user_settings.temperature_unit IS 'User preference for weather widget: celsius | fahrenheit';
COMMENT ON COLUMN myday_user_settings.financial_preferences IS 'Optional { preferredDisplayCurrency, exchangeRates: { USD, EUR, GBP } } for Safe Financial defaults';
