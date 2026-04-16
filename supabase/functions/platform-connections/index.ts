import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface PlatformConnectionRow {
  id: string;
  platform: string;
  account_id: string;
  account_name: string;
  expires_at: string | null;
  last_used_at: string | null;
  last_error: string | null;
  is_active: boolean;
  created_by: string | null;
}

interface RequestPayload {
  action?: 'list' | 'disconnect' | 'connect-bluesky';
  id?: string;
  handle?: string;
  appPassword?: string;
}

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const normalizeEmail = (value: string | null | undefined): string =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

const getServiceClient = () => createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const getRequestAuthClient = (authHeader: string) =>
  createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

async function requireAdmin(req: Request) {
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    throw json({ error: 'Unauthorized' }, 401);
  }

  const authClient = getRequestAuthClient(authHeader);
  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser();

  if (userError || !user?.email) {
    throw json({ error: 'Unauthorized' }, 401);
  }

  const supabase = getServiceClient();
  const email = normalizeEmail(user.email);
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('id, email, is_admin')
    .eq('email', email)
    .maybeSingle();

  if (profileError || !profile?.is_admin) {
    throw json({ error: 'Forbidden' }, 403);
  }

  return { supabase, userEmail: email };
}

async function verifyBluesky(handle: string, appPassword: string) {
  const sessionRes = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: handle, password: appPassword }),
  });

  if (!sessionRes.ok) {
    const err = (await sessionRes.json().catch(() => ({}))) as { message?: string };
    throw new Error(err.message ?? 'Invalid BlueSky credentials.');
  }

  return (await sessionRes.json()) as { handle: string };
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  let payload: RequestPayload;
  try {
    payload = (await req.json()) as RequestPayload;
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  try {
    const { supabase, userEmail } = await requireAdmin(req);

    switch (payload.action) {
      case 'list': {
        const { data, error } = await supabase
          .from('platform_connections')
          .select(
            'id, platform, account_id, account_name, expires_at, last_used_at, last_error, is_active, created_by',
          )
          .eq('is_active', true)
          .order('platform')
          .order('account_name');

        if (error) {
          return json({ error: error.message || 'Failed to load platform connections.' }, 500);
        }

        return json({ connections: (data as PlatformConnectionRow[]) ?? [] });
      }

      case 'disconnect': {
        if (!payload.id) {
          return json({ error: 'Connection id is required.' }, 400);
        }

        const { error } = await supabase
          .from('platform_connections')
          .update({ is_active: false })
          .eq('id', payload.id);

        if (error) {
          return json({ error: error.message || 'Failed to disconnect platform.' }, 500);
        }

        return json({ success: true });
      }

      case 'connect-bluesky': {
        const handle = typeof payload.handle === 'string' ? payload.handle.trim() : '';
        const appPassword =
          typeof payload.appPassword === 'string' ? payload.appPassword.trim() : '';

        if (!handle || !appPassword) {
          return json({ error: 'Handle and app password are required.' }, 400);
        }

        const session = await verifyBluesky(handle, appPassword);

        const { error: upsertErr } = await supabase.from('platform_connections').upsert(
          {
            platform: 'BlueSky',
            account_id: session.handle,
            account_name: `@${session.handle}`,
            access_token: null,
            refresh_token: null,
            token_secret: appPassword,
            expires_at: null,
            created_by: userEmail,
            is_active: true,
            last_error: null,
          },
          { onConflict: 'platform,account_id' },
        );

        if (upsertErr) {
          return json({ error: upsertErr.message || 'Failed to save BlueSky connection.' }, 500);
        }

        await supabase
          .from('platform_connections')
          .update({ is_active: false })
          .eq('platform', 'BlueSky')
          .neq('account_id', session.handle)
          .eq('is_active', true);

        return json({ success: true });
      }

      default:
        return json({ error: 'Unsupported action.' }, 400);
    }
  } catch (error) {
    if (error instanceof Response) return error;

    return json(
      {
        error: error instanceof Error ? error.message : 'Platform connections request failed.',
      },
      500,
    );
  }
});
