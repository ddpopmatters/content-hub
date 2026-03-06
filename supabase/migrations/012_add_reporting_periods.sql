-- Reporting periods for weekly, monthly, quarterly, and annual social reporting.

CREATE TABLE IF NOT EXISTS reporting_periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cadence TEXT NOT NULL CHECK (cadence IN ('Weekly', 'Monthly', 'Quarterly', 'Annual')),
  label TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Ready', 'Published')),
  owner TEXT,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  narrative JSONB NOT NULL DEFAULT '{}'::jsonb,
  qualitative JSONB NOT NULL DEFAULT '{}'::jsonb,
  completeness JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT reporting_periods_date_window CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_reporting_periods_cadence
  ON reporting_periods(cadence);

CREATE INDEX IF NOT EXISTS idx_reporting_periods_start_date
  ON reporting_periods(start_date DESC);

CREATE INDEX IF NOT EXISTS idx_reporting_periods_end_date
  ON reporting_periods(end_date DESC);

CREATE INDEX IF NOT EXISTS idx_reporting_periods_status
  ON reporting_periods(status);

ALTER TABLE reporting_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reporting_periods_select" ON reporting_periods;
CREATE POLICY "reporting_periods_select" ON reporting_periods
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "reporting_periods_insert" ON reporting_periods;
CREATE POLICY "reporting_periods_insert" ON reporting_periods
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "reporting_periods_update" ON reporting_periods;
CREATE POLICY "reporting_periods_update" ON reporting_periods
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "reporting_periods_delete" ON reporting_periods;
CREATE POLICY "reporting_periods_delete" ON reporting_periods
  FOR DELETE TO authenticated
  USING (true);

DROP TRIGGER IF EXISTS update_reporting_periods_updated_at ON reporting_periods;
CREATE TRIGGER update_reporting_periods_updated_at
  BEFORE UPDATE ON reporting_periods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
