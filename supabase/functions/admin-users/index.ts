import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getSuperAdminEmail, isSuperAdminEmail } from '../_shared/adminAccess.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const APP_URL = Deno.env.get('APP_URL') ?? 'https://ddpopmatters.github.io/content-hub/';

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

interface AuthAdminUser {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
  last_sign_in_at?: string | null;
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

async function getRequestUser(authHeader: string) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY,
      Authorization: authHeader,
    },
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as { id?: string | null; email?: string | null } | null;
}

const isExistingAuthUserError = (message: string | null | undefined): boolean => {
  return /already been registered|email_exists/i.test(message ?? '');
};

const resolveExistingAuthStatus = (user: AuthAdminUser): string => {
  const isActive = Boolean(user.email_confirmed_at || user.confirmed_at || user.last_sign_in_at);
  return isActive ? 'active' : 'pending';
};

async function findAuthUserByEmail(
  supabase: ReturnType<typeof getServiceClient>,
  email: string,
): Promise<{ user: AuthAdminUser | null; error: string | null }> {
  let page = 1;
  const perPage = 200;

  while (page <= 10) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      return { user: null, error: error.message || 'Failed to inspect existing auth users.' };
    }

    const users = Array.isArray(data.users) ? (data.users as AuthAdminUser[]) : [];
    const existingUser = users.find((user) => normalizeEmail(user.email) === email) ?? null;

    if (existingUser) {
      return { user: existingUser, error: null };
    }

    if (users.length < perPage) {
      break;
    }

    page += 1;
  }

  return { user: null, error: null };
}

async function fetchAdminProfileByAuthUserId(
  supabase: ReturnType<typeof getServiceClient>,
  authUserId: string,
) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, email, is_admin, auth_user_id')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (error) return null;
  return data as {
    id: string;
    email: string;
    is_admin: boolean;
    auth_user_id: string | null;
  } | null;
}

async function fetchAdminProfileByEmail(
  supabase: ReturnType<typeof getServiceClient>,
  email: string,
) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, email, is_admin, auth_user_id')
    .eq('email', email)
    .maybeSingle();

  if (error) return null;
  return data as {
    id: string;
    email: string;
    is_admin: boolean;
    auth_user_id: string | null;
  } | null;
}

async function relinkAdminProfileAuthUser(
  supabase: ReturnType<typeof getServiceClient>,
  profile: { id: string; email: string; is_admin: boolean; auth_user_id: string | null },
  authUserId: string,
) {
  const { data, error } = await supabase
    .from('user_profiles')
    .update({ auth_user_id: authUserId })
    .eq('id', profile.id)
    .select('id, email, is_admin, auth_user_id')
    .maybeSingle();

  if (error) return profile;
  return (
    (data as { id: string; email: string; is_admin: boolean; auth_user_id: string | null }) ??
    profile
  );
}

async function resolveAdminProfile(
  supabase: ReturnType<typeof getServiceClient>,
  authUserId: string | null,
  email: string,
) {
  if (authUserId) {
    const profileByAuthUserId = await fetchAdminProfileByAuthUserId(supabase, authUserId);
    if (profileByAuthUserId) return profileByAuthUserId;
  }

  const profileByEmail = await fetchAdminProfileByEmail(supabase, email);
  if (!profileByEmail) return null;

  if (!authUserId || profileByEmail.auth_user_id === authUserId) {
    return profileByEmail;
  }

  return relinkAdminProfileAuthUser(supabase, profileByEmail, authUserId);
}

async function syncCanonicalAdminState(supabase: ReturnType<typeof getServiceClient>) {
  const superAdminEmail = getSuperAdminEmail();

  await supabase
    .from('user_profiles')
    .update({ is_admin: false })
    .eq('is_admin', true)
    .neq('email', superAdminEmail);

  await supabase.from('user_profiles').update({ is_admin: true }).eq('email', superAdminEmail);
}

async function requireSuperAdmin(req: Request) {
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const user = await getRequestUser(authHeader);
  if (!user?.email) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = getServiceClient();
  const authUserId = typeof user.id === 'string' ? user.id : null;
  const email = normalizeEmail(user.email);
  const profile = await resolveAdminProfile(supabase, authUserId, email);

  if (!profile || !isSuperAdminEmail(email)) {
    throw new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  await syncCanonicalAdminState(supabase);

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
    const { supabase } = await requireSuperAdmin(req);

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

        let inviteSent = false;
        let authUserId: string | null = null;
        let status = 'pending';

        const { data: inviteData, error: inviteError } =
          await supabase.auth.admin.inviteUserByEmail(email, {
            data: { name },
            redirectTo: APP_URL,
          });

        if (inviteError) {
          if (!isExistingAuthUserError(inviteError.message)) {
            return json({ error: inviteError.message || 'Failed to send invite.' }, 500);
          }

          const { user: existingAuthUser, error: existingAuthError } = await findAuthUserByEmail(
            supabase,
            email,
          );

          if (existingAuthError) {
            return json({ error: existingAuthError }, 500);
          }

          if (!existingAuthUser?.id) {
            return json(
              {
                error:
                  'An account already exists for that email, but Content Hub could not link it automatically.',
              },
              500,
            );
          }

          authUserId = existingAuthUser.id;
          status = resolveExistingAuthStatus(existingAuthUser);
        } else {
          inviteSent = true;
          authUserId = inviteData.user?.id ?? null;
        }

        const { data, error } = await supabase
          .from('user_profiles')
          .insert({
            auth_user_id: authUserId,
            email,
            name,
            features,
            status,
            is_admin: false,
            is_approver: isApprover,
          })
          .select('*')
          .single();

        if (error) {
          if (inviteSent && authUserId) {
            await supabase.auth.admin.deleteUser(authUserId);
          }
          return json({ error: error.message || 'Failed to create user profile.' }, 500);
        }

        return json({ user: data as UserProfileRow, inviteSent }, 201);
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
