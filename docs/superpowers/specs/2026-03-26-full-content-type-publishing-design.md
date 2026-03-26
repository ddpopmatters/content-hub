# Full Content Type Publishing Design

**Date:** 2026-03-26
**Status:** Approved

---

## Goal

Enable the Content Hub to publish all content types (`No asset`, `Design`, `Carousel`, `Video`) to all platforms (Instagram, Facebook, LinkedIn, LinkedIn Org, Bluesky, YouTube) using the correct platform-native API flows.

## Current State

- `assetType` is never included in the publish payload — all content types publish identically (single image or text).
- `mediaUrls` from entry attachments is transmitted to the Edge Function but no publisher reads it.
- Attachments are stored as base64 `dataUrl` strings in the database — external platform APIs cannot fetch these.
- Token expiry is shown as a UI warning but never checked before publishing — expired tokens cause cryptic 401 failures.
- YouTube publisher is a stub that always returns `skipped`.

## Architecture

Four sequential layers, each independently shippable:

1. **Plumbing** — Supabase Storage for media + `assetType` in payload + `mediaUrls` wired to publishers
2. **Carousel** — Instagram carousel, Facebook multi-photo, LinkedIn (image only), Bluesky multi-image
3. **Video** — Instagram Reels, Facebook video, LinkedIn video, Bluesky video, YouTube
4. **Token refresh** — pre-publish expiry check with platform-specific refresh flows

```
Entry saved → attachment uploaded to Supabase Storage (client-side)
                           ↓
User clicks Publish → buildPublishPayload (includes assetType, mediaUrls = public URLs)
                           ↓
POST /functions/v1/publish-entry
  → check token expiry → refresh if needed
  → per platform: dispatch on assetType
      'No asset' / 'Design' → text / single-image (existing path, unchanged)
      'Carousel'            → carousel flow
      'Video'               → video flow
```

---

## Layer 1: Plumbing

### Supabase Storage

- New bucket: `content-media`, public read, authenticated write.
- RLS: users may only write to `entries/{entryId}/`.
- Max file size: 500MB (accommodates video).
- When a user selects a file in the attachment input, the client uploads it to Supabase Storage immediately (before entry save) and stores the returned public URL in `attachment.url`. This avoids re-uploading on every entry save.
- `dataUrl` (base64) is no longer written for new uploads. The field remains in the `Attachment` type for read-back compatibility with existing entries.
- Existing entries with `dataUrl`-only attachments publish as today (single-image via `previewUrl`). No migration of existing content.

### Payload changes

Add `assetType` to `PublishPayload` in `supabase/functions/_shared/types.ts`:

```typescript
assetType: 'No asset' | 'Video' | 'Design' | 'Carousel';
```

`buildPublishPayload` in `src/features/publishing/publishUtils.ts` includes `entry.assetType`.

### Publisher routing

Each publisher gains a despatch on `payload.assetType`:

- `'No asset'` / `'Design'` → existing single-image-or-text path (no change)
- `'Carousel'` → carousel path (Layer 2); graceful fallback to single-image until Layer 2 ships
- `'Video'` → video path (Layer 3); graceful fallback to single-image until Layer 3 ships

Fallback behaviour: if the dedicated path is not yet implemented, publishers continue to use `previewUrl` + caption as today.

---

## Layer 2: Carousel

### Instagram Carousel

Three-step Graph API flow:

1. For each URL in `payload.mediaUrls` (2–10 images): `POST /{igUserId}/media?image_url={url}&is_carousel_item=true` → collect container IDs
2. `POST /{igUserId}/media?media_type=CAROUSEL&children={id1,id2,...}&caption={text}` → carousel container ID
3. `POST /{igUserId}/media_publish?creation_id={carouselId}` → publish

If `mediaUrls` has only one entry, fall back to the existing single-image path.

### Facebook Multi-Photo

1. For each URL in `payload.mediaUrls`: `POST /{pageId}/photos?url={url}&published=false` → collect photo IDs
2. `POST /{pageId}/feed` with `message={text}` and `attached_media=[{media_fbid: id}, ...]`

If only one URL, use the existing `/{pageId}/photos` path.

### LinkedIn

The LinkedIn ugcPosts API does not support native multi-image carousels. LinkedIn's supported carousel format requires uploading a PDF document (`feedshare-document` recipe), which is outside scope here.

Behaviour for `'Carousel'` entries on LinkedIn: post the first image from `mediaUrls` (or `previewUrl`) with the caption. Add a note to `last_error` on the connection row: `"LinkedIn does not support carousel posts — posted first image only"`. This is surfaced as a non-failure result (status remains `published`).

### Bluesky Multi-Image

Upload each image in `mediaUrls` as a blob via `com.atproto.repo.uploadBlob` (max 4 — Bluesky limit). Build `embed.images` array with all blobs. If more than 4 images, use the first 4 and set `last_error` to note the truncation.

---

## Layer 3: Video

### Instagram Reels

1. `POST /{igUserId}/media?video_url={mediaUrls[0]}&media_type=REELS&caption={text}` → container ID
2. Poll `GET /{containerId}?fields=status_code` every 3s, up to 10 attempts (30s total). If `status_code !== 'FINISHED'` after polling, return `status: 'failed'` with `error: 'Video processing timed out — check Instagram Studio'`.
3. `POST /{igUserId}/media_publish?creation_id={containerId}`

