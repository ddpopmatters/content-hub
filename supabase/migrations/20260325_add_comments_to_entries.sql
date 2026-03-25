-- Add comments column to entries table
-- Comments are stored as JSONB array of {id, author, body, createdAt, mentions[]}
ALTER TABLE entries
  ADD COLUMN IF NOT EXISTS comments JSONB NOT NULL DEFAULT '[]'::jsonb;
