import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import type { PublishPayload, PlatformResult, PlatformConnection } from '../_shared/types.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('PUBLISH_WEBHOOK_SECRET');
const LINKEDIN_CLIENT_ID = Deno.env.get('LINKEDIN_CLIENT_ID') ?? '';
const LINKEDIN_CLIENT_SECRET = Deno.env.get('LINKEDIN_CLIENT_SECRET') ?? '';
const LINKEDIN_ORG_CLIENT_ID = Deno.env.get('LINKEDIN_ORG_CLIENT_ID') ?? '';
const LINKEDIN_ORG_CLIENT_SECRET = Deno.env.get('LINKEDIN_ORG_CLIENT_SECRET') ?? '';
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') ?? '';
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '';

function isTokenExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  const expiryTime = new Date(expiresAt).getTime();
  return Number.isFinite(expiryTime) && expiryTime <= Date.now() + 60_000;
}

async function refreshLinkedInAccessToken(
  conn: PlatformConnection,
): Promise<{ access_token: string; refresh_token: string | null; expires_at: string | null }> {
  if (!conn.refresh_token) {
    throw new Error('LinkedIn connection has expired and must be reconnected.');
  }

  const clientId = conn.platform === 'LinkedIn Org' ? LINKEDIN_ORG_CLIENT_ID : LINKEDIN_CLIENT_ID;
  const clientSecret =
    conn.platform === 'LinkedIn Org' ? LINKEDIN_ORG_CLIENT_SECRET : LINKEDIN_CLIENT_SECRET;

  const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: conn.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(`LinkedIn token refresh failed: ${await tokenRes.text()}`);
  }

  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? conn.refresh_token,
    expires_at: tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : conn.expires_at,
  };
}

async function refreshGoogleAccessToken(
  conn: PlatformConnection,
): Promise<{ access_token: string; refresh_token: string | null; expires_at: string | null }> {
  if (!conn.refresh_token) {
    throw new Error('Google connection has expired and must be reconnected.');
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: conn.refresh_token,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(`Google token refresh failed: ${await tokenRes.text()}`);
  }

  const tokens = (await tokenRes.json()) as {
    access_token: string;
    expires_in?: number;
  };

  return {
    access_token: tokens.access_token,
    refresh_token: conn.refresh_token,
    expires_at: tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : conn.expires_at,
  };
}

async function persistRefreshedConnection(
  connectionId: string,
  updates: { access_token: string; refresh_token: string | null; expires_at: string | null },
) {
  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  await serviceClient
    .from('platform_connections')
    .update({
      access_token: updates.access_token,
      refresh_token: updates.refresh_token,
      expires_at: updates.expires_at,
      last_error: null,
    })
    .eq('id', connectionId);
}

async function ensureFreshConnection(
  conn: PlatformConnection,
  timestamp: string,
): Promise<PlatformConnection | PlatformResult> {
  if (!isTokenExpired(conn.expires_at)) {
    return conn;
  }

  try {
    if (conn.platform === 'LinkedIn' || conn.platform === 'LinkedIn Org') {
      const refreshed = await refreshLinkedInAccessToken(conn);
      const updated = { ...conn, ...refreshed };
      await persistRefreshedConnection(conn.id, refreshed);
      return updated;
    }

    if (conn.platform === 'YouTube') {
      const refreshed = await refreshGoogleAccessToken(conn);
      const updated = { ...conn, ...refreshed };
      await persistRefreshedConnection(conn.id, refreshed);
      return updated;
    }

    return {
      status: 'failed',
      url: null,
      postId: null,
      error: `${conn.platform} connection has expired. Reconnect it before publishing.`,
      timestamp,
    };
  } catch (error) {
    return {
      status: 'failed',
      url: null,
      postId: null,
      error: error instanceof Error ? error.message : `${conn.platform} token refresh failed.`,
      timestamp,
    };
  }
}

// ─── Platform publishers ────────────────────────────────────────────────────

