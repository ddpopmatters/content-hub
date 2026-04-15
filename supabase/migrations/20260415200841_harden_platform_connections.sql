ALTER TABLE platform_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_connections_select" ON platform_connections;
DROP POLICY IF EXISTS "platform_connections_insert" ON platform_connections;
DROP POLICY IF EXISTS "platform_connections_update" ON platform_connections;
DROP POLICY IF EXISTS "platform_connections_delete" ON platform_connections;
