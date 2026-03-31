import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_URL = Deno.env.get('APP_URL') ?? 'https://ddpopmatters.github.io/content-hub';

interface UserProfileRow {
  id: string;
  auth_user_id: string | null;
  email: string;
  name: string;
  features: string[];
  status: string;
  is_admin: boolean;
  is_approver: boolean;
  avatar_url: string | null;
  created_at: string;
  updated_at?: string;
  last_login_at?: string | null;
  manager_email?: string | null;
}

interface RequestPayload {
  action?: 'list' | 'create' | 'update' | 'delete';
  id?: string;
  email?: string;
  name?: string;
  features?: string[];
  isApprover?: boolean;
  patch?: {
    name?: string;
    features?: string[];
    isApprover?: boolean;
    status?: string;
  };
}

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const normalizeEmail = (value: string | null | undefined): string => {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
};

const getServiceClient = () => createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function requireAdmin(req: Request) {
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = getServiceClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user?.email) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const email = normalizeEmail(user.email);
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('id, email, is_admin')
    .eq('email', email)
    .maybeSingle();

  if (profileError || !profile?.is_admin) {
    throw new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return { supabase, user };
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

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
    const { supabase } = await requireAdmin(req);

    switch (payload.action) {
      case 'list': {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('*')
          .order('name', { ascending: true });

        if (error) return json({ error: error.message || 'Failed to load users.' }, 500);
        return json({ users: (data as UserProfileRow[]) ?? [] });
      }

      case 'create': {
        const email = normalizeEmail(payload.email);
        const name = typeof payload.name === 'string' ? payload.name.trim() : '';
        const features = Array.isArray(payload.features) ? payload.features : [];
        const isApprover = Boolean(payload.isApprover);

        if (!email || !name) {
          return json({ error: 'Name and email are required.' }, 400);
        }

        const { data: existingProfile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('email', email)
          .maybeSingle();

        if (existingProfile) {
          return json(
            {
              error:
                'A user profile already exists for that email. Use the existing account or remove it first.',
            },
            409,
          );
        }

        const { data: inviteData, error: inviteError } =
          await supabase.auth.admin.inviteUserByEmail(email, {
            data: { name },
            redirectTo: APP_URL,
          });

        if (inviteError) {
          return json({ error: inviteError.message || 'Failed to send invite.' }, 500);
        }

        const authUserId = inviteData.user?.id ?? null;
        const { data, error } = await supabase
          .from('user_profiles')
          .insert({
            auth_user_id: authUserId,
            email,
            name,
            features,
            status: 'pending',
            is_admin: false,
            is_approver: isApprover,
          })
          .select('*')
          .single();

        if (error) {
          if (authUserId) {
            await supabase.auth.admin.deleteUser(authUserId);
          }
          return json({ error: error.message || 'Failed to create user profile.' }, 500);
        }

        return json({ user: data as UserProfileRow }, 201);
      }

      case 'update': {
        if (!payload.id || !payload.patch) {
          return json({ error: 'User id and patch are required.' }, 400);
        }

        const dbPatch: Record<string, unknown> = {};
        if (typeof payload.patch.name === 'string') dbPatch.name = payload.patch.name.trim();
        if (Array.isArray(payload.patch.features)) dbPatch.features = payload.patch.features;
        if (typeof payload.patch.isApprover === 'boolean')
          dbPatch.is_approver = payload.patch.isApprover;
        if (typeof payload.patch.status === 'string') dbPatch.status = payload.patch.status;

        if (!Object.keys(dbPatch).length) {
          return json({ error: 'No supported fields to update.' }, 400);
        }

        const { data, error } = await supabase
          .from('user_profiles')
          .update(dbPatch)
          .eq('id', payload.id)
          .select('*')
          .single();

        if (error) {
          return json({ error: error.message || 'Failed to update user.' }, 500);
        }

        return json({ user: data as UserProfileRow });
      }

      case 'delete': {
        if (!payload.id) {
          return json({ error: 'User id is required.' }, 400);
        }

        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('auth_user_id')
          .eq('id', payload.id)
          .single();

        if (profileError) {
          return json({ error: profileError.message || 'Failed to load user.' }, 500);
        }

        const authUserId =
          profile && typeof profile.auth_user_id === 'string' ? profile.auth_user_id : null;

        if (authUserId) {
          const { error: authDeleteError } = await supabase.auth.admin.deleteUser(authUserId);
          if (authDeleteError) {
            return json({ error: authDeleteError.message || 'Failed to delete auth user.' }, 500);
          }
        } else {
          const { error: deleteError } = await supabase
            .from('user_profiles')
            .delete()
            .eq('id', payload.id);
          if (deleteError) {
            return json({ error: deleteError.message || 'Failed to delete user profile.' }, 500);
          }
        }

        return json({ ok: true });
      }

      default:
        return json({ error: 'Unsupported action.' }, 400);
    }
  } catch (error) {
    if (error instanceof Response) return error;
    console.error('[admin-users] Unhandled error:', error);
    return json({ error: 'Internal error' }, 500);
  }
});
