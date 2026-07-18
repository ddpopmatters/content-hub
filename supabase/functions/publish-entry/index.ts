import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { requireOwnerRequest } from '../_shared/ownerAuth.ts';
import { type PublishableEntryRow, requirePublishableEntry } from '../_shared/publishableEntry.ts';
import {
  type ManualPublicationOutcome,
  orchestrateFailedPublicationRetry,
  orchestrateManualPublication,
  type PublicationRetryContext,
  type PublisherOutcome,
} from '../_shared/publicationOrchestrator.ts';
import { createPublicationRepository } from '../_shared/publicationRepository.ts';
import { isAmbiguousProviderMutationResponse } from '../_shared/providerResponse.ts';
import { getTrustedLinkedInUploadUrl } from '../_shared/providerUploadUrl.ts';
import { META_GRAPH_API_BASE_URL } from '../_shared/providerVersions.ts';
import { createPublicationFailure, finalisePlatformResult } from '../_shared/publicationResult.ts';
import { getPublicationMediaIssue } from '../_shared/publicationMedia.ts';
import type {
  DurablePublicationJob,
  PlatformConnection,
  PlatformResult,
  PublishPayload,
} from '../_shared/types.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_PUBLISHABLE_KEY =
  Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const LINKEDIN_CLIENT_ID = Deno.env.get('LINKEDIN_CLIENT_ID') ?? '';
