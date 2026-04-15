import { useState, useCallback, useEffect } from 'react';
import { uuid } from '../../lib/utils';

interface SyncQueueItem {
  id: string;
  label: string;
  action: () => Promise<unknown>;
  attempts: number;
  lastError: string;
  lastAttemptAt: string;
  requiresApi: boolean;
}

interface SyncToast {
  id: string;
  message: string;
  tone: string;
}

interface RunSyncOptions {
  requiresApi?: boolean;
}

// `window.api` is defined globally by the app bootstrap/runtime surface.

export function useSyncQueue() {
  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>([]);
  const [syncToast, setSyncToast] = useState<SyncToast | null>(null);

  const pushSyncToast = useCallback((message: string, tone = 'warning') => {
    setSyncToast({ id: uuid(), message, tone });
  }, []);

  useEffect(() => {
    if (!syncToast) return;
    const timeout = setTimeout(() => setSyncToast(null), 4000);
    return () => clearTimeout(timeout);
  }, [syncToast]);

  const enqueueSyncTask = useCallback(
    (label: string, action: () => Promise<unknown>, error: unknown, requiresApi = true) => {
      const entry: SyncQueueItem = {
        id: uuid(),
        label,
        action,
        attempts: 1,
        lastError: error instanceof Error ? error.message : 'Unknown error',
        lastAttemptAt: new Date().toISOString(),
        requiresApi,
      };
      setSyncQueue((prev) => [...prev, entry].slice(-25));
      pushSyncToast(`${label} failed. Added to retry queue.`, 'warning');
    },
    [pushSyncToast],
  );

  const runSyncTask = useCallback(
    async (label: string, action: () => Promise<unknown>, options: RunSyncOptions = {}) => {
      const requiresApi = options.requiresApi !== false;
      // Only block if window.api is present but explicitly disabled.
      // When window.api is absent we fall through to the Supabase path.
      if (requiresApi && window.api && !window.api.enabled) {
        enqueueSyncTask(`${label} (offline)`, action, new Error('API offline'), requiresApi);
        return false;
      }
      try {
        const result = await action();
        if (result === false || result === null) {
          const error = new Error(
            result === false ? 'Action reported failure' : 'Action returned no data',
          );
          console.warn(`${label} failed`, error);
          enqueueSyncTask(label, action, error, requiresApi);
          return false;
        }
        return true;
      } catch (error) {
        console.warn(`${label} failed`, error);
        enqueueSyncTask(label, action, error, requiresApi);
        return false;
      }
    },
    [enqueueSyncTask],
  );

  const retrySyncItem = useCallback(
    async (item: SyncQueueItem) => {
      if (item.requiresApi && window.api && !window.api.enabled) {
        setSyncQueue((prev) =>
          prev.map((entry) =>
            entry.id === item.id
              ? {
                  ...entry,
                  lastError: 'API offline',
                  lastAttemptAt: new Date().toISOString(),
                }
              : entry,
          ),
        );
        pushSyncToast('API offline. Retry again when connected.', 'warning');
        return;
      }
      try {
        await item.action();
        setSyncQueue((prev) => prev.filter((entry) => entry.id !== item.id));
        pushSyncToast(`${item.label} synced.`, 'success');
      } catch (error) {
        setSyncQueue((prev) =>
          prev.map((entry) =>
            entry.id === item.id
              ? {
                  ...entry,
                  attempts: entry.attempts + 1,
                  lastError: error instanceof Error ? error.message : 'Unknown error',
                  lastAttemptAt: new Date().toISOString(),
                }
              : entry,
          ),
        );
        pushSyncToast(`${item.label} failed again.`, 'warning');
      }
    },
    [pushSyncToast],
  );

  const retryAllSync = useCallback(async () => {
    await Promise.all(syncQueue.map((item) => retrySyncItem(item)));
  }, [syncQueue, retrySyncItem]);

  const dismissSyncItem = useCallback((id: string) => {
    setSyncQueue((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  const reset = useCallback(() => {
    setSyncQueue([]);
    setSyncToast(null);
  }, []);

  return {
    syncQueue,
    syncToast,
    pushSyncToast,
    runSyncTask,
    retrySyncItem,
    retryAllSync,
    dismissSyncItem,
    reset,
  };
}