async function publishToBluesky(
  conn: PlatformConnection,
  payload: PublishPayload,
): Promise<PlatformResult> {
  const timestamp = new Date().toISOString();
  try {
    // conn.token_secret = app password, conn.account_id = handle (e.g. user.bsky.social)
    const handle = conn.account_id;
    const appPassword = conn.token_secret;

    if (!handle || !appPassword) {
      return {
        status: 'failed',
        url: null,
        postId: null,
        error: 'Missing BlueSky credentials',
        timestamp,
      };
    }

    // Create session
    const sessionRes = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: handle, password: appPassword }),
    });
    if (!sessionRes.ok) {
      const err = await sessionRes.text();
      return {
        status: 'failed',
        url: null,
        postId: null,
        error: `BlueSky auth failed: ${err}`,
        timestamp,
      };
    }
    const session = (await sessionRes.json()) as { did: string; accessJwt: string };

    // Build post record
    const text = payload.caption.slice(0, 300); // BlueSky 300 char limit

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
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.accessJwt}`,
        },
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

    const record: Record<string, unknown> = {
      $type: 'app.bsky.feed.post',
      text,
      createdAt: timestamp,
      langs: ['en'],
    };

    // Attach image if available
    if (payload.previewUrl) {
      const imgRes = await fetch(payload.previewUrl);
      if (imgRes.ok) {
        const imgData = await imgRes.arrayBuffer();
        const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
        const blobRes = await fetch('https://bsky.social/xrpc/com.atproto.repo.uploadBlob', {
          method: 'POST',
          headers: {
            'Content-Type': contentType,
            Authorization: `Bearer ${session.accessJwt}`,
          },
          body: imgData,
        });
        if (blobRes.ok) {
          const { blob } = (await blobRes.json()) as { blob: unknown };
          record.embed = {
            $type: 'app.bsky.embed.images',
            images: [{ image: blob, alt: text.slice(0, 100) }],
          };
        }
      }
    }

    // Create post
    const postRes = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.accessJwt}`,
      },
      body: JSON.stringify({
        repo: session.did,
        collection: 'app.bsky.feed.post',
        record,
      }),
    });

    if (!postRes.ok) {
      const err = await postRes.text();
      return {
        status: 'failed',
        url: null,
        postId: null,
        error: `BlueSky post failed: ${err}`,
        timestamp,
      };
    }

    const postData = (await postRes.json()) as { uri: string; cid: string };
    // Convert AT URI to web URL: at://did:plc:xxx/app.bsky.feed.post/rkey → https://bsky.app/profile/handle/post/rkey
    const rkey = postData.uri.split('/').pop();
    const url = `https://bsky.app/profile/${handle}/post/${rkey}`;

    return { status: 'published', url, postId: postData.uri, error: null, timestamp };
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

async function resolveInstagramCredentials(
  conn: PlatformConnection,
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
  const page = pagesData.data?.find((candidate) => candidate.id === conn.account_id);
  if (!page?.id)
    return {
      status: 'failed',
      url: null,
      postId: null,
      error:
        'Instagram publish failed: the connected Facebook Page is no longer accessible for this token',
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

async function publishToInstagram(
  conn: PlatformConnection,
  payload: PublishPayload,
): Promise<PlatformResult> {
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

    const creds = await resolveInstagramCredentials(conn, userToken, timestamp);
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

    const createMediaRes = await fetch(
      `https://graph.facebook.com/v19.0/${instagramUserId}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          image_url: previewUrl,
          caption: text,
          access_token: page.access_token,
        }),
      },
    );
    if (!createMediaRes.ok) {
      throw new Error(`Instagram media creation failed: ${await createMediaRes.text()}`);
    }

    const creationData = (await createMediaRes.json()) as { id?: string };
    if (!creationData.id) {
      throw new Error('Instagram media creation failed: no creation ID returned');
    }

    const publishRes = await fetch(
      `https://graph.facebook.com/v19.0/${instagramUserId}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          creation_id: creationData.id,
          access_token: page.access_token,
        }),
      },
    );
    if (!publishRes.ok) {
      throw new Error(`Instagram publish failed: ${await publishRes.text()}`);
    }

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

