import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAuth } from '../useAuth';
import { AUTH, SUPABASE_API, getSupabase } from '../../../lib/supabase';

const originalLocation = window.location;

const setWindowLocation = (href: string) => {
  const url = new URL(href);
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      ...originalLocation,
      href: url.toString(),
      origin: url.origin,
      pathname: url.pathname,
      search: url.search,
      hash: url.hash,
      hostname: url.hostname,
    },
  });
};

// Mock all dependencies that useAuth imports
vi.mock('../../../lib/utils', () => ({
  ensurePeopleArray: (val: unknown) => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string')
      return val
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
    return [];
  },
  normalizeEmail: (s: string) => s?.toLowerCase().trim() ?? '',
  storageAvailable: () => true,
  STORAGE_KEYS: { USER: 'pm-user' },
}));

vi.mock('../../../lib/users', () => ({
  ensureFeaturesList: (val: unknown) => (Array.isArray(val) ? val : []),
}));

vi.mock('../../../lib/supabase', () => ({
  AUTH: {
    getSession: vi.fn().mockResolvedValue(null),
    signIn: vi.fn().mockResolvedValue({ error: 'mock' }),
    signOut: vi.fn().mockResolvedValue(undefined),
  },
  SUPABASE_API: {
    fetchCurrentUserProfile: vi.fn().mockResolvedValue(null),
    updateUserProfile: vi.fn().mockResolvedValue(null),
  },
  getSupabase: vi.fn().mockReturnValue(null),
}));

