import type { createClient as SupabaseCreateClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';

interface MockProfileRow {
  id: string;
  auth_user_id: string | null;
  email: string;
  name: string;
  avatar_url: string | null;
  is_admin: boolean;
  is_approver: boolean;
  features: string[];
  status: string;
  created_at: string;
  manager_email: string | null;
  last_login_at?: string | null;
}

interface MockQueryState {
  filters: Record<string, unknown>;
  updateData: Record<string, unknown> | null;
}

function createMockSupabaseClient(
  authUser: { id: string; email: string },
  rows: MockProfileRow[],
  invokeResult: { data: unknown; error: { message: string } | null } = {
    data: { ok: true, sent: 1, failed: 0 },
    error: null,
  },
  session: { access_token: string } | null = { access_token: 'session-token' },
) {
  const profileRows = rows.map((row) => ({ ...row }));
  const updates: Array<{ filters: Record<string, unknown>; payload: Record<string, unknown> }> = [];

  const from = vi.fn((table: string) => {
    const state: MockQueryState = { filters: {}, updateData: null };

    const resolve = async () => {
      if (table !== 'user_profiles') {
        return { data: null, error: null };
      }

      const matchRow = () =>
        profileRows.find((row) =>
          Object.entries(state.filters).every(
            ([field, value]) => row[field as keyof MockProfileRow] === value,
          ),
        );

      if (state.updateData) {
        const row = matchRow();
        if (!row) return { data: null, error: null };
        Object.assign(row, state.updateData);
        updates.push({ filters: { ...state.filters }, payload: { ...state.updateData } });
        return { data: { ...row }, error: null };
      }

      const row = matchRow();
      return { data: row ? { ...row } : null, error: null };
    };

    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn((field: string, value: unknown) => {
        state.filters[field] = value;
        return builder;
      }),
      update: vi.fn((payload: Record<string, unknown>) => {
        state.updateData = payload;
        return builder;
      }),
      maybeSingle: vi.fn(resolve),
      single: vi.fn(resolve),
    };

    return builder;
  });

  return {
    client: {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: authUser } }),
        getSession: vi.fn().mockResolvedValue({ data: { session } }),
        stopAutoRefresh: vi.fn(),
      },
      functions: {
        invoke: vi.fn().mockResolvedValue(invokeResult),
      },
      from,
    },
    updates,
    profileRows,
  };
}

async function loadSupabaseModule(client: ReturnType<typeof createMockSupabaseClient>['client']) {
  vi.resetModules();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  const createClient = vi.fn(() => client) as unknown as typeof SupabaseCreateClient;
  (
    window as typeof window & {
      supabase?: { createClient: typeof SupabaseCreateClient };
      supabaseReady?: Promise<void>;
    }
  ).supabase = { createClient };
  delete (
    window as typeof window & {
      supabaseReady?: Promise<void>;
    }
  ).supabaseReady;

  return import('./supabase');
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete (
    window as typeof window & {
      supabase?: { createClient: typeof SupabaseCreateClient };
      supabaseReady?: Promise<void>;
      __currentUserEmail?: string | null;
    }
  ).supabase;
  delete (
    window as typeof window & {
      supabaseReady?: Promise<void>;
      __currentUserEmail?: string | null;
    }
  ).supabaseReady;
  delete (
    window as typeof window & {
      __currentUserEmail?: string | null;
    }
  ).__currentUserEmail;
});

describe('SUPABASE_API.fetchCurrentUserProfile', () => {
  const baseProfile: MockProfileRow = {
    id: 'profile-1',
    auth_user_id: 'intel-user-1',
    email: 'francesca.harrison@populationmatters.org',
    name: 'Francesca Harrison',
    avatar_url: null,
    is_admin: false,
    is_approver: true,
    features: ['calendar', 'approvals'],
    status: 'active',
    created_at: '2026-03-28T10:00:00.000Z',
    manager_email: null,
  };

  it('returns the profile when auth_user_id already matches', async () => {
    const { client, updates } = createMockSupabaseClient(
      {
        id: 'intel-user-1',
        email: baseProfile.email,
      },
      [baseProfile],
    );
    const { SUPABASE_API } = await loadSupabaseModule(client);

    const profile = await SUPABASE_API.fetchCurrentUserProfile();

    expect(profile?.id).toBe(baseProfile.id);
    expect(profile?.auth_user_id).toBe('intel-user-1');
    expect(updates).toHaveLength(0);
  });

  it('relinks a migrated user profile by email when auth_user_id is stale', async () => {
    const { client, updates, profileRows } = createMockSupabaseClient(
      {
        id: 'intel-user-1',
        email: baseProfile.email,
      },
      [{ ...baseProfile, auth_user_id: 'legacy-content-hub-user' }],
    );
    const { SUPABASE_API } = await loadSupabaseModule(client);

    const profile = await SUPABASE_API.fetchCurrentUserProfile();

    expect(profile?.auth_user_id).toBe('intel-user-1');
    expect(updates).toHaveLength(1);
    expect(updates[0]?.payload).toMatchObject({ auth_user_id: 'intel-user-1' });
    expect(profileRows[0]?.auth_user_id).toBe('intel-user-1');
  });

  it('returns null when no profile matches by auth_user_id or email', async () => {
    const { client, updates } = createMockSupabaseClient(
      {
        id: 'intel-user-1',
        email: 'francesca.harrison@populationmatters.org',
      },
      [],
    );
    const { SUPABASE_API } = await loadSupabaseModule(client);

    const profile = await SUPABASE_API.fetchCurrentUserProfile();

    expect(profile).toBeNull();
    expect(updates).toHaveLength(0);
  });
});

