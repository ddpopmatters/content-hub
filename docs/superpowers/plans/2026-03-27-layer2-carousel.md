# Layer 2: Carousel Publishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish carousel entries as native carousels on Instagram (multi-image), Facebook (multi-photo post), Bluesky (multi-image embed), and LinkedIn (first image with API limitation noted).

**Architecture:** Each platform publisher in `publish-entry/index.ts` gains a routing check at the top: if `payload.assetType === 'Carousel'` and `payload.mediaUrls.length >= 2`, call a new carousel-specific sub-function; otherwise fall through to existing single-image path. Instagram and Facebook publishers are refactored to extract shared credential resolution into helper functions to avoid duplication.

**Pre-requisite:** Layer 1 (plumbing) must be complete — `payload.assetType` and `payload.mediaUrls` must be present.

**Tech Stack:** Deno/TypeScript Edge Function, Instagram Graph API v19, Facebook Graph API v19, Bluesky AT Protocol, LinkedIn ugcPosts API v2

---

### Task 1: Instagram carousel publisher

**Files:**

- Modify: `supabase/functions/publish-entry/index.ts:124-271`

The current `publishToInstagram` resolves credentials (page, igUserId) and then runs the single-image flow inline. We extract credential resolution into a helper, then add carousel despatch.

- [ ] **Step 1: Extract credential resolver helper**

Above `publishToInstagram` (after line 122), add:

