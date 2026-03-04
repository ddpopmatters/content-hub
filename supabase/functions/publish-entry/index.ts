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
  // TODO: Phase 3 — Meta Graph API
  // Requires: access_token (Page Access Token), account_id (Instagram Business Account ID)
  // 1. Create media container: POST /{ig-user-id}/media
  // 2. Publish container:      POST /{ig-user-id}/media_publish
  return {
    status: 'skipped',
    url: null,
    postId: null,
    error: 'Instagram integration coming in Phase 3',
    timestamp,
  };
}

async function publishToFacebook(
  conn: PlatformConnection,
  payload: PublishPayload,
): Promise<PlatformResult> {
  const timestamp = new Date().toISOString();
  // TODO: Phase 3 — Meta Graph API (same app as Instagram)
  // POST /{page-id}/photos or /{page-id}/feed
  return {
    status: 'skipped',
    url: null,
    postId: null,
    error: 'Facebook integration coming in Phase 3',
    timestamp,
  };
}

async function publishToLinkedIn(
  conn: PlatformConnection,
  payload: PublishPayload,
): Promise<PlatformResult> {
  const timestamp = new Date().toISOString();
  // TODO: Phase 4 — LinkedIn UGC Post API
  // POST /ugcPosts with author = urn:li:organisation:{id}
  return {
    status: 'skipped',
    url: null,
    postId: null,
    error: 'LinkedIn integration coming in Phase 4',
    timestamp,
  };
}

async function publishToYouTube(
  conn: PlatformConnection,
  payload: PublishPayload,
): Promise<PlatformResult> {
  const timestamp = new Date().toISOString();
  // TODO: Phase 6 — YouTube Data API v3
  // Resumable upload to /upload/youtube/v3/videos
  return {
    status: 'skipped',
    url: null,
    postId: null,
    error: 'YouTube integration coming in Phase 6',
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
