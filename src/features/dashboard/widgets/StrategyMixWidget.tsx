import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui';
import { CONTENT_CATEGORIES, CONTENT_CATEGORY_TARGETS } from '../../../constants';
import type { Entry } from '../../../types/models';
import { cx } from '../../../lib/utils';

interface StrategyMixWidgetProps {
  entries: Entry[];
}

export function StrategyMixWidget({ entries }: StrategyMixWidgetProps): React.ReactElement {
  const snapshot = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recent = entries.filter(
      (entry) => !entry.deletedAt && new Date(entry.date) >= thirtyDaysAgo,
    );
    const total = recent.length || 1;

    const mix = CONTENT_CATEGORIES.map((category) => {
      const count = recent.filter((entry) => entry.contentCategory === category).length;
      const actual = Math.round((count / total) * 100);
      const target = CONTENT_CATEGORY_TARGETS[category];
      return {
        category,
        count,
        actual,
        target,
        diff: actual - target,
      };
    });

    return {
      mix,
      totalTagged: recent.filter((entry) => entry.contentCategory).length,
      totalRecent: recent.length,
      reactiveCount: recent.filter(
        (entry) => entry.responseMode && entry.responseMode !== 'Planned',
      ).length,
      partnerCount: recent.filter((entry) => entry.partnerOrg).length,
      seriesCount: recent.filter((entry) => entry.seriesName).length,
      peakCount: recent.filter((entry) => entry.contentPeak).length,
    };
  }, [entries]);

  return (
    <Card className="shadow-md">
      <CardHeader className="border-b border-graystone-200 py-3">
        <CardTitle className="text-base text-ocean-900">Strategy Mix (30 days)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 py-4">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl bg-graystone-50 px-3 py-2">
            <div className="text-graystone-500">Tagged posts</div>
            <div className="mt-1 font-semibold text-ocean-800">
              {snapshot.totalTagged}/{snapshot.totalRecent}
            </div>
          </div>
          <div className="rounded-xl bg-graystone-50 px-3 py-2">
            <div className="text-graystone-500">Reactive modes</div>
            <div className="mt-1 font-semibold text-ocean-800">{snapshot.reactiveCount}</div>
          </div>
          <div className="rounded-xl bg-graystone-50 px-3 py-2">
            <div className="text-graystone-500">Partner-led</div>
            <div className="mt-1 font-semibold text-ocean-800">{snapshot.partnerCount}</div>
          </div>
          <div className="rounded-xl bg-graystone-50 px-3 py-2">
            <div className="text-graystone-500">Series / peaks</div>
            <div className="mt-1 font-semibold text-ocean-800">
              {snapshot.seriesCount} / {snapshot.peakCount}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {snapshot.mix.map((row) => (
            <div key={row.category}>
              <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                <span className="truncate font-medium text-graystone-700">{row.category}</span>
                <span className="shrink-0 text-graystone-500">
                  {row.actual}% / {row.target}% target
                  <span
                    className={cx(
                      'ml-1 font-medium',
                      row.diff === 0
                        ? 'text-graystone-500'
                        : row.diff > 0
                          ? 'text-emerald-600'
                          : 'text-amber-600',
                    )}
                  >
                    ({row.diff >= 0 ? '+' : ''}
                    {row.diff}%)
                  </span>
                </span>
              </div>
              <div className="relative h-2 overflow-hidden rounded-full bg-graystone-100">
                <div
                  className="absolute left-0 top-0 h-full rounded-full bg-ocean-500"
                  style={{ width: `${Math.min(row.actual, 100)}%` }}
                />
                <div
                  className="absolute top-0 h-full w-0.5 bg-graystone-900"
                  style={{ left: `${row.target}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default StrategyMixWidget;
