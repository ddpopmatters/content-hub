import React from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge } from '../../components/ui';
import type { ReportCadence, ReportingPeriod } from '../../types/models';
import { cx } from '../../lib/utils';

interface ReportPeriodListProps {
  periods: ReportingPeriod[];
  selectedReportId: string | null;
  onSelect: (reportId: string) => void;
  onCreate: (cadence: ReportCadence) => void;
  onDelete: (reportId: string) => void;
}

const STATUS_VARIANTS = {
  Draft: 'secondary',
  Ready: 'warning',
  Published: 'success',
} as const;

export function ReportPeriodList({
  periods,
  selectedReportId,
  onSelect,
  onCreate,
  onDelete,
}: ReportPeriodListProps): React.ReactElement {
  return (
    <div className="space-y-6">
      <Card className="shadow-md">
        <CardHeader className="space-y-2 border-b border-graystone-100">
          <CardTitle>Reporting periods</CardTitle>
          <p className="text-sm text-graystone-500">
            Create a reporting period and fill the gaps the framework cannot derive from posts.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {(['Weekly', 'Monthly', 'Quarterly', 'Annual'] as ReportCadence[]).map((cadence) => (
              <Button key={cadence} variant="outline" size="sm" onClick={() => onCreate(cadence)}>
                New {cadence.toLowerCase()}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-md">
        <CardHeader className="border-b border-graystone-100">
          <CardTitle>Saved reports</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {periods.length === 0 && (
            <div className="rounded-2xl border border-dashed border-graystone-300 bg-graystone-50 px-4 py-8 text-center text-sm text-graystone-500">
              No reporting periods yet.
            </div>
          )}
          {periods.map((period) => (
            <div
              key={period.id}
              className={cx(
                'rounded-2xl border px-4 py-4 transition',
                selectedReportId === period.id
                  ? 'border-ocean-400 bg-ocean-50 shadow-sm'
                  : 'border-graystone-200 hover:border-ocean-300 hover:bg-graystone-50',
              )}
            >
              <button onClick={() => onSelect(period.id)} className="w-full text-left">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-ocean-900">{period.label}</div>
                    <div className="mt-1 text-xs text-graystone-500">
                      {period.startDate} to {period.endDate}
                    </div>
                  </div>
                  <Badge variant={STATUS_VARIANTS[period.status]}>{period.status}</Badge>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-graystone-500">
                  <span>{period.cadence}</span>
                  <span>•</span>
                  <span>{period.completeness.completionRatio}% complete</span>
                </div>
              </button>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="text-xs text-graystone-500">Owner: {period.owner || 'Unknown'}</div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(period.id);
                  }}
                  className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default ReportPeriodList;
