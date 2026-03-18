# Social Publishing — Schedule & Instant Post — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Post now" (direct Edge Function call) and "Schedule" (Zapier webhook) buttons to the entry modal, with native publishers for Instagram, Facebook, LinkedIn, and YouTube alongside the existing BlueSky implementation.

**Architecture:** Hybrid approach — "Post now" calls `publish-entry` Supabase Edge Function directly from the frontend via `supabase.functions.invoke`; "Schedule" fires the existing Zapier webhook with a `scheduledDate` field. Four platform publisher stubs in the Edge Function are filled in. A new `usePublish` domain hook manages async state and toast feedback. A new `PublishPanel` component is rendered as a right-side column in the entry modal when the entry is Approved.

**Tech Stack:** React 19, TypeScript, Vitest, Supabase Edge Functions (Deno/TypeScript), Tailwind 4.2, `supabase.functions.invoke`, existing `publishUtils.ts` helpers.

---

## File Map

| File                                                     | Action | Responsibility                                                                            |
| -------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------- |
| `supabase/migrations/20260318_add_publishing_fields.sql` | Create | Add `scheduled_at` to entries; add `page_id` + `organisation_urn` to platform_connections |
| `src/types/models.ts`                                    | Modify | Add `scheduled_at?: string \| null` to Entry interface                                    |
| `supabase/functions/publish-entry/index.ts`              | Modify | Implement 4 platform publisher stubs                                                      |
| `src/hooks/domain/usePublish.ts`                         | Create | Async state for postNow + schedule operations                                             |
| `src/hooks/domain/__tests__/usePublish.test.ts`          | Create | Vitest unit tests for usePublish                                                          |
| `src/hooks/domain/index.ts`                              | Modify | Export usePublish                                                                         |
| `src/features/publishing/PublishPanel.tsx`               | Create | Right-side publish UI — platform checkboxes, Post now, Schedule                           |
| Entry modal file (find in Task 6)                        | Modify | Render PublishPanel when entry.workflowStatus === 'Approved'                              |
| `src/app.jsx`                                            | Modify | Instantiate usePublish, pass postNow/schedule down to entry modal                         |

---

## Task 1: DB Migration + Type Update

**Files:**

- Create: `supabase/migrations/20260318_add_publishing_fields.sql`
- Modify: `src/types/models.ts`

**Background:** The `entries` table needs `scheduled_at` (TIMESTAMPTZ) to store exact datetime for scheduled posts. The `platform_connections` table needs `page_id` (for Instagram/Facebook, which require a linked Facebook Page) and `organisation_urn` (for LinkedIn, to post as an organisation rather than personal profile). Both are nullable — existing rows stay untouched.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260318_add_publishing_fields.sql
ALTER TABLE entries
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

ALTER TABLE platform_connections
  ADD COLUMN IF NOT EXISTS page_id TEXT,
  ADD COLUMN IF NOT EXISTS organisation_urn TEXT;
```

- [ ] **Step 2: Apply the migration**

Use the Supabase MCP `apply_migration` tool (project: "Workstream Tool") with the SQL above. Do NOT use `execute_sql` for schema changes.

- [ ] **Step 3: Add `scheduled_at` to the Entry interface**

In `src/types/models.ts`, find the `Entry` interface and add after `publishedAt`:

```typescript
scheduled_at?: string | null;
```

- [ ] **Step 4: Verify typecheck passes**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260318_add_publishing_fields.sql src/types/models.ts
SKIP_AUDIT=1 git commit -m "feat(publishing): add scheduled_at to entries and page_id/org_urn to platform_connections"
```

---

## Task 2: `usePublish` Hook (TDD)

**Files:**

- Create: `src/hooks/domain/usePublish.ts`
- Create: `src/hooks/domain/__tests__/usePublish.test.ts`
- Modify: `src/hooks/domain/index.ts`

**Background:** The domain hook pattern uses dependency injection — see `src/hooks/domain/useYearPlan.ts` for the exact pattern. The hook receives `{ currentUser, pushSyncToast, publishSettings, onUpdateEntry }` and exposes `{ postNow, schedule, isPosting, lastResult }`. `postNow` calls `supabase.functions.invoke('publish-entry', ...)`. `schedule` fires a no-cors fetch to the Zapier webhook URL from publishSettings. Neither uses `runSyncTask` — these are user-initiated real-time operations, not background sync queue items.