Requires `mediaUrls[0]` to be a publicly accessible video URL (MP4). Returns `status: 'failed'` with a clear message if `mediaUrls` is empty.

### Facebook Video

`POST /{pageId}/videos` with `file_url={mediaUrls[0]}&description={text}`. Facebook fetches the video server-side — no binary streaming required.

### LinkedIn Video

1. Register upload with `feedshare-video` recipe via `POST /v2/assets?action=registerUpload`
2. Fetch video bytes from `mediaUrls[0]`
3. `PUT` bytes to the returned upload URL
4. Post with `shareMediaCategory: 'VIDEO'` and `media: [{ status: 'READY', media: assetUrn }]`

### Bluesky Video

1. Fetch video bytes from `mediaUrls[0]`
2. Upload via `com.atproto.repo.uploadBlob` with `Content-Type: video/mp4`
3. Include in post record as `embed: { $type: 'app.bsky.embed.video', video: blob }`

### YouTube

Full resumable upload flow:

1. Initiate: `POST https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable` with metadata:
   ```json
   {
     "snippet": { "title": "{caption[0..100]}", "description": "{caption}", "categoryId": "22" },
     "status": { "privacyStatus": "public" }
   }
   ```
2. Fetch video bytes from `mediaUrls[0]`
3. `PUT` to resumable upload URI with video bytes
4. Return `status: 'published'` with the returned video URL (`https://www.youtube.com/watch?v={id}`)

Returns `status: 'failed'` with clear message if `mediaUrls` is empty or token is missing/expired.

---

## Layer 4: Token Refresh

### Pre-publish check

At the start of each platform publish (inside the Edge Function's `Promise.all` loop, before calling the publisher), check `conn.expires_at`. If the token expires within 24 hours or has already expired, attempt a refresh before proceeding.

### Per-platform refresh

**Meta (Facebook / Instagram)**
No refresh token issued. Return a structured error immediately:
`{ status: 'failed', error: 'Facebook token expired — reconnect your account in Publishing settings' }`

**LinkedIn personal and org**
`POST https://www.linkedin.com/oauth/v2/accessToken` with `grant_type=refresh_token&refresh_token={conn.refresh_token}&client_id={...}&client_secret={...}`.
On success: update `access_token`, `refresh_token`, `expires_at` in `platform_connections` and proceed.
On failure: `{ status: 'failed', error: 'LinkedIn token expired — reconnect your account in Publishing settings' }`

`LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET` must be set as Edge Function secrets.

**Google / YouTube**
`POST https://oauth2.googleapis.com/token` with `grant_type=refresh_token&refresh_token={conn.refresh_token}&client_id={...}&client_secret={...}`.
Same update-and-proceed pattern. Secrets: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

**Bluesky**
App passwords don't expire. No refresh needed.

### PlatformConnection schema change

Add `expires_at` and `refresh_token` to the `PlatformConnection` type in `_shared/types.ts` (both already exist in the DB row and are returned by `select('*')`, but are not currently in the TypeScript interface).

---

## Error Handling

All new code paths return structured `PlatformResult` — no new unhandled throws. Specific cases:

| Condition                            | Result                                                                     |
| ------------------------------------ | -------------------------------------------------------------------------- |
| `mediaUrls` empty for video/carousel | `failed` with clear message                                                |
| Instagram video polling timeout      | `failed` — `'Video processing timed out — check Instagram Studio'`         |
| Carousel with 1 image                | Fallback to single-image path                                              |
| Bluesky carousel > 4 images          | First 4 used, `last_error` notes truncation                                |
| LinkedIn carousel                    | First image posted, `last_error` notes API limitation                      |
| Token expired, no refresh token      | `failed` — `'{Platform} token expired — reconnect in Publishing settings'` |
| Token refresh fails                  | `failed` — same message                                                    |
| Token refresh succeeds               | Proceed transparently                                                      |

---

## Testing

- `publishUtils.ts`: add test asserting `assetType` is included in the built payload.
- Attachment upload hook: test that `attachment.url` is set from Storage and `dataUrl` is not written.
- Platform API flows: manual integration testing against sandbox credentials (consistent with existing approach — no mocks for external APIs).
- Edge Function token refresh: manual testing with a deliberately expired token.

---

## Files to Create or Modify

| File                                                  | Change                                                                                         |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `supabase/functions/_shared/types.ts`                 | Add `assetType` to `PublishPayload`; add `expires_at`, `refresh_token` to `PlatformConnection` |
| `supabase/functions/publish-entry/index.ts`           | Token refresh logic; per-platform carousel and video publishers; `assetType` despatch          |
| `src/features/publishing/publishUtils.ts`             | Add `assetType` to `buildPublishPayload`                                                       |
| `src/hooks/domain/useEntries.ts` (or entry save hook) | Upload attachments to Supabase Storage on save                                                 |
| `src/types/models.ts`                                 | Confirm `Attachment.url` is used for Storage URL                                               |
| Supabase dashboard                                    | Create `content-media` bucket with RLS                                                         |

---

## Known Limitations

- **LinkedIn carousel:** Native multi-image carousel requires PDF upload — out of scope. First image is posted with a note in `last_error`.
- **Existing base64 attachments:** Not migrated. Continue to work via `previewUrl` fallback.
- **Video file size:** Limited by Supabase Storage (500MB) and platform API limits (Instagram: 650MB, LinkedIn: 5GB, YouTube: 256GB).
- **YouTube `categoryId`:** Defaults to `22` (People & Blogs). Not configurable per entry.
