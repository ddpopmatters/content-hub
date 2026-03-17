import { useState, useCallback, useEffect } from 'react';
import type { PlanningCampaign } from '../../types/models';
import { loadCampaigns, saveCampaigns } from '../../lib/storage';
import { SUPABASE_API } from '../../lib/supabase';

export type { PlanningCampaign }; // re-export so consumers can import from this hook file

interface UseYearPlanDeps {
  currentUser: string;
  runSyncTask: (label: string, action: () => Promise<unknown>) => Promise<boolean>;
  pushSyncToast: (message: string, variant?: string) => void;
}

export function useYearPlan({ currentUser, runSyncTask, pushSyncToast }: UseYearPlanDeps) {
  const [campaigns, setCampaigns] = useState<PlanningCampaign[]>(() => loadCampaigns());

  useEffect(() => {
    saveCampaigns(campaigns);
  }, [campaigns]);

  const refreshCampaigns = useCallback(() => {
    SUPABASE_API.fetchCampaigns()
      .then((data) => Array.isArray(data) && setCampaigns(data))
      .catch(() => pushSyncToast('Unable to refresh campaigns from the server.', 'warning'));
  }, [pushSyncToast]);

  const addCampaign = useCallback(
    (campaign: Omit<PlanningCampaign, 'id' | 'createdAt' | 'createdBy'>) => {
      const newCampaign: PlanningCampaign = {
        ...campaign,
        id: crypto.randomUUID(),
        createdBy: currentUser,
        createdAt: new Date().toISOString(),
      };
      setCampaigns((prev) =>
        [...prev, newCampaign].sort((a, b) => a.startDate.localeCompare(b.startDate)),
      );
      runSyncTask(`Create campaign (${newCampaign.id})`, () =>
        SUPABASE_API.saveCampaign(newCampaign, currentUser),
      ).then((ok) => {
        if (ok) refreshCampaigns();
      });
    },
    [currentUser, runSyncTask, refreshCampaigns],
  );

  const updateCampaign = useCallback(
    (id: string, updates: Partial<PlanningCampaign>) => {
      let merged: PlanningCampaign | undefined;
      setCampaigns((prev) => {
        const next = prev
          .map((c) => {
            if (c.id !== id) return c;
            merged = { ...c, ...updates };
            return merged;
          })
          .sort((a, b) => a.startDate.localeCompare(b.startDate));
        return next;
      });
      if (merged) {
        const toSave = merged;
        runSyncTask(`Update campaign (${id})`, () =>
          SUPABASE_API.saveCampaign(toSave, currentUser),
        ).then((ok) => {
          if (ok) refreshCampaigns();
        });
      }
    },
    [currentUser, runSyncTask, refreshCampaigns],
  );

  const deleteCampaign = useCallback(
    (id: string) => {
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
      runSyncTask(`Delete campaign (${id})`, () => SUPABASE_API.deleteCampaign(id)).then((ok) => {
        if (ok) refreshCampaigns();
      });
    },
    [runSyncTask, refreshCampaigns],
  );

  const reset = useCallback(() => {
    setCampaigns(loadCampaigns());
  }, []);

  return { campaigns, addCampaign, updateCampaign, deleteCampaign, refreshCampaigns, reset };
}
