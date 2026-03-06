import React from 'react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from '../../components/ui';
import type { ReportingPeriod } from '../../types/models';
import { ReportMetricForm } from './ReportMetricForm';
import { ReportNarrativeForm } from './ReportNarrativeForm';
import { ReportPrintView } from './ReportPrintView';

interface ReportEditorProps {
  report: ReportingPeriod | null;
  autosaving: boolean;
  onChangeMeta: (updates: Partial<ReportingPeriod>) => void;
  onMetricChange: (group: 'tier1' | 'tier2' | 'tier3', metricId: string, value: number | null) => void;
  onNarrativeChange: (field: keyof ReportingPeriod['narrative'], value: string) => void;
  onQualitativeChange: (field: keyof ReportingPeriod['qualitative'], value: string) => void;
  onRecalculate: () => void;
  onOpenAnalytics: () => void;
  onOpenImport: () => void;
  onMarkReady: () => void;
  onPublish: () => void;
  onPrint: () => void;
}

export function ReportEditor({
  report,
  autosaving,
  onChangeMeta,
  onMetricChange,
  onNarrativeChange,
  onQualitativeChange,
  onRecalculate,
  onOpenAnalytics,
  onOpenImport,
  onMarkReady,
  onPublish,
  onPrint,
}: ReportEditorProps): React.ReactElement {
  if (!report) {
    return (
      <Card className="shadow-md">
        <CardContent className="px-8 py-16 text-center">
          <h3 className="text-lg font-semibold text-ocean-900">Select a reporting period</h3>
          <p className="mt-2 text-sm text-graystone-500">
            Create a weekly, monthly, quarterly, or annual report to start collecting reporting data.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-md">
        <CardHeader className="border-b border-graystone-100">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle>Report setup</CardTitle>
              <p className="mt-1 text-sm text-graystone-500">
                Auto-fill what the app already knows, then add the strategic context around it.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={report.completeness.complete ? 'success' : 'warning'}>
                {report.completeness.completionRatio}% complete
              </Badge>
              <Badge variant="outline">{report.status}</Badge>
              {autosaving && <Badge variant="secondary">Saving…</Badge>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr,1fr,1fr]">
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-graystone-500">Label</div>
              <Input
                value={report.label}
                onChange={(event) => onChangeMeta({ label: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-graystone-500">Start</div>
              <Input
                type="date"
                value={report.startDate}
                onChange={(event) => onChangeMeta({ startDate: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-graystone-500">End</div>
              <Input
                type="date"
                value={report.endDate}
                onChange={(event) => onChangeMeta({ endDate: event.target.value })}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={onRecalculate}>
              Refresh auto-fill
            </Button>
            <Button
              variant="outline"
              onClick={onMarkReady}
              disabled={!report.completeness.complete}
            >
              Mark ready
            </Button>
            <Button
              variant="success"
              onClick={onPublish}
              disabled={!report.completeness.complete || report.status === 'Published'}
            >
              Publish report
            </Button>
            <Button variant="secondary" onClick={onPrint}>
              Print / PDF
            </Button>
          </div>
          {!report.completeness.complete && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Missing metrics: {report.completeness.missingMetricIds.join(', ') || 'none'}.
              Missing narrative: {report.completeness.missingNarrativeIds.join(', ') || 'none'}.
            </div>
          )}
        </CardContent>
      </Card>

      <ReportMetricForm
        report={report}
        onMetricChange={onMetricChange}
        onRecalculate={onRecalculate}
        onOpenAnalytics={onOpenAnalytics}
        onOpenImport={onOpenImport}
      />

      <ReportNarrativeForm
        report={report}
        onNarrativeChange={onNarrativeChange}
        onQualitativeChange={onQualitativeChange}
      />

      <ReportPrintView report={report} />
    </div>
  );
}

export default ReportEditor;
