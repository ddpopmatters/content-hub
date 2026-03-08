import { useCallback, useEffect, useMemo, useState } from 'react';
import { appendAudit } from '../../lib/audit';
import { createDefaultContentPeaks, sortContentPeaks } from '../../lib/contentPeaks';
import { loadContentPeaks, saveContentPeaks } from '../../lib/storage';
import type { ContentPeak } from '../../types/models';
import { uuid } from '../../lib/utils';

interface UseContentPeaksDeps {
  currentUser: string;
}

export function useContentPeaks({ currentUser }: UseContentPeaksDeps) {
  const [contentPeaks, setContentPeaks] = useState<ContentPeak[]>(() => {
    const stored = loadContentPeaks();
    return stored.length
      ? sortContentPeaks(stored)
      : sortContentPeaks(createDefaultContentPeaks(currentUser));
  });

  useEffect(() => {
    saveContentPeaks(contentPeaks);
  }, [contentPeaks]);

  const addContentPeak = useCallback(
    (peak: Omit<ContentPeak, 'id' | 'createdAt' | 'updatedAt'>) => {
      const created: ContentPeak = {
        ...peak,
        id: uuid(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setContentPeaks((prev) => sortContentPeaks([...prev, created]));
      appendAudit({
        user: currentUser,
        action: 'content-peak-create',
        meta: { id: created.id, title: created.title },
      });
      return created;
    },
    [currentUser],
  );

  const updateContentPeak = useCallback(
    (id: string, updates: Partial<ContentPeak>) => {
      setContentPeaks((prev) =>
        sortContentPeaks(
          prev.map((peak) =>
            peak.id === id ? { ...peak, ...updates, updatedAt: new Date().toISOString() } : peak,
          ),
        ),
      );
      appendAudit({
        user: currentUser,
        action: 'content-peak-update',
        meta: { id },
      });
    },
    [currentUser],
  );

  const deleteContentPeak = useCallback(
    (id: string) => {
      setContentPeaks((prev) => prev.filter((peak) => peak.id !== id));
      appendAudit({
        user: currentUser,
        action: 'content-peak-delete',
        meta: { id },
      });
    },
    [currentUser],
  );

  const upcomingPeaks = useMemo(
    () =>
      contentPeaks.filter((peak) => {
        const end = new Date(peak.endDate);
        return end >= new Date();
      }),
    [contentPeaks],
  );

  return {
    contentPeaks,
    setContentPeaks,
    addContentPeak,
    updateContentPeak,
    deleteContentPeak,
    upcomingPeaks,
  };
}
