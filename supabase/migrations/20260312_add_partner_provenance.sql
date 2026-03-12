ALTER TABLE entries ADD COLUMN IF NOT EXISTS partner_individual_name TEXT;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS partner_consent_status TEXT
  CHECK (partner_consent_status IN ('confirmed', 'pending', 'not-required'));
ALTER TABLE entries ADD COLUMN IF NOT EXISTS partner_capture_context TEXT;
