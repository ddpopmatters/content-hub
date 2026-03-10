import { useCallback, useEffect, useMemo, useState } from 'react';
import { appendAudit } from '../../lib/audit';
import {
  buildRapidResponseFromOpportunity,
  buildRapidResponseSnapshot,
} from '../../lib/rapidResponses';
import { SUPABASE_API } from '../../lib/supabase';
import type { Opportunity, RapidResponse } from '../../types/models';
import { uuid } from '../../lib/utils';

interface UseRapidResponsesDeps {
  currentUser: string;
  runSyncTask?: (
    label: string,
    action: () => Promise<unknown>,
    options?: { requiresApi?: boolean },
  ) => Promise<boolean>;
  pushSyncToast?: (message: string, variant?: string) => void;
}

export function useRapidResponses({
  currentUser,
  runSyncTask,
  pushSyncToast,
}: UseRapidResponsesDeps) {
  const [rapidResponses, setRapidResponses] = useState<RapidResponse[]>([]);

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

  const refreshRapidResponses = useCallback(() => {
    SUPABASE_API.fetchRapidResponses()
      .then((items) => setRapidResponses(items))
      .catch(() => pushSyncToast?.('Unable to refresh rapid responses.', 'warning'));
  }, [pushSyncToast]);

  useEffect(() => {
    refreshRapidResponses();
  }, [refreshRapidResponses]);

  const addRapidResponse = useCallback(
    (response: Omit<RapidResponse, 'id' | 'createdAt' | 'updatedAt'>) => {
      const timestamp = new Date().toISOString();
      const owner = response.owner || getCurrentOwner();
      const created: RapidResponse = {
        ...response,
        owner,
        id: uuid(),
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      setRapidResponses((prev) => [created, ...prev]);

      void queueSyncTask('Adding rapid response', async () => {
        const saved = await SUPABASE_API.createRapidResponse({
          ...response,
          owner,
        });
        if (!saved) {
          throw new Error('Unable to create rapid response');
        }
      }).then((ok) => {
        if (ok) refreshRapidResponses();
      });

      appendAudit({
        user: currentUser,
        action: 'rapid-response-create',
        meta: { id: created.id, title: created.title },
      });
      return created;
    },
    [currentUser, getCurrentOwner, queueSyncTask, refreshRapidResponses],
  );

  const createRapidResponseFromOpportunity = useCallback(
    (opportunity: Opportunity) => {
      const created = buildRapidResponseFromOpportunity(opportunity, getCurrentOwner());
      setRapidResponses((prev) => [created, ...prev]);

      void queueSyncTask('Adding rapid response', async () => {
        const saved = await SUPABASE_API.createRapidResponse({
          title: created.title,
          owner: created.owner,
          status: created.status,
          responseMode: created.responseMode,
          triggerDate: created.triggerDate,
          dueAt: created.dueAt,
          signOffRoute: created.signOffRoute,
          sourceOpportunityId: created.sourceOpportunityId,
          linkedEntryId: created.linkedEntryId,
          campaign: created.campaign,
          contentPillar: created.contentPillar,
          targetPlatforms: created.targetPlatforms,
          notes: created.notes,
        });
        if (!saved) {
          throw new Error('Unable to create rapid response');
        }
      }).then((ok) => {
        if (ok) refreshRapidResponses();
      });

      appendAudit({
        user: currentUser,
        action: 'rapid-response-from-opportunity',
        meta: { id: created.id, sourceOpportunityId: opportunity.id },
      });
      return created;
    },
    [currentUser, getCurrentOwner, queueSyncTask, refreshRapidResponses],
  );

  const updateRapidResponse = useCallback(
    (id: string, updates: Partial<RapidResponse>) => {
      const updatedAt = new Date().toISOString();
      setRapidResponses((prev) =>
        prev.map((response) =>
          response.id === id ? { ...response, ...updates, updatedAt } : response,
        ),
      );

      void queueSyncTask('Updating rapid response', async () => {
        const saved = await SUPABASE_API.updateRapidResponse(id, updates);
        if (!saved) {
          throw new Error('Unable to update rapid response');
        }
      }).then((ok) => {
        if (ok) refreshRapidResponses();
      });

      appendAudit({
        user: currentUser,
        action: 'rapid-response-update',
        meta: { id },
      });
    },
    [currentUser, queueSyncTask, refreshRapidResponses],
  );

  const deleteRapidResponse = useCallback(
    (id: string) => {
      setRapidResponses((prev) => prev.filter((response) => response.id !== id));

      void queueSyncTask('Deleting rapid response', async () => {
        const saved = await SUPABASE_API.deleteRapidResponse(id);
        if (!saved) {
          throw new Error('Unable to delete rapid response');
        }
      }).then((ok) => {
        if (ok) refreshRapidResponses();
      });

      appendAudit({
        user: currentUser,
        action: 'rapid-response-delete',
        meta: { id },
      });
    },
    [currentUser, queueSyncTask, refreshRapidResponses],
  );

  const urgentResponseCount = useMemo(
    () =>
      rapidResponses.filter((response) => {
        const snapshot = buildRapidResponseSnapshot(response);
        return snapshot.overdue || snapshot.dueSoon;
      }).length,
    [rapidResponses],
  );

  return {
    rapidResponses,
    setRapidResponses,
    addRapidResponse,
    createRapidResponseFromOpportunity,
    updateRapidResponse,
    deleteRapidResponse,
    urgentResponseCount,
    refreshRapidResponses,
  };
}
