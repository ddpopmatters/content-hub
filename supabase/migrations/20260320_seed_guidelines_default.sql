-- Seed the default guidelines row so the app doesn't return 406 on first load.
-- Uses INSERT ... ON CONFLICT DO NOTHING so re-running is safe.
INSERT INTO public.guidelines (id, char_limits, banned_words, required_phrases, language_guide, hashtag_tips, approver_directory, updated_at)
VALUES (
  'default',
  '{}'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  NULL,
  NULL,
  '[]'::jsonb,
  NOW()
)
ON CONFLICT (id) DO NOTHING;
