import { useState, useEffect, useCallback } from 'react';

interface AssetGoals {
  Video: number;
  Design: number;
  Carousel: number;
  [key: string]: number;
}

export function usePublishing() {
  const [dailyPostTarget, setDailyPostTarget] = useState(() => {
    try {
      const stored = window.localStorage.getItem('pm-daily-post-target');
      return stored ? parseInt(stored, 10) || 0 : 0;
    } catch {
      return 0;
    }
  });

  const [assetGoals, setAssetGoals] = useState<AssetGoals>(() => ({
    Video: 40,
    Design: 40,
    Carousel: 20,
  }));

  // Remove retired browser-side webhook configuration, including any stored secret.
  useEffect(() => {
    try {
      window.localStorage.removeItem('pm-publish-settings');
    } catch {
      // Ignore storage errors
    }
  }, []);

  const handleDailyPostTargetChange = useCallback((target: number) => {
    setDailyPostTarget(target);
    try {
      window.localStorage.setItem('pm-daily-post-target', String(target));
    } catch {
      // Ignore storage errors
    }
  }, []);

  const reset = useCallback(() => {
    setDailyPostTarget(0);
    setAssetGoals({ Video: 40, Design: 40, Carousel: 20 });
  }, []);

  return {
    dailyPostTarget,
    setDailyPostTarget,
    handleDailyPostTargetChange,
    assetGoals,
    setAssetGoals,
    reset,
  };
}
