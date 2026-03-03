import { useState, useCallback, useMemo, useEffect } from 'react';
import { uuid } from '../../lib/utils';
import { appendAudit } from '../../lib/audit';
import { SUPABASE_API } from '../../lib/supabase';
import type { Opportunity, OpportunityStatus, OpportunityUrgency } from '../../types/models';

interface UseOpportunitiesDeps {
  currentUser: string;
  currentUserEmail: string;
  runSyncTask: (
    label: string,
    action: () => Promise<unknown>,
    options?: { requiresApi?: boolean },
  ) => Promise<boolean>;
  pushSyncToast: (message: string, variant?: string) => void;
}

export interface OpportunityPayload {
  date: string;
  description: string;
  angle: string;
  urgency: OpportunityUrgency;
  linkedEntryId?: string;
}

const URGENCY_SORT_ORDER: Record<OpportunityUrgency, number> = {
  High: 0,
  Medium: 1,
  Low: 2,
};

export function useOpportunities({
  currentUser,
  currentUserEmail,
  runSyncTask,
  pushSyncToast,
}: UseOpportunitiesDeps) {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);

  const refreshOpportunities = useCallback(() => {
    SUPABASE_API.fetchOpportunities()
      .then((items) => setOpportunities(items))
      .catch(() => pushSyncToast('Unable to refresh opportunities.', 'warning'));
  }, [pushSyncToast]);

  useEffect(() => {
    refreshOpportunities();
  }, [refreshOpportunities]);

  const addOpportunity = useCallback(
    (payload: OpportunityPayload) => {
      const timestamp = new Date().toISOString();
      const createdOpportunity: Opportunity = {
        id: uuid(),
        date: payload.date,
        description: payload.description.trim(),
        angle: payload.angle.trim(),
        urgency: payload.urgency,
        status: 'Open',
        createdBy: currentUser || 'Unknown',
        linkedEntryId: payload.linkedEntryId || undefined,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      setOpportunities((prev) => [createdOpportunity, ...prev]);

      runSyncTask(
        `Create opportunity (${createdOpportunity.id})`,
        async () => {
          const saved = await SUPABASE_API.createOpportunity(createdOpportunity, currentUserEmail);
          if (!saved) {
            throw new Error('Unable to create opportunity');
          }
        },
        { requiresApi: false },
      ).then((ok) => {
        if (ok) refreshOpportunities();
      });

      appendAudit({
        user: currentUser,
        action: 'opportunity-create',
        meta: {
          id: createdOpportunity.id,
          urgency: createdOpportunity.urgency,
        },
      });
    },
    [currentUser, currentUserEmail, refreshOpportunities, runSyncTask],
  );

  const updateOpportunityStatus = useCallback(
    (id: string, status: OpportunityStatus) => {
      const updatedAt = new Date().toISOString();
      setOpportunities((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status, updatedAt } : item)),
      );

      runSyncTask(
        `Update opportunity (${id})`,
        async () => {
          const saved = await SUPABASE_API.updateOpportunityStatus(id, status);
          if (!saved) {
            throw new Error('Unable to update opportunity');
          }
        },
        { requiresApi: false },
      ).then((ok) => {
        if (ok) refreshOpportunities();
      });

      appendAudit({
        user: currentUser,
        action: 'opportunity-status-update',
        meta: { id, status },
      });
    },
    [currentUser, refreshOpportunities, runSyncTask],
  );

  const markOpportunityAsActed = useCallback(
    (id: string) => updateOpportunityStatus(id, 'Acted'),
    [updateOpportunityStatus],
  );

  const dismissOpportunity = useCallback(
    (id: string) => updateOpportunityStatus(id, 'Dismissed'),
    [updateOpportunityStatus],
  );

  const openOpportunities = useMemo(() => {
    return opportunities
      .filter((item) => item.status === 'Open')
      .slice()
      .sort((a, b) => {
        const urgencyDiff = URGENCY_SORT_ORDER[a.urgency] - URGENCY_SORT_ORDER[b.urgency];
        if (urgencyDiff !== 0) return urgencyDiff;
        return b.date.localeCompare(a.date);
      });
  }, [opportunities]);

  const urgentOpenCount = useMemo(
    () => openOpportunities.filter((item) => item.urgency === 'High').length,
    [openOpportunities],
  );

  const reset = useCallback(() => {
    setOpportunities([]);
  }, []);

  return {
    opportunities,
    setOpportunities,
    openOpportunities,
    urgentOpenCount,
    addOpportunity,
    markOpportunityAsActed,
    dismissOpportunity,
    refreshOpportunities,
    reset,
  };
}