const LINKEDIN_CLIENT_SECRET = Deno.env.get('LINKEDIN_CLIENT_SECRET') ?? '';
const LINKEDIN_ORG_CLIENT_ID = Deno.env.get('LINKEDIN_ORG_CLIENT_ID') ?? '';
const LINKEDIN_ORG_CLIENT_SECRET = Deno.env.get('LINKEDIN_ORG_CLIENT_SECRET') ?? '';
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') ?? '';
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '';
const LINKEDIN_API_VERSION = '202607';
const PUBLICATION_CONTRACT_VERSION = 'durable-manual-v1';
const REQUEST_KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const publicationContractResponse = async (): Promise<Response> => {
  try {
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await serviceClient.rpc('get_publication_contract_version');
    if (error || data !== PUBLICATION_CONTRACT_VERSION) {
      throw new Error('publication contract unavailable');
    }
    return new Response(
      JSON.stringify({
        ready: true,
        contractVersion: PUBLICATION_CONTRACT_VERSION,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch {
    return new Response(JSON.stringify({ ready: false }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

const fetchWithSignal = (
  signal: AbortSignal,
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> => fetch(input, { redirect: 'error', ...init, signal });

class ProviderRejectedError extends Error {}
class ProviderMutationUncertainError extends Error {}

const requireProviderPreparation = (response: Response, message: string): void => {
  if (!response.ok) throw new ProviderRejectedError(message);
};

const requireProviderMutation = (response: Response, message: string): void => {
  if (response.ok) return;
  if (isAmbiguousProviderMutationResponse(response)) {
    throw new ProviderMutationUncertainError(message);
  }
  throw new ProviderRejectedError(message);
};

const fetchProviderMutation = async (
  signal: AbortSignal,
  input: string | URL | Request,
  init: RequestInit,
  message: string,
): Promise<Response> => {
  let response: Response;
  try {
    response = await fetchWithSignal(signal, input, init);
  } catch {
    throw new ProviderMutationUncertainError(message);
  }
  requireProviderMutation(response, message);
  return response;
};

const readProviderMutationJson = async <Value>(
  response: Response,
  message: string,
): Promise<Value> => {
  try {
    return (await response.json()) as Value;
  } catch {
    throw new ProviderMutationUncertainError(message);
  }
};

const providerRejectedResult = (platform: string, timestamp: string): PlatformResult => ({
  status: 'failed',
  url: null,
  postId: null,
  error: `${platform} rejected the publication request.`,
  timestamp,
});

function isTokenExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  const expiryTime = new Date(expiresAt).getTime();
  return Number.isFinite(expiryTime) && expiryTime <= Date.now() + 60_000;
}

async function refreshLinkedInAccessToken(
  conn: PlatformConnection,
  signal: AbortSignal,
): Promise<{
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
}> {
  if (!conn.refresh_token) {
    throw new Error('LinkedIn connection has expired and must be reconnected.');
  }

  const clientId = conn.platform === 'LinkedIn Org' ? LINKEDIN_ORG_CLIENT_ID : LINKEDIN_CLIENT_ID;
  const clientSecret =
    conn.platform === 'LinkedIn Org' ? LINKEDIN_ORG_CLIENT_SECRET : LINKEDIN_CLIENT_SECRET;

  const tokenRes = await fetchWithSignal(signal, 'https://www.linkedin.com/oauth/v2/accessToken', {
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
    throw new Error('LinkedIn token refresh failed.');
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
  signal: AbortSignal,
): Promise<{
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
}> {
  if (!conn.refresh_token) {
    throw new Error('Google connection has expired and must be reconnected.');
  }

  const tokenRes = await fetchWithSignal(signal, 'https://oauth2.googleapis.com/token', {
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
    throw new Error('Google token refresh failed.');
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
  updates: {
    access_token: string;
    refresh_token: string | null;
    expires_at: string | null;
  },
) {
  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { error } = await serviceClient
    .from('platform_connections')
    .update({
      access_token: updates.access_token,
      refresh_token: updates.refresh_token,
      expires_at: updates.expires_at,
      last_error: null,
    })
    .eq('id', connectionId);
  if (error) throw new Error('connection refresh persistence failed');
}

async function ensureFreshConnection(
  conn: PlatformConnection,
  timestamp: string,
  signal: AbortSignal,
): Promise<PlatformConnection | PlatformResult> {
  if (!isTokenExpired(conn.expires_at)) {
    return conn;
  }

  try {
    if (conn.platform === 'LinkedIn' || conn.platform === 'LinkedIn Org') {
      const refreshed = await refreshLinkedInAccessToken(conn, signal);
      const updated = { ...conn, ...refreshed };
      await persistRefreshedConnection(conn.id, refreshed);
      if (signal.aborted) throw new Error('connection refresh aborted');
      return updated;
    }

    if (conn.platform === 'YouTube') {
      const refreshed = await refreshGoogleAccessToken(conn, signal);
      const updated = { ...conn, ...refreshed };
      await persistRefreshedConnection(conn.id, refreshed);
      if (signal.aborted) throw new Error('connection refresh aborted');
      return updated;
    }

    return createPublicationFailure(conn.platform, 'reconnect_required', timestamp);
  } catch {
    if (signal.aborted) throw new Error('connection refresh aborted');
    return createPublicationFailure(conn.platform, 'reconnect_required', timestamp);
  }
}

// ─── Platform publishers ────────────────────────────────────────────────────

async function publishToBluesky(
  conn: PlatformConnection,
  payload: PublishPayload,
  signal: AbortSignal,
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
    const sessionRes = await fetchWithSignal(
      signal,
      'https://bsky.social/xrpc/com.atproto.server.createSession',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: handle, password: appPassword }),
      },
    );
    if (!sessionRes.ok) {
      return {
        status: 'failed',
        url: null,
        postId: null,
        error: 'BlueSky authentication failed.',
        timestamp,
      };
    }
    const session = (await sessionRes.json()) as {
      did: string;
      accessJwt: string;
    };

    // Build post record
    const text = payload.caption;

    // Multi-image carousel path (max 4 images on Bluesky)
    if (payload.assetType === 'Carousel' && payload.mediaUrls.length >= 2) {
      const imageUrls = payload.mediaUrls.slice(0, 4);
      const blobs = await Promise.all(
        imageUrls.map((url) => uploadBlueskyBlob(url, session.accessJwt, signal)),
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
          images: validBlobs.map((blob, i) => ({
            image: blob,
            alt: `Image ${i + 1}`,
          })),
        },
      };

      const postRes = await fetchProviderMutation(
        signal,
        'https://bsky.social/xrpc/com.atproto.repo.createRecord',
        {
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
        },
        'BlueSky carousel publication outcome is uncertain.',
      );
      const postData = await readProviderMutationJson<{ uri?: string; cid?: string }>(
        postRes,
        'BlueSky carousel publication outcome is uncertain.',
      );
      if (!postData.uri) {
        throw new ProviderMutationUncertainError(
          'BlueSky carousel publication outcome is uncertain.',
        );
      }
      const rkey = postData.uri.split('/').pop();
      if (!rkey) {
        throw new ProviderMutationUncertainError(
          'BlueSky carousel publication outcome is uncertain.',
        );
      }
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
      const imgRes = await fetchWithSignal(signal, payload.previewUrl);
      if (!imgRes.ok) {
        return {
          status: 'failed',
          url: null,
          postId: null,
          error: 'Bluesky image could not be loaded; no post was created.',
          timestamp,
        };
      }

      const imgData = await imgRes.arrayBuffer();
      const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
      const blobRes = await fetchWithSignal(
        signal,
        'https://bsky.social/xrpc/com.atproto.repo.uploadBlob',
        {
          method: 'POST',
          headers: {
            'Content-Type': contentType,
            Authorization: `Bearer ${session.accessJwt}`,
          },
          body: imgData,
        },
      );
      if (!blobRes.ok) {
        return {
          status: 'failed',
          url: null,
          postId: null,
          error: 'Bluesky image upload failed; no post was created.',
          timestamp,
        };
      }

      const { blob } = (await blobRes.json()) as { blob: unknown };
      record.embed = {
        $type: 'app.bsky.embed.images',
        images: [{ image: blob, alt: text.slice(0, 100) }],
      };
    }

    // Create post
    const postRes = await fetchProviderMutation(
      signal,
      'https://bsky.social/xrpc/com.atproto.repo.createRecord',
      {
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
      },
      'BlueSky publication outcome is uncertain.',
    );
    const postData = await readProviderMutationJson<{ uri?: string; cid?: string }>(
      postRes,
      'BlueSky publication outcome is uncertain.',
    );
    if (!postData.uri) {
      throw new ProviderMutationUncertainError('BlueSky publication outcome is uncertain.');
    }
    // Convert AT URI to web URL: at://did:plc:xxx/app.bsky.feed.post/rkey → https://bsky.app/profile/handle/post/rkey
    const rkey = postData.uri.split('/').pop();
    if (!rkey) {
      throw new ProviderMutationUncertainError('BlueSky publication outcome is uncertain.');
    }
    const url = `https://bsky.app/profile/${handle}/post/${rkey}`;

    return {
      status: 'published',
      url,
      postId: postData.uri,
      error: null,
      timestamp,
    };
  } catch (error) {
    if (error instanceof ProviderMutationUncertainError) {
      throw new Error('BlueSky publication outcome is uncertain.');
    }
    return providerRejectedResult('BlueSky', timestamp);
  }
}

async function uploadBlueskyBlob(
  imageUrl: string,
  accessJwt: string,
  signal: AbortSignal,
): Promise<unknown | null> {
  const imgRes = await fetchWithSignal(signal, imageUrl);
  if (!imgRes.ok) return null;
  const imgData = await imgRes.arrayBuffer();
  const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
  const blobRes = await fetchWithSignal(
    signal,
    'https://bsky.social/xrpc/com.atproto.repo.uploadBlob',
    {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        Authorization: `Bearer ${accessJwt}`,
      },
      body: imgData,
    },
  );
  if (!blobRes.ok) return null;
  const { blob } = (await blobRes.json()) as { blob: unknown };
  return blob;
}

async function resolveInstagramCredentials(
  conn: PlatformConnection,
  userToken: string,
  timestamp: string,
  signal: AbortSignal,
): Promise<
  { page: { id: string; access_token: string }; instagramUserId: string } | PlatformResult
> {
  const pagesRes = await fetchWithSignal(
    signal,
    `${META_GRAPH_API_BASE_URL}/me/accounts?${new URLSearchParams({
      access_token: userToken,
    })}`,
  );
  if (!pagesRes.ok) {
    return {
      status: 'failed',
      url: null,
      postId: null,
      error: 'Instagram page lookup failed.',
      timestamp,
    };
  }
  const pagesData = (await pagesRes.json()) as {
    data?: Array<{ id?: string; access_token?: string }>;
  };
  const page = pagesData.data?.find((candidate) => candidate.id === conn.account_id);
  if (!page?.id) {
    return {
      status: 'failed',
      url: null,
      postId: null,
      error:
        'Instagram publish failed: the connected Facebook Page is no longer accessible for this token',
      timestamp,
    };
  }
  if (!page.access_token) {
    return {
      status: 'failed',
      url: null,
      postId: null,
      error: 'Instagram publish failed: no page access token',
      timestamp,
    };
  }

  const igRes = await fetchWithSignal(
    signal,
    `${META_GRAPH_API_BASE_URL}/${page.id}?${new URLSearchParams({
      fields: 'instagram_business_account',
      access_token: page.access_token,
    })}`,
  );
  if (!igRes.ok) return providerRejectedResult('Instagram', timestamp);
  const igData = (await igRes.json()) as {
    instagram_business_account?: { id?: string } | null;
  };
  const instagramUserId = igData.instagram_business_account?.id;
  if (!instagramUserId) {
    return {
      status: 'failed',
      url: null,
      postId: null,
      error: 'Instagram publish failed: Facebook Page not linked to an Instagram Business Account',
      timestamp,
    };
  }

  return {
    page: { id: page.id, access_token: page.access_token },
    instagramUserId,
  };
}

async function publishInstagramCarousel(
  instagramUserId: string,
  pageAccessToken: string,
  payload: PublishPayload,
  timestamp: string,
  signal: AbortSignal,
): Promise<PlatformResult> {
  const text = payload.caption;
  const mediaUrls = payload.mediaUrls.slice(0, 10); // Instagram carousel max 10

  // Step 1: create a container per image
  const childIds: string[] = [];
  for (const imageUrl of mediaUrls) {
    const containerRes = await fetchWithSignal(
      signal,
      `${META_GRAPH_API_BASE_URL}/${instagramUserId}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          image_url: imageUrl,
          is_carousel_item: 'true',
          access_token: pageAccessToken,
        }),
      },
    );
    requireProviderPreparation(containerRes, 'Instagram carousel item creation failed.');
    const containerData = (await containerRes.json()) as { id?: string };
    if (!containerData.id) {
      throw new ProviderRejectedError('Instagram carousel item creation failed: no container ID');
    }
    childIds.push(containerData.id);
  }

  // Step 2: create carousel container
  const carouselRes = await fetchWithSignal(
    signal,
    `${META_GRAPH_API_BASE_URL}/${instagramUserId}/media`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        media_type: 'CAROUSEL',
        children: childIds.join(','),
        caption: text,
        access_token: pageAccessToken,
      }),
    },
  );
  requireProviderPreparation(carouselRes, 'Instagram carousel container creation failed.');
  const carouselData = (await carouselRes.json()) as { id?: string };
  if (!carouselData.id) {
    throw new ProviderRejectedError('Instagram carousel container creation failed: no ID');
  }

  // Step 3: publish
  const publishRes = await fetchProviderMutation(
    signal,
    `${META_GRAPH_API_BASE_URL}/${instagramUserId}/media_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        creation_id: carouselData.id,
        access_token: pageAccessToken,
      }),
    },
    'Instagram carousel publication outcome is uncertain.',
  );
  const publishData = await readProviderMutationJson<{ id?: string }>(
    publishRes,
    'Instagram carousel publication outcome is uncertain.',
  );
  if (!publishData.id) {
    throw new ProviderMutationUncertainError(
      'Instagram carousel publication outcome is uncertain.',
    );
  }

  // Fetch permalink
  let postUrl: string | null = null;
  try {
    const permalinkRes = await fetchWithSignal(
      signal,
      `${META_GRAPH_API_BASE_URL}/${publishData.id}?${new URLSearchParams({
        fields: 'permalink',
        access_token: pageAccessToken,
      })}`,
    );
    if (permalinkRes.ok) {
      const permalinkData = (await permalinkRes.json()) as {
        permalink?: string;
      };
      postUrl = permalinkData.permalink ?? null;
    }
  } catch {
    // The provider ID already confirms publication; a permalink is optional.
  }

  return {
    status: 'published',
    url: postUrl,
    postId: publishData.id,
    error: null,
    timestamp,
  };
}

async function publishToInstagram(
  conn: PlatformConnection,
  payload: PublishPayload,
  signal: AbortSignal,
): Promise<PlatformResult> {
  const timestamp = new Date().toISOString();
  try {
    const userToken = conn.access_token;
    const text = payload.caption;

    if (!userToken) {
      return {
        status: 'failed',
        url: null,
        postId: null,
        error: 'Missing Instagram credentials: no Facebook user access token stored',
        timestamp,
      };
    }

    const creds = await resolveInstagramCredentials(conn, userToken, timestamp, signal);
    if ('status' in creds) return creds;
    const { page, instagramUserId } = creds;

    // Carousel path
    if (payload.assetType === 'Carousel' && payload.mediaUrls.length >= 2) {
      return await publishInstagramCarousel(
        instagramUserId,
        page.access_token,
        payload,
        timestamp,
        signal,
      );
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

    const createMediaRes = await fetchWithSignal(
      signal,
      `${META_GRAPH_API_BASE_URL}/${instagramUserId}/media`,
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
    requireProviderPreparation(createMediaRes, 'Instagram media creation failed.');

    const creationData = (await createMediaRes.json()) as { id?: string };
    if (!creationData.id) {
      throw new ProviderRejectedError('Instagram media creation failed: no creation ID returned');
    }

    const publishRes = await fetchProviderMutation(
      signal,
      `${META_GRAPH_API_BASE_URL}/${instagramUserId}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          creation_id: creationData.id,
          access_token: page.access_token,
        }),
      },
      'Instagram publication outcome is uncertain.',
    );
    const publishData = await readProviderMutationJson<{ id?: string }>(
      publishRes,
      'Instagram publication outcome is uncertain.',
    );
    if (!publishData.id) {
      throw new ProviderMutationUncertainError('Instagram publication outcome is uncertain.');
    }

    // Fetch the permalink — publishData.id is a numeric media ID, not a shortcode
    let postUrl: string | null = null;
    try {
      const permalinkRes = await fetchWithSignal(
        signal,
        `${META_GRAPH_API_BASE_URL}/${publishData.id}?${new URLSearchParams({
          fields: 'permalink',
          access_token: page.access_token,
        })}`,
      );
      if (permalinkRes.ok) {
        const permalinkData = (await permalinkRes.json()) as {
          permalink?: string;
        };
        postUrl = permalinkData.permalink ?? null;
      }
    } catch {
      // The provider ID already confirms publication; a permalink is optional.
    }

    return {
      status: 'published',
      url: postUrl,
      postId: publishData.id,
      error: null,
      timestamp,
    };
  } catch (error) {
    if (error instanceof ProviderMutationUncertainError) {
      throw new Error('Instagram publication outcome is uncertain.');
    }
    return providerRejectedResult('Instagram', timestamp);
  }
}

async function resolveFacebookPage(
  conn: PlatformConnection,
  userToken: string,
  timestamp: string,
  signal: AbortSignal,
): Promise<{ page: { id: string; access_token: string } } | PlatformResult> {
  const pagesRes = await fetchWithSignal(
    signal,
    `${META_GRAPH_API_BASE_URL}/me/accounts?${new URLSearchParams({
      access_token: userToken,
    })}`,
  );
  if (!pagesRes.ok) {
    return {
      status: 'failed',
      url: null,
      postId: null,
      error: 'Facebook page lookup failed.',
      timestamp,
    };
  }
  const pagesData = (await pagesRes.json()) as {
    data?: Array<{ id?: string; access_token?: string }>;
  };
  const page = pagesData.data?.find((candidate) => candidate.id === conn.account_id);
  if (!page?.id) {
    return {
      status: 'failed',
      url: null,
      postId: null,
      error:
        'Facebook publish failed: the connected Facebook Page is no longer accessible for this token',
      timestamp,
    };
  }
  if (!page.access_token) {
    return {
      status: 'failed',
      url: null,
      postId: null,
      error: 'Facebook publish failed: no page access token',
      timestamp,
    };
  }
  return { page: { id: page.id, access_token: page.access_token } };
}

async function publishToFacebook(
  conn: PlatformConnection,
  payload: PublishPayload,
  signal: AbortSignal,
): Promise<PlatformResult> {
  const timestamp = new Date().toISOString();
  try {
    const userToken = conn.access_token;
    const previewUrl = payload.previewUrl?.trim();
    const text = payload.caption;

    if (!userToken) {
      return {
        status: 'failed',
        url: null,
        postId: null,
        error: 'Missing Facebook credentials: no user access token stored',
        timestamp,
      };
    }

    const creds = await resolveFacebookPage(conn, userToken, timestamp, signal);
    if ('status' in creds) return creds;
    const { page } = creds;

    // Multi-photo carousel path
    if (payload.assetType === 'Carousel' && payload.mediaUrls.length >= 2) {
      const photoIds: string[] = [];
      for (const imageUrl of payload.mediaUrls.slice(0, 20)) {
        const photoRes = await fetchWithSignal(
          signal,
          `${META_GRAPH_API_BASE_URL}/${page.id}/photos`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              url: imageUrl,
              published: 'false',
              access_token: page.access_token,
            }),
          },
        );
        requireProviderPreparation(photoRes, 'Facebook photo staging failed.');
        const photoData = (await photoRes.json()) as { id?: string };
        if (!photoData.id) {
          throw new ProviderRejectedError('Facebook photo staging failed: no photo ID');
        }
        photoIds.push(photoData.id);
      }

      const feedRes = await fetchProviderMutation(
        signal,
        `${META_GRAPH_API_BASE_URL}/${page.id}/feed`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            attached_media: photoIds.map((id) => ({ media_fbid: id })),
            access_token: page.access_token,
          }),
        },
        'Facebook multi-photo publication outcome is uncertain.',
      );
      const feedData = await readProviderMutationJson<{ id?: string }>(
        feedRes,
        'Facebook multi-photo publication outcome is uncertain.',
      );
      if (!feedData.id) {
        throw new ProviderMutationUncertainError(
          'Facebook multi-photo publication outcome is uncertain.',
        );
      }
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
      const photoRes = await fetchProviderMutation(
        signal,
        `${META_GRAPH_API_BASE_URL}/${page.id}/photos`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            url: previewUrl,
            message: text,
            published: 'true',
            access_token: page.access_token,
          }),
        },
        'Facebook photo publication outcome is uncertain.',
      );
      const photoData = await readProviderMutationJson<{ id?: string; post_id?: string }>(
        photoRes,
        'Facebook photo publication outcome is uncertain.',
      );
      if (!photoData.post_id) {
        throw new ProviderMutationUncertainError(
          'Facebook photo publication outcome is uncertain.',
        );
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
    const feedRes = await fetchProviderMutation(
      signal,
      `${META_GRAPH_API_BASE_URL}/${page.id}/feed`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          message: text,
          access_token: page.access_token,
        }),
      },
      'Facebook publication outcome is uncertain.',
    );
    const feedData = await readProviderMutationJson<{ id?: string }>(
      feedRes,
      'Facebook publication outcome is uncertain.',
    );
    if (!feedData.id) {
      throw new ProviderMutationUncertainError('Facebook publication outcome is uncertain.');
    }

    return {
      status: 'published',
      url: `https://www.facebook.com/${feedData.id}`,
      postId: feedData.id,
      error: null,
      timestamp,
    };
  } catch (error) {
    if (error instanceof ProviderMutationUncertainError) {
      throw new Error('Facebook publication outcome is uncertain.');
    }
    return providerRejectedResult('Facebook', timestamp);
  }
}

async function publishToLinkedIn(
  conn: PlatformConnection,
  payload: PublishPayload,
  signal: AbortSignal,
): Promise<PlatformResult> {
  const timestamp = new Date().toISOString();
  try {
    if (payload.assetType === 'Carousel') {
      return {
        status: 'failed',
        url: null,
        postId: null,
        error: 'LinkedIn carousel publishing is not available; no post was created.',
        timestamp,
      };
    }

    const accessToken = conn.access_token;
    const accountId = conn.account_id;
    const previewUrl = payload.previewUrl?.trim();
    const text = payload.caption;

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
      'Linkedin-Version': LINKEDIN_API_VERSION,
      'X-Restli-Protocol-Version': '2.0.0',
    };

    let imageUrn: string | null = null;

    if (previewUrl) {
      const registerRes = await fetchWithSignal(
        signal,
        'https://api.linkedin.com/rest/images?action=initializeUpload',
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            initializeUploadRequest: {
              owner: authorUrn,
            },
          }),
        },
      );

      requireProviderPreparation(registerRes, 'LinkedIn upload registration failed.');

      const registerData = (await registerRes.json()) as {
        value?: {
          uploadUrl?: string;
          image?: string;
        };
      };
      const uploadUrl = getTrustedLinkedInUploadUrl(registerData.value?.uploadUrl);
      imageUrn = registerData.value?.image ?? null;

      if (!uploadUrl || !imageUrn) {
        throw new ProviderRejectedError(
          'LinkedIn upload registration failed: missing upload URL or image URN',
        );
      }

      const imageRes = await fetchWithSignal(signal, previewUrl);
      requireProviderPreparation(imageRes, 'LinkedIn image fetch failed.');

      const imageData = await imageRes.arrayBuffer();
      const imageContentType = imageRes.headers.get('content-type') || 'application/octet-stream';

      const uploadRes = await fetchWithSignal(signal, uploadUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': imageContentType,
        },
        body: imageData,
      });
      requireProviderPreparation(uploadRes, 'LinkedIn image upload failed.');
    }

    const postRes = await fetchProviderMutation(
      signal,
      'https://api.linkedin.com/rest/posts',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          author: authorUrn,
          commentary: text,
          visibility: 'PUBLIC',
          distribution: {
            feedDistribution: 'MAIN_FEED',
            targetEntities: [],
            thirdPartyDistributionChannels: [],
          },
          ...(imageUrn
            ? {
                content: {
                  media: { id: imageUrn },
                },
              }
            : {}),
          lifecycleState: 'PUBLISHED',
          isReshareDisabledByAuthor: false,
        }),
      },
      'LinkedIn publication outcome is uncertain.',
    );

    const postUrn = postRes.headers.get('x-restli-id');
    if (!postUrn) {
      throw new ProviderMutationUncertainError('LinkedIn publication outcome is uncertain.');
    }

    return {
      status: 'published',
      url: `https://www.linkedin.com/feed/update/${postUrn}/`,
      postId: postUrn,
      error: null,
      timestamp,
    };
  } catch (error) {
    if (error instanceof ProviderMutationUncertainError) {
      throw new Error('LinkedIn publication outcome is uncertain.');
    }
    return providerRejectedResult('LinkedIn', timestamp);
  }
}

