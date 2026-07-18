import { isSuperAdminEmail } from './adminAccess.ts';
import { corsHeaders } from './cors.ts';

interface AuthUser {
  id?: string | null;
  email?: string | null;
}

interface RequireOwnerOptions {
  supabaseUrl: string;
  publishableKey: string;
  fetcher?: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
}

export interface OwnerIdentity {
  id: string;
  email: string;
}

const errorResponse = (error: string, status: number): Response =>
  new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const normalizeEmail = (value: string | null | undefined): string =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

/**
 * Authenticate the request before any service-role or social-platform access.
 * The browser token proves identity; the canonical owner check authorises publishing.
 */
export async function requireOwnerRequest(
  req: Request,
  { supabaseUrl, publishableKey, fetcher = fetch }: RequireOwnerOptions,
): Promise<OwnerIdentity> {
  const authHeader = req.headers.get('Authorization')?.trim() ?? '';
  if (!/^Bearer\s+\S+$/i.test(authHeader)) {
    throw errorResponse('Unauthorized', 401);
  }

  if (!supabaseUrl || !publishableKey) {
    throw errorResponse('Authentication service is unavailable.', 503);
  }

  let response: Response;
  try {
    response = await fetcher(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
      headers: {
        apikey: publishableKey,
        Authorization: authHeader,
      },
    });
  } catch {
    throw errorResponse('Authentication service is unavailable.', 503);
  }

  if (!response.ok) {
    throw errorResponse('Unauthorized', 401);
  }

  let user: AuthUser | null = null;
  try {
    user = (await response.json()) as AuthUser;
  } catch {
    throw errorResponse('Unauthorized', 401);
  }

  const email = normalizeEmail(user?.email);
  const id = typeof user?.id === 'string' ? user.id.trim() : '';
  if (!id || !email) {
    throw errorResponse('Unauthorized', 401);
  }

  if (!isSuperAdminEmail(email)) {
    throw errorResponse('Forbidden', 403);
  }

  return { id, email };
}
