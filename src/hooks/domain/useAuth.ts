import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { ensurePeopleArray, normalizeEmail, storageAvailable, STORAGE_KEYS } from '../../lib/utils';
import { ensureFeaturesList } from '../../lib/users';
import { AUTH, SUPABASE_API } from '../../lib/supabase';
const USER_STORAGE_KEY = STORAGE_KEYS.USER;

type InviteActivationType = '' | 'invite' | 'recovery';

const INVITE_ACTIVATION_TYPES = new Set<InviteActivationType>(['invite', 'recovery']);

const readHashParams = (hash: string): URLSearchParams => {
  const trimmedHash = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!trimmedHash || !trimmedHash.includes('=')) return new URLSearchParams();
  return new URLSearchParams(trimmedHash);
};

const readInviteLinkState = (): {
  inviteToken: string;
  activationType: InviteActivationType;
} => {
  if (typeof window === 'undefined') {
    return { inviteToken: '', activationType: '' };
  }

  try {
    const url = new URL(window.location.href);
    const hashParams = readHashParams(url.hash);
    const inviteToken = url.searchParams.get('invite') || '';
    const authType = (url.searchParams.get('type') ||
      hashParams.get('type') ||
      '') as InviteActivationType;
    const activationType = INVITE_ACTIVATION_TYPES.has(authType) ? authType : '';

    return { inviteToken, activationType };
  } catch {
    return { inviteToken: '', activationType: '' };
  }
};

