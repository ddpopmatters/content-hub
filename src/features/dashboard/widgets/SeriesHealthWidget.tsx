import React, { useMemo } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '../../../components/ui';
import { buildContentSeriesSnapshot } from '../../../lib/contentSeries';
import type { ContentSeries, Entry } from '../../../types/models';

interface SeriesHealthWidgetProps {
  contentSeries: ContentSeries[];
  entries: Entry[];
  onOpenSeries: () => void;
}

export function SeriesHealthWidget({
  contentSeries,
  entries,
  onOpenSeries,
}: SeriesHealthWidgetProps): React.ReactElement {
  const snapshot = useMemo(() => {
    const active = contentSeries.filter((series) => series.status === 'Active');
    const seriesSnapshots = active.map((series) => ({
      series,
      snapshot: buildContentSeriesSnapshot(series, entries),
    }));

    return {
      activeCount: active.length,
      totalEpisodes: seriesSnapshots.reduce(
        (sum, item) => sum + item.snapshot.linkedEntries.length,
        0,
      ),
      reviewDueCount: seriesSnapshots.filter((item) => item.snapshot.reviewDue).length,
      topSeries: seriesSnapshots.slice(0, 3),
    };
  }, [contentSeries, entries]);

  return (
    <Card className="shadow-md">
      <CardHeader className="border-b border-graystone-200 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base text-ocean-900">Series Health</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenSeries}
            className="justify-center sm:justify-start"
          >
            Open series
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 py-4">
        <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
          <div className="rounded-2xl border border-graystone-100 bg-graystone-50/70 px-4 py-3">
            <div className="text-graystone-500">Active</div>
            <div className="mt-1 font-semibold text-ocean-800">{snapshot.activeCount}</div>
          </div>
          <div className="rounded-2xl border border-graystone-100 bg-graystone-50/70 px-4 py-3">
            <div className="text-graystone-500">Episodes</div>
            <div className="mt-1 font-semibold text-ocean-800">{snapshot.totalEpisodes}</div>
          </div>
          <div className="rounded-2xl border border-graystone-100 bg-graystone-50/70 px-4 py-3">
            <div className="text-graystone-500">Review due</div>
            <div className="mt-1 font-semibold text-ocean-800">{snapshot.reviewDueCount}</div>
          </div>
        </div>

        <div className="space-y-3">
          {snapshot.topSeries.length === 0 ? (
            <div className="rounded-xl bg-graystone-50 px-3 py-4 text-sm text-graystone-500">
              No active series yet. Add one in the Series workspace.
            </div>
          ) : (
            snapshot.topSeries.map(({ series, snapshot: item }) => (
              <div
                key={series.id}
                className="rounded-2xl border border-graystone-200 bg-white px-4 py-4"
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <div className="font-semibold text-ocean-900">{series.title}</div>
                  <div className="text-xs font-semibold text-ocean-700">
                    {item.progressPercent}%
                  </div>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-graystone-100">
                  <div
                    className="h-full rounded-full bg-ocean-500"
                    style={{ width: `${Math.min(item.progressPercent, 100)}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default SeriesHealthWidget;
