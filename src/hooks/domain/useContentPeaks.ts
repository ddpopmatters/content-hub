import { useCallback, useEffect, useMemo, useState } from 'react';
import { appendAudit } from '../../lib/audit';
import { sortContentPeaks } from '../../lib/contentPeaks';
import { SUPABASE_API } from '../../lib/supabase';
import type { ContentPeak } from '../../types/models';
import { uuid } from '../../lib/utils';

interface UseContentPeaksDeps {
  currentUser: string;
  runSyncTask?: (
    label: string,
    action: () => Promise<unknown>,
    options?: { requiresApi?: boolean },
  ) => Promise<boolean>;
  pushSyncToast?: (message: string, variant?: string) => void;
}

export function useContentPeaks({ currentUser, runSyncTask, pushSyncToast }: UseContentPeaksDeps) {
  const [contentPeaks, setContentPeaks] = useState<ContentPeak[]>([]);

  const getCurrentOwner = useCallback(() => {
    if (typeof window !== 'undefined') {
      const email = window.__currentUserEmail?.trim();
      if (email) return email;
    }
    return currentUser || 'Unknown';
  }, [currentUser]);

  const queueSyncTask = useCallback(
    async (label: string, action: () => Promise<unknown>) => {
      if (runSyncTask) {
        return runSyncTask(label, action, { requiresApi: false });
      }
      try {
        await action();
        return true;
      } catch (error) {
        console.warn(`${label} failed`, error);
        pushSyncToast?.(`${label} failed.`, 'warning');
        return false;
      }
    },
    [pushSyncToast, runSyncTask],
  );

  const refreshContentPeaks = useCallback(() => {
    SUPABASE_API.fetchContentPeaks()
      .then((items) => setContentPeaks(sortContentPeaks(items)))
      .catch(() => pushSyncToast?.('Unable to refresh content peaks.', 'warning'));
  }, [pushSyncToast]);

  useEffect(() => {
    refreshContentPeaks();
  }, [refreshContentPeaks]);

  const addContentPeak = useCallback(
    (peak: Omit<ContentPeak, 'id' | 'createdAt' | 'updatedAt'>) => {
      const timestamp = new Date().toISOString();
      const owner = peak.owner || getCurrentOwner();
      const created: ContentPeak = {
        ...peak,
        owner,
        id: uuid(),
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      setContentPeaks((prev) => sortContentPeaks([...prev, created]));

      void queueSyncTask('Adding peak', async () => {
        const saved = await SUPABASE_API.createContentPeak({
          ...peak,
          owner,
        });
        if (!saved) {
          throw new Error('Unable to create content peak');
        }
      }).then((ok) => {
        if (ok) refreshContentPeaks();
      });

      appendAudit({
        user: currentUser,
        action: 'content-peak-create',
        meta: { id: created.id, title: created.title },
      });
      return created;
    },
    [currentUser, getCurrentOwner, queueSyncTask, refreshContentPeaks],
  );

  const updateContentPeak = useCallback(
    (id: string, updates: Partial<ContentPeak>) => {
      const updatedAt = new Date().toISOString();
      setContentPeaks((prev) =>
        sortContentPeaks(
          prev.map((peak) => (peak.id === id ? { ...peak, ...updates, updatedAt } : peak)),
        ),
      );

      void queueSyncTask('Updating peak', async () => {
        const saved = await SUPABASE_API.updateContentPeak(id, updates);
        if (!saved) {
          throw new Error('Unable to update content peak');
        }
      }).then((ok) => {
        if (ok) refreshContentPeaks();
      });

      appendAudit({
        user: currentUser,
        action: 'content-peak-update',
        meta: { id },
      });
    },
    [currentUser, queueSyncTask, refreshContentPeaks],
  );

  const deleteContentPeak = useCallback(
    (id: string) => {
      setContentPeaks((prev) => prev.filter((peak) => peak.id !== id));

      void queueSyncTask('Deleting peak', async () => {
        const saved = await SUPABASE_API.deleteContentPeak(id);
        if (!saved) {
          throw new Error('Unable to delete content peak');
        }
      }).then((ok) => {
        if (ok) refreshContentPeaks();
      });

      appendAudit({
        user: currentUser,
        action: 'content-peak-delete',
        meta: { id },
      });
    },
    [currentUser, queueSyncTask, refreshContentPeaks],
  );

  const upcomingPeaks = useMemo(
    () =>
      contentPeaks.filter((peak) => {
        const end = new Date(peak.endDate);
        return end >= new Date();
      }),
    [contentPeaks],
  );

  return {
    contentPeaks,
    setContentPeaks,
    addContentPeak,
    updateContentPeak,
    deleteContentPeak,
    upcomingPeaks,
    refreshContentPeaks,
  };
}