function publishToLinkedInOrg(
  conn: PlatformConnection,
  payload: PublishPayload,
  signal: AbortSignal,
): Promise<PlatformResult> {
  // Always post as the org page — account_id is the org numeric ID
  const orgConn: PlatformConnection = {
    ...conn,
    org_account_id: conn.account_id,
  };
  return publishToLinkedIn(orgConn, payload, signal);
}

// ─── Router ─────────────────────────────────────────────────────────────────

const PUBLISHERS: Record<
  string,
  (
    conn: PlatformConnection,
    payload: PublishPayload,
    signal: AbortSignal,
  ) => Promise<PlatformResult>
> = {
  BlueSky: publishToBluesky,
  Instagram: publishToInstagram,
  Facebook: publishToFacebook,
  LinkedIn: publishToLinkedIn,
  'LinkedIn Org': publishToLinkedInOrg,
};

const toPublisherOutcome = (platform: string, result: PlatformResult): PublisherOutcome => {
  const finalResult = finalisePlatformResult(platform, result);
  if (finalResult.status === 'published') {
    if (!finalResult.postId?.trim()) {
      throw new Error('provider identifier missing');
    }
    return {
      status: 'published',
      providerPostId: finalResult.postId,
      providerUrl: finalResult.url,
    };
  }
  if (finalResult.status === 'skipped') {
    return { status: 'skipped', errorCode: 'unsupported' };
  }
  return { status: 'failed', errorCode: 'provider_rejected' };
};

