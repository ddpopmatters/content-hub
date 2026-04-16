import React, { useMemo } from 'react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '../../../components/ui';
import { buildContentPeakSnapshot, sortContentPeaks } from '../../../lib/contentPeaks';
import type { ContentPeak, Entry } from '../../../types/models';

interface UpcomingPeaksWidgetProps {
  contentPeaks: ContentPeak[];
  entries: Entry[];
  onOpenPeaks: () => void;
}

export function UpcomingPeaksWidget({
  contentPeaks,
  entries,
  onOpenPeaks,
}: UpcomingPeaksWidgetProps): React.ReactElement {
  const upcoming = useMemo(() => {
    const now = new Date();
    return sortContentPeaks(contentPeaks)
      .filter((peak) => new Date(peak.endDate) >= now)
      .slice(0, 3)
      .map((peak) => ({
        peak,
        snapshot: buildContentPeakSnapshot(peak, entries, now),
      }));
  }, [contentPeaks, entries]);

  return (
    <Card className="shadow-md">
      <CardHeader className="border-b border-graystone-200 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base text-ocean-900">Upcoming Peaks</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenPeaks}
            className="justify-center sm:justify-start"
          >
            Open peaks
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 py-4">
        {upcoming.length === 0 ? (
          <div className="rounded-xl bg-graystone-50 px-3 py-4 text-sm text-graystone-500">
            No live or upcoming peaks yet. Add one in the Peaks workspace.
          </div>
        ) : (
          upcoming.map(({ peak, snapshot }) => (
            <div
              key={peak.id}
              className="rounded-2xl border border-graystone-200 bg-white px-4 py-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="font-semibold text-ocean-900">{peak.title}</div>
                  <div className="mt-1 text-xs text-graystone-500">
                    {peak.startDate} to {peak.endDate}
                  </div>
                </div>
                <Badge variant={snapshot.state === 'Live' ? 'info' : 'secondary'}>
                  {snapshot.state}
                </Badge>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                <div className="rounded-2xl border border-graystone-100 bg-graystone-50/70 px-4 py-3">
                  <div className="text-graystone-500">Readiness</div>
                  <div className="mt-1 font-semibold text-ocean-800">
                    {snapshot.readinessScore}%
                  </div>
                </div>
                <div className="rounded-2xl border border-graystone-100 bg-graystone-50/70 px-4 py-3">
                  <div className="text-graystone-500">Entries</div>
                  <div className="mt-1 font-semibold text-ocean-800">
                    {snapshot.linkedEntries.length}
                  </div>
                </div>
                <div className="rounded-2xl border border-graystone-100 bg-graystone-50/70 px-4 py-3">
                  <div className="text-graystone-500">Approved</div>
                  <div className="mt-1 font-semibold text-ocean-800">
                    {snapshot.approvedEntries.length}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export default UpcomingPeaksWidget;
