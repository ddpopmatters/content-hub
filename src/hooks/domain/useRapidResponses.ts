import { useCallback, useEffect, useMemo, useState } from 'react';
import { appendAudit } from '../../lib/audit';
import {
  buildRapidResponseFromOpportunity,
  buildRapidResponseSnapshot,
} from '../../lib/rapidResponses';
import { loadRapidResponses, saveRapidResponses } from '../../lib/storage';
import type { Opportunity, RapidResponse } from '../../types/models';
import { uuid } from '../../lib/utils';

interface UseRapidResponsesDeps {
  currentUser: string;
}

export function useRapidResponses({ currentUser }: UseRapidResponsesDeps) {
  const [rapidResponses, setRapidResponses] = useState<RapidResponse[]>(() => loadRapidResponses());

  useEffect(() => {
    saveRapidResponses(rapidResponses);
  }, [rapidResponses]);

  const addRapidResponse = useCallback(
    (response: Omit<RapidResponse, 'id' | 'createdAt' | 'updatedAt'>) => {
      const created: RapidResponse = {
        ...response,
        id: uuid(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setRapidResponses((prev) => [...prev, created]);
      appendAudit({
        user: currentUser,
        action: 'rapid-response-create',
        meta: { id: created.id, title: created.title },
      });
      return created;
    },
    [currentUser],
  );

  const createRapidResponseFromOpportunity = useCallback(
    (opportunity: Opportunity) => {
      const created = buildRapidResponseFromOpportunity(opportunity, currentUser || 'Unassigned');
      setRapidResponses((prev) => [...prev, created]);
      appendAudit({
        user: currentUser,
        action: 'rapid-response-from-opportunity',
        meta: { id: created.id, sourceOpportunityId: opportunity.id },
      });
      return created;
    },
    [currentUser],
  );

  const updateRapidResponse = useCallback(
    (id: string, updates: Partial<RapidResponse>) => {
      setRapidResponses((prev) =>
        prev.map((response) =>
          response.id === id
            ? { ...response, ...updates, updatedAt: new Date().toISOString() }
            : response,
        ),
      );
      appendAudit({
        user: currentUser,
        action: 'rapid-response-update',
        meta: { id },
      });
    },
    [currentUser],
  );

  const deleteRapidResponse = useCallback(
    (id: string) => {
      setRapidResponses((prev) => prev.filter((response) => response.id !== id));
      appendAudit({
        user: currentUser,
        action: 'rapid-response-delete',
        meta: { id },
      });
    },
    [currentUser],
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
    addRapidResponse,
    createRapidResponseFromOpportunity,
    updateRapidResponse,
    deleteRapidResponse,
    urgentResponseCount,
  };
}
