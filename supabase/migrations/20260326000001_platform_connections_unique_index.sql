-- Ensure unique constraint exists on (platform, account_id) for upsert onConflict to work
CREATE UNIQUE INDEX IF NOT EXISTS platform_connections_platform_account_id_key
  ON platform_connections(platform, account_id);
