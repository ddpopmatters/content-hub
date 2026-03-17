import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSyncQueue } from '../useSyncQueue';

describe('useSyncQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Default: API is online
    window.api = { enabled: true };
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (window as unknown as Record<string, unknown>).api;
  });

  describe('runSyncTask', () => {
    it('executes the action and returns true on success', async () => {
      const { result } = renderHook(() => useSyncQueue());
      const action = vi.fn().mockResolvedValue('ok');

      let success: boolean | undefined;
      await act(async () => {
        success = (await result.current.runSyncTask('Save entry', action)) as boolean;
      });

      expect(action).toHaveBeenCalledOnce();
      expect(success).toBe(true);
      expect(result.current.syncQueue).toHaveLength(0);
    });

    it('enqueues on failure and returns false', async () => {
      const { result } = renderHook(() => useSyncQueue());
      const action = vi.fn().mockRejectedValue(new Error('Network error'));

      let success: boolean | undefined;
      await act(async () => {
        success = (await result.current.runSyncTask('Save entry', action)) as boolean;
      });

      expect(success).toBe(false);
      expect(result.current.syncQueue).toHaveLength(1);
      expect(result.current.syncQueue[0].label).toBe('Save entry');
      expect(result.current.syncQueue[0].lastError).toBe('Network error');
      expect(result.current.syncQueue[0].attempts).toBe(1);
    });

    it('enqueues when API is offline', async () => {
      window.api = { enabled: false };
      const { result } = renderHook(() => useSyncQueue());
      const action = vi.fn();

      await act(async () => {
        await result.current.runSyncTask('Save entry', action);
      });

      expect(action).not.toHaveBeenCalled();
      expect(result.current.syncQueue).toHaveLength(1);
      expect(result.current.syncQueue[0].label).toContain('offline');
    });

    it('runs the action when window.api is undefined (Supabase path)', async () => {
      delete (window as unknown as Record<string, unknown>).api;
      const { result } = renderHook(() => useSyncQueue());
      const action = vi.fn().mockResolvedValue(undefined);

      await act(async () => {
        await result.current.runSyncTask('Save entry', action);
      });

      expect(action).toHaveBeenCalled();
      expect(result.current.syncQueue).toHaveLength(0);
    });

    it('skips API check when requiresApi is false', async () => {
      delete (window as unknown as Record<string, unknown>).api;
      const { result } = renderHook(() => useSyncQueue());
      const action = vi.fn().mockResolvedValue('ok');

      let success: boolean | undefined;
      await act(async () => {
        success = (await result.current.runSyncTask('Local save', action, {
          requiresApi: false,
        })) as boolean;
      });

      expect(action).toHaveBeenCalledOnce();
      expect(success).toBe(true);
    });
  });

  describe('retry logic', () => {
    it('removes item from queue on successful retry', async () => {
      const { result } = renderHook(() => useSyncQueue());
      const action = vi.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValue('ok');

      // First call fails → enqueues
      await act(async () => {
        await result.current.runSyncTask('Save entry', action);
      });
      expect(result.current.syncQueue).toHaveLength(1);

      // Retry succeeds → dequeues
      const item = result.current.syncQueue[0];
      await act(async () => {
        await result.current.retrySyncItem(item);
      });

      expect(result.current.syncQueue).toHaveLength(0);
    });

    it('increments attempts on failed retry', async () => {
      const { result } = renderHook(() => useSyncQueue());
      const action = vi.fn().mockRejectedValue(new Error('still broken'));

      await act(async () => {
        await result.current.runSyncTask('Save entry', action);
      });

      const item = result.current.syncQueue[0];
      await act(async () => {
        await result.current.retrySyncItem(item);
      });

      expect(result.current.syncQueue).toHaveLength(1);
      expect(result.current.syncQueue[0].attempts).toBe(2);
    });

    it('does not call action when retrying offline item while offline', async () => {
      const { result } = renderHook(() => useSyncQueue());
      const action = vi.fn().mockRejectedValue(new Error('fail'));

      await act(async () => {
        await result.current.runSyncTask('Save entry', action);
      });

      // Go offline and retry
      window.api = { enabled: false };
      const item = result.current.syncQueue[0];
      const callsBefore = action.mock.calls.length;

      await act(async () => {
        await result.current.retrySyncItem(item);
      });

      expect(action.mock.calls.length).toBe(callsBefore);
      expect(result.current.syncQueue).toHaveLength(1);
    });

    it('waits for all queued retries before resolving retryAllSync', async () => {
      const { result } = renderHook(() => useSyncQueue());
      const firstAction = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              setTimeout(() => resolve('first'), 50);
            }),
        );
      const secondAction = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              setTimeout(() => resolve('second'), 100);
            }),
        );

      await act(async () => {
        await result.current.runSyncTask('First task', firstAction);
        await result.current.runSyncTask('Second task', secondAction);
      });

      let retryCompleted = false;
      const retryPromise = act(async () => {
        await result.current.retryAllSync();
        retryCompleted = true;
      });

      await Promise.resolve();
      expect(retryCompleted).toBe(false);

      await act(async () => {
        vi.advanceTimersByTime(99);
        await Promise.resolve();
      });
      expect(retryCompleted).toBe(false);

      await act(async () => {
        vi.advanceTimersByTime(1);
        await Promise.resolve();
      });
      await retryPromise;

      expect(retryCompleted).toBe(true);
      expect(result.current.syncQueue).toHaveLength(0);
    });
  });

  describe('syncToast', () => {
    it('sets toast on failure', async () => {
      const { result } = renderHook(() => useSyncQueue());
      const action = vi.fn().mockRejectedValue(new Error('fail'));

      await act(async () => {
        await result.current.runSyncTask('Save entry', action);
      });

      expect(result.current.syncToast).not.toBeNull();
      expect(result.current.syncToast!.message).toContain('Save entry');
      expect(result.current.syncToast!.tone).toBe('warning');
    });

    it('auto-dismisses after 4 seconds', async () => {
      const { result } = renderHook(() => useSyncQueue());

      act(() => {
        result.current.pushSyncToast('Test message');
      });
      expect(result.current.syncToast).not.toBeNull();

      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(result.current.syncToast).toBeNull();
    });
  });

  describe('queue limits', () => {
    it('caps queue at 25 items', async () => {
      const { result } = renderHook(() => useSyncQueue());

      for (let i = 0; i < 30; i++) {
        await act(async () => {
          await result.current.runSyncTask(
            `Task ${i}`,
            vi.fn().mockRejectedValue(new Error('fail')),
          );
        });
      }

      expect(result.current.syncQueue).toHaveLength(25);
    });
  });

  describe('reset', () => {
    it('clears queue and toast', async () => {
      const { result } = renderHook(() => useSyncQueue());
      const action = vi.fn().mockRejectedValue(new Error('fail'));

      await act(async () => {
        await result.current.runSyncTask('Save entry', action);
      });
      expect(result.current.syncQueue.length).toBeGreaterThan(0);

      act(() => {
        result.current.reset();
      });

      expect(result.current.syncQueue).toHaveLength(0);
      expect(result.current.syncToast).toBeNull();
    });
  });
});
