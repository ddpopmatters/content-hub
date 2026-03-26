-- Add token_secret column to platform_connections for storing BlueSky app passwords
ALTER TABLE platform_connections
  ADD COLUMN IF NOT EXISTS token_secret TEXT;

-- Ensure unique constraint exists so upsert onConflict works
CREATE UNIQUE INDEX IF NOT EXISTS platform_connections_platform_account_id_key
  ON platform_connections(platform, account_id);
