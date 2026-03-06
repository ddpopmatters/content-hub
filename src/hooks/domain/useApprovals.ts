import { useState, useCallback, useMemo, useEffect } from 'react';
import { DEFAULT_APPROVERS } from '../../constants';

interface UseApprovalsDeps {
  apiGet: (url: string) => Promise<unknown>;
  entries: Record<string, unknown>[];
  viewerMatchesValue: (value: unknown) => boolean;
}

export function useApprovals({ apiGet, entries, viewerMatchesValue }: UseApprovalsDeps) {
  const [approverDirectory, setApproverDirectory] = useState<string[]>(DEFAULT_APPROVERS);

  const refreshApprovers = useCallback(async () => {
    try {
      let payload: unknown = null;
      if (
        window.api &&
        typeof (window.api as Record<string, unknown>).listApprovers === 'function'
      ) {
        payload = await (
          window.api as Record<string, (...args: unknown[]) => Promise<unknown>>
        ).listApprovers();
      } else {
        payload = await apiGet('/api/approvers');
      }
      if (Array.isArray(payload) && payload.length) {
        setApproverDirectory(
          payload
            .map((entry: Record<string, unknown>) => {
              if (!entry) return '';
              if (entry.name && String(entry.name).trim().length) return String(entry.name).trim();
              if (entry.email && String(entry.email).trim().length)
                return String(entry.email).trim();
              return '';
            })
            .filter(Boolean),
        );
      } else {
        setApproverDirectory(DEFAULT_APPROVERS);
      }
    } catch (error) {
      console.warn('Failed to load approvers', error);
      setApproverDirectory(DEFAULT_APPROVERS);
    }
  }, [apiGet]);

  useEffect(() => {
    refreshApprovers();
  }, [refreshApprovers]);

  const outstandingApprovals = useMemo(
    () =>
      entries
        .filter(
          (entry) =>
            !entry.deletedAt &&
            entry.status === 'Pending' &&
            Array.isArray(entry.approvers) &&
            (entry.approvers as string[]).some((approver) => viewerMatchesValue(approver)),
        )
        .sort((a, b) => ((a.date as string) || '').localeCompare((b.date as string) || '')),
    [entries, viewerMatchesValue],
  );

  const reset = useCallback(() => {
    setApproverDirectory(DEFAULT_APPROVERS);
  }, []);

  return {
    approverDirectory,
    setApproverDirectory,
    refreshApprovers,
    outstandingApprovals,
    reset,
  };
}
