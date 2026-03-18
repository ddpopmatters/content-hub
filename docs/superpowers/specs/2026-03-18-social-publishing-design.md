# Social Publishing — Schedule & Instant Post

**Date:** 2026-03-18
**Status:** Approved for implementation

---

## Overview

Add native "Post now" and "Schedule" capabilities to Content Hub. Approved entries can be published directly to all five platforms (Instagram, Facebook, LinkedIn, YouTube, BlueSky) from within the entry modal. Instant posting bypasses Zapier and calls the `publish-entry` Edge Function directly; scheduled posting fires the existing Zapier webhook with a `scheduledDate` payload field.

---

## Approach

Hybrid: "Post now" = direct Edge Function call. "Schedule" = Zapier webhook with `scheduledDate`. No new backend infrastructure or cron jobs. Extends the existing `publish-entry` function with four new platform publishers alongside the existing BlueSky implementation.

---

## Section 1: Data Model

### Change

`ALTER TABLE entries ADD COLUMN scheduled_at TIMESTAMPTZ;`

### Rationale

The existing `date` column (DATE type) stores calendar date only. Scheduled posting requires a precise datetime. `scheduled_at` is nullable — only set when a post has been scheduled.

### Type change

Add `scheduled_at?: string | null` to the `Entry` interface in `src/types/models.ts`.

### No other schema changes

`publish_status` (`jsonb`) already tracks per-platform state as `Record<string, PlatformPublishStatus>`:

```typescript
interface PlatformPublishStatus {
  status: 'pending' | 'publishing' | 'published' | 'failed';
  url: string | null;
  error: string | null;
  timestamp: string | null;
}
```

RLS: no changes — same open policy already in place for entries.

---

## Section 2: Backend — Platform Publishers

### Location

`supabase/functions/publish-entry/index.ts` — fill in four existing stubs in the `PUBLISHERS` map.

### Interface (unchanged)

Each publisher receives `{ connection: PlatformConnection, entry: EntryPayload }` and returns `{ url: string | null, error: string | null }`.

### Platform implementations

**Instagram**
Two-step Meta Graph API flow:

1. `POST /{ig-user-id}/media` — create media container with `image_url` and `caption`
2. `POST /{ig-user-id}/media_publish` — publish the container

Requires `page_id` stored on the `platform_connections` row. If absent: `{ error: 'No linked Facebook Page found' }`.
Image URL must be publicly accessible (Content Hub entries already use public Supabase Storage URLs).

**Facebook**
Single call: `POST /{page-id}/feed` with `message` and optional `link`.
Page access token from stored connection. Requires `page_id` on the connection row.

**LinkedIn**
`POST /ugcPosts` with `author` as organisation URN. Supports text + image.
Scope `w_organization_social` already requested in the OAuth flow.
If no `organisation_urn` on the connection: falls back to personal profile post, with `warning: 'Posting as individual — no organisation URN found'` in result.

**YouTube**
`POST /youtube/v3/videos` using resumable upload.
Only attempted if `entry.videoUrl` is present. If absent: returns `{ url: null, error: null, skipped: true }` — does not count as failure.

### Error handling

- All four publishers wrapped in `try/catch`
- HTTP 401/403 from any platform API → `{ error: 'Token expired — reconnect account' }`
- `Promise.all` across all publishers — one failure does not block others
- Function-level response: array of `{ platform, success, url, error, skipped? }`
- Function returns HTTP 200 even on partial failure — calling code inspects per-platform results

---

## Section 3: Frontend — Publish Panel UI

### Component

`src/features/publishing/PublishPanel.tsx`

Rendered as a right-side column inside `EntryModal`. Visible only when `entry.workflowStatus === 'Approved'`.

### Platform selection

Checkboxes pre-ticked from `entry.platforms`. Each platform shows:

- Connected: checkbox enabled
- No connection found: warning icon + checkbox disabled + "Connect in Settings" link

"Post now" and "Schedule" buttons disabled if no ticked platform has a valid connection.

### Post now

