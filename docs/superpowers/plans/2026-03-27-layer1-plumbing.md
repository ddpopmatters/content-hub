# Layer 1: Plumbing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `assetType` into the publish payload, replace base64 attachment storage with Supabase Storage public URLs, and make `mediaUrls` useful to publishers.

**Architecture:** Three coordinated changes — (1) Supabase Storage bucket for media files, (2) EntryForm uploads files to Storage on select instead of reading as base64, (3) `buildPublishPayload` includes `assetType` and filters `assetPreviews` to public URLs only. Publishers gain no new logic yet — carousel/video paths are stubbed in Layer 2/3.

**Tech Stack:** React 19, TypeScript, Supabase Storage JS client, Vitest

---

### Task 1: Create Supabase Storage bucket

**Files:**

- Manual step: Supabase dashboard

- [ ] **Step 1: Create bucket via Supabase dashboard**

In the Supabase dashboard for the "Workstream Tool" project:

1. Go to Storage → New bucket
2. Name: `content-media`
3. Public bucket: **on**
4. Max file size: `524288000` (500 MB)
5. Allowed MIME types: `image/*,video/*,application/pdf`
6. Click Save

- [ ] **Step 2: Add RLS policy via SQL editor**

In Supabase SQL editor, run:

```sql
-- Allow authenticated users to upload to content-media
CREATE POLICY "authenticated users can upload to content-media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'content-media');

-- Allow authenticated users to delete their own uploads
CREATE POLICY "authenticated users can delete from content-media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'content-media');
```

(Public read is already enabled by the public bucket setting.)

---

### Task 2: Add `assetType` to `PublishPayload` type

**Files:**

- Modify: `supabase/functions/_shared/types.ts`

- [ ] **Step 1: Add `assetType` field**

In `supabase/functions/_shared/types.ts`, change:

```typescript
export interface PublishPayload {
  entryId: string;
  platforms: string[];
  caption: string;
  platformCaptions: Record<string, string>;
  mediaUrls: string[];
  previewUrl: string | null;
  scheduledDate: string;
  firstComment: string;
  campaign: string;
  contentPillar: string;
  links: unknown[];
  callbackUrl: string | null;
  webhookSecret?: string;
}
```

To:

```typescript
export interface PublishPayload {
  entryId: string;
  platforms: string[];
  caption: string;
  platformCaptions: Record<string, string>;
  assetType: string;
  mediaUrls: string[];
  previewUrl: string | null;
  scheduledDate: string;
  firstComment: string;
  campaign: string;
  contentPillar: string;
  links: unknown[];
  callbackUrl: string | null;
  webhookSecret?: string;
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd "/Users/dan/dev/population_matters/tools/Content Hub" && npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/_shared/types.ts
git commit -m "feat(publish): add assetType to PublishPayload type"
```

---

### Task 3: Update `buildPublishPayload` — add `assetType`, use `assetPreviews` as `mediaUrls`

**Files:**

- Modify: `src/features/publishing/publishUtils.ts:7-23`
- Test: `src/features/publishing/__tests__/publishUtils.test.ts`

- [ ] **Step 1: Write failing tests**

In `src/features/publishing/__tests__/publishUtils.test.ts`, add:

```typescript
import { describe, it, expect } from 'vitest';
import { buildPublishPayload, getAggregatePublishStatus } from '../publishUtils';
import type { Entry } from '../../../types/models';

const baseEntry = {
  id: '1',
  platforms: ['LinkedIn'],
  caption: 'Test caption',
  platformCaptions: {},
  assetType: 'Design',
  assetPreviews: [],
  previewUrl: '',
  date: '2026-03-27',
  firstComment: '',
  campaign: '',
  contentPillar: '',
  links: [],
} as unknown as Entry;

describe('buildPublishPayload', () => {
  it('includes assetType in the payload', () => {
    const payload = buildPublishPayload({ ...baseEntry, assetType: 'Video' } as unknown as Entry);
    expect(payload.assetType).toBe('Video');
  });

  it('uses assetPreviews as mediaUrls', () => {
    const entry = {
      ...baseEntry,
      assetPreviews: [
        'https://storage.example.com/img1.jpg',
        'https://storage.example.com/img2.jpg',
      ],
    } as unknown as Entry;
    const payload = buildPublishPayload(entry);
    expect(payload.mediaUrls).toEqual([
      'https://storage.example.com/img1.jpg',
      'https://storage.example.com/img2.jpg',
    ]);
  });

  it('filters base64 data URLs out of mediaUrls', () => {
    const entry = {
      ...baseEntry,
      assetPreviews: ['https://storage.example.com/img1.jpg', 'data:image/jpeg;base64,/9j/4AAQ=='],
    } as unknown as Entry;
    const payload = buildPublishPayload(entry);
    expect(payload.mediaUrls).toEqual(['https://storage.example.com/img1.jpg']);
  });
});

describe('getAggregatePublishStatus', () => {
  it('returns failed when all platforms are skipped', () => {
    expect(
      getAggregatePublishStatus({
        Instagram: { status: 'skipped', url: null, error: 'not implemented', timestamp: 't' },
      }),
    ).toBe('failed');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "/Users/dan/dev/population_matters/tools/Content Hub" && npm test -- publishUtils
```

Expected: FAIL — `buildPublishPayload` tests fail because `assetType` is missing and `mediaUrls` uses `attachments`.

- [ ] **Step 3: Update `buildPublishPayload`**