**Note:** There is already a `usePublishing.ts` hook (manages publish settings and goals). The new `usePublish.ts` is distinct — it handles imperative publish operations.

The existing `src/features/publishing/publishUtils.ts` exports `buildPublishPayload(entry, settings)` and `triggerPublish(url, payload)` helpers — use these in the hook rather than reimplementing.

- [ ] **Step 1: Write the failing tests**

Create `src/hooks/domain/__tests__/usePublish.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePublish } from '../usePublish';
import { supabase } from '../../../lib/supabase';
import { triggerPublish } from '../../../features/publishing/publishUtils';

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

// Mock the publishUtils helpers
vi.mock('../../../features/publishing/publishUtils', () => ({
  buildPublishPayload: vi.fn((entry) => ({
    entryId: entry.id,
    platforms: entry.platforms,
    caption: entry.caption,
    platformCaptions: entry.platformCaptions ?? {},
    mediaUrls: [],
  })),
  triggerPublish: vi.fn(),
}));

const mockEntry = {
  id: 'entry-1',
  platforms: ['Instagram', 'LinkedIn'],
  caption: 'Test caption',
  platformCaptions: {},
  workflowStatus: 'Approved',
  publishStatus: {},
};

const mockDeps = {
  currentUser: 'user-1',
  publishSettings: {
    webhookUrl: 'https://hooks.zapier.com/test',
    webhookSecret: '',
    autoPublishOnApproval: false,
  },
  onUpdateEntry: vi.fn(),
  pushSyncToast: vi.fn(),
};

describe('usePublish', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('postNow: calls supabase.functions.invoke with correct payload', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: [
        {
          platform: 'Instagram',
          status: 'published',
          url: 'https://instagram.com/p/abc',
          error: null,
        },
        { platform: 'LinkedIn', status: 'published', url: null, error: null },
      ],
      error: null,
    });

    const { result } = renderHook(() => usePublish(mockDeps));

    let results: unknown;
    await act(async () => {
      results = await result.current.postNow(mockEntry as any, ['Instagram', 'LinkedIn']);
    });

    expect(supabase.functions.invoke).toHaveBeenCalledWith('publish-entry', {
      body: expect.objectContaining({
        entryId: 'entry-1',
        platforms: ['Instagram', 'LinkedIn'],
      }),
    });
    expect(results).toHaveLength(2);
  });

  it('postNow: calls pushSyncToast with success message on full success', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: [{ platform: 'Instagram', status: 'published', url: null, error: null }],
      error: null,
    });

    const { result } = renderHook(() => usePublish(mockDeps));
    await act(async () => {
      await result.current.postNow(mockEntry as any, ['Instagram']);
    });

    expect(mockDeps.pushSyncToast).toHaveBeenCalledWith(
      expect.stringContaining('Instagram'),
      'success',
    );
  });

  it('postNow: calls pushSyncToast with error variant on full failure', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: [{ platform: 'Instagram', status: 'failed', url: null, error: 'Token expired' }],
      error: null,
    });

    const { result } = renderHook(() => usePublish(mockDeps));
    await act(async () => {
      await result.current.postNow(mockEntry as any, ['Instagram']);
    });

    expect(mockDeps.pushSyncToast).toHaveBeenCalledWith(
      expect.stringContaining('Instagram'),
      'error',
    );
  });

  it('postNow: calls onUpdateEntry with updated publishStatus', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: [
        {
          platform: 'Instagram',
          status: 'published',
          url: 'https://instagram.com/p/x',
          error: null,
          timestamp: '2026-03-18T10:00:00Z',
        },
      ],
      error: null,
    });

    const { result } = renderHook(() => usePublish(mockDeps));
    await act(async () => {
      await result.current.postNow(mockEntry as any, ['Instagram']);
    });

    expect(mockDeps.onUpdateEntry).toHaveBeenCalledWith('entry-1', {
      publishStatus: expect.objectContaining({
        Instagram: expect.objectContaining({ status: 'published' }),
      }),
    });
  });

  it('postNow: isPosting is true during flight, false after', async () => {
    let resolve: (v: unknown) => void;
    vi.mocked(supabase.functions.invoke).mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );

    const { result } = renderHook(() => usePublish(mockDeps));
    act(() => {
      result.current.postNow(mockEntry as any, ['Instagram']);
    });
    expect(result.current.isPosting).toBe(true);

    await act(async () => {
      resolve!({ data: [], error: null });
    });
    expect(result.current.isPosting).toBe(false);
  });

  it('schedule: fires triggerPublish with scheduledDate and calls onUpdateEntry', async () => {
    vi.mocked(triggerPublish).mockResolvedValue(undefined);

    const { result } = renderHook(() => usePublish(mockDeps));
    await act(async () => {
      await result.current.schedule(mockEntry as any, ['Instagram'], '2026-07-11T10:00:00Z');
    });

    expect(triggerPublish).toHaveBeenCalledWith(
      'https://hooks.zapier.com/test',
      expect.objectContaining({ scheduledDate: '2026-07-11T10:00:00Z' }),
    );
    expect(mockDeps.onUpdateEntry).toHaveBeenCalledWith('entry-1', {
      scheduled_at: '2026-07-11T10:00:00Z',
    });
  });

  it('postNow: surfaces network failure toast when invoke throws', async () => {
    vi.mocked(supabase.functions.invoke).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => usePublish(mockDeps));
    await act(async () => {
      await result.current.postNow(mockEntry as any, ['Instagram']);
    });

    expect(mockDeps.pushSyncToast).toHaveBeenCalledWith(
      expect.stringContaining('Could not reach publishing service'),
      'error',
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- usePublish --run
```

