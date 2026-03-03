-- Add missing entry fields that the form collects but were never persisted.
-- audience_segments, golden_thread_pass, assessment_scores already exist (007).
-- This migration adds the remaining 6 fields.

-- Publishing
ALTER TABLE entries ADD COLUMN IF NOT EXISTS evergreen BOOLEAN DEFAULT false;

-- Influencer attribution
ALTER TABLE entries ADD COLUMN IF NOT EXISTS influencer_id TEXT;

-- Content production fields
ALTER TABLE entries ADD COLUMN IF NOT EXISTS url TEXT;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS script TEXT;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS design_copy TEXT;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS carousel_slides JSONB DEFAULT '[]'::jsonb;

-- Validate carousel_slides is an array
ALTER TABLE entries ADD CONSTRAINT carousel_slides_is_array
  CHECK (carousel_slides IS NULL OR jsonb_typeof(carousel_slides) = 'array');
