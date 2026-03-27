# Publish Format Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three correctness bugs in the platform publishers: broken Instagram result URL, unused LinkedIn first-comment field, and unsafe `org_account_id` type cast.

**Architecture:** All changes are in `supabase/functions/publish-entry/index.ts` (platform publishers) and `supabase/functions/_shared/types.ts` (type definition). No client-side changes needed — `firstComment` is already in the payload.

**Tech Stack:** Deno/TypeScript Edge Function, LinkedIn UGC Posts API v2, Instagram Graph API v19

---

### Task 1: Fix `PlatformConnection` type — add `org_account_id`

**Files:**

- Modify: `supabase/functions/_shared/types.ts`
- Modify: `supabase/functions/publish-entry/index.ts:415-416`

- [ ] **Step 1: Add `org_account_id` to the interface**

In `supabase/functions/_shared/types.ts`, change:

```typescript
export interface PlatformConnection {
  id: string;
  platform: string;
  account_id: string;
  account_name: string;
  access_token: string | null;
  refresh_token: string | null;
  token_secret: string | null;
  expires_at: string | null;
  scope: string | null;
}
```

To:

```typescript
export interface PlatformConnection {
  id: string;
  platform: string;
  account_id: string;
  account_name: string;
  access_token: string | null;
  refresh_token: string | null;
  token_secret: string | null;
  expires_at: string | null;
  scope: string | null;
  org_account_id?: string | null;
}
```

- [ ] **Step 2: Remove the unsafe cast in `publishToLinkedIn`**

In `supabase/functions/publish-entry/index.ts`, line 415, change:

```typescript
const orgId = (conn as unknown as Record<string, string>).org_account_id;
```

To:

```typescript
const orgId = conn.org_account_id;
```

- [ ] **Step 3: Run typecheck**

```bash
cd "/Users/dan/dev/population_matters/tools/Content Hub" && npm run typecheck
```

Expected: no errors related to `org_account_id`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/_shared/types.ts supabase/functions/publish-entry/index.ts
git commit -m "fix(publish): add org_account_id to PlatformConnection type"
```

---

### Task 2: Fix Instagram result URL — use `permalink` field

**Files:**

- Modify: `supabase/functions/publish-entry/index.ts:235-261`

**Context:** `media_publish` returns `{ id }` which is a numeric media ID. Instagram `/p/{id}/` URLs expect a shortcode — the numeric ID doesn't resolve. Fix: after publishing, fetch `/{mediaId}?fields=permalink,shortcode` to get the canonical URL.

- [ ] **Step 1: Update `publishRes` response type and add permalink fetch**

In `publishToInstagram`, replace lines 250–261:

```typescript
const publishData = (await publishRes.json()) as { id?: string };
if (!publishData.id) {
  throw new Error('Instagram publish failed: no post ID returned');
}

return {
  status: 'published',
  url: `https://www.instagram.com/p/${publishData.id}/`,
  postId: publishData.id,
  error: null,
  timestamp,
};
```

With:

```typescript
const publishData = (await publishRes.json()) as { id?: string };
if (!publishData.id) {
  throw new Error('Instagram publish failed: no post ID returned');
}

// Fetch the permalink — publishData.id is a numeric media ID, not a shortcode
let postUrl: string | null = null;
const permalinkRes = await fetch(
  `https://graph.facebook.com/v19.0/${publishData.id}?${new URLSearchParams({
    fields: 'permalink',
    access_token: page.access_token,
  })}`,
);
if (permalinkRes.ok) {
  const permalinkData = (await permalinkRes.json()) as { permalink?: string };
  postUrl = permalinkData.permalink ?? null;
}

return {
  status: 'published',
  url: postUrl,
  postId: publishData.id,
  error: null,
  timestamp,
};
```

- [ ] **Step 2: Run typecheck**

```bash
cd "/Users/dan/dev/population_matters/tools/Content Hub" && npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/publish-entry/index.ts
git commit -m "fix(publish): fetch Instagram permalink after publish instead of constructing from numeric ID"
```

---

### Task 3: Post LinkedIn first comment after publish

**Files:**

- Modify: `supabase/functions/publish-entry/index.ts:510-521`

**Context:** `payload.firstComment` is already sent from the client but ignored. LinkedIn supports posting a comment immediately after publishing via `POST /v2/socialActions/{encoded-urn}/comments`. The comment actor must match the post author URN. The URN must be URL-encoded in the path (`:` → `%3A`).

- [ ] **Step 1: Add first-comment posting after successful ugcPosts call**

In `publishToLinkedIn`, replace lines 510–521:

```typescript
const postUrn = postRes.headers.get('x-restli-id');
if (!postUrn) {
  throw new Error('LinkedIn publish failed: no post URN returned');
}

return {
  status: 'published',
  url: `https://www.linkedin.com/feed/update/${postUrn}/`,
  postId: postUrn,
  error: null,
  timestamp,
};
```

With:

```typescript
const postUrn = postRes.headers.get('x-restli-id');
if (!postUrn) {
  throw new Error('LinkedIn publish failed: no post URN returned');
}

// Post first comment if provided
if (payload.firstComment?.trim()) {
  const encodedUrn = encodeURIComponent(postUrn);
  await fetch(`https://api.linkedin.com/v2/socialActions/${encodedUrn}/comments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      actor: authorUrn,
      message: { text: payload.firstComment.trim() },
    }),
  }).catch(() => {
    // First comment failure is non-fatal — the post itself succeeded
  });
}

return {
  status: 'published',
  url: `https://www.linkedin.com/feed/update/${postUrn}/`,
  postId: postUrn,
  error: null,
  timestamp,
};
```

- [ ] **Step 2: Run typecheck**

```bash
cd "/Users/dan/dev/population_matters/tools/Content Hub" && npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/publish-entry/index.ts
git commit -m "feat(publish): post firstComment to LinkedIn after successful publish"
```

---

## Self-Review

**Spec coverage:**

- Instagram URL fix → Task 2 ✓
- LinkedIn first comment → Task 3 ✓
- `org_account_id` type → Task 1 ✓
- `mediaUrls` ignored → intentionally deferred (design decision, not a bug)
- Facebook/Instagram `data[0]` → intentionally deferred (UX decision)
- YouTube always skipped → no fix needed (correct behaviour)
- No auth header on Edge Function call → out of scope (separate security concern)

**Placeholder scan:** No TBDs. All code blocks are complete.

**Type consistency:** `page.access_token` used in Task 2 is available in scope (already used on line 222 in the same function). `authorUrn`, `headers`, and `payload.firstComment` used in Task 3 are all in scope within `publishToLinkedIn`.
