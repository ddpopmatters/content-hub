import { useState, useCallback, useEffect } from 'react';
import { SUPABASE_API } from '../../lib/supabase';
import { normalizeEmail } from '../../lib/utils';
import { ensureFeaturesList } from '../../lib/users';
import type { User } from '../../types/models';

interface UseAdminDeps {
  currentUserIsAdmin: boolean;
  authStatus: string;
  pushSyncToast: (message: string, variant?: string) => void;
  refreshApprovers: () => Promise<void>;
}

export function useAdmin({
  currentUserIsAdmin,
  authStatus,
  pushSyncToast,
  refreshApprovers,
}: UseAdminDeps) {
  const [userList, setUserList] = useState<User[]>(() => []);
  const [adminAudits, setAdminAudits] = useState<Record<string, unknown>[]>([]);
  const [accessModalUser, setAccessModalUser] = useState<User | null>(null);
  const [userAdminError, setUserAdminError] = useState('');
  const [userAdminSuccess, setUserAdminSuccess] = useState('');

  // Clear admin state when not authenticated
  useEffect(() => {
    if (authStatus !== 'ready' && authStatus !== 'loading') {
      setUserList([]);
      setAccessModalUser(null);
    }
  }, [authStatus]);

  const refreshUsers = useCallback(() => {
    SUPABASE_API.fetchAdminUsers()
      .then((payload) => Array.isArray(payload) && setUserList(payload))
      .catch(() => pushSyncToast('Unable to refresh user roster.', 'warning'));
  }, [pushSyncToast]);

  const addUser = useCallback(
    async (formData: {
      first: string;
      last: string;
      email: string;
      features: string[];
      isApprover: boolean;
    }) => {
      setUserAdminError('');
      setUserAdminSuccess('');
      if (!currentUserIsAdmin) {
        setUserAdminError('You do not have permission to manage users.');
        return;
      }
      const first = formData.first.trim();
      const last = formData.last.trim();
      const email = formData.email.trim();
      if (!first || !last || !email) return;
      const fullname = `${first} ${last}`;
      const normalizedEmail = normalizeEmail(email);
      const selectedFeatures = ensureFeaturesList(formData.features);
      try {
        const created = await SUPABASE_API.inviteAdminUser({
          name: fullname,
          email: normalizedEmail,
          features: selectedFeatures,
          isApprover: formData.isApprover,
        });
        if (created) {
          setUserList((prev) => {
            const without = prev.filter((user) => user.id !== created.id);
            return [created, ...without];
          });
          setUserAdminSuccess(`Invitation sent to ${normalizedEmail}.`);
          void refreshApprovers();
          refreshUsers();
        }
      } catch (error) {
        console.error(error);
        setUserAdminError(error instanceof Error ? error.message : 'Unable to create user.');
      }
    },
    [currentUserIsAdmin, refreshApprovers, refreshUsers],
  );

  const removeUser = useCallback(
    async (user: User) => {
      if (!user?.id) return;
      setUserAdminError('');
      setUserAdminSuccess('');
      if (!currentUserIsAdmin) {
        setUserAdminError('You do not have permission to manage users.');
        return;
      }
      try {
        await SUPABASE_API.deleteAdminUser(user.id);
        setUserList((prev) => prev.filter((item) => item.id !== user.id));
        setUserAdminSuccess(`Removed ${user.name || user.email}.`);
        void refreshApprovers();
        refreshUsers();
      } catch (error) {
        console.error(error);
        setUserAdminError(error instanceof Error ? error.message : 'Unable to remove user.');
      }
    },
    [currentUserIsAdmin, refreshApprovers, refreshUsers],
  );

  const toggleApproverRole = useCallback(
    async (user: User) => {
      if (!user?.id) return;
      setUserAdminError('');
      setUserAdminSuccess('');
      if (!currentUserIsAdmin) {
        setUserAdminError('You do not have permission to manage users.');
        return;
      }
      try {
        const nextValue = !user.isApprover;
        const updated = await SUPABASE_API.updateAdminUser(user.id, { isApprover: nextValue });
        if (updated) {
          setUserList((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
          setUserAdminSuccess(
            `${nextValue ? 'Added' : 'Removed'} ${user.name || user.email} ${
              nextValue ? 'to' : 'from'
            } the approver list.`,
          );
          void refreshApprovers();
          refreshUsers();
        }
      } catch (error) {
        console.error(error);
        setUserAdminError(
          error instanceof Error ? error.message : 'Unable to update approver status.',
        );
      }
    },
    [currentUserIsAdmin, refreshApprovers, refreshUsers],
  );

  const handleAccessSave = useCallback(
    async (features: unknown) => {
      if (!accessModalUser) return;
      if (!currentUserIsAdmin) {
        setUserAdminError('You do not have permission to manage users.');
        setAccessModalUser(null);
        return;
      }
      const normalized = ensureFeaturesList(features);
      try {
        const updated = await SUPABASE_API.updateAdminUser(accessModalUser.id, {
          features: normalized,
        });
        if (updated) {
          setUserList((prev) => prev.map((user) => (user.id === updated.id ? updated : user)));
          void refreshApprovers();
          refreshUsers();
        }
      } catch (error) {
        console.error(error);
        setUserAdminError(error instanceof Error ? error.message : 'Unable to update access.');
      } finally {
        setAccessModalUser(null);
      }
    },
    [accessModalUser, currentUserIsAdmin, refreshApprovers, refreshUsers],
  );

  const reset = useCallback(() => {
    setUserList([]);
    setAdminAudits([]);
    setAccessModalUser(null);
    setUserAdminError('');
    setUserAdminSuccess('');
  }, []);

  return {
    userList,
    setUserList,
    adminAudits,
    setAdminAudits,
    accessModalUser,
    setAccessModalUser,
    userAdminError,
    userAdminSuccess,
    refreshUsers,
    addUser,
    removeUser,
    toggleApproverRole,
    handleAccessSave,
    reset,
  };
}