In `src/features/publishing/publishUtils.ts`, replace lines 7–23:

```typescript
export function buildPublishPayload(entry: Entry, callbackUrl?: string, webhookSecret?: string) {
  return {
    entryId: entry.id,
    platforms: entry.platforms,
    caption: entry.caption,
    platformCaptions: entry.platformCaptions || {},
    assetType: entry.assetType,
    mediaUrls: (entry.assetPreviews || []).filter((url) => url && !url.startsWith('data:')),
    previewUrl: entry.previewUrl || null,
    scheduledDate: entry.date,
    firstComment: entry.firstComment || '',
    campaign: entry.campaign || '',
    contentPillar: entry.contentPillar || '',
    links: entry.links || [],
    callbackUrl: callbackUrl || null,
    ...(webhookSecret && { webhookSecret }),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "/Users/dan/dev/population_matters/tools/Content Hub" && npm test -- publishUtils
```

Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/publishing/publishUtils.ts src/features/publishing/__tests__/publishUtils.test.ts
git commit -m "feat(publish): add assetType to payload, use assetPreviews as mediaUrls"
```

---

### Task 4: Update `EntryForm` — upload to Supabase Storage on file select

**Files:**

- Modify: `src/features/entry/EntryForm.tsx:50` (import), `src/features/entry/EntryForm.tsx:1260-1283` (file input handler)

- [ ] **Step 1: Add `getSupabase` to import**

In `src/features/entry/EntryForm.tsx`, change line 50:

```typescript
import { SUPABASE_API } from '../../lib/supabase';
```

To:

```typescript
import { SUPABASE_API, getSupabase } from '../../lib/supabase';
```

- [ ] **Step 2: Replace the file input `onChange` handler**

In `src/features/entry/EntryForm.tsx`, replace the entire `onChange` handler on the preview-file input (lines 1260–1283):

```typescript
onChange={async (event) => {
  const files = Array.from(event.target.files || []) as File[];
  event.target.value = '';
  for (const file of files) {
    if (file.size > 500 * 1024 * 1024) {
      pushSyncToast?.('Each file must be under 500 MB.', 'warning');
      continue;
    }
    const client = getSupabase();
    if (!client) {
      pushSyncToast?.('Not signed in — cannot upload file.', 'error');
      continue;
    }
    const ext = file.name.split('.').pop() ?? 'bin';
    const path = `entries/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await client.storage.from('content-media').upload(path, file);
    if (error) {
      pushSyncToast?.(`Upload failed: ${error.message}`, 'error');
      continue;
    }
    const { data: urlData } = client.storage.from('content-media').getPublicUrl(path);
    const publicUrl = urlData.publicUrl;
    setAssetPreviews((prev) => {
      const next = [...prev, publicUrl];
      if (!previewUrl) setPreviewUrl(next[0]);
      return next;
    });
  }
}}
```

- [ ] **Step 3: Update file input `accept` attribute and `accept` the 500MB limit text**

Change the input's `accept` attribute from `"image/*,application/pdf"` to `"image/*,video/*,application/pdf"`.

The full input element becomes:

```tsx
<input
  id="preview-file"
  type="file"
  accept="image/*,video/*,application/pdf"
  multiple
  onChange={async (event) => {
    // ... handler from Step 2 above
  }}
  className={cx(fileInputClasses, 'text-xs')}
/>
```

- [ ] **Step 4: Run typecheck**

```bash
cd "/Users/dan/dev/population_matters/tools/Content Hub" && npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Run tests**

```bash
cd "/Users/dan/dev/population_matters/tools/Content Hub" && npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/features/entry/EntryForm.tsx
git commit -m "feat(entry): upload attachments to Supabase Storage instead of base64"
```

---

### Task 5: Update `publish-entry` Edge Function — pass `assetType` through to publishers

**Files:**

- Modify: `supabase/functions/publish-entry/index.ts:628-632`

The Edge Function receives `payload.assetType` from the client now. The `platformPayload` spread already forwards all payload fields — no change needed to the handler loop. But we should confirm TypeScript is happy.

- [ ] **Step 1: Run typecheck on the Edge Function (local check)**

```bash
cd "/Users/dan/dev/population_matters/tools/Content Hub" && npm run typecheck
```

Expected: no errors. The `assetType` field is now in `PublishPayload` so the spread at `index.ts:629` (`{ ...payload, caption: ... }`) forwards it automatically.

- [ ] **Step 2: Commit**

```bash
git commit --allow-empty -m "chore(publish): assetType forwarded via payload spread — no handler changes needed"
```

---

## Self-Review

**Spec coverage:**

- Supabase Storage bucket → Task 1 ✓
- `assetType` in `PublishPayload` → Task 2 ✓
- `buildPublishPayload` uses `assetPreviews` as `mediaUrls` → Task 3 ✓
- Base64 data URLs filtered from `mediaUrls` → Task 3 ✓
- EntryForm uploads to Storage → Task 4 ✓
- File input accepts video → Task 4 ✓
- `assetType` forwarded to publishers → Task 5 ✓
- Publisher routing stubs for Carousel/Video → deferred to Layer 2/3 plans (graceful fallback via existing single-image path)

**Placeholder scan:** No TBDs. All code blocks complete.

**Type consistency:** `entry.assetPreviews` used in Task 3 matches `assetPreviews?: string[]` in `src/types/models.ts:193`. `getSupabase()` returns `SupabaseClient | null` — null check in Task 4 Step 2 handles this.
