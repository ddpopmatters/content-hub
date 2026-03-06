import React, { useEffect, useMemo, useState } from 'react';
import { ReportPeriodList } from './ReportPeriodList';
import { ReportEditor } from './ReportEditor';
import { calculateReportCompleteness } from '../../lib/reporting/reportCompleteness';
import {
  updateMetricValue,
  updateNarrativeField,
  updateQualitativeField,
} from '../../lib/reporting/reportCalculations';
import { printReportingPeriod } from '../../lib/reporting/reportExport';
import type { Entry, ReportCadence, ReportingPeriod } from '../../types/models';

interface ReportingWorkspaceProps {
  entries: Entry[];
  reportingPeriods: ReportingPeriod[];
  onCreateReport: (cadence: ReportCadence) => ReportingPeriod;
  onUpdateReport: (id: string, updates: Partial<ReportingPeriod>) => ReportingPeriod | null;
  onRecalculateReport: (id: string, entries: Entry[]) => ReportingPeriod | null;
  onUpdateStatus: (id: string, status: ReportingPeriod['status']) => ReportingPeriod | null;
  onDeleteReport: (id: string) => void;
  onOpenAnalytics: () => void;
  onOpenImport: () => void;
}

export function ReportingWorkspace({
  entries,
  reportingPeriods,
  onCreateReport,
  onUpdateReport,
  onRecalculateReport,
  onUpdateStatus,
  onDeleteReport,
  onOpenAnalytics,
  onOpenImport,
}: ReportingWorkspaceProps): React.ReactElement {
  const [selectedReportId, setSelectedReportId] = useState<string | null>(
    reportingPeriods[0]?.id || null,
  );
  const [draftReport, setDraftReport] = useState<ReportingPeriod | null>(reportingPeriods[0] || null);
  const [dirty, setDirty] = useState(false);
  const [autosaving, setAutosaving] = useState(false);

  const selectedReport = useMemo(
    () => reportingPeriods.find((period) => period.id === selectedReportId) || null,
    [reportingPeriods, selectedReportId],
  );

  useEffect(() => {
    if (!selectedReportId && reportingPeriods[0]?.id) {
      setSelectedReportId(reportingPeriods[0].id);
    }
  }, [reportingPeriods, selectedReportId]);

  useEffect(() => {
    if (!selectedReport) {
      setDraftReport(null);
      setDirty(false);
      return;
    }
    if (!draftReport || draftReport.id !== selectedReport.id || !dirty) {
      setDraftReport(selectedReport);
      setDirty(false);
    }
  }, [selectedReport, draftReport, dirty]);

  useEffect(() => {
    if (!dirty || !draftReport) return;
    const timeout = window.setTimeout(() => {
      setAutosaving(true);
      const next = {
        ...draftReport,
        completeness: calculateReportCompleteness(draftReport),
      };
      onUpdateReport(draftReport.id, next);
      setAutosaving(false);
      setDirty(false);
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [dirty, draftReport, onUpdateReport]);

  const mutateDraft = (updater: (report: ReportingPeriod) => ReportingPeriod) => {
    setDraftReport((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      next.completeness = calculateReportCompleteness(next);
      return next;
    });
    setDirty(true);
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px,minmax(0,1fr)]">
      <ReportPeriodList
        periods={reportingPeriods}
        selectedReportId={selectedReportId}
        onSelect={setSelectedReportId}
        onCreate={(cadence) => {
          const created = onCreateReport(cadence);
          setSelectedReportId(created.id);
          setDraftReport(created);
          setDirty(false);
        }}
        onDelete={(reportId) => {
          onDeleteReport(reportId);
          if (selectedReportId === reportId) {
            const fallback = reportingPeriods.find((period) => period.id !== reportId) || null;
            setSelectedReportId(fallback?.id || null);
            setDraftReport(fallback);
            setDirty(false);
          }
        }}
      />

      <ReportEditor
        report={draftReport}
        autosaving={autosaving}
        onChangeMeta={(updates) =>
          mutateDraft((report) => ({
            ...report,
            ...updates,
            updatedAt: new Date().toISOString(),
          }))
        }
        onMetricChange={(group, metricId, value) =>
          mutateDraft((report) => updateMetricValue(report, group, metricId, value))
        }
        onNarrativeChange={(field, value) =>
          mutateDraft((report) => updateNarrativeField(report, field, value))
        }
        onQualitativeChange={(field, value) =>
          mutateDraft((report) => updateQualitativeField(report, field, value))
        }
        onRecalculate={() => {
          if (!draftReport) return;
          const refreshed = onRecalculateReport(draftReport.id, entries);
          if (refreshed) {
            setDraftReport(refreshed);
            setDirty(false);
          }
        }}
        onOpenAnalytics={onOpenAnalytics}
        onOpenImport={onOpenImport}
        onMarkReady={() => {
          if (!draftReport) return;
          const completeDraft = { ...draftReport, completeness: calculateReportCompleteness(draftReport) };
          if (!completeDraft.completeness.complete) {
            setDraftReport(completeDraft);
            return;
          }
          const updated = onUpdateStatus(draftReport.id, 'Ready');
          if (updated) setDraftReport({ ...updated, completeness: calculateReportCompleteness(updated) });
        }}
        onPublish={() => {
          if (!draftReport) return;
          const updated = onUpdateStatus(draftReport.id, 'Published');
          if (updated) setDraftReport({ ...updated, completeness: calculateReportCompleteness(updated) });
        }}
        onPrint={() => printReportingPeriod(draftReport)}
      />
    </div>
  );
}

export default ReportingWorkspace;
