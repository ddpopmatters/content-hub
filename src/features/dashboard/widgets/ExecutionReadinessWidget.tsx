import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui';
import type { Entry } from '../../../types/models';
import { buildComplianceSnapshot } from '../../analytics/analyticsUtils';

interface ExecutionReadinessWidgetProps {
  entries: Entry[];
}

export function ExecutionReadinessWidget({
  entries,
}: ExecutionReadinessWidgetProps): React.ReactElement {
  const compliance = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recent = entries.filter(
      (entry) => !entry.deletedAt && new Date(entry.date) >= thirtyDaysAgo,
    );
    return buildComplianceSnapshot(recent);
  }, [entries]);

  return (
    <Card className="shadow-md">
      <CardHeader className="border-b border-graystone-200 py-3">
        <CardTitle className="text-base text-ocean-900">Execution Readiness (30 days)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 py-4">
        <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
          <div className="rounded-2xl border border-graystone-100 bg-graystone-50/70 px-4 py-3">
            <div className="text-graystone-500">Review ready</div>
            <div className="mt-1 font-semibold text-ocean-800">
              {compliance.readyForReviewCount}/{compliance.totalPosts}
            </div>
          </div>
          <div className="rounded-2xl border border-graystone-100 bg-graystone-50/70 px-4 py-3">
            <div className="text-graystone-500">Blocked</div>
            <div className="mt-1 font-semibold text-ocean-800">{compliance.blockedCount}</div>
          </div>
        </div>

        <div className="space-y-2 text-xs">
          {[
            ['Source verified', compliance.sourceVerifiedRate],
            ['CTA defined', compliance.ctaRate],
            ['Alt text ready', compliance.altTextReadyRate],
            ['Subtitles ready', compliance.subtitlesReadyRate],
            ['UTM ready', compliance.utmReadyRate],
            ['SEO query set', compliance.seoReadyRate],
          ].map(([label, rate]) => (
            <div key={label} className="rounded-2xl border border-graystone-100 bg-white px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-graystone-600">{label}</span>
                <span className="font-semibold text-ocean-700">{Number(rate).toFixed(0)}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-graystone-100">
                <div
                  className="h-full rounded-full bg-ocean-500"
                  style={{ width: `${Math.min(Number(rate), 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default ExecutionReadinessWidget;
