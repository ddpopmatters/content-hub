import { useCallback, useEffect, useMemo, useState } from 'react';
import { appendAudit } from '../../lib/audit';
import { loadReportingPeriods, saveReportingPeriods } from '../../lib/storage';
import { SUPABASE_API } from '../../lib/supabase';
import { calculateReportCompleteness } from '../../lib/reporting/reportCompleteness';
import {
  createReportingPeriod,
  hydrateReportingPeriod,
} from '../../lib/reporting/reportCalculations';
import type { Entry, ReportCadence, ReportStatus, ReportingPeriod } from '../../types/models';

interface UseReportingDeps {
  currentUser: string;
  runSyncTask: (
    label: string,
    action: () => Promise<unknown>,
    options?: { requiresApi?: boolean },
  ) => Promise<boolean>;
  pushSyncToast: (message: string, variant?: string) => void;
}

const sortPeriods = (periods: ReportingPeriod[]) =>
  periods.slice().sort((a, b) => b.startDate.localeCompare(a.startDate));

export function useReporting({ currentUser, runSyncTask, pushSyncToast }: UseReportingDeps) {
  const [reportingPeriods, setReportingPeriods] = useState<ReportingPeriod[]>(() =>
    loadReportingPeriods(),
  );

  useEffect(() => {
    saveReportingPeriods(reportingPeriods);
  }, [reportingPeriods]);

  const refreshReportingPeriods = useCallback(() => {
    SUPABASE_API.fetchReportingPeriods()
      .then((items) => {
        if (items.length) {
          setReportingPeriods(sortPeriods(items));
        }
      })
      .catch(() => pushSyncToast('Unable to refresh reporting periods.', 'warning'));
  }, [pushSyncToast]);

  useEffect(() => {
    refreshReportingPeriods();
  }, [refreshReportingPeriods]);

  const createReport = useCallback(
    (cadence: ReportCadence) => {
      const created = createReportingPeriod(cadence, currentUser);
      created.completeness = calculateReportCompleteness(created);
      setReportingPeriods((prev) => sortPeriods([created, ...prev]));

      runSyncTask(
        `Create reporting period (${created.id})`,
        async () => {
          const saved = await SUPABASE_API.createReportingPeriod(created);
          if (!saved) throw new Error('Unable to create reporting period');
        },
        { requiresApi: false },
      ).then((ok) => {
        if (ok) refreshReportingPeriods();
      });

      appendAudit({
        user: currentUser,
        action: 'reporting-period-create',
        meta: { id: created.id, cadence: created.cadence },
      });

      return created;
    },
    [currentUser, refreshReportingPeriods, runSyncTask],
  );

  const updateReport = useCallback(
    (id: string, updates: Partial<ReportingPeriod>) => {
      let nextSnapshot: ReportingPeriod | null = null;
      setReportingPeriods((prev) =>
        sortPeriods(
          prev.map((period) => {
            if (period.id !== id) return period;
            nextSnapshot = {
              ...period,
              ...updates,
              metrics: updates.metrics || period.metrics,
              narrative: updates.narrative || period.narrative,
              qualitative: updates.qualitative || period.qualitative,
              completeness: updates.completeness || period.completeness,
              updatedAt: new Date().toISOString(),
            };
            return nextSnapshot;
          }),
        ),
      );

      runSyncTask(
        `Update reporting period (${id})`,
        async () => {
          const saved = await SUPABASE_API.updateReportingPeriod(id, updates);
          if (!saved) throw new Error('Unable to update reporting period');
        },
        { requiresApi: false },
      );

      return nextSnapshot;
    },
    [runSyncTask],
  );

  const recalculateReport = useCallback(
    (reportId: string, entries: Entry[]) => {
      let updatedReport: ReportingPeriod | null = null;
      setReportingPeriods((prev) => {
        const next = prev.map((period) => {
          if (period.id !== reportId) return period;
          const hydrated = hydrateReportingPeriod(period, entries, prev);
          const completeness = calculateReportCompleteness(hydrated);
          updatedReport = { ...hydrated, completeness };
          return updatedReport;
        });
        return sortPeriods(next);
      });

      if (!updatedReport) return null;

      runSyncTask(
        `Recalculate reporting period (${reportId})`,
        async () => {
          const saved = await SUPABASE_API.updateReportingPeriod(reportId, {
            metrics: updatedReport!.metrics,
            qualitative: updatedReport!.qualitative,
            completeness: updatedReport!.completeness,
            updatedAt: updatedReport!.updatedAt,
          });
          if (!saved) throw new Error('Unable to recalculate reporting period');
        },
        { requiresApi: false },
      );

      appendAudit({
        user: currentUser,
        action: 'reporting-period-recalculate',
        meta: { id: reportId },
      });

      return updatedReport;
    },
    [currentUser, runSyncTask],
  );

  const updateReportStatus = useCallback(
    (id: string, status: ReportStatus) => {
      const publishedAt = status === 'Published' ? new Date().toISOString() : null;
      return updateReport(id, {
        status,
        publishedAt,
      });
    },
    [updateReport],
  );

  const deleteReport = useCallback(
    (id: string) => {
      setReportingPeriods((prev) => prev.filter((period) => period.id !== id));
      runSyncTask(
        `Delete reporting period (${id})`,
        async () => {
          const ok = await SUPABASE_API.deleteReportingPeriod(id);
          if (!ok) throw new Error('Unable to delete reporting period');
        },
        { requiresApi: false },
      );

      appendAudit({
        user: currentUser,
        action: 'reporting-period-delete',
        meta: { id },
      });
    },
    [currentUser, runSyncTask],
  );

  const reportsByCadence = useMemo(() => {
    return reportingPeriods.reduce<Record<ReportCadence, ReportingPeriod[]>>(
      (groups, period) => {
        groups[period.cadence].push(period);
        return groups;
      },
      { Weekly: [], Monthly: [], Quarterly: [], Annual: [] },
    );
  }, [reportingPeriods]);

  const reset = useCallback(() => {
    setReportingPeriods(loadReportingPeriods());
  }, []);

  return {
    reportingPeriods,
    setReportingPeriods,
    refreshReportingPeriods,
    createReport,
    updateReport,
    recalculateReport,
    updateReportStatus,
    deleteReport,
    reportsByCadence,
    reset,
  };
}
