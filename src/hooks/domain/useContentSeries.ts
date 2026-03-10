import { useCallback, useEffect, useMemo, useState } from 'react';
import { appendAudit } from '../../lib/audit';
import { sortContentSeries } from '../../lib/contentSeries';
import { SUPABASE_API } from '../../lib/supabase';
import type { ContentSeries } from '../../types/models';
import { uuid } from '../../lib/utils';

interface UseContentSeriesDeps {
  currentUser: string;
  runSyncTask?: (
    label: string,
    action: () => Promise<unknown>,
    options?: { requiresApi?: boolean },
  ) => Promise<boolean>;
  pushSyncToast?: (message: string, variant?: string) => void;
}

export function useContentSeries({
  currentUser,
  runSyncTask,
  pushSyncToast,
}: UseContentSeriesDeps) {
  const [contentSeries, setContentSeries] = useState<ContentSeries[]>([]);

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

  const refreshContentSeries = useCallback(() => {
    SUPABASE_API.fetchContentSeries()
      .then((items) => setContentSeries(sortContentSeries(items)))
      .catch(() => pushSyncToast?.('Unable to refresh content series.', 'warning'));
  }, [pushSyncToast]);

  useEffect(() => {
    refreshContentSeries();
  }, [refreshContentSeries]);

  const addContentSeries = useCallback(
    (series: Omit<ContentSeries, 'id' | 'createdAt' | 'updatedAt'>) => {
      const timestamp = new Date().toISOString();
      const owner = series.owner || getCurrentOwner();
      const created: ContentSeries = {
        ...series,
        owner,
        id: uuid(),
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      setContentSeries((prev) => sortContentSeries([...prev, created]));

      void queueSyncTask('Adding series', async () => {
        const saved = await SUPABASE_API.createContentSeries({
          ...series,
          owner,
        });
        if (!saved) {
          throw new Error('Unable to create content series');
        }
      }).then((ok) => {
        if (ok) refreshContentSeries();
      });

      appendAudit({
        user: currentUser,
        action: 'content-series-create',
        meta: { id: created.id, title: created.title },
      });
      return created;
    },
    [currentUser, getCurrentOwner, queueSyncTask, refreshContentSeries],
  );

  const updateContentSeries = useCallback(
    (id: string, updates: Partial<ContentSeries>) => {
      const updatedAt = new Date().toISOString();
      setContentSeries((prev) =>
        sortContentSeries(
          prev.map((series) => (series.id === id ? { ...series, ...updates, updatedAt } : series)),
        ),
      );

      void queueSyncTask('Updating series', async () => {
        const saved = await SUPABASE_API.updateContentSeries(id, updates);
        if (!saved) {
          throw new Error('Unable to update content series');
        }
      }).then((ok) => {
        if (ok) refreshContentSeries();
      });

      appendAudit({
        user: currentUser,
        action: 'content-series-update',
        meta: { id },
      });
    },
    [currentUser, queueSyncTask, refreshContentSeries],
  );

  const deleteContentSeries = useCallback(
    (id: string) => {
      setContentSeries((prev) => prev.filter((series) => series.id !== id));

      void queueSyncTask('Deleting series', async () => {
        const saved = await SUPABASE_API.deleteContentSeries(id);
        if (!saved) {
          throw new Error('Unable to delete content series');
        }
      }).then((ok) => {
        if (ok) refreshContentSeries();
      });

      appendAudit({
        user: currentUser,
        action: 'content-series-delete',
        meta: { id },
      });
    },
    [currentUser, queueSyncTask, refreshContentSeries],
  );

  const activeSeries = useMemo(
    () => contentSeries.filter((series) => series.status === 'Active'),
    [contentSeries],
  );

  return {
    contentSeries,
    setContentSeries,
    addContentSeries,
    updateContentSeries,
    deleteContentSeries,
    activeSeries,
    refreshContentSeries,
  };
}
