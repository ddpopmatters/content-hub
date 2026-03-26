import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import type { PublishPayload, PlatformResult, PlatformConnection } from '../_shared/types.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('PUBLISH_WEBHOOK_SECRET');

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

async function publishToInstagram(
  conn: PlatformConnection,
  payload: PublishPayload,
): Promise<PlatformResult> {
  const timestamp = new Date().toISOString();
  try {
    const userToken = conn.access_token;
    const previewUrl = payload.previewUrl?.trim();
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

    if (!previewUrl) {
      return {
        status: 'failed',
        url: null,
        postId: null,
        error: 'Instagram requires an image — add a preview image to this entry',
        timestamp,
      };
    }

    const pagesRes = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?${new URLSearchParams({
        access_token: userToken,
      })}`,
    );
    if (!pagesRes.ok) {
      throw new Error(`Instagram page lookup failed: ${await pagesRes.text()}`);
    }

    const pagesData = (await pagesRes.json()) as {
      data?: Array<{ id?: string; name?: string; access_token?: string }>;
    };
    const page = pagesData.data?.[0];

    if (!page?.id) {
      return {
        status: 'failed',
        url: null,
        postId: null,
        error: 'Instagram publish failed: no Facebook Pages found for this connection',
        timestamp,
      };
    }

    if (!page.access_token) {
      return {
        status: 'failed',
        url: null,
        postId: null,
        error: 'Instagram publish failed: could not resolve a Facebook Page access token',
        timestamp,
      };
    }

    const igAccountRes = await fetch(
      `https://graph.facebook.com/v19.0/${page.id}?${new URLSearchParams({
        fields: 'instagram_business_account',
        access_token: page.access_token,
      })}`,
    );
    if (!igAccountRes.ok) {
      throw new Error(`Instagram account lookup failed: ${await igAccountRes.text()}`);
    }

    const igAccountData = (await igAccountRes.json()) as {
      instagram_business_account?: { id?: string } | null;
    };
    const instagramUserId = igAccountData.instagram_business_account?.id;

    if (!instagramUserId) {
      return {
        status: 'failed',
        url: null,
        postId: null,
        error:
          'Instagram publish failed: the selected Facebook Page is not linked to an Instagram Business Account',
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

    return {
      status: 'published',
      url: `https://www.instagram.com/p/${publishData.id}/`,
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

    const pagesRes = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?${new URLSearchParams({
        access_token: userToken,
      })}`,
    );
    if (!pagesRes.ok) {
      throw new Error(`Facebook page lookup failed: ${await pagesRes.text()}`);
    }

    const pagesData = (await pagesRes.json()) as {
      data?: Array<{ id?: string; name?: string; access_token?: string }>;
    };
    const page = pagesData.data?.[0];

    if (!page?.id) {
      return {
        status: 'failed',
        url: null,
        postId: null,
        error: 'Facebook publish failed: no Facebook Pages found for this connection',
        timestamp,
      };
    }

    if (!page.access_token) {
      return {
        status: 'failed',
        url: null,
        postId: null,
        error: 'Facebook publish failed: could not resolve a Facebook Page access token',
        timestamp,
      };
    }

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
    const previewUrl = payload.previewUrl?.trim();
    const text = payload.caption.slice(0, 3000);

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
    const orgId = (conn as unknown as Record<string, string>).org_account_id;
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

    return {
      status: 'published',
      url: `https://www.linkedin.com/feed/update/${postUrn}/`,
      postId: postUrn,
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
        const conn = (connections ?? []).find((c) => c.platform === platform);
        if (!conn) {
          results[platform] = {
            status: 'failed',
            url: null,
            postId: null,
            error: `No active connection found for ${platform}`,
            timestamp,
          };
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

        results[platform] = await publisher(conn, platformPayload);

        // Update last_used_at and any errors
        await supabase
          .from('platform_connections')
          .update({
            last_used_at: timestamp,
            last_error: results[platform].status === 'failed' ? results[platform].error : null,
          })
          .eq('id', conn.id);
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
