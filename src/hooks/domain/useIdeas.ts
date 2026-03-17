import { useState, useCallback, useMemo, useEffect } from 'react';
import { sanitizeIdea } from '../../lib/sanitizers';
import { loadIdeas, saveIdeas } from '../../lib/storage';
import { appendAudit } from '../../lib/audit';
import { SUPABASE_API } from '../../lib/supabase';

interface UseIdeasDeps {
  currentUser: string;
  runSyncTask: (label: string, action: () => Promise<unknown>) => Promise<boolean>;
  pushSyncToast: (message: string, variant?: string) => void;
}

export function useIdeas({ currentUser, runSyncTask, pushSyncToast }: UseIdeasDeps) {
  const [ideas, setIdeas] = useState<Record<string, unknown>[]>(() => loadIdeas());

  useEffect(() => {
    saveIdeas(ideas);
  }, [ideas]);

  const refreshIdeas = useCallback(() => {
    SUPABASE_API.fetchIdeas()
      .then((payload: unknown) => Array.isArray(payload) && setIdeas(payload))
      .catch(() => pushSyncToast('Unable to refresh ideas from the server.', 'warning'));
  }, [pushSyncToast]);

  const addIdea = useCallback(
    (idea: Record<string, unknown>) => {
      const timestamp = new Date().toISOString();
      const sanitized = sanitizeIdea({
        ...idea,
        createdBy: idea.createdBy || currentUser || 'Unknown',
        createdAt: timestamp,
      });
      if (!sanitized) return;
      setIdeas((prev) => [sanitized, ...prev]);
      runSyncTask(`Create idea (${sanitized.id})`, () =>
        SUPABASE_API.saveIdea(sanitized, currentUser || ''),
      ).then((ok) => {
        if (ok) refreshIdeas();
      });
      appendAudit({
        user: currentUser,
        action: 'idea-create',
        meta: { id: sanitized.id, title: sanitized.title },
      });
    },
    [currentUser, runSyncTask, refreshIdeas],
  );

  const deleteIdea = useCallback(
    (id: string) => {
      setIdeas((prev) => prev.filter((idea) => idea.id !== id));
      runSyncTask(`Delete idea (${id})`, () => SUPABASE_API.deleteIdea(id)).then((ok) => {
        if (ok) refreshIdeas();
      });
      appendAudit({ user: currentUser, action: 'idea-delete', meta: { id } });
    },
    [currentUser, runSyncTask, refreshIdeas],
  );

  const markIdeaConverted = useCallback(
    (id: string, convertedEntryId?: string) => {
      const convertedAt = new Date().toISOString();
      setIdeas((prev) =>
        prev.map((idea) =>
          idea.id === id
            ? {
                ...idea,
                convertedToEntryId: convertedEntryId || undefined,
                convertedAt,
              }
            : idea,
        ),
      );
      const ideaToUpdate = ideas.find((i) => i.id === id);
      if (ideaToUpdate) {
        runSyncTask(`Update idea conversion (${id})`, () =>
          SUPABASE_API.saveIdea(
            { ...ideaToUpdate, convertedToEntryId: convertedEntryId || undefined, convertedAt },
            currentUser || '',
          ),
        ).then((ok) => {
          if (ok) refreshIdeas();
        });
      }
      appendAudit({
        user: currentUser,
        action: 'idea-converted',
        meta: { id, convertedEntryId: convertedEntryId || null },
      });
    },
    [ideas, currentUser, runSyncTask, refreshIdeas],
  );

  const ideasByMonth = useMemo(() => {
    const groups = new Map<string, Record<string, unknown>[]>();
    ideas.forEach((idea) => {
      const key = (idea.targetMonth as string) || '';
      if (!key) return;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(idea);
    });
    return groups;
  }, [ideas]);

  const reset = useCallback(() => {
    setIdeas(loadIdeas());
  }, []);

  return {
    ideas,
    setIdeas,
    addIdea,
    deleteIdea,
    markIdeaConverted,
    refreshIdeas,
    ideasByMonth,
    reset,
  };
}
