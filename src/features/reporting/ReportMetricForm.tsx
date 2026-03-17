import React from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
} from '../../components/ui';
import type { ReportingPeriod } from '../../types/models';
import { getMetricDefinitionsForGroup } from '../../lib/reporting/metricRegistry';
import { MetricInfoButton } from './MetricInfoButton';

interface ReportMetricFormProps {
  report: ReportingPeriod;
  onMetricChange: (
    group: 'tier1' | 'tier2' | 'tier3',
    metricId: string,
    value: number | null,
  ) => void;
  onRecalculate: () => void;
  onOpenAnalytics: () => void;
  onOpenImport: () => void;
}

const SOURCE_VARIANTS = {
  'auto-filled': 'info',
  aggregated: 'secondary',
  imported: 'success',
  manual: 'warning',
} as const;

export function ReportMetricForm({
  report,
  onMetricChange,
  onRecalculate,
  onOpenAnalytics,
  onOpenImport,
}: ReportMetricFormProps): React.ReactElement {
  const groups: Array<{ id: 'tier1' | 'tier2' | 'tier3'; label: string }> = [
    { id: 'tier1', label: 'Tier 1 leadership signals' },
    { id: 'tier2', label: 'Tier 2 operational metrics' },
    { id: 'tier3', label: 'Tier 3 platform health' },
  ];

  return (
    <div className="space-y-6">
      <Card className="shadow-md">
        <CardHeader className="border-b border-graystone-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Metrics</CardTitle>
              <p className="mt-1 text-sm text-graystone-500">
                Auto-fill entry-derived values, then add the period-level inputs the framework still
                needs.
              </p>
              <p className="mt-2 text-xs text-graystone-500">
                Every metric can be entered manually here. CSV import is still available when you
                want to populate post-level analytics first.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={onOpenAnalytics}>
                Log post metrics
              </Button>
              <Button variant="outline" size="sm" onClick={onOpenImport}>
                Import CSV
              </Button>
              <Button size="sm" onClick={onRecalculate}>
                Auto-fill from entries
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {groups.map((group) => {
            const definitions = getMetricDefinitionsForGroup(report.cadence, group.id);
            if (!definitions.length) return null;
            return (
              <section key={group.id} className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-ocean-900">{group.label}</h4>
                </div>
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  {definitions.map((definition) => {
                    const metric = report.metrics[group.id][definition.id];
                    return (
                      <div
                        key={definition.id}
                        className="rounded-2xl border border-graystone-200 bg-graystone-50 px-4 py-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-semibold text-ocean-900">
                                {definition.label}
                              </span>
                              {definition.guidance && (
                                <MetricInfoButton
                                  label={definition.label}
                                  guidance={definition.guidance}
                                />
                              )}
                            </div>
                            <p className="mt-1 text-xs text-graystone-500">
                              {definition.description}
                            </p>
                          </div>
                          <Badge variant={SOURCE_VARIANTS[metric?.source || 'manual']}>
                            {metric?.source || 'manual'}
                          </Badge>
                        </div>
                        <div className="mt-4">
                          <Input
                            type="number"
                            step={definition.inputType === 'percent' ? '0.01' : '1'}
                            value={metric?.value ?? ''}
                            onChange={(event) => {
                              const raw = event.target.value;
                              onMetricChange(
                                group.id,
                                definition.id,
                                raw === '' ? null : Number(raw),
                              );
                            }}
                          />
                          <div className="mt-2 text-[11px] text-graystone-500">
                            Unit: {definition.unit}. Editing here stores a manual reporting value.
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </CardContent>
      </Card>

      <Card className="shadow-md">
        <CardHeader className="border-b border-graystone-100">
          <CardTitle>Derived breakdowns</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div>
            <h4 className="mb-3 text-sm font-semibold text-ocean-900">Totals</h4>
            <div className="space-y-2">
              {Object.entries(report.metrics.derivedTotals).map(([key, metric]) => (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-xl border border-graystone-200 px-3 py-2 text-sm"
                >
                  <span className="text-graystone-600">{key}</span>
                  <span className="font-semibold text-ocean-900">{metric.value ?? '—'}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold text-ocean-900">Content pillars</h4>
            <div className="space-y-2">
              {Object.entries(report.metrics.contentPillars).map(([pillar, metric]) => (
                <div
                  key={pillar}
                  className="flex items-center justify-between rounded-xl border border-graystone-200 px-3 py-2 text-sm"
                >
                  <span className="text-graystone-600">{pillar}</span>
                  <span className="font-semibold text-ocean-900">{metric.value ?? 0}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold text-ocean-900">Audience segments</h4>
            <div className="space-y-2">
              {Object.keys(report.metrics.audienceSegments).length === 0 && (
                <div className="rounded-xl border border-dashed border-graystone-300 px-3 py-5 text-center text-sm text-graystone-500">
                  No audience segment data on entries yet.
                </div>
              )}
              {Object.entries(report.metrics.audienceSegments).map(([segment, metric]) => (
                <div
                  key={segment}
                  className="flex items-center justify-between rounded-xl border border-graystone-200 px-3 py-2 text-sm"
                >
                  <span className="text-graystone-600">{segment}</span>
                  <span className="font-semibold text-ocean-900">{metric.value ?? 0}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-md">
        <CardHeader className="border-b border-graystone-100">
          <CardTitle>Platform coverage</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-graystone-500">
                <th className="pb-3 pr-4">Platform</th>
                <th className="pb-3 pr-4">Posts</th>
                <th className="pb-3 pr-4">Reach</th>
                <th className="pb-3 pr-4">Impressions</th>
                <th className="pb-3 pr-4">Engagements</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(report.metrics.platforms).map(([platform, summary]) => (
                <tr key={platform} className="border-t border-graystone-100 text-graystone-700">
                  <td className="py-3 pr-4 font-semibold text-ocean-900">{platform}</td>
                  <td className="py-3 pr-4">{summary.posts?.value ?? 0}</td>
                  <td className="py-3 pr-4">{summary.reach?.value ?? 0}</td>
                  <td className="py-3 pr-4">{summary.impressions?.value ?? 0}</td>
                  <td className="py-3 pr-4">{summary.engagements?.value ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

export default ReportMetricForm;
