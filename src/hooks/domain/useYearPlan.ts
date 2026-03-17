import { useState, useCallback, useEffect, useRef } from 'react';
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
  const campaignsRef = useRef<PlanningCampaign[]>([]);

  useEffect(() => {
    campaignsRef.current = campaigns;
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
    (id: string, updates: Partial<Omit<PlanningCampaign, 'id' | 'createdAt' | 'createdBy'>>) => {
      const existing = campaignsRef.current.find((c) => c.id === id);
      if (!existing) return;
      const merged: PlanningCampaign = { ...existing, ...updates };
      setCampaigns((prev) =>
        prev
          .map((c) => (c.id === id ? merged : c))
          .sort((a, b) => a.startDate.localeCompare(b.startDate)),
      );
      runSyncTask(`Update campaign (${id})`, () =>
        SUPABASE_API.saveCampaign(merged, currentUser),
      ).then((ok) => {
        if (ok) refreshCampaigns();
      });
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
