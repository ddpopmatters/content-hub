import { useState, useCallback, useEffect } from 'react';
import { normalizeEmail } from '../../lib/utils';
import { ensureFeaturesList } from '../../lib/users';

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
  const [userList, setUserList] = useState<Record<string, unknown>[]>(() => []);
  const [adminAudits, setAdminAudits] = useState<Record<string, unknown>[]>([]);
  const [accessModalUser, setAccessModalUser] = useState<Record<string, unknown> | null>(null);
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
    if (
      !window.api ||
      !(window.api as Record<string, unknown>).enabled ||
      !(window.api as Record<string, unknown>).listUsers
    )
      return;
    (window.api as Record<string, (...args: unknown[]) => Promise<unknown>>)
      .listUsers()
      .then((payload: unknown) => Array.isArray(payload) && setUserList(payload))
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
      normalizeEmail(email);
      const selectedFeatures = ensureFeaturesList(formData.features);
      if (!window.api || typeof (window.api as Record<string, unknown>).createUser !== 'function') {
        setUserAdminError('Server is offline. Try again when connected.');
        return;
      }
      try {
        const created = (await (
          window.api as Record<string, (...args: unknown[]) => Promise<unknown>>
        ).createUser({
          name: fullname,
          email,
          features: selectedFeatures,
          isApprover: formData.isApprover,
        })) as Record<string, unknown>;
        if (created) {
          setUserList((prev) => {
            const without = prev.filter((user) => user.id !== created.id);
            return [created, ...without];
          });
          setUserAdminSuccess(`Invitation sent to ${email}.`);
          refreshApprovers();
          refreshUsers();
        }
      } catch (error) {
        console.error(error);
        setUserAdminError('Unable to create user. Please try again.');
      }
    },
    [currentUserIsAdmin, refreshApprovers, refreshUsers],
  );

  const removeUser = useCallback(
    async (user: Record<string, unknown>) => {
      if (!user?.id) return;
      setUserAdminError('');
      setUserAdminSuccess('');
      if (!currentUserIsAdmin) {
        setUserAdminError('You do not have permission to manage users.');
        return;
      }
      if (!window.api || typeof (window.api as Record<string, unknown>).deleteUser !== 'function') {
        setUserAdminError('Server is offline.');
        return;
      }
      try {
        await (window.api as Record<string, (...args: unknown[]) => Promise<unknown>>).deleteUser(
          user.id,
        );
        setUserList((prev) => prev.filter((item) => item.id !== user.id));
        setUserAdminSuccess(`Removed ${user.name || user.email}.`);
        refreshApprovers();
        refreshUsers();
      } catch (error) {
        console.error(error);
        setUserAdminError('Unable to remove user.');
      }
    },
    [currentUserIsAdmin, refreshApprovers, refreshUsers],
  );

  const toggleApproverRole = useCallback(
    async (user: Record<string, unknown>) => {
      if (!user?.id) return;
      setUserAdminError('');
      setUserAdminSuccess('');
      if (!currentUserIsAdmin) {
        setUserAdminError('You do not have permission to manage users.');
        return;
      }
      if (!window.api || typeof (window.api as Record<string, unknown>).updateUser !== 'function') {
        setUserAdminError('Server is offline.');
        return;
      }
      try {
        const nextValue = !user.isApprover;
        const result = (await (
          window.api as Record<string, (...args: unknown[]) => Promise<unknown>>
        ).updateUser(user.id, { isApprover: nextValue })) as Record<string, unknown>;
        if (result?.user) {
          const updated = result.user as Record<string, unknown>;
          setUserList((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
          setUserAdminSuccess(
            `${nextValue ? 'Added' : 'Removed'} ${user.name || user.email} ${
              nextValue ? 'to' : 'from'
            } the approver list.`,
          );
          refreshApprovers();
          refreshUsers();
        }
      } catch (error) {
        console.error(error);
        setUserAdminError('Unable to update approver status.');
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
      if (!window.api || typeof (window.api as Record<string, unknown>).updateUser !== 'function') {
        setUserAdminError('Server is offline.');
        return;
      }
      try {
        const result = (await (
          window.api as Record<string, (...args: unknown[]) => Promise<unknown>>
        ).updateUser(accessModalUser.id, { features: normalized })) as Record<string, unknown>;
        if (result?.user) {
          const updated = result.user as Record<string, unknown>;
          setUserList((prev) => prev.map((user) => (user.id === updated.id ? updated : user)));
          refreshApprovers();
          refreshUsers();
        }
      } catch (error) {
        console.error(error);
        setUserAdminError('Unable to update access.');
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