Expected: FAIL — `usePublish` module not found.

- [ ] **Step 3: Implement `usePublish.ts`**

Create `src/hooks/domain/usePublish.ts`:

```typescript
import { useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { buildPublishPayload, triggerPublish } from '../../features/publishing/publishUtils';
import type { Entry } from '../../types/models';
import type { PublishSettings } from '../../types/models';

export interface PublishResult {
  platform: string;
  status: 'published' | 'failed' | 'skipped';
  url: string | null;
  error: string | null;
  timestamp?: string;
  warning?: string;
}

interface UsePublishDeps {
  currentUser: string | null;
  publishSettings: PublishSettings;
  onUpdateEntry: (id: string, updates: Partial<Entry>) => void;
  pushSyncToast: (message: string, variant: 'success' | 'error') => void;
}

export function usePublish({
  currentUser,
  publishSettings,
  onUpdateEntry,
  pushSyncToast,
}: UsePublishDeps) {
  const [isPosting, setIsPosting] = useState(false);
  const [lastResult, setLastResult] = useState<PublishResult[] | null>(null);

  const postNow = useCallback(
    async (entry: Entry, platforms: string[]): Promise<PublishResult[]> => {
      setIsPosting(true);
      try {
        const payload = buildPublishPayload(entry, publishSettings);
        const { data, error } = await supabase.functions.invoke('publish-entry', {
          body: { ...payload, platforms },
        });

        if (error) {
          pushSyncToast('Could not reach publishing service — check your connection', 'error');
          return [];
        }

        const results: PublishResult[] = data ?? [];
        setLastResult(results);

        // Build updated publishStatus
        const updatedStatus: Record<string, object> = { ...(entry.publishStatus ?? {}) };
        for (const r of results) {
          if (r.status !== 'skipped') {
            updatedStatus[r.platform] = {
              status: r.status === 'published' ? 'published' : 'failed',
              url: r.url,
              error: r.error,
              timestamp: r.timestamp ?? new Date().toISOString(),
            };
          }
        }
        onUpdateEntry(entry.id, { publishStatus: updatedStatus as Entry['publishStatus'] });

        // Build toast message
        const succeeded = results.filter((r) => r.status === 'published').map((r) => r.platform);
        const failed = results.filter((r) => r.status === 'failed');

        if (failed.length === 0 && succeeded.length > 0) {
          pushSyncToast(`Posted to ${succeeded.join(', ')} ✓`, 'success');
        } else if (failed.length > 0) {
          const failMsgs = failed.map((r) => `${r.platform} failed: ${r.error}`).join(' · ');
          const successPart = succeeded.length > 0 ? `Posted to ${succeeded.join(', ')} ✓ · ` : '';
          pushSyncToast(
            `${successPart}${failMsgs}`,
            failed.length === results.filter((r) => r.status !== 'skipped').length
              ? 'error'
              : 'success',
          );
        }

        return results;
      } catch {
        pushSyncToast('Could not reach publishing service — check your connection', 'error');
        return [];
      } finally {
        setIsPosting(false);
      }
    },
    [publishSettings, onUpdateEntry, pushSyncToast],
  );

  const schedule = useCallback(
    async (entry: Entry, platforms: string[], datetime: string): Promise<void> => {
      const payload = buildPublishPayload(entry, publishSettings);
      await triggerPublish(publishSettings.webhookUrl, {
        ...payload,
        platforms,
        scheduledDate: datetime,
      });
      onUpdateEntry(entry.id, { scheduled_at: datetime });
      const d = new Date(datetime);
      const label = d.toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
      pushSyncToast(`Scheduled for ${label} via Zapier`, 'success');
    },
    [publishSettings, onUpdateEntry, pushSyncToast],
  );

  return { postNow, schedule, isPosting, lastResult };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- usePublish --run
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Export from domain index**

In `src/hooks/domain/index.ts`, add:

```typescript
export { usePublish } from './usePublish';
```

- [ ] **Step 6: Full test suite**

```bash
npm test -- --run
```

Expected: all existing tests still pass.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/domain/usePublish.ts src/hooks/domain/__tests__/usePublish.test.ts src/hooks/domain/index.ts
SKIP_AUDIT=1 git commit -m "feat(publishing): add usePublish hook with postNow and schedule"
```

