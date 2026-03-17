-- Create campaigns table for the yearly Gantt planning view
CREATE TABLE IF NOT EXISTS campaigns (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  type        TEXT        NOT NULL DEFAULT 'campaign',
  start_date  DATE        NOT NULL,
  end_date    DATE        NOT NULL,
  colour      TEXT        NOT NULL DEFAULT '#6366f1',
  notes       TEXT,
  created_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT campaigns_dates_valid CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS campaigns_start_date_idx ON campaigns (start_date);
CREATE INDEX IF NOT EXISTS campaigns_end_date_idx   ON campaigns (end_date);

-- Enable RLS
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

-- All authenticated team members can read/write all campaigns
DROP POLICY IF EXISTS "campaigns_select" ON campaigns;
CREATE POLICY "campaigns_select" ON campaigns
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "campaigns_insert" ON campaigns;
CREATE POLICY "campaigns_insert" ON campaigns
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "campaigns_update" ON campaigns;
CREATE POLICY "campaigns_update" ON campaigns
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "campaigns_delete" ON campaigns;
CREATE POLICY "campaigns_delete" ON campaigns
  FOR DELETE TO authenticated USING (true);