async function resolveFacebookPage(
  conn: PlatformConnection,
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
  const page = pagesData.data?.find((candidate) => candidate.id === conn.account_id);
  if (!page?.id)
    return {
      status: 'failed',
      url: null,
      postId: null,
      error:
        'Facebook publish failed: the connected Facebook Page is no longer accessible for this token',
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

async function publishToFacebook(
  conn: PlatformConnection,
  payload: PublishPayload,
): Promise<PlatformResult> {
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

    const creds = await resolveFacebookPage(conn, userToken, timestamp);
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
        if (!photoRes.ok)
          throw new Error(`Facebook photo staging failed: ${await photoRes.text()}`);
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

      if (!photoRes.ok) {
        throw new Error(`Facebook photo publish failed: ${await photoRes.text()}`);
      }

      const photoData = (await photoRes.json()) as { id?: string; post_id?: string };
      if (!photoData.post_id) {
        throw new Error('Facebook photo publish failed: no post ID returned');
      }

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
      body: new URLSearchParams({
        message: text,
        access_token: page.access_token,
      }),
    });

    if (!feedRes.ok) {
      throw new Error(`Facebook post publish failed: ${await feedRes.text()}`);
    }

    const feedData = (await feedRes.json()) as { id?: string };
    if (!feedData.id) {
      throw new Error('Facebook post publish failed: no post ID returned');
    }

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
}

async function publishToLinkedIn(
  conn: PlatformConnection,
  payload: PublishPayload,
): Promise<PlatformResult> {
  const timestamp = new Date().toISOString();
  try {
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

    if (!accessToken || !accountId) {
      return {
        status: 'failed',
        url: null,
        postId: null,
        error: 'Missing LinkedIn credentials: access token or account ID not found',
        timestamp,
      };
    }

    // Use org URN if stored (org_account_id), else fall back to personal URN
    const orgId = conn.org_account_id;
    const authorUrn = orgId ? `urn:li:organization:${orgId}` : `urn:li:person:${accountId}`;
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    };

    let mediaCategory: 'NONE' | 'IMAGE' = 'NONE';
    let media: Array<{ status: 'READY'; media: string }> | undefined;

    if (previewUrl) {
      const registerRes = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          registerUploadRequest: {
            recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
            owner: authorUrn,
            serviceRelationships: [
              {
                relationshipType: 'OWNER',
                identifier: 'urn:li:userGeneratedContent',
              },
            ],
          },
        }),
      });

      if (!registerRes.ok) {
        throw new Error(`LinkedIn upload registration failed: ${await registerRes.text()}`);
      }

      const registerData = (await registerRes.json()) as {
        value?: {
          uploadMechanism?: {
            'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'?: {
              uploadUrl?: string;
            };
          };
          asset?: string;
        };
      };
      const uploadUrl =
        registerData.value?.uploadMechanism?.[
          'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
        ]?.uploadUrl;
      const asset = registerData.value?.asset;

      if (!uploadUrl || !asset) {
        throw new Error('LinkedIn upload registration failed: missing upload URL or asset URN');
      }

      const imageRes = await fetch(previewUrl);
      if (!imageRes.ok) {
        throw new Error(`LinkedIn image fetch failed: ${await imageRes.text()}`);
      }

      const imageData = await imageRes.arrayBuffer();
      const imageContentType = imageRes.headers.get('content-type') || 'application/octet-stream';

      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': imageContentType },
        body: imageData,
      });
      if (!uploadRes.ok) {
        throw new Error(`LinkedIn image upload failed: ${await uploadRes.text()}`);
      }

      mediaCategory = 'IMAGE';
      media = [{ status: 'READY', media: asset }];
    }

    const postRes = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        author: authorUrn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text },
            shareMediaCategory: mediaCategory,
            ...(media ? { media } : {}),
          },
        },
        visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
      }),
    });

    if (!postRes.ok) {
      throw new Error(`LinkedIn publish failed: ${await postRes.text()}`);
    }

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
      error: carouselLimitationNote,
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

