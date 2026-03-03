import React, { useMemo } from 'react';
import { Card, CardHeader, CardContent, CardTitle, Badge } from '../../components/ui';
import { PlatformIcon, ClockIcon } from '../../components/common';
import { cx } from '../../lib/utils';
import { PRIORITY_TIERS, PRIORITY_TIER_BADGE_CLASSES } from '../../constants';
import type { Entry } from '../../types/models';

export interface UpcomingDeadlinesProps {
  /** All entries to check for deadlines */
  entries: Entry[];
  /** Callback when entry is clicked */
  onOpenEntry: (id: string) => void;
  /** How many days ahead to show (default 14) */
  daysAhead?: number;
}

interface DeadlineEntry extends Entry {
  deadlineDate: Date;
  daysUntil: number;
}

function getDeadlineStatus(daysUntil: number): { label: string; className: string } {
  if (daysUntil < 0) {
    return { label: 'Overdue', className: 'bg-red-100 text-red-700' };
  }
  if (daysUntil === 0) {
    return { label: 'Due today', className: 'bg-amber-100 text-amber-700' };
  }
  if (daysUntil === 1) {
    return { label: 'Due tomorrow', className: 'bg-amber-100 text-amber-700' };
  }
  if (daysUntil <= 3) {
    return { label: `${daysUntil} days`, className: 'bg-amber-50 text-amber-600' };
  }
  return { label: `${daysUntil} days`, className: 'bg-graystone-100 text-graystone-600' };
}

export function UpcomingDeadlines({
  entries,
  onOpenEntry,
  daysAhead = 14,
}: UpcomingDeadlinesProps): React.ReactElement {
  const deadlineEntries = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() + daysAhead);

    const result: DeadlineEntry[] = [];

    for (const entry of entries) {
      // Skip deleted, approved, or entries without deadline
      if (entry.deletedAt) continue;
      if (entry.status === 'Approved') continue;
      if (!entry.approvalDeadline) continue;

      const deadline = new Date(entry.approvalDeadline);
      if (Number.isNaN(deadline.getTime())) continue;

      deadline.setHours(0, 0, 0, 0);
      const daysUntil = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Include overdue items and items within daysAhead
      if (daysUntil <= daysAhead) {
        result.push({
          ...entry,
          deadlineDate: deadline,
          daysUntil,
        });
      }
    }

    // Sort: overdue first, then by deadline date
    return result.sort((a, b) => a.deadlineDate.getTime() - b.deadlineDate.getTime());
  }, [entries, daysAhead]);

  const overdueCount = deadlineEntries.filter((e) => e.daysUntil < 0).length;
  const urgentCount = deadlineEntries.filter((e) => e.daysUntil >= 0 && e.daysUntil <= 3).length;

  return (
    <Card className="shadow-md">
      <CardHeader className="border-b border-graystone-200 py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base text-ocean-900">
            <ClockIcon className="h-4 w-4 text-ocean-500" />
            Upcoming Deadlines
          </CardTitle>
          <div className="flex items-center gap-2">
            {overdueCount > 0 && <Badge variant="destructive">{overdueCount} overdue</Badge>}
            {urgentCount > 0 && <Badge variant="warning">{urgentCount} urgent</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="max-h-80 overflow-y-auto">
        {deadlineEntries.length === 0 ? (
          <p className="py-4 text-center text-sm text-graystone-500">No upcoming deadlines.</p>
        ) : (
          <div className="space-y-2">
            {deadlineEntries.map((entry) => {
              const status = getDeadlineStatus(entry.daysUntil);
              const priorityTier = PRIORITY_TIERS.includes(entry.priorityTier)
                ? entry.priorityTier
                : 'Medium';
              const deadlineStr = entry.deadlineDate.toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              });

              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => onOpenEntry(entry.id)}
                  className={cx(
                    'w-full rounded-lg border px-3 py-2 text-left transition',
                    'hover:border-ocean-300 hover:bg-ocean-50',
                    entry.daysUntil < 0
                      ? 'border-red-200 bg-red-50'
                      : entry.daysUntil <= 3
                        ? 'border-amber-200 bg-amber-50'
                        : 'border-graystone-200 bg-white',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {entry.platforms.slice(0, 2).map((platform) => (
                          <span key={platform}>
                            <PlatformIcon platform={platform} size="xs" />
                          </span>
                        ))}
                        {entry.platforms.length > 2 && (
                          <span className="text-[10px] text-graystone-400">
                            +{entry.platforms.length - 2}
                          </span>
                        )}
                        <Badge variant="outline" className="text-[10px]">
                          {entry.assetType}
                        </Badge>
                        <Badge
                          className={cx('text-[10px]', PRIORITY_TIER_BADGE_CLASSES[priorityTier])}
                        >
                          {priorityTier}
                        </Badge>
                      </div>
                      <p className="mt-1 line-clamp-1 text-xs text-graystone-700">
                        {entry.caption || 'Untitled'}
                      </p>
                      <div className="mt-1 text-[10px] text-graystone-500">Due: {deadlineStr}</div>
                    </div>
                    <span
                      className={cx(
                        'rounded-full px-2 py-0.5 text-[10px] font-medium',
                        status.className,
                      )}
                    >
                      {status.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default UpcomingDeadlines;
