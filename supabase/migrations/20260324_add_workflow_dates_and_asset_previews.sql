-- Migration: add workflow dates and asset_previews to entries
-- Apply via: supabase db push --include-all

ALTER TABLE entries
  ADD COLUMN IF NOT EXISTS first_check_date       DATE,
  ADD COLUMN IF NOT EXISTS second_check_date      DATE,
  ADD COLUMN IF NOT EXISTS asset_production_date  DATE,
  ADD COLUMN IF NOT EXISTS final_check_date       DATE,
  ADD COLUMN IF NOT EXISTS asset_previews         JSONB NOT NULL DEFAULT '[]'::jsonb;
