CREATE TABLE IF NOT EXISTS monthly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year INTEGER NOT NULL,
  platform_metrics JSONB DEFAULT '{}',
  qualitative JSONB DEFAULT '{}',
  created_by TEXT,
  created_by_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS monthly_reports_period_idx ON monthly_reports(period_year, period_month);
CREATE TRIGGER update_monthly_reports_updated_at BEFORE UPDATE ON monthly_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
