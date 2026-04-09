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

1. Build the app with `CONTENT_MEDIA_UPLOADS_ENABLED=true`.
2. Sign in as a normal authenticated user.
3. Upload an image, a video, and a PDF in the entry form.
4. Confirm each file gets a public URL and renders in the preview grid.
5. Publish or save an entry and verify the preview URLs persist correctly.

## Rollback

If storage is unavailable or misconfigured:

1. Set `CONTENT_MEDIA_UPLOADS_ENABLED=false`.
2. Rebuild and redeploy the app.
3. Users will fall back to hosted preview URLs until storage is fixed.
