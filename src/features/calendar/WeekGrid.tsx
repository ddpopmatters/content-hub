import React, { useState, useCallback } from 'react';
import { Badge } from '../../components/ui';
import { PlatformIcon } from '../../components/common';
import { cx } from '../../lib/utils';
import { PRIORITY_TIERS, PRIORITY_TIER_BADGE_CLASSES } from '../../constants';
import type { Entry } from '../../types/models';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface WeekGridProps {
  /** Start date of the week (Sunday) */
  weekStart: Date;
  /** All entries to display */
  entries: Entry[];
  /** Callback when entry is approved */
  onApprove: (id: string) => void;
  /** Callback when entry is deleted */
  onDelete: (id: string) => void;
  /** Callback when entry is opened */
  onOpen: (id: string) => void;
  /** Callback when entry date is changed via drag-and-drop */
  onDateChange?: (entryId: string, newDate: string) => void;
  /** Daily post target for content gap indicators (0 = disabled) */
  dailyPostTarget?: number;
}

function getWeekDates(weekStart: Date): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function formatDateKey(date: Date): string {
  // Use local date components to avoid timezone issues with toISOString()
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function WeekGrid({
  weekStart,
  entries,
  onApprove,
  onDelete,
  onOpen,
  onDateChange,
  dailyPostTarget = 0,
}: WeekGridProps): React.ReactElement {
  const weekDates = getWeekDates(weekStart);
  const today = formatDateKey(new Date());
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  // Drag-and-drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, entryId: string) => {
    e.dataTransfer.setData('entryId', entryId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, date: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverDate(date);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverDate(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetDate: string) => {
      e.preventDefault();
      setDragOverDate(null);
      const entryId = e.dataTransfer.getData('entryId');
      if (entryId && onDateChange) {
        onDateChange(entryId, targetDate);
      }
    },
    [onDateChange],
  );

  // Group entries by date
  const entriesByDate = entries.reduce<Record<string, Entry[]>>((acc, entry) => {
    const dateKey = entry.date;
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(entry);
    return acc;
  }, {});

  return (
    <div className="grid grid-cols-7 gap-2">
      {weekDates.map((date) => {
        const dateKey = formatDateKey(date);
        const isToday = dateKey === today;
        const dayEntries = entriesByDate[dateKey] || [];
        const dayNum = date.getDate();
        const dayName = DAY_NAMES[date.getDay()];

        const isDragOver = dragOverDate === dateKey;
        return (
          <div
            key={dateKey}
            onDragOver={(e) => handleDragOver(e, dateKey)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, dateKey)}
            className={cx(
              'min-h-[200px] rounded-xl border p-2 transition-colors',
              isToday ? 'border-ocean-400 bg-ocean-50' : 'border-graystone-200 bg-white',
              isDragOver && 'bg-aqua-100 ring-2 ring-aqua-400',
            )}
          >
            {/* Day header */}
            <div className="mb-2 text-center">
              <div
                className={cx(
                  'text-xs font-medium uppercase tracking-wide',
                  isToday ? 'text-ocean-600' : 'text-graystone-500',
                )}
              >
                {dayName}
              </div>
              <div className="flex items-center justify-center gap-1">
                <div
                  className={cx(
                    'inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold',
                    isToday ? 'bg-ocean-500 text-white' : 'text-graystone-700',
                  )}
                >
                  {dayNum}
                </div>
                {dailyPostTarget > 0 && dayEntries.length < dailyPostTarget && (
                  <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-700">
                    Gap
                  </span>
                )}
              </div>
            </div>

            {/* Entries for this day */}
            <div className="space-y-1.5">
              {dayEntries.map((entry) => {
                const priorityTier = PRIORITY_TIERS.includes(entry.priorityTier)
                  ? entry.priorityTier
                  : 'Medium';
                return (
                  <div
                    key={entry.id}
                    role="button"
                    tabIndex={0}
                    draggable={!!onDateChange}
                    onDragStart={(e) => handleDragStart(e, entry.id)}
                    onClick={() => onOpen(entry.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onOpen(entry.id);
                      }
                    }}
                    className={cx(
                      'w-full rounded-lg border px-2 py-1.5 text-left transition hover:shadow-md',
                      entry.workflowStatus === 'Approved' || entry.status === 'Approved'
                        ? 'border-emerald-200 bg-emerald-50'
                        : entry.workflowStatus === 'Published'
                          ? 'border-ocean-200 bg-ocean-50'
                          : 'border-graystone-200 bg-white',
                      onDateChange && 'cursor-grab active:cursor-grabbing',
                    )}
                  >
                    <div className="flex items-start gap-1.5">
                      {/* Platform icons */}
                      <div className="flex shrink-0 flex-wrap gap-0.5">
                        {(entry.platforms || []).slice(0, 3).map((platform) => (
                          <span key={platform}>
                            <PlatformIcon platform={platform} size="xs" />
                          </span>
                        ))}
                        {entry.platforms && entry.platforms.length > 3 && (
                          <span className="text-[10px] text-graystone-500">
                            +{entry.platforms.length - 3}
                          </span>
                        )}
                      </div>
                      {/* Caption preview */}
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-[11px] leading-tight text-graystone-700">
                          {entry.caption || 'No caption'}
                        </p>
                      </div>
                    </div>
                    {/* Status badge */}
                    <div className="mt-1 flex items-center gap-1">
                      <span
                        className={cx(
                          'inline-block rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide',
                          entry.workflowStatus === 'Approved' || entry.status === 'Approved'
                            ? 'bg-emerald-100 text-emerald-700'
                            : entry.workflowStatus === 'Published'
                              ? 'bg-ocean-100 text-ocean-700'
                              : 'bg-amber-100 text-amber-700',
                        )}
                      >
                        {entry.workflowStatus || entry.status || 'Draft'}
                      </span>
                      <Badge
                        className={cx(
                          'px-1.5 py-0.5 text-[9px] uppercase tracking-wide',
                          PRIORITY_TIER_BADGE_CLASSES[priorityTier],
                        )}
                      >
                        {priorityTier}
                      </Badge>
                      {entry.assetType && (
                        <span className="text-[9px] text-graystone-400">{entry.assetType}</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {dayEntries.length === 0 && dailyPostTarget > 0 && (
                <div className="flex flex-col items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-2 text-xs text-amber-700">
                  <span className="font-medium">Content gap</span>
                  <span>
                    Need {dailyPostTarget} post{dailyPostTarget !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
              {dayEntries.length === 0 && dailyPostTarget === 0 && (
                <div className="py-4 text-center text-xs text-graystone-400">No posts</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default WeekGrid;
