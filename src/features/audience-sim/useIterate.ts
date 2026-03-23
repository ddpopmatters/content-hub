import { useCallback, useMemo, useState } from 'react';
import { getSupabase, initSupabase } from '../../lib/supabase';
import type { DiffChunk, SegmentResult } from './types';

export function useIterate() {
  const [diff, setDiff] = useState<DiffChunk[] | null>(null);
  const [revised, setRevised] = useState<string | null>(null);
  const [iterating, setIterating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [simId, setSimId] = useState<string | null>(null);

  const iterate = useCallback(
    async (nextSimId: string, contentText: string, segmentResults: SegmentResult[]) => {
      setIterating(true);
      setError(null);
      setSimId(nextSimId);

      try {
        await initSupabase();
        const client = getSupabase();
        if (!client) {
          throw new Error('Supabase is unavailable');
        }

        const { data, error: invokeError } = await client.functions.invoke('iterate-content', {
          body: { sim_id: nextSimId, content: contentText, results: segmentResults },
        });

        if (invokeError) {
          throw new Error(invokeError.message || 'Failed to iterate content');
        }

        const response = (data || {}) as { diff?: DiffChunk[]; revised?: string };
        const nextDiff = Array.isArray(response.diff) ? response.diff : [];
        const nextRevised = typeof response.revised === 'string' ? response.revised : '';

        setDiff(nextDiff);
        setRevised(nextRevised);

        return { diff: nextDiff, revised: nextRevised };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to iterate content';
        setError(message);
        throw err;
      } finally {
        setIterating(false);
      }
    },
    [],
  );

  const accept = useCallback(async () => {
    if (!simId || !revised) return null;

    await initSupabase();
    const client = getSupabase();
    if (!client) {
      throw new Error('Supabase is unavailable');
    }

    const { error: updateError } = await client
      .from('audience_simulations')
      .update({ iteration_status: 'complete' })
      .eq('id', simId);

    if (updateError) {
      throw new Error(updateError.message || 'Failed to accept iteration');
    }

    return revised;
  }, [revised, simId]);

  const reject = useCallback(() => {
    setDiff(null);
    setRevised(null);
    setError(null);
  }, []);

  return useMemo(
    () => ({
      diff,
      revised,
      iterating,
      error,
      iterate,
      accept,
      reject,
    }),
    [accept, diff, error, iterate, iterating, reject, revised],
  );
}

export default useIterate;
