import { requireOwnerRequest } from './ownerAuth.ts';

const OWNER_EMAIL = 'daniel.davis@populationmatters.org';

function assertEquals(actual: unknown, expected: unknown): void {
  if (!Object.is(actual, expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

async function captureResponse(operation: () => Promise<unknown>): Promise<Response> {
  try {
    await operation();
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
  throw new Error('Expected operation to throw a Response');
}

const request = (authorization?: string): Request =>
  new Request('https://example.test/functions/v1/publish-entry', {
    method: 'POST',
    headers: authorization ? { Authorization: authorization } : undefined,
  });

Deno.test('requireOwnerRequest rejects a missing bearer token before calling Auth', async () => {
  let authCalled = false;
  const response = await captureResponse(() =>
    requireOwnerRequest(request(), {
      supabaseUrl: 'https://project.supabase.co',
      publishableKey: 'publishable-key',
      fetcher: () => {
        authCalled = true;
        return Promise.resolve(Response.json({}));
      },
    }),
  );

  assertEquals(response.status, 401);
  assertEquals(authCalled, false);
});

Deno.test('requireOwnerRequest rejects invalid Supabase sessions', async () => {
  const response = await captureResponse(() =>
    requireOwnerRequest(request('Bearer invalid-token'), {
      supabaseUrl: 'https://project.supabase.co',
      publishableKey: 'publishable-key',
      fetcher: () => Promise.resolve(new Response('Unauthorized', { status: 401 })),
    }),
  );

  assertEquals(response.status, 401);
});

Deno.test('requireOwnerRequest rejects an authenticated non-owner', async () => {
  const response = await captureResponse(() =>
    requireOwnerRequest(request('Bearer valid-token'), {
      supabaseUrl: 'https://project.supabase.co',
      publishableKey: 'publishable-key',
      fetcher: () => Promise.resolve(Response.json({ id: 'user-2', email: 'other@example.org' })),
    }),
  );

  assertEquals(response.status, 403);
});

Deno.test('requireOwnerRequest returns the canonical owner identity', async () => {
  const identity = await requireOwnerRequest(request('Bearer valid-token'), {
    supabaseUrl: 'https://project.supabase.co/',
    publishableKey: 'publishable-key',
    fetcher: (input, init) => {
      assertEquals(String(input), 'https://project.supabase.co/auth/v1/user');
      assertEquals(new Headers(init?.headers).get('Authorization'), 'Bearer valid-token');
      assertEquals(new Headers(init?.headers).get('apikey'), 'publishable-key');
      return Promise.resolve(
        Response.json({ id: 'owner-id', email: ` ${OWNER_EMAIL.toUpperCase()} ` }),
      );
    },
  });

  assertEquals(identity.id, 'owner-id');
  assertEquals(identity.email, OWNER_EMAIL);
});

Deno.test('requireOwnerRequest fails closed when Auth configuration is unavailable', async () => {
  const response = await captureResponse(() =>
    requireOwnerRequest(request('Bearer valid-token'), {
      supabaseUrl: 'https://project.supabase.co',
      publishableKey: '',
    }),
  );

  assertEquals(response.status, 503);
});