async function publishToLinkedInOrg(
  conn: PlatformConnection,
  payload: PublishPayload,
): Promise<PlatformResult> {
  // Always post as the org page — account_id is the org numeric ID
  const orgConn = {
    ...conn,
    org_account_id: conn.account_id,
  } as unknown as PlatformConnection;
  return publishToLinkedIn(orgConn, payload);
}

async function publishToYouTube(
  conn: PlatformConnection,
  payload: PublishPayload,
): Promise<PlatformResult> {
  const timestamp = new Date().toISOString();
  void conn;
  void payload;
  return {
    status: 'skipped',
    url: null,
    postId: null,
    error:
      'YouTube requires a video file — this platform is not available for image or caption posts. Upload the video directly via YouTube Studio.',
    timestamp,
  };
}

// ─── Router ─────────────────────────────────────────────────────────────────

const PUBLISHERS: Record<
  string,
  (conn: PlatformConnection, payload: PublishPayload) => Promise<PlatformResult>
> = {
  BlueSky: publishToBluesky,
  Instagram: publishToInstagram,
  Facebook: publishToFacebook,
  LinkedIn: publishToLinkedIn,
  'LinkedIn Org': publishToLinkedInOrg,
  YouTube: publishToYouTube,
};

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as PublishPayload & { webhookSecret?: string };

    // Validate webhook secret if configured
    if (WEBHOOK_SECRET && payload.webhookSecret !== WEBHOOK_SECRET) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch active connections for requested platforms
    const { data: connections, error: dbError } = await supabase
      .from('platform_connections')
      .select('*')
      .in('platform', payload.platforms)
      .eq('is_active', true);

    if (dbError) {
      return new Response(
        JSON.stringify({ success: false, error: `DB error: ${dbError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Publish to each requested platform concurrently
    const timestamp = new Date().toISOString();
    const results: Record<string, PlatformResult> = {};

    await Promise.all(
      payload.platforms.map(async (platform) => {
        const matchingConnections = (connections ?? []).filter(
          (connection) => connection.platform === platform,
        );
        if (matchingConnections.length === 0) {
          results[platform] = {
            status: 'failed',
            url: null,
            postId: null,
            error: `No active connection found for ${platform}`,
            timestamp,
          };
          return;
        }
        if (matchingConnections.length > 1) {
          results[platform] = {
            status: 'failed',
            url: null,
            postId: null,
            error: `Multiple active connections found for ${platform}. Disconnect the extra account before publishing.`,
            timestamp,
          };
          return;
        }

        const baseConnection = matchingConnections[0];
        const freshConnection = await ensureFreshConnection(baseConnection, timestamp);
        if ('status' in freshConnection) {
          results[platform] = freshConnection;
          return;
        }

        // Use platform-specific caption if available
        const platformPayload = {
          ...payload,
          caption: payload.platformCaptions?.[platform] || payload.caption,
        };

        const publisher = PUBLISHERS[platform];
        if (!publisher) {
          results[platform] = {
            status: 'failed',
            url: null,
            postId: null,
            error: `No publisher implemented for ${platform}`,
            timestamp,
          };
          return;
        }

        results[platform] = await publisher(freshConnection, platformPayload);

        // Update last_used_at and any errors
        await supabase
          .from('platform_connections')
          .update({
            last_used_at: timestamp,
            last_error: results[platform].status === 'failed' ? results[platform].error : null,
          })
          .eq('id', freshConnection.id);
      }),
    );

    const anySuccess = Object.values(results).some((r) => r.status === 'published');
    const allFailed = Object.values(results).every((r) => r.status === 'failed');

    // Fire callback if provided
    if (payload.callbackUrl) {
      fetch(payload.callbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId: payload.entryId, results }),
      }).catch(() => {});
    }

    return new Response(JSON.stringify({ success: !allFailed, results }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