- Calls `supabase.functions.invoke('publish-entry', { body: { entryId, platforms, caption, platformCaptions, mediaUrls } })`
- Button shows spinner, goes disabled while in flight
- On success: toast "Posted to Instagram, LinkedIn ✓" — updates `publish_status` per platform
- On partial failure: toast lists each result — "Posted to Instagram ✓ · Facebook failed: permissions error"
- On network failure (function unreachable): toast "Could not reach publishing service — check your connection" — no status written

### Schedule

- Date input + time input (both required)
- "Schedule" button disabled if datetime is blank or in the past
- Inline helper text: "Must be a future date/time" when invalid
- On click: fires Zapier webhook with `scheduledDate` in payload, stores value in `entry.scheduled_at`
- Toast: "Scheduled for 11 Jul 10:00 via Zapier"
- No conflict detection — multiple posts on the same date/time are valid

### Published status strip

If `publish_status` has existing entries, shows compact per-platform rows below the buttons:

- Platform name + coloured dot (green = published, red = failed, amber = pending) + timestamp or error snippet

### Token expiry (surface from backend)

If Edge Function returns `error: 'Token expired — reconnect account'` for a platform:
Toast includes: "[Platform] needs reconnecting" with inline link to Connections screen.

### Hook: `usePublish`

`src/hooks/domain/usePublish.ts`

Follows the domain hook dependency injection pattern (same as `useEntries`, `useYearPlan`):

```typescript
function usePublish({
  currentUser,
  pushSyncToast,
}: {
  currentUser: User | null;
  pushSyncToast: (msg: string, variant: 'success' | 'error') => void;
}) {
  return {
    postNow: (entry: Entry, platforms: string[]) => Promise<PublishResult[]>,
    schedule: (entry: Entry, platforms: string[], datetime: string) => Promise<void>,
    isPosting: boolean,
    lastResult: PublishResult[] | null,
  }
}
```

Exported from `src/hooks/domain/index.ts`. Instantiated in `app.jsx` alongside other domain hooks. Handles: Edge Function invocation, Zapier fetch, optimistic `publish_status` writes, toast despatch, `scheduled_at` persistence.

---

## Section 4: Backend Error Handling & Platform Prerequisites

### Execution model

Each publisher runs inside `Promise.all` — fully parallel, fully isolated. A throw inside one publisher is caught and converted to `{ success: false, error: message }` before `Promise.all` resolves.

### Token expiry

No server-side token refresh. Expired token (401/403 from platform API) → surface as `'Token expired — reconnect account'` in result. Reconnection is the recovery path.

### Platform prerequisites stored on `platform_connections`

| Platform  | Required field           | Missing behaviour                                            |
| --------- | ------------------------ | ------------------------------------------------------------ |
| Instagram | `page_id`                | `{ success: false, error: 'No linked Facebook Page found' }` |
| Facebook  | `page_id`                | Same as Instagram                                            |
| LinkedIn  | `organisation_urn`       | Falls back to personal profile post, adds `warning` field    |
| YouTube   | `entry.videoUrl` present | `{ success: true, skipped: true }` — not a failure           |

### Zapier scheduling path

Webhook fired with `mode: 'no-cors'` — response body is unreadable. Assumed success if no exception thrown. Frontend shows scheduled confirmation toast immediately on no-throw.

---

## Files Created / Modified

### New

- `src/features/publishing/PublishPanel.tsx`
- `src/hooks/domain/usePublish.ts`
- `src/hooks/domain/__tests__/usePublish.test.ts`
- `supabase/migrations/YYYYMMDD_add_scheduled_at_to_entries.sql`

### Modified

- `supabase/functions/publish-entry/index.ts` — implement 4 platform stubs
- `src/features/publishing/EntryModal.tsx` (or equivalent) — render `PublishPanel` when approved
- `src/hooks/domain/index.ts` — export `usePublish`
- `src/types/models.ts` — add `scheduled_at?: string | null` to Entry

---

## Out of Scope

- Token refresh flows (complex, per-platform, deferred)
- Scheduling without Zapier (pg_cron approach — deferred to future spec)
- Bulk scheduling across multiple entries
- Post preview before publishing
- Edit or cancel a scheduled post (Zapier handles this)