describe('SUPABASE_API.updateUserProfile', () => {
  it('updates the recovered profile after relinking by email', async () => {
    const { client, updates } = createMockSupabaseClient(
      {
        id: 'intel-user-1',
        email: 'francesca.harrison@populationmatters.org',
      },
      [
        {
          id: 'profile-1',
          auth_user_id: 'legacy-content-hub-user',
          email: 'francesca.harrison@populationmatters.org',
          name: 'Francesca Harrison',
          avatar_url: null,
          is_admin: false,
          is_approver: true,
          features: ['calendar', 'approvals'],
          status: 'active',
          created_at: '2026-03-28T10:00:00.000Z',
          manager_email: null,
        },
      ],
    );
    const { SUPABASE_API } = await loadSupabaseModule(client);

    const profile = await SUPABASE_API.updateUserProfile({ name: 'Francesca H.' });

    expect(profile?.name).toBe('Francesca H.');
    expect(updates).toHaveLength(2);
    expect(updates[0]?.payload).toMatchObject({ auth_user_id: 'intel-user-1' });
    expect(updates[1]?.payload).toMatchObject({ name: 'Francesca H.' });
  });
});

describe('SUPABASE_API.sendNotification', () => {
  it('throws when the notification service cannot resolve any recipients', async () => {
    const { client } = createMockSupabaseClient(
      {
        id: 'intel-user-1',
        email: 'francesca.harrison@populationmatters.org',
      },
      [],
      {
        data: {
          ok: false,
          sent: 0,
          failed: 1,
          error: 'No email addresses found for recipients.',
        },
        error: null,
      },
    );
    const { SUPABASE_API } = await loadSupabaseModule(client);

    await expect(
      SUPABASE_API.sendNotification({ subject: 'Test', text: 'Hello', approvers: ['Missing'] }),
    ).rejects.toThrow('No email addresses found for recipients.');
  });

  it('throws when the notification function reports failed deliveries', async () => {
    const { client } = createMockSupabaseClient(
      {
        id: 'intel-user-1',
        email: 'francesca.harrison@populationmatters.org',
      },
      [],
      {
        data: { ok: false, sent: 0, failed: 2, error: 'Failed to send 2 notifications.' },
        error: null,
      },
    );
    const { SUPABASE_API } = await loadSupabaseModule(client);

    await expect(
      SUPABASE_API.sendNotification({ subject: 'Test', text: 'Hello', toEmails: ['a@pm.org'] }),
    ).rejects.toThrow('Failed to send 2 notifications.');
  });

  it('throws when the notification invoke itself fails', async () => {
    const { client } = createMockSupabaseClient(
      {
        id: 'intel-user-1',
        email: 'francesca.harrison@populationmatters.org',
      },
      [],
      {
        data: null,
        error: { message: 'Edge function unavailable' },
      },
    );
    const { SUPABASE_API } = await loadSupabaseModule(client);

    await expect(
      SUPABASE_API.sendNotification({ subject: 'Test', text: 'Hello', toEmails: ['a@pm.org'] }),
    ).rejects.toThrow('Edge function unavailable');
  });
});

describe('SUPABASE_API.fetchAdminUsers', () => {
  it('returns an empty list without hitting tables when there is no authenticated session', async () => {
    const { client } = createMockSupabaseClient(
      {
        id: 'intel-user-1',
        email: 'francesca.harrison@populationmatters.org',
      },
      [],
      { data: { users: [] }, error: null },
      null,
    );
    const { SUPABASE_API } = await loadSupabaseModule(client);

    const users = await SUPABASE_API.fetchAdminUsers();

    expect(users).toEqual([]);
    expect(client.from).not.toHaveBeenCalledWith('user_profiles');
  });
});