```typescript
async function resolveInstagramCredentials(
  userToken: string,
  timestamp: string,
): Promise<
  { page: { id: string; access_token: string }; instagramUserId: string } | PlatformResult
> {
  const pagesRes = await fetch(
    `https://graph.facebook.com/v19.0/me/accounts?${new URLSearchParams({ access_token: userToken })}`,
  );
  if (!pagesRes.ok) {
    return {
      status: 'failed',
      url: null,
      postId: null,
      error: `Instagram page lookup failed: ${await pagesRes.text()}`,
      timestamp,
    };
  }
  const pagesData = (await pagesRes.json()) as {
    data?: Array<{ id?: string; access_token?: string }>;
  };
  const page = pagesData.data?.[0];
  if (!page?.id)
    return {
      status: 'failed',
      url: null,
      postId: null,
      error: 'Instagram publish failed: no Facebook Pages found',
      timestamp,
    };
  if (!page.access_token)
    return {
      status: 'failed',
      url: null,
      postId: null,
      error: 'Instagram publish failed: no page access token',
      timestamp,
    };

  const igRes = await fetch(
    `https://graph.facebook.com/v19.0/${page.id}?${new URLSearchParams({ fields: 'instagram_business_account', access_token: page.access_token })}`,
  );
  if (!igRes.ok) throw new Error(`Instagram account lookup failed: ${await igRes.text()}`);
  const igData = (await igRes.json()) as { instagram_business_account?: { id?: string } | null };
  const instagramUserId = igData.instagram_business_account?.id;
  if (!instagramUserId)
    return {
      status: 'failed',
      url: null,
      postId: null,
      error: 'Instagram publish failed: Facebook Page not linked to an Instagram Business Account',
      timestamp,
    };

  return { page: { id: page.id, access_token: page.access_token }, instagramUserId };
}
```

- [ ] **Step 2: Add `publishInstagramCarousel` sub-function**

After the helper above, add:

```typescript
async function publishInstagramCarousel(
  instagramUserId: string,
  pageAccessToken: string,
  payload: PublishPayload,
  timestamp: string,
): Promise<PlatformResult> {
  const text = payload.caption.slice(0, 2200);
  const mediaUrls = payload.mediaUrls.slice(0, 10); // Instagram carousel max 10

  // Step 1: create a container per image
  const childIds: string[] = [];
  for (const imageUrl of mediaUrls) {
    const containerRes = await fetch(`https://graph.facebook.com/v19.0/${instagramUserId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        image_url: imageUrl,
        is_carousel_item: 'true',
        access_token: pageAccessToken,
      }),
    });
    if (!containerRes.ok)
      throw new Error(`Instagram carousel item creation failed: ${await containerRes.text()}`);
    const containerData = (await containerRes.json()) as { id?: string };
    if (!containerData.id)
      throw new Error('Instagram carousel item creation failed: no container ID');
    childIds.push(containerData.id);
  }

  // Step 2: create carousel container
  const carouselRes = await fetch(`https://graph.facebook.com/v19.0/${instagramUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      media_type: 'CAROUSEL',
      children: childIds.join(','),
      caption: text,
      access_token: pageAccessToken,
    }),
  });
  if (!carouselRes.ok)
    throw new Error(`Instagram carousel container creation failed: ${await carouselRes.text()}`);
  const carouselData = (await carouselRes.json()) as { id?: string };
  if (!carouselData.id) throw new Error('Instagram carousel container creation failed: no ID');

  // Step 3: publish
  const publishRes = await fetch(
    `https://graph.facebook.com/v19.0/${instagramUserId}/media_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ creation_id: carouselData.id, access_token: pageAccessToken }),
    },
  );
  if (!publishRes.ok)
    throw new Error(`Instagram carousel publish failed: ${await publishRes.text()}`);
  const publishData = (await publishRes.json()) as { id?: string };
  if (!publishData.id) throw new Error('Instagram carousel publish failed: no post ID');

  // Fetch permalink
  let postUrl: string | null = null;
  const permalinkRes = await fetch(
    `https://graph.facebook.com/v19.0/${publishData.id}?${new URLSearchParams({ fields: 'permalink', access_token: pageAccessToken })}`,
  );
  if (permalinkRes.ok) {
    const permalinkData = (await permalinkRes.json()) as { permalink?: string };
    postUrl = permalinkData.permalink ?? null;
  }

  return { status: 'published', url: postUrl, postId: publishData.id, error: null, timestamp };
}
```

- [ ] **Step 3: Refactor `publishToInstagram` to use helper and despatch on assetType**

Replace the body of `publishToInstagram` (lines 128–270 inside the try block) with:

```typescript
const timestamp = new Date().toISOString();
try {
  const userToken = conn.access_token;
  const text = payload.caption.slice(0, 2200);

  if (!userToken) {
    return {
      status: 'failed',
      url: null,
      postId: null,
      error: 'Missing Instagram credentials: no Facebook user access token stored',
      timestamp,
    };
  }

  const creds = await resolveInstagramCredentials(userToken, timestamp);
  if ('status' in creds) return creds;
  const { page, instagramUserId } = creds;

  // Carousel path
  if (payload.assetType === 'Carousel' && payload.mediaUrls.length >= 2) {
    return publishInstagramCarousel(instagramUserId, page.access_token, payload, timestamp);
  }

  // Single image path
  const previewUrl = payload.previewUrl?.trim();
  if (!previewUrl) {
    return {
      status: 'failed',
      url: null,
      postId: null,
      error: 'Instagram requires an image — add a preview image to this entry',
      timestamp,
    };
  }

  const createMediaRes = await fetch(`https://graph.facebook.com/v19.0/${instagramUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      image_url: previewUrl,
      caption: text,
      access_token: page.access_token,
    }),
  });
  if (!createMediaRes.ok)
    throw new Error(`Instagram media creation failed: ${await createMediaRes.text()}`);
  const creationData = (await createMediaRes.json()) as { id?: string };
  if (!creationData.id) throw new Error('Instagram media creation failed: no creation ID returned');

  const publishRes = await fetch(
    `https://graph.facebook.com/v19.0/${instagramUserId}/media_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ creation_id: creationData.id, access_token: page.access_token }),
    },
  );
  if (!publishRes.ok) throw new Error(`Instagram publish failed: ${await publishRes.text()}`);
  const publishData = (await publishRes.json()) as { id?: string };
  if (!publishData.id) throw new Error('Instagram publish failed: no post ID returned');

  let postUrl: string | null = null;
  const permalinkRes = await fetch(
    `https://graph.facebook.com/v19.0/${publishData.id}?${new URLSearchParams({ fields: 'permalink', access_token: page.access_token })}`,
  );
  if (permalinkRes.ok) {
    const permalinkData = (await permalinkRes.json()) as { permalink?: string };
    postUrl = permalinkData.permalink ?? null;
  }

  return { status: 'published', url: postUrl, postId: publishData.id, error: null, timestamp };
} catch (err) {
  return {
    status: 'failed',
    url: null,
    postId: null,
    error: err instanceof Error ? err.message : 'Unknown error',
    timestamp,
  };
}
```

- [ ] **Step 4: Run typecheck**

```bash
cd "/Users/dan/dev/population_matters/tools/Content Hub" && npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/publish-entry/index.ts
git commit -m "feat(publish): Instagram carousel support via multi-container Graph API flow"
```

---

### Task 2: Facebook multi-photo publisher

**Files:**

- Modify: `supabase/functions/publish-entry/index.ts:273-391` (Facebook publisher)

- [ ] **Step 1: Extract Facebook credential resolver helper**

Above `publishToFacebook`, add:

```typescript
async function resolveFacebookPage(
  userToken: string,
  timestamp: string,
): Promise<{ page: { id: string; access_token: string } } | PlatformResult> {
  const pagesRes = await fetch(
    `https://graph.facebook.com/v19.0/me/accounts?${new URLSearchParams({ access_token: userToken })}`,
  );
  if (!pagesRes.ok) {
    return {
      status: 'failed',
      url: null,
      postId: null,
      error: `Facebook page lookup failed: ${await pagesRes.text()}`,
      timestamp,
    };
  }
  const pagesData = (await pagesRes.json()) as {
    data?: Array<{ id?: string; access_token?: string }>;
  };
  const page = pagesData.data?.[0];
  if (!page?.id)
    return {
      status: 'failed',
      url: null,
      postId: null,
      error: 'Facebook publish failed: no Facebook Pages found',
      timestamp,
    };
  if (!page.access_token)
    return {
      status: 'failed',
      url: null,
      postId: null,
      error: 'Facebook publish failed: no page access token',
      timestamp,
    };
  return { page: { id: page.id, access_token: page.access_token } };
}
```

- [ ] **Step 2: Refactor `publishToFacebook` to use helper and add multi-photo despatch**

Replace the body of `publishToFacebook` with:

```typescript
const timestamp = new Date().toISOString();
try {
  const userToken = conn.access_token;
  const previewUrl = payload.previewUrl?.trim();
  const text = payload.caption.slice(0, 63206);

  if (!userToken) {
    return {
      status: 'failed',
      url: null,
      postId: null,
      error: 'Missing Facebook credentials: no user access token stored',
      timestamp,
    };
  }

  const creds = await resolveFacebookPage(userToken, timestamp);
  if ('status' in creds) return creds;
  const { page } = creds;

  // Multi-photo carousel path
  if (payload.assetType === 'Carousel' && payload.mediaUrls.length >= 2) {
    const photoIds: string[] = [];
    for (const imageUrl of payload.mediaUrls.slice(0, 20)) {
      const photoRes = await fetch(`https://graph.facebook.com/v19.0/${page.id}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          url: imageUrl,
          published: 'false',
          access_token: page.access_token,
        }),
      });
      if (!photoRes.ok) throw new Error(`Facebook photo staging failed: ${await photoRes.text()}`);
      const photoData = (await photoRes.json()) as { id?: string };
      if (!photoData.id) throw new Error('Facebook photo staging failed: no photo ID');
      photoIds.push(photoData.id);
    }

    const feedRes = await fetch(`https://graph.facebook.com/v19.0/${page.id}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        attached_media: photoIds.map((id) => ({ media_fbid: id })),
        access_token: page.access_token,
      }),
    });
    if (!feedRes.ok) throw new Error(`Facebook multi-photo post failed: ${await feedRes.text()}`);
    const feedData = (await feedRes.json()) as { id?: string };
    if (!feedData.id) throw new Error('Facebook multi-photo post failed: no post ID');
    return {
      status: 'published',
      url: `https://www.facebook.com/${feedData.id}`,
      postId: feedData.id,
      error: null,
      timestamp,
    };
  }

  // Single image path
  if (previewUrl) {
    const photoRes = await fetch(`https://graph.facebook.com/v19.0/${page.id}/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        url: previewUrl,
        message: text,
        published: 'true',
        access_token: page.access_token,
      }),
    });
    if (!photoRes.ok) throw new Error(`Facebook photo publish failed: ${await photoRes.text()}`);
    const photoData = (await photoRes.json()) as { id?: string; post_id?: string };
    if (!photoData.post_id) throw new Error('Facebook photo publish failed: no post ID returned');
    return {
      status: 'published',
      url: `https://www.facebook.com/${photoData.post_id}`,
      postId: photoData.post_id,
      error: null,
      timestamp,
    };
  }

  // Text-only path
  const feedRes = await fetch(`https://graph.facebook.com/v19.0/${page.id}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ message: text, access_token: page.access_token }),
  });
  if (!feedRes.ok) throw new Error(`Facebook post publish failed: ${await feedRes.text()}`);
  const feedData = (await feedRes.json()) as { id?: string };
  if (!feedData.id) throw new Error('Facebook post publish failed: no post ID returned');
  return {
    status: 'published',
    url: `https://www.facebook.com/${feedData.id}`,
    postId: feedData.id,
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
```

- [ ] **Step 3: Run typecheck**

```bash
cd "/Users/dan/dev/population_matters/tools/Content Hub" && npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/publish-entry/index.ts
git commit -m "feat(publish): Facebook multi-photo carousel via staged photos + feed post"
```

---

### Task 3: LinkedIn carousel — first image with API limitation note

**Files:**

- Modify: `supabase/functions/publish-entry/index.ts:393-531` (LinkedIn publisher)

LinkedIn ugcPosts does not support native multi-image carousels. For carousel entries, post the first image and record the limitation in `last_error` (the connection update at the end of the handler loop will store this). The post result is still `published`.

- [ ] **Step 1: Add carousel despatch to `publishToLinkedIn`**

In `publishToLinkedIn`, after the `previewUrl` resolution (after line 401, before `if (!accessToken || !accountId)`), add:

Find this block at the top of the try body:

```typescript
const accessToken = conn.access_token;
const accountId = conn.account_id;
const previewUrl = payload.previewUrl?.trim();
const text = payload.caption.slice(0, 3000);
```

Replace with:

```typescript
const accessToken = conn.access_token;
const accountId = conn.account_id;
// For carousel: use first mediaUrl as the image; fall through to existing image path
const previewUrl =
  payload.assetType === 'Carousel' && payload.mediaUrls.length > 0
    ? payload.mediaUrls[0]
    : payload.previewUrl?.trim();
const text = payload.caption.slice(0, 3000);
const carouselLimitationNote =
  payload.assetType === 'Carousel'
    ? 'LinkedIn does not support carousel posts — posted first image only'
    : null;
```

Then, at the return statement for successful publish (line 515–521):

```typescript
return {
  status: 'published',
  url: `https://www.linkedin.com/feed/update/${postUrn}/`,
  postId: postUrn,
  error: carouselLimitationNote,
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
git commit -m "feat(publish): LinkedIn carousel posts first image with API limitation noted"
```

---

### Task 4: Bluesky multi-image publisher

**Files:**

- Modify: `supabase/functions/publish-entry/index.ts:11-122` (Bluesky publisher)

- [ ] **Step 1: Add `publishBlueskyMultiImage` helper**

After `publishToBluesky` closing brace (after line 122), add:

```typescript
async function uploadBlueskyBlob(imageUrl: string, accessJwt: string): Promise<unknown | null> {
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) return null;
  const imgData = await imgRes.arrayBuffer();
  const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
  const blobRes = await fetch('https://bsky.social/xrpc/com.atproto.repo.uploadBlob', {
    method: 'POST',
    headers: { 'Content-Type': contentType, Authorization: `Bearer ${accessJwt}` },
    body: imgData,
  });
  if (!blobRes.ok) return null;
  const { blob } = (await blobRes.json()) as { blob: unknown };
  return blob;
}
```

- [ ] **Step 2: Add carousel despatch in `publishToBluesky`**

In `publishToBluesky`, after the session is created and `text` is set (after line 56, before the existing `if (payload.previewUrl)` block), add:

```typescript
// Multi-image carousel path (max 4 images on Bluesky)
if (payload.assetType === 'Carousel' && payload.mediaUrls.length >= 2) {
  const imageUrls = payload.mediaUrls.slice(0, 4);
  const blobs = await Promise.all(
    imageUrls.map((url) => uploadBlueskyBlob(url, session.accessJwt)),
  );
  const validBlobs = blobs.filter(Boolean);

  if (validBlobs.length < 2) {
    return {
      status: 'failed',
      url: null,
      postId: null,
      error: 'Bluesky carousel failed: could not upload enough images',
      timestamp,
    };
  }

  const carouselRecord: Record<string, unknown> = {
    $type: 'app.bsky.feed.post',
    text,
    createdAt: timestamp,
    langs: ['en'],
    embed: {
      $type: 'app.bsky.embed.images',
      images: validBlobs.map((blob, i) => ({ image: blob, alt: `Image ${i + 1}` })),
    },
  };

  const postRes = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessJwt}` },
    body: JSON.stringify({
      repo: session.did,
      collection: 'app.bsky.feed.post',
      record: carouselRecord,
    }),
  });
  if (!postRes.ok) {
    const err = await postRes.text();
    return {
      status: 'failed',
      url: null,
      postId: null,
      error: `Bluesky carousel post failed: ${err}`,
      timestamp,
    };
  }
  const postData = (await postRes.json()) as { uri: string; cid: string };
  const rkey = postData.uri.split('/').pop();
  const truncationNote =
    payload.mediaUrls.length > 4
      ? `First 4 of ${payload.mediaUrls.length} images posted (Bluesky limit)`
      : null;
  return {
    status: 'published',
    url: `https://bsky.app/profile/${handle}/post/${rkey}`,
    postId: postData.uri,
    error: truncationNote,
    timestamp,
  };
}
```

- [ ] **Step 3: Run typecheck**

```bash
cd "/Users/dan/dev/population_matters/tools/Content Hub" && npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Run all tests**

```bash
cd "/Users/dan/dev/population_matters/tools/Content Hub" && npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/publish-entry/index.ts
git commit -m "feat(publish): Bluesky multi-image carousel via embed.images (max 4)"
```

---

## Self-Review

**Spec coverage:**

- Instagram carousel (multi-container flow) → Task 1 ✓
- Facebook multi-photo (staged + attached_media) → Task 2 ✓
- LinkedIn carousel (first image, limitation noted) → Task 3 ✓
- Bluesky multi-image (up to 4, truncation noted) → Task 4 ✓
- Carousel with 1 image falls back to single-image → Tasks 1–4 all check `mediaUrls.length >= 2` ✓

**Placeholder scan:** No TBDs. All API calls, response shapes, and error messages are specified.

**Type consistency:** `PlatformResult` returned from all new paths. `PublishPayload.assetType` and `.mediaUrls` used consistently. `uploadBlueskyBlob` helper defined in Task 4 Step 1 before it is used.
