import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { ensurePeopleArray, normalizeEmail, storageAvailable, STORAGE_KEYS } from '../../lib/utils';
import { ensureFeaturesList } from '../../lib/users';
const USER_STORAGE_KEY = STORAGE_KEYS.USER;

const hasStaticApiBridgeScript = (): boolean => {
  if (typeof document === 'undefined') return false;
  return Boolean(document.querySelector('script[src*="supabaseClient.js"]'));
};

interface UseAuthDeps {
  apiGet: (url: string) => Promise<unknown>;
  apiPost: (url: string, body: unknown) => Promise<unknown>;
  apiPut: (url: string, body: unknown) => Promise<unknown>;
}

export function useAuth({ apiGet, apiPost, apiPut }: UseAuthDeps) {
  // Identity state
  const [currentUser, setCurrentUser] = useState('');
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  const [currentUserAvatar, setCurrentUserAvatar] = useState('');
  const [currentUserFeatures, setCurrentUserFeatures] = useState<string[]>(() => []);
  const [currentUserIsAdmin, setCurrentUserIsAdmin] = useState(false);
  const [currentUserHasPassword, setCurrentUserHasPassword] = useState(false);

  // Auth flow state
  const [authStatus, setAuthStatus] = useState('loading');
  const [authError, setAuthError] = useState('');

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Invite form
  const [inviteToken, setInviteToken] = useState(() => {
    if (typeof window === 'undefined') return '';
    try {
      const url = new URL(window.location.href);
      return url.searchParams.get('invite') || '';
    } catch {
      return '';
    }
  });
  const [invitePassword, setInvitePassword] = useState('');
  const [invitePasswordConfirm, setInvitePasswordConfirm] = useState('');
  const [inviteError, setInviteError] = useState('');

  // Profile state
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileFormName, setProfileFormName] = useState('');
  const [profileAvatarDraft, setProfileAvatarDraft] = useState('');
  const [profileStatus, setProfileStatus] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  // Viewer utilities
  const normalizedViewerName = useMemo(
    () => (currentUser || '').trim().toLowerCase(),
    [currentUser],
  );
  const normalizedViewerEmail = useMemo(
    () => (currentUserEmail || '').trim().toLowerCase(),
    [currentUserEmail],
  );
  const viewerMatchesValue = useCallback(
    (value: unknown) => {
      if (!value || typeof value !== 'string') return false;
      const normalized = value.trim().toLowerCase();
      if (!normalized) return false;
      if (normalizedViewerName && normalizedViewerName === normalized) return true;
      if (normalizedViewerEmail && normalizedViewerEmail === normalized) return true;
      return false;
    },
    [normalizedViewerName, normalizedViewerEmail],
  );
  const viewerIsAuthor = useCallback(
    (entry: { author?: string } | null) => {
      if (!entry) return false;
      return viewerMatchesValue(entry.author);
    },
    [viewerMatchesValue],
  );
  const viewerIsApprover = useCallback(
    (entry: { approvers?: unknown } | null) => {
      if (!entry) return false;
      const names = ensurePeopleArray(entry.approvers);
      return names.some((name: string) => viewerMatchesValue(name));
    },
    [viewerMatchesValue],
  );

  // Feature checks
  const hasFeature = useCallback(
    (feature: string) => currentUserIsAdmin || currentUserFeatures.includes(feature),
    [currentUserFeatures, currentUserIsAdmin],
  );
  const canUseCalendar = hasFeature('calendar');
  const canUseKanban = hasFeature('kanban');
  const canUseApprovals = hasFeature('approvals');
  const canUseIdeas = hasFeature('ideas');

  // Profile helpers
  const PROFILE_IMAGE_LIMIT = 200 * 1024;

  const profileInitials = useMemo(() => {
    const base = (currentUser && currentUser.trim()) || currentUserEmail || 'U';
    const parts = base.split(/\s+/).filter(Boolean);
    if (!parts.length) return base.slice(0, 2).toUpperCase();
    const first = parts[0]?.[0] || '';
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : parts[0]?.[1] || '';
    return (first + last).toUpperCase();
  }, [currentUser, currentUserEmail]);

  const avatarPreview = profileAvatarDraft !== '' ? profileAvatarDraft : currentUserAvatar;

  const openProfileMenu = useCallback(() => {
    setProfileFormName(currentUser || currentUserEmail || '');
    setProfileAvatarDraft(currentUserAvatar || '');
    setProfileStatus('');
    setProfileError('');
    setProfileMenuOpen(true);
  }, [currentUser, currentUserEmail, currentUserAvatar]);

  const closeProfileMenu = useCallback(() => {
    setProfileMenuOpen(false);
  }, []);

  const handleProfileMenuToggle = useCallback(() => {
    if (profileMenuOpen) {
      closeProfileMenu();
      return;
    }
    openProfileMenu();
  }, [profileMenuOpen, closeProfileMenu, openProfileMenu]);

  // Close profile menu on outside click
  useEffect(() => {
    if (!profileMenuOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (!profileMenuRef.current) return;
      if (!profileMenuRef.current.contains(event.target as Node)) {
        closeProfileMenu();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [profileMenuOpen, closeProfileMenu]);

  const handleAvatarFileChange = useCallback((event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target?.files && target.files[0];
    if (!file) return;
    if (file.size > PROFILE_IMAGE_LIMIT) {
      setProfileError('Image must be under 200KB.');
      target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setProfileAvatarDraft(typeof reader.result === 'string' ? reader.result : '');
      setProfileError('');
    };
    reader.onerror = () => {
      setProfileError('Unable to read the selected image.');
    };
    reader.readAsDataURL(file);
    target.value = '';
  }, []);

  const handleProfileSave = useCallback(
    async (event: Event) => {
      event.preventDefault();
      const desiredName = profileFormName.trim() || currentUser || currentUserEmail;
      const payload: Record<string, unknown> = { name: desiredName };
      if ((profileAvatarDraft || '') !== (currentUserAvatar || '')) {
        payload.avatar = profileAvatarDraft ? profileAvatarDraft : null;
      }
      setProfileSaving(true);
      setProfileStatus('');
      setProfileError('');
      try {
        let response: Record<string, unknown> | null = null;
        if (
          window.api &&
          typeof (window.api as Record<string, unknown>).updateProfile === 'function'
        ) {
          response = (await (
            window.api as Record<string, (...args: unknown[]) => Promise<unknown>>
          ).updateProfile(payload)) as Record<string, unknown>;
        } else {
          response = (await apiPut('/api/user', payload)) as Record<string, unknown>;
        }
        const user = response?.user as Record<string, unknown> | undefined;
        if (user) {
          setCurrentUser((user.name as string) || desiredName);
          setCurrentUserEmail((user.email as string) || currentUserEmail);
          setCurrentUserAvatar((user.avatarUrl as string) || '');
        } else {
          setCurrentUser(desiredName);
        }
        setProfileStatus('Profile updated.');
      } catch (error) {
        console.error('Failed to update profile', error);
        setProfileError(error instanceof Error ? error.message : 'Unable to update profile.');
      } finally {
        setProfileSaving(false);
      }
    },
    [profileFormName, currentUser, currentUserEmail, profileAvatarDraft, currentUserAvatar, apiPut],
  );

  // Hydration
  const hydrateCurrentUser = useCallback(async () => {
    setAuthStatus('loading');
    setAuthError('');
    try {
      let payload: Record<string, unknown> | null = null;
      if (
        window.api &&
        typeof (window.api as Record<string, unknown>).getSession === 'function' &&
        typeof (window.api as Record<string, unknown>).getCurrentUser === 'function'
      ) {
        const session = await (
          window.api as Record<string, (...args: unknown[]) => Promise<unknown>>
        ).getSession?.();
        const sessionData = session as Record<string, unknown> | undefined;
        if (sessionData?.user) {
          await (
            window.api as Record<string, (...args: unknown[]) => Promise<unknown>>
          ).ensureUserProfile?.(sessionData.user);
          payload = (await (
            window.api as Record<string, (...args: unknown[]) => Promise<unknown>>
          ).getCurrentUser()) as Record<string, unknown>;
        }
        if (!payload) throw new Error('No authenticated session');
      } else if (hasStaticApiBridgeScript()) {
        throw new Error('Static API bridge not ready');
      } else {
        payload = (await apiGet('/api/user')) as Record<string, unknown>;
      }
      if (!payload) throw new Error('No user payload');
      const nextName =
        payload?.name && String(payload.name).trim().length
          ? String(payload.name).trim()
          : String(payload?.email || '');
      setCurrentUser(nextName);
      setCurrentUserEmail(String(payload?.email || ''));
      setCurrentUserAvatar(String(payload?.avatarUrl || ''));
      setCurrentUserFeatures(ensureFeaturesList(payload?.features));
      setCurrentUserIsAdmin(Boolean(payload?.isAdmin));
      setCurrentUserHasPassword(Boolean(payload?.hasPassword));
      setAuthStatus('ready');
    } catch (error) {
      if (!(error instanceof Error && error.message === 'Static API bridge not ready')) {
        console.warn('Failed to fetch authenticated user', error);
      }
      setCurrentUser('');
      setCurrentUserEmail('');
      setCurrentUserAvatar('');
      setCurrentUserFeatures([]);
      setCurrentUserIsAdmin(false);
      setCurrentUserHasPassword(false);
      setAuthError('');
      setAuthStatus(inviteToken ? 'invite' : 'login');
      setProfileMenuOpen(false);
    }
  }, [inviteToken, apiGet]);

  useEffect(() => {
    hydrateCurrentUser();
  }, [hydrateCurrentUser]);

  useEffect(() => {
    const handleApiReady = () => {
      hydrateCurrentUser();
    };
    window.addEventListener('pm-api-ready', handleApiReady);
    return () => window.removeEventListener('pm-api-ready', handleApiReady);
  }, [hydrateCurrentUser]);

  useEffect(() => {
    if (inviteToken && authStatus !== 'ready') {
      setAuthStatus('invite');
    }
  }, [inviteToken, authStatus]);

  // Persist currentUser to localStorage
  useEffect(() => {
    if (!storageAvailable) return;
    if (currentUser) {
      window.localStorage.setItem(USER_STORAGE_KEY, currentUser);
    } else {
      window.localStorage.removeItem(USER_STORAGE_KEY);
    }
  }, [currentUser]);

  // Login
  const resetLoginFields = useCallback(() => {
    setLoginEmail('');
    setLoginPassword('');
    setLoginError('');
  }, []);

  const submitLogin = useCallback(
    async (event: Event) => {
      event.preventDefault();
      setLoginError('');
      const email = normalizeEmail(loginEmail);
      if (!email) {
        setLoginError('Enter the email you were invited with.');
        return;
      }
      if (!loginPassword) {
        setLoginError('Enter your password.');
        return;
      }
      try {
        let response: Record<string, unknown> | null = null;
        if (window.api && typeof (window.api as Record<string, unknown>).login === 'function') {
          response = (await (
            window.api as Record<string, (...args: unknown[]) => Promise<unknown>>
          ).login({ email, password: loginPassword })) as Record<string, unknown>;
        } else {
          response = (await apiPost('/api/auth', { email, password: loginPassword })) as Record<
            string,
            unknown
          >;
        }
        const user = response?.user as Record<string, unknown> | undefined;
        const name =
          user?.name && (user.name as string).trim().length ? (user.name as string).trim() : email;
        setCurrentUser(name);
        setCurrentUserEmail((user?.email as string) || email);
        setCurrentUserAvatar((user?.avatarUrl as string) || '');
        setCurrentUserFeatures(ensureFeaturesList(user?.features));
        setCurrentUserIsAdmin(Boolean(user?.isAdmin));
        setCurrentUserHasPassword(Boolean(user?.hasPassword));
        setAuthStatus('ready');
        setAuthError('');
        resetLoginFields();
      } catch (error) {
        console.error(error);
        setLoginError('Invalid email or password.');
      }
    },
    [loginEmail, loginPassword, apiPost, resetLoginFields],
  );

  // Invite
  const clearInviteParam = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('invite')) {
        url.searchParams.delete('invite');
        window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
      }
    } catch {
      /* URL parsing can fail in edge cases */
    }
  }, []);

  const submitInvite = useCallback(
    async (event: Event) => {
      event.preventDefault();
      setInviteError('');
      if (!inviteToken) {
        setInviteError('This invite link is invalid.');
        return;
      }
      if (!invitePassword || invitePassword.length < 8) {
        setInviteError('Choose a password with at least 8 characters.');
        return;
      }
      if (invitePassword !== invitePasswordConfirm) {
        setInviteError('Passwords must match.');
        return;
      }
      try {
        let response: Record<string, unknown> | null = null;
        if (
          window.api &&
          typeof (window.api as Record<string, unknown>).acceptInvite === 'function'
        ) {
          response = (await (
            window.api as Record<string, (...args: unknown[]) => Promise<unknown>>
          ).acceptInvite({ token: inviteToken, password: invitePassword })) as Record<
            string,
            unknown
          >;
        } else {
          response = (await apiPut('/api/auth', {
            token: inviteToken,
            password: invitePassword,
          })) as Record<string, unknown>;
        }
        const user = response?.user as Record<string, unknown> | undefined;
        const name =
          user?.name && (user.name as string).trim().length
            ? (user.name as string).trim()
            : (user?.email as string) || '';
        setCurrentUser(name);
        setCurrentUserEmail((user?.email as string) || '');
        setCurrentUserAvatar((user?.avatarUrl as string) || '');
        setCurrentUserFeatures(ensureFeaturesList(user?.features));
        setCurrentUserIsAdmin(Boolean(user?.isAdmin));
        setCurrentUserHasPassword(Boolean(user?.hasPassword));
        setInviteToken('');
        setInvitePassword('');
        setInvitePasswordConfirm('');
        setAuthStatus('ready');
        clearInviteParam();
      } catch (error) {
        console.error(error);
        setInviteError('This invite link is invalid or has expired.');
      }
    },
    [inviteToken, invitePassword, invitePasswordConfirm, apiPut, clearInviteParam],
  );

  // Change password
  const handleChangePassword = useCallback(
    async ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) => {
      const payload = { currentPassword, newPassword };
      const submit = async () => {
        if (
          window.api &&
          window.api.enabled &&
          (window.api as Record<string, unknown>).changePassword
        ) {
          return (
            window.api as Record<string, (...args: unknown[]) => Promise<unknown>>
          ).changePassword(payload);
        }
        return apiPut('/api/password', payload);
      };
      try {
        const response = await submit();
        setCurrentUserHasPassword(true);
        return response;
      } catch (error) {
        console.error('Failed to update password', error);
        if (error instanceof Error) throw error;
        throw new Error('Unable to update password.');
      }
    },
    [apiPut],
  );

  // Called by LoginScreen when auth succeeds via Supabase SSO
  const handleAuthChange = useCallback(
    ({ user, profile }: { user?: Record<string, unknown>; profile?: Record<string, unknown> }) => {
      if (profile) {
        const nextName =
          profile?.name && String(profile.name).trim().length
            ? String(profile.name).trim()
            : String(profile?.email || user?.email || '');
        setCurrentUser(nextName);
        setCurrentUserEmail(String(profile?.email || user?.email || ''));
        setCurrentUserAvatar(String(profile?.avatarUrl || profile?.avatar_url || ''));
        setCurrentUserFeatures(ensureFeaturesList(profile?.features));
        setCurrentUserIsAdmin(Boolean(profile?.isAdmin || profile?.is_admin));
        setCurrentUserHasPassword(true);
        setAuthStatus('ready');
      } else {
        hydrateCurrentUser();
      }
    },
    [hydrateCurrentUser],
  );

  // Reset for sign-out (called by orchestrator)
  const reset = useCallback(() => {
    setCurrentUser('');
    setCurrentUserEmail('');
    setCurrentUserAvatar('');
    setCurrentUserFeatures([]);
    setCurrentUserIsAdmin(false);
    setCurrentUserHasPassword(false);
    setAuthStatus('login');
    setLoginEmail('');
    setLoginPassword('');
    setLoginError('');
    setProfileMenuOpen(false);
    setProfileFormName('');
    setProfileAvatarDraft('');
    setProfileStatus('');
    setProfileError('');
  }, []);

  return {
    // Identity
    currentUser,
    setCurrentUser,
    currentUserEmail,
    setCurrentUserEmail,
    currentUserAvatar,
    currentUserIsAdmin,
    currentUserHasPassword,
    currentUserFeatures,

    // Auth flow
    authStatus,
    setAuthStatus,
    authError,
    hydrateCurrentUser,

    // Login
    loginEmail,
    setLoginEmail,
    loginPassword,
    setLoginPassword,
    loginError,
    setLoginError,
    submitLogin,
    resetLoginFields,

    // Invite
    inviteToken,
    setInviteToken,
    invitePassword,
    setInvitePassword,
    invitePasswordConfirm,
    setInvitePasswordConfirm,
    inviteError,
    submitInvite,
    clearInviteParam,

    // Viewer utilities
    viewerMatchesValue,
    viewerIsAuthor,
    viewerIsApprover,
    hasFeature,
    canUseCalendar,
    canUseKanban,
    canUseApprovals,
    canUseIdeas,

    // Profile
    profileMenuRef,
    profileMenuOpen,
    setProfileMenuOpen,
    profileFormName,
    setProfileFormName,
    profileAvatarDraft,
    setProfileAvatarDraft,
    profileStatus,
    profileError,
    profileSaving,
    profileInitials,
    avatarPreview,
    handleProfileMenuToggle,
    handleAvatarFileChange,
    handleProfileSave,

    // Auth change (LoginScreen callback)
    handleAuthChange,

    // Password
    handleChangePassword,

    // Reset
    reset,
  };
}