describe('useAuth — viewer utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/');
    setWindowLocation('https://content-hub.test/');
    vi.mocked(AUTH.getSession).mockResolvedValue(null);
    vi.mocked(AUTH.signIn).mockResolvedValue({ error: 'mock' });
    vi.mocked(SUPABASE_API.fetchCurrentUserProfile).mockResolvedValue(null);
    vi.mocked(getSupabase).mockReturnValue(null);
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
    window.history.replaceState({}, '', '/');
  });

  function setupAuthenticatedHook(name: string, email: string) {
    const { result } = renderHook(() => useAuth());

    // Manually set user identity via internal state
    act(() => {
      // Access setters through the hook return
      result.current.setCurrentUser(name);
      result.current.setCurrentUserEmail(email);
    });

    return { result };
  }

  describe('viewerIsAuthor', () => {
    it('returns true when entry author matches current user name', () => {
      const { result } = setupAuthenticatedHook('Dan Smith', 'dan@pm.org');
      expect(result.current.viewerIsAuthor({ author: 'Dan Smith' })).toBe(true);
    });

    it('matches case-insensitively', () => {
      const { result } = setupAuthenticatedHook('Dan Smith', 'dan@pm.org');
      expect(result.current.viewerIsAuthor({ author: 'dan smith' })).toBe(true);
      expect(result.current.viewerIsAuthor({ author: 'DAN SMITH' })).toBe(true);
    });

    it('matches by email', () => {
      const { result } = setupAuthenticatedHook('Dan Smith', 'dan@pm.org');
      expect(result.current.viewerIsAuthor({ author: 'dan@pm.org' })).toBe(true);
    });

    it('returns false when author does not match', () => {
      const { result } = setupAuthenticatedHook('Dan Smith', 'dan@pm.org');
      expect(result.current.viewerIsAuthor({ author: 'Jane Doe' })).toBe(false);
    });

    it('returns false for null entry', () => {
      const { result } = setupAuthenticatedHook('Dan Smith', 'dan@pm.org');
      expect(result.current.viewerIsAuthor(null)).toBe(false);
    });

    it('returns false for entry without author field', () => {
      const { result } = setupAuthenticatedHook('Dan Smith', 'dan@pm.org');
      expect(result.current.viewerIsAuthor({})).toBe(false);
    });

    it('trims whitespace in comparison', () => {
      const { result } = setupAuthenticatedHook('Dan Smith', 'dan@pm.org');
      expect(result.current.viewerIsAuthor({ author: '  Dan Smith  ' })).toBe(true);
    });
  });

  describe('viewerIsApprover', () => {
    it('returns true when current user name is in approvers array', () => {
      const { result } = setupAuthenticatedHook('Dan Smith', 'dan@pm.org');
      expect(result.current.viewerIsApprover({ approvers: ['Dan Smith', 'Jane Doe'] })).toBe(true);
    });

    it('returns true when current email is in approvers', () => {
      const { result } = setupAuthenticatedHook('Dan Smith', 'dan@pm.org');
      expect(result.current.viewerIsApprover({ approvers: ['dan@pm.org'] })).toBe(true);
    });

    it('matches case-insensitively', () => {
      const { result } = setupAuthenticatedHook('Dan Smith', 'dan@pm.org');
      expect(result.current.viewerIsApprover({ approvers: ['dan smith'] })).toBe(true);
    });

    it('returns false when not in approvers', () => {
      const { result } = setupAuthenticatedHook('Dan Smith', 'dan@pm.org');
      expect(result.current.viewerIsApprover({ approvers: ['Jane Doe'] })).toBe(false);
    });

    it('returns false for null entry', () => {
      const { result } = setupAuthenticatedHook('Dan Smith', 'dan@pm.org');
      expect(result.current.viewerIsApprover(null)).toBe(false);
    });

    it('handles comma-separated approver string', () => {
      const { result } = setupAuthenticatedHook('Dan Smith', 'dan@pm.org');
      expect(result.current.viewerIsApprover({ approvers: 'Jane Doe, Dan Smith' })).toBe(true);
    });
  });

  describe('hasFeature', () => {
    it('returns true for admin regardless of features', () => {
      const { result } = renderHook(() => useAuth());
      act(() => {
        result.current.handleAuthChange({
          profile: { id: '1', email: 'admin@pm.org', is_admin: true, features: [] },
        });
      });
      expect(result.current.hasFeature('calendar')).toBe(true);
      expect(result.current.hasFeature('anything')).toBe(true);
    });

    it('returns true when feature is in user features list', () => {
      const { result } = renderHook(() => useAuth());
      act(() => {
        result.current.handleAuthChange({
          profile: {
            id: '1',
            email: 'user@pm.org',
            is_admin: false,
            features: ['calendar', 'ideas'],
          },
        });
      });
      expect(result.current.hasFeature('calendar')).toBe(true);
      expect(result.current.hasFeature('ideas')).toBe(true);
    });

    it('returns false when feature is not in user features', () => {
      const { result } = renderHook(() => useAuth());
      act(() => {
        result.current.handleAuthChange({
          profile: { id: '1', email: 'user@pm.org', is_admin: false, features: ['calendar'] },
        });
      });
      expect(result.current.hasFeature('kanban')).toBe(false);
    });
  });

  describe('reset', () => {
    it('clears user identity and sets authStatus to login', () => {
      const { result } = setupAuthenticatedHook('Dan Smith', 'dan@pm.org');

      act(() => {
        result.current.setAuthStatus('ready');
      });
      expect(result.current.authStatus).toBe('ready');

      act(() => {
        result.current.reset();
      });

      expect(result.current.currentUser).toBe('');
      expect(result.current.currentUserEmail).toBe('');
      expect(result.current.authStatus).toBe('login');
    });
  });

  describe('invite activation', () => {
    it('enters invite mode for native Supabase recovery links', async () => {
      vi.mocked(AUTH.getSession).mockResolvedValue({
        user: { email: 'invitee@pm.org' },
      } as never);
      vi.mocked(SUPABASE_API.fetchCurrentUserProfile).mockResolvedValue({
        email: 'invitee@pm.org',
        name: 'Invitee',
        avatar_url: '',
        features: ['calendar'],
        is_admin: false,
      } as never);
      setWindowLocation(
        'https://ddpopmatters.github.io/content-hub/#access_token=test&type=recovery',
      );

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.authStatus).toBe('invite');
        expect(result.current.currentUserEmail).toBe('invitee@pm.org');
      });
      expect(result.current.currentUserHasPassword).toBe(false);
    });

    it('allows password setup from native invite flow without a legacy invite token', async () => {
      const updateUser = vi.fn().mockResolvedValue({
        data: { user: { email: 'invitee@pm.org' } },
        error: null,
      });
      vi.mocked(AUTH.getSession).mockResolvedValue({
        user: { email: 'invitee@pm.org' },
      } as never);
      vi.mocked(SUPABASE_API.fetchCurrentUserProfile).mockResolvedValue({
        email: 'invitee@pm.org',
        name: 'Invitee',
        avatar_url: '',
        features: [],
        is_admin: false,
      } as never);
      vi.mocked(getSupabase).mockReturnValue({
        auth: { updateUser },
      } as never);
      setWindowLocation(
        'https://ddpopmatters.github.io/content-hub/#access_token=test&type=invite',
      );

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.authStatus).toBe('invite');
      });

      act(() => {
        result.current.setInvitePassword('strong-pass');
        result.current.setInvitePasswordConfirm('strong-pass');
      });

      await act(async () => {
        await result.current.submitInvite({ preventDefault() {} } as Event);
      });

      expect(updateUser).toHaveBeenCalledWith({ password: 'strong-pass' });
      expect(result.current.authStatus).toBe('ready');
      expect(result.current.currentUserHasPassword).toBe(true);
    });
  });

  describe('handleChangePassword', () => {
    it('updates the password without reauth when no current password is provided', async () => {
      const updateUser = vi.fn().mockResolvedValue({ error: null });
      vi.mocked(AUTH.getSession).mockResolvedValue({
        user: { email: 'invitee@pm.org' },
      } as never);
      vi.mocked(AUTH.signIn).mockResolvedValue({ error: 'unexpected reauth' });
      vi.mocked(SUPABASE_API.fetchCurrentUserProfile).mockResolvedValue({
        email: 'invitee@pm.org',
        name: 'Invitee',
        avatar_url: '',
        features: [],
        is_admin: false,
      } as never);
      vi.mocked(getSupabase).mockReturnValue({
        auth: { updateUser },
      } as never);
      setWindowLocation(
        'https://ddpopmatters.github.io/content-hub/#access_token=test&type=recovery',
      );

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.authStatus).toBe('invite');
      });

      await act(async () => {
        await result.current.handleChangePassword({
          currentPassword: '',
          newPassword: 'new-password',
        });
      });

      expect(AUTH.signIn).not.toHaveBeenCalled();
      expect(updateUser).toHaveBeenCalledWith({ password: 'new-password' });
      expect(result.current.currentUserHasPassword).toBe(true);
    });
  });
});
