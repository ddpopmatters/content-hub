import React, { useMemo } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '../../../components/ui';
import type { Entry } from '../../../types/models';

interface WeeklyStatsWidgetProps {
  entries: Entry[];
}

function getWeekStart(): Date {
  const now = new Date();
  const day = now.getDay();
  const start = new Date(now);
  start.setDate(start.getDate() - day);
  start.setHours(0, 0, 0, 0);
  return start;
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

export function WeeklyStatsWidget({ entries }: WeeklyStatsWidgetProps): React.ReactElement {
  const stats = useMemo(() => {
    const weekStart = getWeekStart();
    const thisWeekEntries = entries.filter((e) => {
      if (e.deletedAt) return false;
      const entryDate = new Date(e.date);
      return entryDate >= weekStart && (e.status === 'Approved' || e.status === 'Posted');
    });

    let totalEngagements = 0;
    let totalShares = 0;
    let totalSaves = 0;

    thisWeekEntries.forEach((entry) => {
      if (!entry.analytics) return;
      entry.platforms?.forEach((platform) => {
        const platformStats = entry.analytics?.[platform];
        if (platformStats && typeof platformStats === 'object') {
          const s = platformStats as Record<string, number>;
          const likes = s.likes || 0;
          const comments = s.comments || 0;
          const shares = s.shares || 0;
          const saves = s.saves || 0;

          if (likes || comments || shares || saves) {
            totalEngagements += likes + comments + shares;
            totalShares += shares;
            totalSaves += saves;
          }
        }
      });
    });

    return {
      postsPublished: thisWeekEntries.length,
      totalEngagements,
      totalShares,
      totalSaves,
    };
  }, [entries]);

  const metrics = [
    { label: 'Shares', value: formatNumber(stats.totalShares), color: 'text-ocean-600' },
    { label: 'Saves', value: formatNumber(stats.totalSaves), color: 'text-emerald-600' },
    { label: 'Posts Published', value: stats.postsPublished, color: 'text-graystone-700' },
    { label: 'Engagements', value: formatNumber(stats.totalEngagements), color: 'text-amber-600' },
  ];

  return (
    <Card className="shadow-md">
      <CardHeader className="border-b border-graystone-200 py-3">
        <CardTitle className="text-base text-ocean-900">This Week</CardTitle>
      </CardHeader>
      <CardContent className="py-4">
        <div className="grid grid-cols-2 gap-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="text-center">
              <div className={`text-2xl font-bold ${metric.color}`}>{metric.value}</div>
              <div className="text-xs text-graystone-500">{metric.label}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
