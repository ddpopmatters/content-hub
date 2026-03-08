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
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base text-ocean-900">Upcoming Peaks</CardTitle>
          <Button variant="ghost" size="sm" onClick={onOpenPeaks}>
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
            <div key={peak.id} className="rounded-2xl border border-graystone-200 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-ocean-900">{peak.title}</div>
                  <div className="mt-1 text-xs text-graystone-500">
                    {peak.startDate} to {peak.endDate}
                  </div>
                </div>
                <Badge variant={snapshot.state === 'Live' ? 'info' : 'secondary'}>
                  {snapshot.state}
                </Badge>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-xl bg-graystone-50 px-3 py-2">
                  <div className="text-graystone-500">Readiness</div>
                  <div className="mt-1 font-semibold text-ocean-800">
                    {snapshot.readinessScore}%
                  </div>
                </div>
                <div className="rounded-xl bg-graystone-50 px-3 py-2">
                  <div className="text-graystone-500">Entries</div>
                  <div className="mt-1 font-semibold text-ocean-800">
                    {snapshot.linkedEntries.length}
                  </div>
                </div>
                <div className="rounded-xl bg-graystone-50 px-3 py-2">
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