---

## Task 3: Instagram + Facebook Publishers

**Files:**

- Modify: `supabase/functions/publish-entry/index.ts`

**Background:** This file is Deno TypeScript — it runs in Supabase Edge Functions, not Node. The `PUBLISHERS` map has `Instagram` and `Facebook` keys already pointing to stub functions. Each publisher receives `(conn: PlatformConnection, payload: PublishPayload)` and returns `Promise<PlatformResult>`. The `PlatformConnection` type inside this function will have `access_token` (OAuth token), `account_id`, and — after Task 1 migration — `page_id`. The `PlatformResult` shape is `{ status: 'published' | 'failed' | 'skipped', url: string | null, postId: string | null, error: string | null, timestamp: string }`.

**Note:** No automated tests for Edge Functions — verify TypeScript correctness via `deno check` or Supabase CLI, and test manually using a real connected account.

- [ ] **Step 1: Add `page_id` to the local PlatformConnection type in the function**

Near the top of `supabase/functions/publish-entry/index.ts`, find the `PlatformConnection` interface and add:

```typescript
page_id?: string | null;
organisation_urn?: string | null;
```

- [ ] **Step 2: Implement `publishToInstagram`**

Replace the Instagram stub with:

```typescript
async function publishToInstagram(
  conn: PlatformConnection,
  payload: PublishPayload,
): Promise<PlatformResult> {
  const ts = new Date().toISOString();
  if (!conn.page_id) {
    return {
      status: 'failed',
      url: null,
      postId: null,
      error: 'No linked Facebook Page found',
      timestamp: ts,
    };
  }

  try {
    // Get IG Business Account ID via the linked Page
    const pageRes = await fetch(
      `https://graph.facebook.com/v19.0/${conn.page_id}?fields=instagram_business_account&access_token=${conn.access_token}`,
    );
    const pageData = await pageRes.json();
    const igUserId: string | undefined = pageData.instagram_business_account?.id;
    if (!igUserId) {
      return {
        status: 'failed',
        url: null,
        postId: null,
        error: 'No Instagram Business account linked to Facebook Page',
        timestamp: ts,
      };
    }

    const caption = payload.platformCaptions?.Instagram ?? payload.caption;

    // Step 1: Create media container
    const containerRes = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: payload.previewUrl,
        caption,
        access_token: conn.access_token,
      }),
    });
    if (!containerRes.ok) {
      if (containerRes.status === 401 || containerRes.status === 403) {
        return {
          status: 'failed',
          url: null,
          postId: null,
          error: 'Token expired — reconnect account',
          timestamp: ts,
        };
      }
      const err = await containerRes.json();
      return {
        status: 'failed',
        url: null,
        postId: null,
        error: err.error?.message ?? 'Failed to create media container',
        timestamp: ts,
      };
    }
    const { id: creationId } = await containerRes.json();

    // Step 2: Publish container
    const publishRes = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: creationId, access_token: conn.access_token }),
    });
    if (!publishRes.ok) {
      const err = await publishRes.json();
      return {
        status: 'failed',
        url: null,
        postId: null,
        error: err.error?.message ?? 'Failed to publish media',
        timestamp: ts,
      };
    }
    const { id: postId } = await publishRes.json();

    // Fetch permalink
    const permalinkRes = await fetch(
      `https://graph.facebook.com/v19.0/${postId}?fields=permalink&access_token=${conn.access_token}`,
    );
    const permalinkData = await permalinkRes.json();
    const url: string | null = permalinkData.permalink ?? null;

    return { status: 'published', url, postId, error: null, timestamp: ts };
  } catch (e) {
    return {
      status: 'failed',
      url: null,
      postId: null,
      error: e instanceof Error ? e.message : 'Unknown error',
      timestamp: ts,
    };
  }
}
```

- [ ] **Step 3: Implement `publishToFacebook`**

Replace the Facebook stub with:

```typescript
async function publishToFacebook(
  conn: PlatformConnection,
  payload: PublishPayload,
): Promise<PlatformResult> {
  const ts = new Date().toISOString();
  if (!conn.page_id) {
    return {
      status: 'failed',
      url: null,
      postId: null,
      error: 'No linked Facebook Page found',
      timestamp: ts,
    };
  }

  try {
    const message = payload.platformCaptions?.Facebook ?? payload.caption;
    const body: Record<string, string> = { message, access_token: conn.access_token };
    if (payload.previewUrl) body.link = payload.previewUrl;

    const res = await fetch(`https://graph.facebook.com/v19.0/${conn.page_id}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return {
          status: 'failed',
          url: null,
          postId: null,
          error: 'Token expired — reconnect account',
          timestamp: ts,
        };
      }
      const err = await res.json();
      return {
        status: 'failed',
        url: null,
        postId: null,
        error: err.error?.message ?? 'Failed to post',
        timestamp: ts,
      };
    }

    const { id: postId } = await res.json();
    // postId format is "pageId_postId"
    const [pageId, pid] = postId.split('_');
    const url = pid ? `https://www.facebook.com/${pageId}/posts/${pid}` : null;
    return { status: 'published', url, postId, error: null, timestamp: ts };
  } catch (e) {
    return {
      status: 'failed',
      url: null,
      postId: null,
      error: e instanceof Error ? e.message : 'Unknown error',
      timestamp: ts,
    };
  }
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
npm run typecheck
```

Expected: no errors (frontend types). For Deno types, run `deno check supabase/functions/publish-entry/index.ts` if Deno CLI is available.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/publish-entry/index.ts
SKIP_AUDIT=1 git commit -m "feat(publishing): implement Instagram and Facebook publishers"
```

---

## Task 4: LinkedIn + YouTube Publishers

**Files:**

- Modify: `supabase/functions/publish-entry/index.ts`

- [ ] **Step 1: Implement `publishToLinkedIn`**

Replace the LinkedIn stub with:

```typescript
async function publishToLinkedIn(
  conn: PlatformConnection,
  payload: PublishPayload,
): Promise<PlatformResult> {
  const ts = new Date().toISOString();
  const author = conn.organisation_urn ?? `urn:li:person:${conn.account_id}`;
  const isPersonalFallback = !conn.organisation_urn;

  try {
    const text = payload.platformCaptions?.LinkedIn ?? payload.caption;
    const body = {
      author,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    };

    const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${conn.access_token}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return {
          status: 'failed',
          url: null,
          postId: null,
          error: 'Token expired — reconnect account',
          timestamp: ts,
        };
      }
      const err = await res.json();
      return {
        status: 'failed',
        url: null,
        postId: null,
        error: err.message ?? 'Failed to post',
        timestamp: ts,
      };
    }

    const postId = res.headers.get('x-restli-id') ?? '';
    return {
      status: 'published',
      url: null, // LinkedIn API does not return a direct post URL
      postId,
      error: null,
      warning: isPersonalFallback ? 'Posting as individual — no organisation URN found' : undefined,
      timestamp: ts,
    };
  } catch (e) {
    return {
      status: 'failed',
      url: null,
      postId: null,
      error: e instanceof Error ? e.message : 'Unknown error',
      timestamp: ts,
    };
  }
}
```

- [ ] **Step 2: Implement `publishToYouTube`**

Replace the YouTube stub with:

```typescript
async function publishToYouTube(
  conn: PlatformConnection,
  payload: PublishPayload,
): Promise<PlatformResult> {
  const ts = new Date().toISOString();

  // YouTube is video-only — skip silently if no video asset
  if (!payload.videoUrl) {
    return { status: 'skipped', url: null, postId: null, error: null, timestamp: ts };
  }

  try {
    const title = (payload.caption ?? '').slice(0, 100) || 'Untitled';
    const description = payload.platformCaptions?.YouTube ?? payload.caption ?? '';

    // 1. Initiate resumable upload session
    const initRes = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${conn.access_token}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': 'video/*',
        },
        body: JSON.stringify({
          snippet: { title, description },
          status: { privacyStatus: 'public' },
        }),
      },
    );

    if (!initRes.ok) {
      if (initRes.status === 401 || initRes.status === 403) {
        return {
          status: 'failed',
          url: null,
          postId: null,
          error: 'Token expired — reconnect account',
          timestamp: ts,
        };
      }
      return {
        status: 'failed',
        url: null,
        postId: null,
        error: 'Failed to initiate upload',
        timestamp: ts,
      };
    }

    const uploadUrl = initRes.headers.get('location');
    if (!uploadUrl) {
      return {
        status: 'failed',
        url: null,
        postId: null,
        error: 'No upload URL returned',
        timestamp: ts,
      };
    }

    // 2. Fetch and stream the video
    const videoRes = await fetch(payload.videoUrl);
    if (!videoRes.ok || !videoRes.body) {
      return {
        status: 'failed',
        url: null,
        postId: null,
        error: 'Could not fetch video asset',
        timestamp: ts,
      };
    }

    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'video/*' },
      body: videoRes.body,
    });

    if (!uploadRes.ok) {
      return {
        status: 'failed',
        url: null,
        postId: null,
        error: 'Video upload failed',
        timestamp: ts,
      };
    }

    const { id: videoId } = await uploadRes.json();
    return {
      status: 'published',
      url: `https://www.youtube.com/watch?v=${videoId}`,
      postId: videoId,
      error: null,
      timestamp: ts,
    };
  } catch (e) {
    return {
      status: 'failed',
      url: null,
      postId: null,
      error: e instanceof Error ? e.message : 'Unknown error',
      timestamp: ts,
    };
  }
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Run full test suite**

