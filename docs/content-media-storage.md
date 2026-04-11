# Content Media Storage

This app keeps preview asset file uploads disabled by default.

Enable uploads only after the `content-media` Supabase Storage bucket exists and the required access
policies are in place for the target environment.

## Required App Config

Set this in the environment used for builds and local development only after storage is ready:

```env
CONTENT_MEDIA_UPLOADS_ENABLED=true
```

When the flag is `false`, the entry form hides the file picker and asks users to paste a hosted
preview URL instead.

## Required Storage Setup

Create a bucket with these settings:

- Bucket name: `content-media`
- Public bucket: `on`
- Max file size: `524288000` (500 MB)
- Allowed MIME types: `image/*,video/*,application/pdf`

## Required Policies

Run these policies in the Supabase SQL editor for the target project:

```sql
CREATE POLICY "authenticated users can upload to content-media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'content-media');

CREATE POLICY "authenticated users can delete from content-media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'content-media');
```

## Verification

Before enabling uploads broadly:

1. Run `npm run test:content-media`.
2. If you want to verify authenticated upload and delete policies as well, rerun with:

```sh
SUPABASE_STORAGE_TEST_EMAIL="user@example.org" \
SUPABASE_STORAGE_TEST_PASSWORD="password" \
npm run test:content-media
```

3. Build the app with `CONTENT_MEDIA_UPLOADS_ENABLED=true`.
4. Sign in as a normal authenticated user.
5. Upload an image, a video, and a PDF in the entry form.
6. Confirm each file gets a public URL and renders in the preview grid.
7. Publish or save an entry and verify the preview URLs persist correctly.

## Rollback

If storage is unavailable or misconfigured:

1. Set `CONTENT_MEDIA_UPLOADS_ENABLED=false`.
2. Rebuild and redeploy the app.
3. Users will fall back to hosted preview URLs until storage is fixed.
