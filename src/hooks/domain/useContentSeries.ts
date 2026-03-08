import { useCallback, useEffect, useMemo, useState } from 'react';
import { appendAudit } from '../../lib/audit';
import { createDefaultContentSeries, sortContentSeries } from '../../lib/contentSeries';
import { loadContentSeries, saveContentSeries } from '../../lib/storage';
import type { ContentSeries } from '../../types/models';
import { uuid } from '../../lib/utils';

interface UseContentSeriesDeps {
  currentUser: string;
}

export function useContentSeries({ currentUser }: UseContentSeriesDeps) {
  const [contentSeries, setContentSeries] = useState<ContentSeries[]>(() => {
    const stored = loadContentSeries();
    return stored.length
      ? sortContentSeries(stored)
      : sortContentSeries(createDefaultContentSeries(currentUser));
  });

  useEffect(() => {
    saveContentSeries(contentSeries);
  }, [contentSeries]);

  const addContentSeries = useCallback(
    (series: Omit<ContentSeries, 'id' | 'createdAt' | 'updatedAt'>) => {
      const created: ContentSeries = {
        ...series,
        id: uuid(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setContentSeries((prev) => sortContentSeries([...prev, created]));
      appendAudit({
        user: currentUser,
        action: 'content-series-create',
        meta: { id: created.id, title: created.title },
      });
      return created;
    },
    [currentUser],
  );

  const updateContentSeries = useCallback(
    (id: string, updates: Partial<ContentSeries>) => {
      setContentSeries((prev) =>
        sortContentSeries(
          prev.map((series) =>
            series.id === id
              ? { ...series, ...updates, updatedAt: new Date().toISOString() }
              : series,
          ),
        ),
      );
      appendAudit({
        user: currentUser,
        action: 'content-series-update',
        meta: { id },
      });
    },
    [currentUser],
  );

  const deleteContentSeries = useCallback(
    (id: string) => {
      setContentSeries((prev) => prev.filter((series) => series.id !== id));
      appendAudit({
        user: currentUser,
        action: 'content-series-delete',
        meta: { id },
      });
    },
    [currentUser],
  );

  const activeSeries = useMemo(
    () => contentSeries.filter((series) => series.status === 'Active'),
    [contentSeries],
  );

  return {
    contentSeries,
    setContentSeries,
    addContentSeries,
    updateContentSeries,
    deleteContentSeries,
    activeSeries,
  };
}