```bash
npm test -- --run
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/publish-entry/index.ts
SKIP_AUDIT=1 git commit -m "feat(publishing): implement LinkedIn and YouTube publishers"
```

---

## Task 5: `PublishPanel` Component

**Files:**

- Create: `src/features/publishing/PublishPanel.tsx`

**Background:** This component is a self-contained publish UI — no new hooks, just consumes `postNow` and `schedule` functions passed as props. It reads `entry.platforms` to pre-tick checkboxes, checks `platformConnections` to disable ticked but unconnected platforms, validates the schedule datetime is in the future, and displays the existing `entry.publishStatus` as a status strip below the buttons.

It does NOT manage its own async state — the parent passes `isPosting` down as a prop.

- [ ] **Step 1: Create the component**

Create `src/features/publishing/PublishPanel.tsx`:

```typescript
import { useState, useMemo } from 'react';
import type { Entry, PlatformPublishStatus } from '../../types/models';
import type { PublishResult } from '../../hooks/domain/usePublish';

interface PlatformConnection {
  platform: string;
  is_active: boolean;
  expires_at: string | null;
}

interface PublishPanelProps {
  entry: Entry;
  platformConnections: PlatformConnection[];
  isPosting: boolean;
  webhookConfigured: boolean;
  onPostNow: (entry: Entry, platforms: string[]) => Promise<PublishResult[]>;
  onSchedule: (entry: Entry, platforms: string[], datetime: string) => Promise<void>;
  onGoToConnections: () => void;
}

function isExpired(conn: PlatformConnection): boolean {
  if (!conn.expires_at) return false;
  return new Date(conn.expires_at) < new Date();
}

const STATUS_COLOURS: Record<string, string> = {
  published: 'bg-green-500',
  failed: 'bg-red-500',
  pending: 'bg-amber-400',
  publishing: 'bg-amber-400',
};

export function PublishPanel({
  entry,
  platformConnections,
  isPosting,
  webhookConfigured,
  onPostNow,
  onSchedule,
  onGoToConnections,
}: PublishPanelProps) {
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(entry.platforms ?? []);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  const connectedPlatforms = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const conn of platformConnections) {
      map[conn.platform] = conn.is_active && !isExpired(conn);
    }
    return map;
  }, [platformConnections]);

  const hasValidSelection = selectedPlatforms.some((p) => connectedPlatforms[p]);

  const scheduleDatetime = scheduleDate && scheduleTime ? `${scheduleDate}T${scheduleTime}:00` : '';
  const isFutureDate = scheduleDatetime ? new Date(scheduleDatetime) > new Date() : false;
  const canSchedule = hasValidSelection && isFutureDate && webhookConfigured;

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform],
    );
  };

  const handlePostNow = () => {
    const platforms = selectedPlatforms.filter((p) => connectedPlatforms[p]);
    onPostNow(entry, platforms);
  };

  const handleSchedule = () => {
    if (!scheduleDatetime || !isFutureDate) return;
    const platforms = selectedPlatforms.filter((p) => connectedPlatforms[p]);
    onSchedule(entry, platforms, new Date(scheduleDatetime).toISOString());
  };

  const publishStatus = entry.publishStatus ?? {};
  const hasStatus = Object.keys(publishStatus).length > 0;

  return (
    <div className="w-44 shrink-0 border-l border-gray-200 pl-4 py-2 flex flex-col gap-3">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Publish</p>

      {/* Platform checkboxes */}
      <div className="flex flex-col gap-1">
        {(entry.platforms ?? []).map((platform) => {
          const connected = connectedPlatforms[platform];
          return (
            <label
              key={platform}
              className={`flex items-center gap-1.5 text-xs ${connected ? 'cursor-pointer' : 'opacity-50'}`}
            >
              <input
                type="checkbox"
                checked={selectedPlatforms.includes(platform)}
                disabled={!connected}
                onChange={() => togglePlatform(platform)}
                className="rounded"
              />
              <span>{platform}</span>
              {!connected && (
                <button
                  onClick={onGoToConnections}
                  className="text-sky-500 underline ml-auto"
                  title="Connect in Settings"
                >
                  Connect
                </button>
              )}
            </label>
          );
        })}
      </div>

      {/* Post now */}
      <button
        onClick={handlePostNow}
        disabled={!hasValidSelection || isPosting}
        className="w-full bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white text-xs font-semibold rounded-md py-1.5 flex items-center justify-center gap-1"
      >
        {isPosting ? (
          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
            <path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" className="opacity-75" />
          </svg>
        ) : null}
        Post now
      </button>

      {/* Schedule */}
      <div className="flex flex-col gap-1">
        <p className="text-xs text-gray-500">Schedule for:</p>
        <input
          type="date"
          value={scheduleDate}
          onChange={(e) => setScheduleDate(e.target.value)}
          className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs"
        />
        <input
          type="time"
          value={scheduleTime}
          onChange={(e) => setScheduleTime(e.target.value)}
          className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs"
        />
        {scheduleDatetime && !isFutureDate && (
          <p className="text-xs text-red-500">Must be a future date/time</p>
        )}
        <button
          onClick={handleSchedule}
          disabled={!canSchedule}
          className="w-full border border-sky-500 text-sky-500 hover:bg-sky-50 disabled:opacity-40 text-xs font-semibold rounded-md py-1.5"
        >
          Schedule
        </button>
      </div>

      {/* Published status strip */}
      {hasStatus && (
        <div className="flex flex-col gap-1 pt-1 border-t border-gray-100">
          {Object.entries(publishStatus).map(([platform, ps]) => {
            const s = ps as PlatformPublishStatus;
            return (
              <div key={platform} className="flex items-center gap-1.5 text-xs">
                <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_COLOURS[s.status] ?? 'bg-gray-300'}`} />
                <span className="truncate">{platform}</span>
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noreferrer" className="text-sky-500 ml-auto shrink-0">↗</a>
                ) : s.error ? (
                  <span className="text-red-400 ml-auto truncate max-w-16" title={s.error}>!</span>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/publishing/PublishPanel.tsx
SKIP_AUDIT=1 git commit -m "feat(publishing): add PublishPanel component"
```

---

## Task 6: Wire into Entry Modal + app.jsx

**Files:**

- Modify: entry modal file (find below)
- Modify: `src/app.jsx`

**Background:** `app.jsx` is large (~76KB). The `usePublish` hook is instantiated there alongside other domain hooks. The EntryModal receives `postNow` and `schedule` as props and renders `PublishPanel` in a right-side column when `entry.workflowStatus === 'Approved'`.

- [ ] **Step 1: Find the entry modal file**

```bash
grep -rn "workflowStatus" src/features/ --include="*.tsx" -l
```

Look for the file that renders the main entry edit form — it likely contains the word "modal" or "EntryModal" and renders the caption, platforms, and workflow status fields. Note the file path before continuing.

- [ ] **Step 2: Check how entry updates are sent back**

In the entry modal file, find the prop or callback that saves/updates an entry (e.g. `onSave`, `onUpdate`, `onChange`). Note the exact function signature — you'll use this for `onUpdateEntry` in `usePublish`.

- [ ] **Step 2b: Verify hook return shapes in app.jsx**

Before wiring, confirm the exact property names used in app.jsx:

```bash
grep -n "usePublishing\|useEntries\|useSyncQueue" src/app.jsx | head -20
```

Look for how each hook's result is destructured or named. The next step assumes `publishing.settings`, `entries.updateEntry`, and `sync.pushSyncToast` — adjust if the actual names differ.

- [ ] **Step 3: Instantiate `usePublish` in `app.jsx`**

In `src/app.jsx`, after the existing `useYearPlan` hook instantiation, add:

```javascript
const {
  postNow,
  schedule: schedulePost,
  isPosting,
} = usePublish({
  currentUser,
  publishSettings: publishing.settings, // from existing usePublishing hook
  onUpdateEntry: entries.updateEntry, // from existing useEntries hook
  pushSyncToast: sync.pushSyncToast,
});
```

**Note:** Verify the exact names — `publishing.settings` comes from `usePublishing`, `entries.updateEntry` from `useEntries`, `sync.pushSyncToast` from `useSyncQueue`. Check the existing hook return values near the top of app.jsx if unsure.

- [ ] **Step 4: Pass props to the entry modal**

Find where the entry modal component is rendered in `app.jsx` and add props:

```jsx
<EntryModal
  {/* ... existing props ... */}
  postNow={postNow}
  schedulePost={schedulePost}
  isPosting={isPosting}
  platformConnections={publishing.connections}  // from usePublishing
  webhookConfigured={!!publishing.settings?.webhookUrl}
/>
```

- [ ] **Step 5: Render `PublishPanel` in the entry modal**

In the entry modal file, add `postNow`, `schedulePost`, `isPosting`, `platformConnections`, `webhookConfigured` to the props type, then find the outermost layout div (likely a flex row) and add `PublishPanel` as a right column:

```tsx
import { PublishPanel } from '../publishing/PublishPanel';

// In the modal body, inside the flex row that holds the main form:
{
  entry.workflowStatus === 'Approved' && (
    <PublishPanel
      entry={entry}
      platformConnections={platformConnections}
      isPosting={isPosting}
      onPostNow={postNow}
      onSchedule={schedulePost}
      onGoToConnections={onGoToConnections} // existing prop or add navigation callback
      webhookConfigured={webhookConfigured}
    />
  );
}
```

- [ ] **Step 6: Verify TypeScript**

```bash
npm run typecheck
```

Fix any type errors before proceeding.

- [ ] **Step 7: Run full test suite**

```bash
npm test -- --run
```

Expected: all tests pass.

- [ ] **Step 8: Final commit**

```bash
git add src/app.jsx <entry-modal-file>
SKIP_AUDIT=1 git commit -m "feat(publishing): wire PublishPanel into entry modal and app"
```

---

## Verification

After all tasks:

1. **TypeScript:** `npm run typecheck` — no errors
2. **Tests:** `npm test -- --run` — all pass
3. **Build:** `npm run build` — no bundle regressions
4. **Manual smoke test (approved entry):**
   - Open an Approved entry
   - Confirm PublishPanel appears on the right side
   - Confirm platforms from the entry are pre-ticked
   - Confirm "Post now" fires (BlueSky is the only live publisher — test with a connected BlueSky account)
   - Confirm "Schedule" fires Zapier webhook and shows toast
   - Confirm platform without a connection shows "Connect" link and disabled checkbox
