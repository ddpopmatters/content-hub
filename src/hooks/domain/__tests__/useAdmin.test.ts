import { renderHook, act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAdmin } from '../useAdmin';

const { mockFetchAdminUsers, mockInviteAdminUser, mockDeleteAdminUser, mockUpdateAdminUser } =
  vi.hoisted(() => ({
    mockFetchAdminUsers: vi.fn(),
    mockInviteAdminUser: vi.fn(),
    mockDeleteAdminUser: vi.fn(),
    mockUpdateAdminUser: vi.fn(),
  }));

vi.mock('../../../lib/supabase', () => ({
  SUPABASE_API: {
    fetchAdminUsers: mockFetchAdminUsers,
    inviteAdminUser: mockInviteAdminUser,
    deleteAdminUser: mockDeleteAdminUser,
    updateAdminUser: mockUpdateAdminUser,
  },
}));

const deps = {
  currentUserIsAdmin: true,
  authStatus: 'ready',
  pushSyncToast: vi.fn(),
  refreshApprovers: vi.fn().mockResolvedValue(undefined),
};

describe('useAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchAdminUsers.mockResolvedValue([]);
    mockInviteAdminUser.mockResolvedValue({ user: null, inviteSent: true });
    mockDeleteAdminUser.mockResolvedValue(true);
    mockUpdateAdminUser.mockResolvedValue(null);
  });

  it('refreshes users through SUPABASE_API when the browser bridge is absent', async () => {
    mockFetchAdminUsers.mockResolvedValueOnce([
      {
        id: 'user-1',
        email: 'new.user@populationmatters.org',
        name: 'New User',
        status: 'pending',
        isAdmin: false,
        isApprover: false,
        avatarUrl: null,
        features: ['calendar'],
        invitePending: true,
      },
    ]);

    const { result } = renderHook(() => useAdmin(deps));

    act(() => {
      result.current.refreshUsers();
    });

    await waitFor(() => {
      expect(result.current.userList).toHaveLength(1);
    });

    expect(mockFetchAdminUsers).toHaveBeenCalledTimes(1);
  });

  it('invites a user and updates local state on success', async () => {
    const invitedUser = {
      id: 'user-1',
      email: 'new.user@populationmatters.org',
      name: 'New User',
      status: 'pending',
      isAdmin: false,
      isApprover: true,
      avatarUrl: null,
      features: ['calendar', 'approvals'],
      invitePending: true,
    };
    mockInviteAdminUser.mockResolvedValueOnce({ user: invitedUser, inviteSent: true });
    mockFetchAdminUsers.mockResolvedValueOnce([invitedUser]);

    const { result } = renderHook(() => useAdmin(deps));

    await act(async () => {
      await result.current.addUser({
        first: 'New',
        last: 'User',
        email: ' New.User@PopulationMatters.org ',
        features: ['calendar', 'approvals'],
        isApprover: true,
      });
    });

    expect(mockInviteAdminUser).toHaveBeenCalledWith({
      name: 'New User',
      email: 'new.user@populationmatters.org',
      features: ['calendar', 'approvals'],
      isApprover: true,
    });
    expect(result.current.userAdminSuccess).toBe(
      'Invitation sent to new.user@populationmatters.org.',
    );
    await waitFor(() => {
      expect(result.current.userList[0]?.email).toBe('new.user@populationmatters.org');
    });
    expect(deps.refreshApprovers).toHaveBeenCalled();
  });

  it('grants access when the email already has an auth account', async () => {
    const existingAuthUser = {
      id: 'user-2',
      email: 'existing.user@populationmatters.org',
      name: 'Existing User',
      status: 'active',
      isAdmin: false,
      isApprover: false,
      avatarUrl: null,
      features: ['calendar'],
      invitePending: false,
    };
    mockInviteAdminUser.mockResolvedValueOnce({ user: existingAuthUser, inviteSent: false });
    mockFetchAdminUsers.mockResolvedValueOnce([existingAuthUser]);

    const { result } = renderHook(() => useAdmin(deps));

    await act(async () => {
      await result.current.addUser({
        first: 'Existing',
        last: 'User',
        email: 'existing.user@populationmatters.org',
        features: ['calendar'],
        isApprover: false,
      });
    });

    expect(result.current.userAdminSuccess).toBe(
      'Access granted to existing.user@populationmatters.org. They can sign in with their existing account.',
    );
    await waitFor(() => {
      expect(result.current.userList[0]?.email).toBe('existing.user@populationmatters.org');
    });
  });

  it('surfaces backend invite failures', async () => {
    mockInviteAdminUser.mockRejectedValueOnce(new Error('Email invite service is unavailable.'));

    const { result } = renderHook(() => useAdmin(deps));

    await act(async () => {
      await result.current.addUser({
        first: 'New',
        last: 'User',
        email: 'new.user@populationmatters.org',
        features: ['calendar'],
        isApprover: false,
      });
    });

    expect(result.current.userAdminError).toBe('Email invite service is unavailable.');
  });

  it('blocks user management for non-admin viewers', async () => {
    const { result } = renderHook(() =>
      useAdmin({
        ...deps,
        currentUserIsAdmin: false,
      }),
    );

    await act(async () => {
      await result.current.addUser({
        first: 'No',
        last: 'Access',
        email: 'no.access@populationmatters.org',
        features: ['calendar'],
        isApprover: false,
      });
    });

    expect(result.current.userAdminError).toBe('You do not have permission to manage users.');
    expect(mockInviteAdminUser).not.toHaveBeenCalled();
  });
});
