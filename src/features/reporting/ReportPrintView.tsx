import React from 'react';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '../../components/ui';
import type { ReportingPeriod } from '../../types/models';

interface ReportPrintViewProps {
  report: ReportingPeriod;
}

export function ReportPrintView({ report }: ReportPrintViewProps): React.ReactElement {
  return (
    <Card className="shadow-md print:shadow-none print:border-0 print:rounded-none">
      <CardHeader className="border-b border-graystone-100 print:px-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-2xl">{report.label}</CardTitle>
            <p className="mt-2 text-sm text-graystone-500">
              {report.startDate} to {report.endDate}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={report.completeness.complete ? 'success' : 'warning'}>
              {report.completeness.complete ? 'Complete' : 'Incomplete'}
            </Badge>
            <Badge variant="outline">{report.status}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-8 print:px-0">
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {Object.entries(report.metrics.derivedTotals).map(([key, metric]) => (
            <div
              key={key}
              className="rounded-2xl border border-graystone-200 px-4 py-4 print:break-inside-avoid"
            >
              <div className="text-xs uppercase tracking-wide text-graystone-500">{key}</div>
              <div className="mt-2 text-2xl font-bold text-ocean-900">{metric.value ?? '—'}</div>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h3 className="text-lg font-semibold text-ocean-900">Narrative</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {Object.entries(report.narrative).map(([key, value]) =>
              value ? (
                <div
                  key={key}
                  className="rounded-2xl border border-graystone-200 px-4 py-4 print:break-inside-avoid"
                >
                  <div className="text-sm font-semibold text-ocean-900">{key}</div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-graystone-700">{value}</p>
                </div>
              ) : null,
            )}
            {Object.entries(report.qualitative)
              .filter(([_key, value]) => typeof value === 'string' && value)
              .map(([key, value]) => (
                <div
                  key={key}
                  className="rounded-2xl border border-graystone-200 px-4 py-4 print:break-inside-avoid"
                >
                  <div className="text-sm font-semibold text-ocean-900">{key}</div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-graystone-700">
                    {value as string}
                  </p>
                </div>
              ))}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-3 text-lg font-semibold text-ocean-900">Top content</h3>
            <div className="space-y-3">
              {report.qualitative.topPerformers.map((item) => (
                <div
                  key={item.entryId}
                  className="rounded-2xl border border-graystone-200 px-4 py-4 print:break-inside-avoid"
                >
                  <div className="text-sm font-semibold text-ocean-900">{item.caption}</div>
                  <div className="mt-1 text-xs text-graystone-500">
                    {item.date} • {item.platforms.join(', ')}
                  </div>
                  <div className="mt-2 text-sm text-graystone-700">
                    {item.metric}: {item.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="mb-3 text-lg font-semibold text-ocean-900">Bottom content</h3>
            <div className="space-y-3">
              {report.qualitative.bottomPerformers.map((item) => (
                <div
                  key={item.entryId}
                  className="rounded-2xl border border-graystone-200 px-4 py-4 print:break-inside-avoid"
                >
                  <div className="text-sm font-semibold text-ocean-900">{item.caption}</div>
                  <div className="mt-1 text-xs text-graystone-500">
                    {item.date} • {item.platforms.join(', ')}
                  </div>
                  <div className="mt-2 text-sm text-graystone-700">
                    {item.metric}: {item.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-lg font-semibold text-ocean-900">Platform summary</h3>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-graystone-500">
                <th className="pb-2 pr-4">Platform</th>
                <th className="pb-2 pr-4">Posts</th>
                <th className="pb-2 pr-4">Reach</th>
                <th className="pb-2 pr-4">Impressions</th>
                <th className="pb-2 pr-4">Engagements</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(report.metrics.platforms).map(([platform, summary]) => (
                <tr key={platform} className="border-t border-graystone-100">
                  <td className="py-2 pr-4 font-semibold text-ocean-900">{platform}</td>
                  <td className="py-2 pr-4">{summary.posts?.value ?? 0}</td>
                  <td className="py-2 pr-4">{summary.reach?.value ?? 0}</td>
                  <td className="py-2 pr-4">{summary.impressions?.value ?? 0}</td>
                  <td className="py-2 pr-4">{summary.engagements?.value ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="border-t border-graystone-100 pt-4 text-xs text-graystone-500">
          Generated from Content Hub on {new Date().toLocaleString()} • Completeness:{' '}
          {report.completeness.completionRatio}%
        </div>
      </CardContent>
    </Card>
  );
}

export default ReportPrintView;
