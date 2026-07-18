-- Public reads support provider-side media fetching. Browser writes remain
-- limited to authenticated Content Hub users through Storage RLS.
INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) VALUES (
  'content-media',
  'content-media',
  TRUE,
  524288000,
  ARRAY['image/*', 'video/*', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "authenticated users can upload to content-media"
  ON storage.objects;
CREATE POLICY "authenticated users can upload to content-media"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'content-media');

DROP POLICY IF EXISTS "authenticated users can delete from content-media"
  ON storage.objects;
CREATE POLICY "authenticated users can delete from content-media"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'content-media');
