-- Add priority tier support to entries for planning triage and filtering.

ALTER TABLE entries
  ADD COLUMN IF NOT EXISTS priority_tier TEXT DEFAULT 'Medium';

UPDATE entries
SET priority_tier = 'Medium'
WHERE priority_tier IS NULL;

ALTER TABLE entries
  DROP CONSTRAINT IF EXISTS entries_priority_tier_check;

ALTER TABLE entries
  ADD CONSTRAINT entries_priority_tier_check
  CHECK (priority_tier IN ('Low', 'Medium', 'High', 'Urgent'));

ALTER TABLE entries
  ALTER COLUMN priority_tier SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_entries_priority_tier
  ON entries(priority_tier);