const createPlatformPublisher = (
  supabase: SupabaseClient,
  platforms: string[],
): ((
  platform: string,
  payload: PublishPayload,
  signal: AbortSignal,
) => Promise<PublisherOutcome>) => {
  let connectionsPromise: Promise<PlatformConnection[]> | null = null;
  const loadConnections = (): Promise<PlatformConnection[]> => {
    connectionsPromise ??= (async () => {
      const { data, error } = await supabase
        .from('platform_connections')
        .select('*')
        .in('platform', platforms)
        .eq('is_active', true);
      if (error) throw new Error('platform connection lookup failed');
      return (data ?? []) as PlatformConnection[];
    })();
    return connectionsPromise;
  };

  return async (platform, payload, signal) => {
    let connections: PlatformConnection[];
    try {
      connections = await loadConnections();
    } catch {
      return { status: 'failed', errorCode: 'unexpected' };
    }

    const matchingConnections = connections.filter(
      (connection) => connection.platform === platform,
    );
    if (matchingConnections.length === 0) {
      return { status: 'failed', errorCode: 'connection_missing' };
    }
    if (matchingConnections.length > 1) {
      return { status: 'failed', errorCode: 'multiple_connections' };
    }

    const freshConnection = await ensureFreshConnection(
      matchingConnections[0],
      new Date().toISOString(),
      signal,
    );
    if ('status' in freshConnection) {
      return { status: 'failed', errorCode: 'reconnect_required' };
    }

    const publisher = PUBLISHERS[platform];
    if (!publisher) return { status: 'skipped', errorCode: 'unsupported' };
    return toPublisherOutcome(platform, await publisher(freshConnection, payload, signal));
  };
};

