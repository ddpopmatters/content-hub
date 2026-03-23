import { useCallback, useMemo, useState } from 'react';
import { getSupabase, initSupabase } from '../../lib/supabase';
import { createSim, getSim, listSims } from './lib';
import type { AudienceSim, ContentType } from './types';

interface SimulationUser {
  email?: string | null;
  name?: string | null;
}

interface RunSimParams {
  contentText: string;
  contentType: ContentType;
  entryId?: string;
  ideaId?: string;
  segments: string[];
  user?: SimulationUser;
}

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 20;

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

const getCurrentUser = (user?: SimulationUser): Required<SimulationUser> => ({
  email: user?.email || window.__currentUserEmail || '',
  name: user?.name || window.__currentUserName || '',
});

export function useAudienceSim() {
  const [simId, setSimId] = useState<string | null>(null);
  const [sim, setSim] = useState<AudienceSim | null>(null);
  const [history, setHistory] = useState<AudienceSim[]>([]);
  const [status, setStatus] = useState<AudienceSim['status']>('pending');
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async (entryId?: string, ideaId?: string) => {
    if (!entryId && !ideaId) {
      setHistory([]);
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const nextHistory = await listSims(entryId, ideaId);
      setHistory(nextHistory);
      return nextHistory;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load audience simulation history';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const pollSim = useCallback(async (nextSimId: string) => {
    setPolling(true);

    try {
      for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
        const latest = await getSim(nextSimId);
        setSim(latest);
        setStatus(latest.status);

        if (latest.status === 'complete' || latest.status === 'failed') {
          return latest;
        }

        await wait(POLL_INTERVAL_MS);
      }

      throw new Error('Audience simulation timed out');
    } finally {
      setPolling(false);
    }
  }, []);

  const runSim = useCallback(
    async ({ contentText, contentType, entryId, ideaId, segments, user }: RunSimParams) => {
      setLoading(true);
      setError(null);

      try {
        const currentUser = getCurrentUser(user);
        const created = await createSim({
          entry_id: entryId ?? null,
          idea_id: ideaId ?? null,
          content_text: contentText,
          content_type: contentType,
          segments,
          status: 'pending',
          run_by: currentUser.email || 'unknown@populationmatters.org',
          run_by_name: currentUser.name || null,
        });

        setSimId(created.id);
        setSim(created);
        setStatus(created.status);

        await initSupabase();
        const client = getSupabase();
        if (!client) {
          throw new Error('Supabase is unavailable');
        }

        const { error: invokeError } = await client.functions.invoke('simulate-audience', {
          body: {
            sim_id: created.id,
            entry_id: entryId,
            idea_id: ideaId,
            content_text: contentText,
            content_type: contentType,
            segments,
          },
        });

        if (invokeError) {
          throw new Error(invokeError.message || 'Failed to start audience simulation');
        }

        const latest = await pollSim(created.id);
        await loadHistory(entryId, ideaId);
        return latest;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to run audience simulation';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [loadHistory, pollSim],
  );

  return useMemo(
    () => ({
      simId,
      sim,
      history,
      status,
      loading,
      error,
      runSim,
      loadHistory,
      polling,
    }),
    [error, history, loadHistory, loading, polling, runSim, sim, simId, status],
  );
}

export default useAudienceSim;
