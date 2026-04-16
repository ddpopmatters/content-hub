import React, { useMemo } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '../../../components/ui';
import type { Entry } from '../../../types/models';

interface ContentPipelineWidgetProps {
  entries: Entry[];
  onNavigate?: (view: string, filter?: string) => void;
}

const PIPELINE_STAGES = [
  { status: 'Draft', label: 'Draft', color: 'bg-graystone-400' },
  { status: 'Pending', label: 'Pending Approval', color: 'bg-amber-400' },
  { status: 'Scheduled', label: 'Scheduled', color: 'bg-ocean-400' },
  { status: 'Approved', label: 'Approved/Posted', color: 'bg-green-400' },
] as const;

export function ContentPipelineWidget({
  entries,
  onNavigate,
}: ContentPipelineWidgetProps): React.ReactElement {
  const counts = useMemo(() => {
    const activeEntries = entries.filter((e) => !e.deletedAt);
    return PIPELINE_STAGES.map((stage) => ({
      ...stage,
      count: activeEntries.filter((e) => e.status === stage.status).length,
    }));
  }, [entries]);

  const total = counts.reduce((sum, c) => sum + c.count, 0);

  return (
    <Card className="shadow-md">
      <CardHeader className="border-b border-graystone-200 py-3">
        <CardTitle className="text-base text-ocean-900">Content Pipeline</CardTitle>
      </CardHeader>
      <CardContent className="py-4">
        {/* Progress bar */}
        <div className="mb-4 flex h-3 overflow-hidden rounded-full bg-graystone-100">
          {counts.map((stage) => {
            const width = total > 0 ? (stage.count / total) * 100 : 0;
            if (width === 0) return null;
            return (
              <div
                key={stage.status}
                className={`${stage.color} transition-all duration-300`}
                style={{ width: `${width}%` }}
                title={`${stage.label}: ${stage.count}`}
              />
            );
          })}
        </div>

        {/* Stage counts */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {counts.map((stage) => (
            <button
              key={stage.status}
              type="button"
              onClick={() => onNavigate?.('plan', stage.status)}
              className="flex items-center gap-3 rounded-2xl border border-graystone-200 bg-graystone-50/50 px-4 py-3 text-left transition hover:border-ocean-300 hover:bg-ocean-50"
            >
              <span className={`h-2.5 w-2.5 rounded-full ${stage.color}`} />
              <span className="flex-1 text-xs text-graystone-600">{stage.label}</span>
              <span className="rounded-full bg-white px-2.5 py-1 text-sm font-semibold text-ocean-900 shadow-sm">
                {stage.count}
              </span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
