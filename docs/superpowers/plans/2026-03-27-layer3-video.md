# Layer 3: Video Publishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish video entries as native videos on Instagram (Reels), Facebook (video post), LinkedIn (video upload), Bluesky (video embed), and YouTube (resumable upload).

**Architecture:** Each publisher gains a `'Video'` branch that uses `payload.mediaUrls[0]` as the video source URL. Instagram requires polling for processing completion. YouTube implements a full resumable upload. All publishers return a structured `PlatformResult` — video failures are non-retried and surface a human-readable error.

**Pre-requisite:** Layer 1 (plumbing) must be complete. Layer 2 (carousel) is independent — these can be done in either order.

**Tech Stack:** Deno/TypeScript Edge Function, Instagram Graph API v19, Facebook Graph API v19, LinkedIn Assets API v2, Bluesky AT Protocol, YouTube Data API v3

---

### Task 1: Instagram Reels publisher

**Files:**

- Modify: `supabase/functions/publish-entry/index.ts` — inside `publishToInstagram`

Requires Layer 2's `resolveInstagramCredentials` helper to already exist. If Layer 2 is not yet done, implement that helper first (see Layer 2, Task 1, Step 1).

- [ ] **Step 1: Add `waitForInstagramContainer` polling helper**

Above `publishToInstagram`, add:

```typescript
async function waitForInstagramContainer(
  containerId: string,
  accessToken: string,
  maxAttempts = 10,
): Promise<{ ready: boolean; error?: string }> {
  for (let i = 0; i < maxAttempts; i++) {
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, 3000));
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${containerId}?${new URLSearchParams({
        fields: 'status_code',
        access_token: accessToken,
      })}`,
    );
    if (!res.ok) return { ready: false, error: await res.text() };
    const data = (await res.json()) as { status_code?: string };
    if (data.status_code === 'FINISHED') return { ready: true };
    if (data.status_code === 'ERROR')
      return { ready: false, error: 'Instagram video processing error — check Instagram Studio' };
  }
  return { ready: false, error: 'Video processing timed out — check Instagram Studio' };
}
```

- [ ] **Step 2: Add Reels despatch inside `publishToInstagram`**

In `publishToInstagram`, after the carousel despatch block (or after the credential resolution if Layer 2 is not yet done), add before the single-image path:

```typescript
// Instagram Reels path
if (payload.assetType === 'Video') {
  const videoUrl = payload.mediaUrls[0];
  if (!videoUrl) {
    return {
      status: 'failed',
      url: null,
      postId: null,
      error: 'Instagram Reels requires a video file — add a video to this entry',
      timestamp,
    };
  }

  const containerRes = await fetch(`https://graph.facebook.com/v19.0/${instagramUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      video_url: videoUrl,
      media_type: 'REELS',
      caption: text,
      access_token: page.access_token,
    }),
  });
  if (!containerRes.ok)
    throw new Error(`Instagram Reels container creation failed: ${await containerRes.text()}`);
  const containerData = (await containerRes.json()) as { id?: string };
  if (!containerData.id)
    throw new Error('Instagram Reels container creation failed: no container ID');

  const pollResult = await waitForInstagramContainer(containerData.id, page.access_token);
  if (!pollResult.ready) {
    return {
      status: 'failed',
      url: null,
      postId: null,
      error: pollResult.error ?? 'Instagram video processing failed',
      timestamp,
    };
  }

  const publishRes = await fetch(
    `https://graph.facebook.com/v19.0/${instagramUserId}/media_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ creation_id: containerData.id, access_token: page.access_token }),
    },
  );
  if (!publishRes.ok) throw new Error(`Instagram Reels publish failed: ${await publishRes.text()}`);
  const publishData = (await publishRes.json()) as { id?: string };
  if (!publishData.id) throw new Error('Instagram Reels publish failed: no post ID');

  let postUrl: string | null = null;
  const permalinkRes = await fetch(
    `https://graph.facebook.com/v19.0/${publishData.id}?${new URLSearchParams({ fields: 'permalink', access_token: page.access_token })}`,
  );
  if (permalinkRes.ok) {
    const permalinkData = (await permalinkRes.json()) as { permalink?: string };
    postUrl = permalinkData.permalink ?? null;
  }

  return { status: 'published', url: postUrl, postId: publishData.id, error: null, timestamp };
}
```

- [ ] **Step 3: Run typecheck**

```bash
cd "/Users/dan/dev/population_matters/tools/Content Hub" && npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/publish-entry/index.ts
git commit -m "feat(publish): Instagram Reels support with processing status polling"
```

---

### Task 2: Facebook video publisher

**Files:**

- Modify: `supabase/functions/publish-entry/index.ts` — inside `publishToFacebook`

Requires Layer 2's `resolveFacebookPage` helper. If Layer 2 is not yet done, implement that helper first (see Layer 2, Task 2, Step 1).

- [ ] **Step 1: Add video despatch inside `publishToFacebook`**

In `publishToFacebook`, after the carousel despatch block (or after credential resolution if Layer 2 not done), add before the single-image path:

```typescript
// Video path
if (payload.assetType === 'Video') {
  const videoUrl = payload.mediaUrls[0];
  if (!videoUrl) {
    return {
      status: 'failed',
      url: null,
      postId: null,
      error: 'Facebook video requires a video file — add a video to this entry',
      timestamp,
    };
  }

  const videoRes = await fetch(`https://graph.facebook.com/v19.0/${page.id}/videos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      file_url: videoUrl,
      description: text,
      access_token: page.access_token,
    }),
  });
  if (!videoRes.ok) throw new Error(`Facebook video publish failed: ${await videoRes.text()}`);
  const videoData = (await videoRes.json()) as { id?: string };
  if (!videoData.id) throw new Error('Facebook video publish failed: no video ID returned');

  return {
    status: 'published',
    url: `https://www.facebook.com/video/${videoData.id}`,
    postId: videoData.id,
    error: null,
    timestamp,
  };
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd "/Users/dan/dev/population_matters/tools/Content Hub" && npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/publish-entry/index.ts
git commit -m "feat(publish): Facebook video post via file_url parameter"
```

---

### Task 3: LinkedIn video publisher

**Files:**

- Modify: `supabase/functions/publish-entry/index.ts` — inside `publishToLinkedIn`

- [ ] **Step 1: Add video despatch in `publishToLinkedIn`**

In `publishToLinkedIn`, after the credentials block (`accessToken`, `accountId`, `authorUrn`, `headers` are set), before the existing `if (previewUrl)` image upload block, add:

```typescript
// Video path
if (payload.assetType === 'Video') {
  const videoUrl = payload.mediaUrls[0];
  if (!videoUrl) {
    return {
      status: 'failed',
      url: null,
      postId: null,
      error: 'LinkedIn video requires a video file — add a video to this entry',
      timestamp,
    };
  }

  const registerRes = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-video'],
        owner: authorUrn,
        serviceRelationships: [
          { relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' },
        ],
      },
    }),
  });
  if (!registerRes.ok)
    throw new Error(`LinkedIn video upload registration failed: ${await registerRes.text()}`);

  const registerData = (await registerRes.json()) as {
    value?: {
      uploadMechanism?: {
        'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'?: { uploadUrl?: string };
      };
      asset?: string;
    };
  };
  const uploadUrl =
    registerData.value?.uploadMechanism?.[
      'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
    ]?.uploadUrl;
  const asset = registerData.value?.asset;
  if (!uploadUrl || !asset)
    throw new Error('LinkedIn video upload registration failed: missing upload URL or asset URN');

  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) throw new Error(`LinkedIn video fetch failed: ${await videoRes.text()}`);
  const videoData = await videoRes.arrayBuffer();
  const videoContentType = videoRes.headers.get('content-type') || 'video/mp4';

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': videoContentType },
    body: videoData,
  });
  if (!uploadRes.ok) throw new Error(`LinkedIn video upload failed: ${await uploadRes.text()}`);

  const postRes = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text },
          shareMediaCategory: 'VIDEO',
          media: [{ status: 'READY', media: asset }],
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    }),
  });
  if (!postRes.ok) throw new Error(`LinkedIn video post failed: ${await postRes.text()}`);
  const postUrn = postRes.headers.get('x-restli-id');
  if (!postUrn) throw new Error('LinkedIn video post failed: no post URN returned');

  if (payload.firstComment?.trim()) {
    const encodedUrn = encodeURIComponent(postUrn);
    await fetch(`https://api.linkedin.com/v2/socialActions/${encodedUrn}/comments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ actor: authorUrn, message: { text: payload.firstComment.trim() } }),
    }).catch(() => {});
  }

  return {
    status: 'published',
    url: `https://www.linkedin.com/feed/update/${postUrn}/`,
    postId: postUrn,
    error: null,
    timestamp,
  };
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd "/Users/dan/dev/population_matters/tools/Content Hub" && npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/publish-entry/index.ts
git commit -m "feat(publish): LinkedIn video post via feedshare-video recipe"
```

---

### Task 4: Bluesky video publisher

**Files:**

- Modify: `supabase/functions/publish-entry/index.ts` — inside `publishToBluesky`

- [ ] **Step 1: Add video despatch in `publishToBluesky`**

In `publishToBluesky`, after the carousel despatch block (or after `text` is set and session is created), add before the existing `if (payload.previewUrl)` image block:

```typescript
// Video path
if (payload.assetType === 'Video') {
  const videoUrl = payload.mediaUrls[0];
  if (!videoUrl) {
    return {
      status: 'failed',
      url: null,
      postId: null,
      error: 'Bluesky video requires a video file — add a video to this entry',
      timestamp,
    };
  }

  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) {
    return {
      status: 'failed',
      url: null,
      postId: null,
      error: `Bluesky video fetch failed: ${await videoRes.text()}`,
      timestamp,
    };
  }
  const videoData = await videoRes.arrayBuffer();
  const videoContentType = videoRes.headers.get('content-type') || 'video/mp4';

  const blobRes = await fetch('https://bsky.social/xrpc/com.atproto.repo.uploadBlob', {
    method: 'POST',
    headers: { 'Content-Type': videoContentType, Authorization: `Bearer ${session.accessJwt}` },
    body: videoData,
  });
  if (!blobRes.ok) {
    return {
      status: 'failed',
      url: null,
      postId: null,
      error: `Bluesky video upload failed: ${await blobRes.text()}`,
      timestamp,
    };
  }
  const { blob } = (await blobRes.json()) as { blob: unknown };

  const videoRecord: Record<string, unknown> = {
    $type: 'app.bsky.feed.post',
    text,
    createdAt: timestamp,
    langs: ['en'],
    embed: { $type: 'app.bsky.embed.video', video: blob },
  };

  const postRes = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessJwt}` },
    body: JSON.stringify({
      repo: session.did,
      collection: 'app.bsky.feed.post',
      record: videoRecord,
    }),
  });
  if (!postRes.ok) {
    const err = await postRes.text();
    return {
      status: 'failed',
      url: null,
      postId: null,
      error: `Bluesky video post failed: ${err}`,
      timestamp,
    };
  }
  const postData = (await postRes.json()) as { uri: string; cid: string };
  const rkey = postData.uri.split('/').pop();
  return {
    status: 'published',
    url: `https://bsky.app/profile/${handle}/post/${rkey}`,
    postId: postData.uri,
    error: null,
    timestamp,
  };
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd "/Users/dan/dev/population_matters/tools/Content Hub" && npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/publish-entry/index.ts
git commit -m "feat(publish): Bluesky video post via embed.video blob upload"
```

---

### Task 5: YouTube video publisher

**Files:**

- Modify: `supabase/functions/publish-entry/index.ts:545-560` (replace `publishToYouTube` stub)

- [ ] **Step 1: Replace YouTube stub with full resumable upload**

Replace the entire `publishToYouTube` function (lines 545–560):

```typescript
async function publishToYouTube(
  conn: PlatformConnection,
  payload: PublishPayload,
): Promise<PlatformResult> {
  const timestamp = new Date().toISOString();
  try {
    const accessToken = conn.access_token;
    if (!accessToken) {
      return {
        status: 'failed',
        url: null,
        postId: null,
        error: 'Missing YouTube credentials — reconnect your account',
        timestamp,
      };
    }

    const videoUrl = payload.mediaUrls[0];
    if (!videoUrl) {
      return {
        status: 'failed',
        url: null,
        postId: null,
        error: 'YouTube requires a video file — add a video to this entry',
        timestamp,
      };
    }

    // Step 1: initiate resumable upload
    const initRes = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': 'video/mp4',
        },
        body: JSON.stringify({
          snippet: {
            title: payload.caption.slice(0, 100),
            description: payload.caption,
            categoryId: '22',
          },
          status: { privacyStatus: 'public' },
        }),
      },
    );
    if (!initRes.ok) throw new Error(`YouTube upload init failed: ${await initRes.text()}`);
    const uploadUri = initRes.headers.get('Location');
    if (!uploadUri) throw new Error('YouTube upload init failed: no upload URI returned');

    // Step 2: fetch video bytes
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok)
      throw new Error(`Failed to fetch video for YouTube: ${await videoRes.text()}`);
    const videoData = await videoRes.arrayBuffer();
    const videoContentType = videoRes.headers.get('content-type') || 'video/mp4';

    // Step 3: upload video
    const uploadRes = await fetch(uploadUri, {
      method: 'PUT',
      headers: { 'Content-Type': videoContentType },
      body: videoData,
    });
    if (!uploadRes.ok) throw new Error(`YouTube video upload failed: ${await uploadRes.text()}`);

    const uploadData = (await uploadRes.json()) as { id?: string };
    if (!uploadData.id) throw new Error('YouTube video upload failed: no video ID returned');

    return {
      status: 'published',
      url: `https://www.youtube.com/watch?v=${uploadData.id}`,
      postId: uploadData.id,
      error: null,
      timestamp,
    };
  } catch (err) {
    return {
      status: 'failed',
      url: null,
      postId: null,
      error: err instanceof Error ? err.message : 'Unknown error',
      timestamp,
    };
  }
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd "/Users/dan/dev/population_matters/tools/Content Hub" && npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Run all tests**

```bash
cd "/Users/dan/dev/population_matters/tools/Content Hub" && npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/publish-entry/index.ts
git commit -m "feat(publish): YouTube video upload via resumable upload API"
```

---

## Self-Review

**Spec coverage:**

- Instagram Reels (container → poll → publish) → Task 1 ✓
- Facebook video (`file_url` parameter) → Task 2 ✓
- LinkedIn video (`feedshare-video` recipe) → Task 3 ✓
- Bluesky video (`embed.video` blob) → Task 4 ✓
- YouTube resumable upload → Task 5 ✓
- Empty `mediaUrls` for video entries returns clear `failed` result → all tasks check `mediaUrls[0]` ✓
- Instagram polling timeout returns `failed` with human-readable message → Task 1 ✓
- LinkedIn video includes `firstComment` posting → Task 3 Step 1 ✓

**Placeholder scan:** No TBDs. All API endpoints, request shapes, and error paths are fully specified.

**Type consistency:** `waitForInstagramContainer` defined in Task 1 Step 1, used in Task 1 Step 2. `uploadBlueskyBlob` defined in Layer 2 Task 4 Step 1, not reused here (Bluesky video uses inline blob upload with different content-type handling). All functions return `Promise<PlatformResult>`.
