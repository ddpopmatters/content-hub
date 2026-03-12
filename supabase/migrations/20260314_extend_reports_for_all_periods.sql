-- Extend monthly_reports to support all reporting cadences from the
-- Analytics & Optimisation Framework: monthly, quarterly, annual, campaign.

ALTER TABLE monthly_reports
  ADD COLUMN IF NOT EXISTS report_type TEXT DEFAULT 'monthly'
    CHECK (report_type IN ('monthly', 'quarterly', 'annual', 'campaign')),
  ADD COLUMN IF NOT EXISTS period_quarter INTEGER
    CHECK (period_quarter BETWEEN 1 AND 4),
  ADD COLUMN IF NOT EXISTS campaign_name TEXT,
  ADD COLUMN IF NOT EXISTS date_from DATE,
  ADD COLUMN IF NOT EXISTS date_to DATE;

-- period_month is now optional (not needed for quarterly/annual/campaign)
ALTER TABLE monthly_reports ALTER COLUMN period_month DROP NOT NULL;

-- Replace the month+year unique index with one that covers all report types
DROP INDEX IF EXISTS monthly_reports_period_idx;
CREATE UNIQUE INDEX monthly_reports_period_idx ON monthly_reports (
  report_type,
  period_year,
  COALESCE(period_month, 0),
  COALESCE(period_quarter, 0),
  COALESCE(campaign_name, '')
);