const loadPublishableEntry = (supabase: SupabaseClient, entryId: string) =>
  requirePublishableEntry(entryId, async (authoritativeEntryId) => {
    const { data, error } = await supabase
      .from('entries')
      .select(
        'id, platforms, asset_type, caption, platform_captions, first_comment, asset_previews, preview_url, workflow_status, approved_at, content_revision, approved_revision, deleted_at',
      )
      .eq('id', authoritativeEntryId)
      .maybeSingle();

    return { data: data as PublishableEntryRow | null, error };
  });

const toBrowserResults = (job: DurablePublicationJob) =>
  Object.fromEntries(
    job.results.map((result) => [
      result.platform,
      {
        status: result.status,
        url: result.url,
        error: result.error,
        timestamp: result.completedAt ?? result.updatedAt,
      },
    ]),
  );

const durableJobResponse = (job: DurablePublicationJob, durabilityConfirmed = true): Response => {
  const results = toBrowserResults(job);
  const success = job.results.some((result) => result.status === 'published');
  return new Response(JSON.stringify({ success, results, job, durabilityConfirmed }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
};

const publicationOutcomeResponse = (outcome: ManualPublicationOutcome): Response => {
  if (outcome.ok) {
    return durableJobResponse(outcome.job, outcome.durabilityConfirmed);
  }

  return new Response(
    JSON.stringify({
      success: false,
      error: outcome.message,
      ...(outcome.job ? { job: outcome.job, results: toBrowserResults(outcome.job) } : {}),
    }),
    {
      status:
        outcome.code === 'invalid_request'
          ? 400
          : outcome.code === 'retry_not_available'
            ? 409
            : outcome.code === 'media_preflight_failed'
              ? 422
              : 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  );
};

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method === 'GET') {
    return publicationContractResponse();
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const owner = await requireOwnerRequest(req, {
      supabaseUrl: SUPABASE_URL,
      publishableKey: SUPABASE_PUBLISHABLE_KEY,
    });

    let requestBody: unknown;
    try {
      requestBody = await req.json();
    } catch {
      return new Response(JSON.stringify({ success: false, error: 'Invalid JSON request body.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body =
      requestBody && typeof requestBody === 'object' && !Array.isArray(requestBody)
        ? (requestBody as Record<string, unknown>)
        : {};
    const action = body.action;
    if (action !== undefined && action !== 'publish' && action !== 'retry_failed') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'A valid publication action is required.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const entryId = body.entryId;
    const requestKey = body.requestKey;
    const normalisedEntryId = typeof entryId === 'string' ? entryId.trim() : '';
    const normalisedRequestKey = typeof requestKey === 'string' ? requestKey.trim() : '';
    if (!REQUEST_KEY_PATTERN.test(normalisedEntryId)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'A valid publication request is required.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const repository = createPublicationRepository(supabase);

    if (action === 'retry_failed') {
      const jobId = typeof body.jobId === 'string' ? body.jobId.trim() : '';
      const retryRequestKey =
        typeof body.retryRequestKey === 'string' ? body.retryRequestKey.trim() : '';
      const platform = typeof body.platform === 'string' ? body.platform.trim() : '';
      if (
        !REQUEST_KEY_PATTERN.test(jobId) ||
        !REQUEST_KEY_PATTERN.test(retryRequestKey) ||
        !platform
      ) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'A valid publication retry is required.',
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      let retryContext: PublicationRetryContext | null;
      try {
        retryContext = await repository.loadOwnedRetryContext(jobId, owner.id);
      } catch {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Publishing state could not be loaded safely.',
          }),
          {
            status: 503,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      if (
        !retryContext ||
        retryContext.job.entryId !== normalisedEntryId ||
        retryContext.payload.entryId !== normalisedEntryId ||
        !retryContext.payload.platforms.includes(platform)
      ) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'This platform result is not available for a safe retry.',
          }),
          {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      const selectedResult = retryContext.job.results.find(
        (result) => result.platform === platform,
      );
      if (selectedResult?.status === 'published') {
        return durableJobResponse(retryContext.job);
      }
      if (!selectedResult || !['failed', 'pending', 'publishing'].includes(selectedResult.status)) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'This platform result is not available for a safe retry.',
          }),
          {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      const currentEntry = await loadPublishableEntry(supabase, normalisedEntryId);
      if (currentEntry.entryRevision !== retryContext.job.entryRevision) {
        return new Response(
          JSON.stringify({
            success: false,
            error:
              'This entry changed after approval. Approve the latest version before publishing.',
          }),
          {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      const retryOutcome = await orchestrateFailedPublicationRetry(
        {
          jobId,
          retryRequestKey,
          platform,
          requestedBy: owner,
          entryRevision: retryContext.job.entryRevision,
          payload: retryContext.payload,
        },
        {
          repository,
          preflightMedia: (payload) =>
            getPublicationMediaIssue(payload, { supabaseUrl: SUPABASE_URL }),
          publish: createPlatformPublisher(supabase, retryContext.payload.platforms),
        },
      );
      return publicationOutcomeResponse(retryOutcome);
    }

    if (!REQUEST_KEY_PATTERN.test(normalisedRequestKey)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'A valid publication request is required.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    try {
      await repository.recoverStaleClaims();
      const existingJob = await repository.findManualJob(owner.id, normalisedRequestKey);
      if (existingJob) {
        if (existingJob.entryId !== normalisedEntryId) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'The publication request does not match this entry.',
            }),
            {
              status: 409,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            },
          );
        }
        return durableJobResponse(existingJob);
      }
    } catch {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Publishing state could not be loaded safely.',
        }),
        {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const publishableEntry = await loadPublishableEntry(supabase, normalisedEntryId);

    const outcome = await orchestrateManualPublication(
      {
        requestKey: normalisedRequestKey,
        requestedBy: owner,
        entryRevision: publishableEntry.entryRevision,
        payload: publishableEntry.payload,
      },
      {
        repository,
        preflightMedia: (payload) =>
          getPublicationMediaIssue(payload, { supabaseUrl: SUPABASE_URL }),
        publish: createPlatformPublisher(supabase, publishableEntry.payload.platforms),
      },
    );
    return publicationOutcomeResponse(outcome);
  } catch (err) {
    if (err instanceof Response) return err;

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Publishing could not be completed. No confirmed result was recorded.',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
