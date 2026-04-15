/**
 * oauth-callback — handles OAuth redirects from Meta, LinkedIn, Google
 *
 * Flow:
 * 1. Platform redirects to this function with ?code=xxx&state=yyy
 * 2. Function exchanges code for access + refresh tokens
 * 3. Stores tokens in platform_connections
 * 4. Redirects browser to success page in the app
 *
 * State param format: base64(JSON({ platform, createdByEmail, redirectTo }))
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Meta (Instagram + Facebook)
const META_APP_ID = Deno.env.get('META_APP_ID') ?? '';
const META_APP_SECRET = Deno.env.get('META_APP_SECRET') ?? '';

// LinkedIn (personal)
const LINKEDIN_CLIENT_ID = Deno.env.get('LINKEDIN_CLIENT_ID') ?? '';
const LINKEDIN_CLIENT_SECRET = Deno.env.get('LINKEDIN_CLIENT_SECRET') ?? '';

// LinkedIn (org / Community Management API)
const LINKEDIN_ORG_CLIENT_ID = Deno.env.get('LINKEDIN_ORG_CLIENT_ID') ?? '';
const LINKEDIN_ORG_CLIENT_SECRET = Deno.env.get('LINKEDIN_ORG_CLIENT_SECRET') ?? '';

// Google (YouTube)
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') ?? '';
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '';

const _supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const FUNCTION_URL = _supabaseUrl ? `${_supabaseUrl}/functions/v1/oauth-callback` : '';
const APP_URL = Deno.env.get('APP_URL') ?? '';

// ─── Token exchangers ────────────────────────────────────────────────────────

interface TokenResult {
  platform: string;
  accountId: string;
  accountName: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scope: string | null;
}

async function exchangeMetaCode(
  code: string,
  redirectUri: string,
  platform: 'Instagram' | 'Facebook',
): Promise<TokenResult> {
  // Exchange code for short-lived token
  const tokenRes = await fetch(
    `https://graph.facebook.com/v19.0/oauth/access_token?` +
      new URLSearchParams({
        client_id: META_APP_ID,
        client_secret: META_APP_SECRET,
        redirect_uri: redirectUri,
        code,
      }),
  );
  if (!tokenRes.ok) throw new Error(`Meta token exchange failed: ${await tokenRes.text()}`);
  const { access_token: shortToken } = (await tokenRes.json()) as { access_token: string };

  // Exchange for long-lived token (60 days)
  const longRes = await fetch(
    `https://graph.facebook.com/v19.0/oauth/access_token?` +
      new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: META_APP_ID,
        client_secret: META_APP_SECRET,
        fb_exchange_token: shortToken,
      }),
  );
  if (!longRes.ok)
    throw new Error(`Meta long-lived token exchange failed: ${await longRes.text()}`);
  const { access_token: longToken, expires_in } = (await longRes.json()) as {
    access_token: string;
    expires_in: number;
  };

  const pagesRes = await fetch(
    `https://graph.facebook.com/v19.0/me/accounts?${new URLSearchParams({
      access_token: longToken,
      fields: 'id,name,instagram_business_account{id,username}',
    })}`,
  );
  if (!pagesRes.ok) {
    throw new Error(`Meta page lookup failed: ${await pagesRes.text()}`);
  }

  const pagesData = (await pagesRes.json()) as {
    data?: Array<{
      id?: string;
      name?: string;
      instagram_business_account?: { id?: string; username?: string } | null;
    }>;
  };

  const pages = Array.isArray(pagesData.data) ? pagesData.data : [];

  if (platform === 'Instagram') {
    const instagramPages = pages.filter((page) => page.instagram_business_account?.id);
    if (instagramPages.length !== 1) {
      throw new Error(
        instagramPages.length === 0
          ? 'Instagram connection failed: no linked Instagram Business Account was found for this Facebook login.'
          : 'Instagram connection failed: this login can access multiple Instagram Business Accounts. Reduce it to one supported account before reconnecting.',
      );
    }

    const page = instagramPages[0];
    return {
      platform,
      accountId: page.id ?? '',
      accountName:
        page.instagram_business_account?.username || page.name || 'Instagram Business Account',
      accessToken: longToken,
      refreshToken: null,
      expiresAt: new Date(Date.now() + (expires_in ?? 5184000) * 1000),
      scope: null,
    };
  }

  if (pages.length !== 1) {
    throw new Error(
      pages.length === 0
        ? 'Facebook connection failed: no Facebook Page was found for this login.'
        : 'Facebook connection failed: this login can access multiple Facebook Pages. Reduce it to one supported Page before reconnecting.',
    );
  }

  const page = pages[0];

  return {
    platform,
    accountId: page.id ?? '',
    accountName: page.name || 'Facebook Page',
    accessToken: longToken,
    refreshToken: null,
    expiresAt: new Date(Date.now() + (expires_in ?? 5184000) * 1000),
    scope: null,
  };
}

async function exchangeLinkedInCode(code: string, redirectUri: string): Promise<TokenResult> {
  const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: LINKEDIN_CLIENT_ID,
      client_secret: LINKEDIN_CLIENT_SECRET,
    }),
  });
  if (!tokenRes.ok) throw new Error(`LinkedIn token exchange failed: ${await tokenRes.text()}`);
  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    refresh_token_expires_in?: number;
  };

  // Get profile
  const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = (await profileRes.json()) as { sub: string; name: string };

  return {
    platform: 'LinkedIn',
    accountId: profile.sub,
    accountName: profile.name ?? 'LinkedIn Account',
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    scope: null,
  };
}

async function exchangeLinkedInOrgCode(code: string, redirectUri: string): Promise<TokenResult> {
  const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: LINKEDIN_ORG_CLIENT_ID,
      client_secret: LINKEDIN_ORG_CLIENT_SECRET,
    }),
  });
  if (!tokenRes.ok) throw new Error(`LinkedIn org token exchange failed: ${await tokenRes.text()}`);
  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  // Find the org page this token has admin access to
  const aclRes = await fetch(
    'https://api.linkedin.com/v2/organizationalEntityAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED',
    { headers: { Authorization: `Bearer ${tokens.access_token}` } },
  );
  const aclData = (await aclRes.json()) as {
    elements?: Array<{ organizationalTarget: string }>;
  };

  // organizationalTarget is like "urn:li:organization:12345"
  const orgUrn = aclData.elements?.[0]?.organizationalTarget ?? '';
  const orgId = orgUrn.split(':').pop() ?? 'unknown';

  // Fetch org name
  let orgName = 'Population Matters';
  if (orgId !== 'unknown') {
    const orgRes = await fetch(
      `https://api.linkedin.com/v2/organizations/${orgId}?projection=(localizedName)`,
      { headers: { Authorization: `Bearer ${tokens.access_token}` } },
    );
    if (orgRes.ok) {
      const orgData = (await orgRes.json()) as { localizedName?: string };
      orgName = orgData.localizedName ?? orgName;
    }
  }

  return {
    platform: 'LinkedIn Org',
    accountId: orgId,
    accountName: orgName,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    scope: null,
  };
}

async function exchangeGoogleCode(code: string, redirectUri: string): Promise<TokenResult> {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
    }),
  });
  if (!tokenRes.ok) throw new Error(`Google token exchange failed: ${await tokenRes.text()}`);
  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
  };

  // Get channel info
  const channelRes = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true`,
    { headers: { Authorization: `Bearer ${tokens.access_token}` } },
  );
  const channelData = (await channelRes.json()) as {
    items?: Array<{ id: string; snippet: { title: string } }>;
  };
  const channel = channelData.items?.[0];

  return {
    platform: 'YouTube',
    accountId: channel?.id ?? 'unknown',
    accountName: channel?.snippet?.title ?? 'YouTube Channel',
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    scope: tokens.scope,
  };
}

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const stateRaw = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    return new Response(`OAuth error: ${error}`, { status: 400 });
  }

  if (!code || !stateRaw) {
    return new Response('Missing code or state', { status: 400 });
  }

  let state: { platform: string; createdByEmail: string; redirectTo?: string };
  try {
    state = JSON.parse(atob(stateRaw));
  } catch {
    return new Response('Invalid state param', { status: 400 });
  }

  const redirectUri = `${FUNCTION_URL}`;

  try {
    let result: TokenResult;
    switch (state.platform) {
      case 'Instagram':
      case 'Facebook':
        result = await exchangeMetaCode(code, redirectUri, state.platform);
        break;
      case 'LinkedIn':
        result = await exchangeLinkedInCode(code, redirectUri);
        break;
      case 'LinkedIn Org':
        result = await exchangeLinkedInOrgCode(code, redirectUri);
        break;
      case 'YouTube':
        result = await exchangeGoogleCode(code, redirectUri);
        break;
      default:
        return new Response(`Unknown platform: ${state.platform}`, { status: 400 });
    }

    // Upsert into platform_connections
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error: upsertError } = await supabase.from('platform_connections').upsert(
      {
        platform: result.platform,
        account_id: result.accountId,
        account_name: result.accountName,
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
        expires_at: result.expiresAt?.toISOString() ?? null,
        scope: result.scope,
        created_by: state.createdByEmail,
        is_active: true,
        last_error: null,
      },
      { onConflict: 'platform,account_id' },
    );

    if (upsertError) {
      return new Response(`Failed to save connection: ${upsertError.message}`, { status: 500 });
    }

    await supabase
      .from('platform_connections')
      .update({ is_active: false })
      .eq('platform', result.platform)
      .neq('account_id', result.accountId)
      .eq('is_active', true);

    // Redirect back to the app with success signal
    const successUrl = new URL(state.redirectTo ?? APP_URL);
    successUrl.searchParams.set('oauth_success', result.platform);
    successUrl.searchParams.set('account_name', result.accountName);

    return new Response(null, {
      status: 302,
      headers: { Location: successUrl.toString() },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return new Response(`OAuth callback error: ${msg}`, { status: 500 });
  }
});