export function useAuth() {
  const initialInviteLinkState = readInviteLinkState();

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
  const [inviteToken, setInviteToken] = useState(initialInviteLinkState.inviteToken);
  const [inviteActivationType, setInviteActivationType] = useState<InviteActivationType>(
    initialInviteLinkState.activationType,
  );
  const [invitePassword, setInvitePassword] = useState('');
  const [invitePasswordConfirm, setInvitePasswordConfirm] = useState('');
  const [inviteError, setInviteError] = useState('');
  const inviteFlowActive = Boolean(inviteToken || inviteActivationType);

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
        payload.avatar_url = profileAvatarDraft ? profileAvatarDraft : null;
      }
      setProfileSaving(true);
      setProfileStatus('');
      setProfileError('');
      try {
        const updated = await SUPABASE_API.updateUserProfile(
          payload as Parameters<typeof SUPABASE_API.updateUserProfile>[0],
        );
        if (updated) {
          setCurrentUser(updated.name && updated.name.trim() ? updated.name.trim() : desiredName);
          setCurrentUserEmail(updated.email || currentUserEmail);
          setCurrentUserAvatar(updated.avatar_url || '');
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
    [profileFormName, currentUser, currentUserEmail, profileAvatarDraft, currentUserAvatar],
  );

  // Hydration
  const hydrateCurrentUser = useCallback(async () => {
    setAuthStatus('loading');
    setAuthError('');
    try {
      const session = await AUTH.getSession();
      if (!session?.user) throw new Error('No authenticated session');
      const profile = await SUPABASE_API.fetchCurrentUserProfile();
      if (!profile && !inviteFlowActive) throw new Error('No user profile');
      const fallbackEmail = session.user.email || '';
      const nextName =
        profile?.name && profile.name.trim().length
          ? profile.name.trim()
          : profile?.email || fallbackEmail;
      setCurrentUser(nextName);
      setCurrentUserEmail(profile?.email || fallbackEmail);
      setCurrentUserAvatar(profile?.avatar_url || '');
      setCurrentUserFeatures(ensureFeaturesList(profile?.features));
      setCurrentUserIsAdmin(Boolean(profile?.is_admin));
      if (inviteFlowActive) {
        setCurrentUserHasPassword(false);
        setAuthStatus('invite');
        return;
      }
      setCurrentUserHasPassword(true);
      setAuthStatus('ready');
    } catch {
      setCurrentUser('');
      setCurrentUserEmail('');
      setCurrentUserAvatar('');
      setCurrentUserFeatures([]);
      setCurrentUserIsAdmin(false);
      setCurrentUserHasPassword(false);
      setAuthError('');
      setAuthStatus(inviteFlowActive ? 'invite' : 'login');
      setProfileMenuOpen(false);
    }
  }, [inviteFlowActive]);

  useEffect(() => {
    hydrateCurrentUser();
  }, [hydrateCurrentUser]);

  useEffect(() => {
    if (inviteFlowActive && authStatus !== 'ready') {
      setAuthStatus('invite');
    }
  }, [inviteFlowActive, authStatus]);

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
        const result = await AUTH.signIn(email, loginPassword);
        if (result.error) {
          setLoginError(result.error);
          return;
        }
        const profile = await SUPABASE_API.fetchCurrentUserProfile();
        if (!profile) {
          setLoginError('Signed in but could not load your profile.');
          return;
        }
        setCurrentUser(profile.name && profile.name.trim() ? profile.name.trim() : email);
        setCurrentUserEmail(profile.email);
        setCurrentUserAvatar(profile.avatar_url || '');
        setCurrentUserFeatures(ensureFeaturesList(profile.features));
        setCurrentUserIsAdmin(Boolean(profile.is_admin));
        setCurrentUserHasPassword(true);
        setAuthStatus('ready');
        setAuthError('');
        resetLoginFields();
      } catch (error) {
        console.error(error);
        setLoginError('Invalid email or password.');
      }
    },
    [loginEmail, loginPassword, resetLoginFields],
  );

  // Invite
  const clearInviteParam = useCallback(() => {
    setInviteToken('');
    setInviteActivationType('');
    setInviteError('');
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      let hasChanges = false;
      const authSearchParams = [
        'invite',
        'type',
        'token_hash',
        'access_token',
        'refresh_token',
        'expires_at',
        'expires_in',
        'provider_token',
        'provider_refresh_token',
        'code',
      ];

      authSearchParams.forEach((key) => {
        if (url.searchParams.has(key)) {
          url.searchParams.delete(key);
          hasChanges = true;
        }
      });

      const hashParams = readHashParams(url.hash);
      authSearchParams.forEach((key) => {
        if (hashParams.has(key)) {
          hashParams.delete(key);
          hasChanges = true;
        }
      });

      if (hasChanges) {
        const nextHash = hashParams.toString();
        url.hash = nextHash ? `#${nextHash}` : '';
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
      if (!inviteFlowActive) {
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
        const { getSupabase } = await import('../../lib/supabase');
        const client = getSupabase();
        if (!client) throw new Error('Supabase not ready');
        const { data, error } = await client.auth.updateUser({ password: invitePassword });
        if (error) throw new Error(error.message);
        const profile = await SUPABASE_API.fetchCurrentUserProfile();
        const email = data.user?.email || '';
        const name = profile?.name && profile.name.trim() ? profile.name.trim() : email;
        setCurrentUser(name);
        setCurrentUserEmail(profile?.email || email);
        setCurrentUserAvatar(profile?.avatar_url || '');
        setCurrentUserFeatures(ensureFeaturesList(profile?.features));
        setCurrentUserIsAdmin(Boolean(profile?.is_admin));
        setCurrentUserHasPassword(true);
        setInvitePassword('');
        setInvitePasswordConfirm('');
        setAuthStatus('ready');
        clearInviteParam();
      } catch (error) {
        console.error(error);
        setInviteError('This invite link is invalid or has expired.');
      }
    },
    [inviteFlowActive, invitePassword, invitePasswordConfirm, clearInviteParam],
  );

  // Change password
  const handleChangePassword = useCallback(
    async ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) => {
      try {
        const session = await AUTH.getSession();
        if (!session?.user?.email) throw new Error('Not authenticated');
        if (currentPassword) {
          // Supabase doesn't expose a direct "change password with current password" flow;
          // re-auth then update via updateUser.
          const reauth = await AUTH.signIn(session.user.email, currentPassword);
          if (reauth.error) throw new Error(reauth.error);
        }
        const { error } = await (await import('../../lib/supabase'))
          .getSupabase()!
          .auth.updateUser({
            password: newPassword,
          });
        if (error) throw new Error(error.message);
        setCurrentUserHasPassword(true);
      } catch (error) {
        console.error('Failed to update password', error);
        if (error instanceof Error) throw error;
        throw new Error('Unable to update password.');
      }
    },
    [],
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
        setCurrentUserHasPassword(!inviteFlowActive);
        setAuthStatus(inviteFlowActive ? 'invite' : 'ready');
      } else {
        hydrateCurrentUser();
      }
    },
    [hydrateCurrentUser, inviteFlowActive],
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
