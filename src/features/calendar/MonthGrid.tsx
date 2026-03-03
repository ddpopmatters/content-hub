import React, {
  useMemo,
  useState,
  useRef,
  useCallback,
  useEffect,
  type KeyboardEvent,
} from 'react';
import { Card, CardHeader, CardContent, CardTitle, Badge, Button } from '../../components/ui';
import { PlatformIcon, LoaderIcon, TrashIcon } from '../../components/common';
import { cx, isoFromParts } from '../../lib/utils';
import { ensureChecklist, isImageMedia } from '../../lib/sanitizers';
import {
  CHECKLIST_ITEMS,
  WORKFLOW_STAGES,
  PRIORITY_TIERS,
  PRIORITY_TIER_BADGE_CLASSES,
} from '../../constants';
import type { Entry } from '../../types/models';

export interface MonthGridProps {
  /** Array of day numbers in the month */
  days: number[];
  /** Month index (0-11) */
  month: number;
  /** Full year (e.g., 2024) */
  year: number;
  /** Calendar entries for the month */
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

export function MonthGrid({
  days,
  month,
  year,
  entries,
  onApprove,
  onDelete,
  onOpen,
  onDateChange,
  dailyPostTarget = 0,
}: MonthGridProps): React.ReactElement {
  const [focusedDayIndex, setFocusedDayIndex] = useState(0);
  const [focusedEntryIndex, setFocusedEntryIndex] = useState(-1);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const dayRefs = useRef<(HTMLDivElement | null)[]>([]);
  const entryRefs = useRef<Record<string, HTMLDivElement | null>>({});

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

  // Reset focus and clear refs when days change
  useEffect(() => {
    setFocusedDayIndex(0);
    setFocusedEntryIndex(-1);
    setSelectedDay(null);
    dayRefs.current = [];
    entryRefs.current = {};
  }, [days, month, year]);

  const handleDayKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>, dayIndex: number, dayEntries: Entry[]) => {
      const columnsPerRow = window.innerWidth >= 1280 ? 3 : window.innerWidth >= 768 ? 2 : 1;

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          if (dayIndex < days.length - 1) {
            setFocusedDayIndex(dayIndex + 1);
            setFocusedEntryIndex(-1);
            dayRefs.current[dayIndex + 1]?.focus();
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (dayIndex > 0) {
            setFocusedDayIndex(dayIndex - 1);
            setFocusedEntryIndex(-1);
            dayRefs.current[dayIndex - 1]?.focus();
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (focusedEntryIndex === -1 && dayEntries.length > 0) {
            // Move into first entry in the day
            setFocusedEntryIndex(0);
            const iso = isoFromParts(year, month, days[dayIndex]);
            entryRefs.current[`${iso}-0`]?.focus();
          } else {
            // Move to next row of days
            const nextRowIndex = dayIndex + columnsPerRow;
            if (nextRowIndex < days.length) {
              setFocusedDayIndex(nextRowIndex);
              setFocusedEntryIndex(-1);
              dayRefs.current[nextRowIndex]?.focus();
            }
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          {
            const prevRowIndex = dayIndex - columnsPerRow;
            if (prevRowIndex >= 0) {
              setFocusedDayIndex(prevRowIndex);
              setFocusedEntryIndex(-1);
              dayRefs.current[prevRowIndex]?.focus();
            }
          }
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          setSelectedDay(selectedDay === dayIndex ? null : dayIndex);
          break;
        case 'Escape':
          e.preventDefault();
          setSelectedDay(null);
          setFocusedEntryIndex(-1);
          break;
      }
    },
    [days, month, year, focusedEntryIndex, selectedDay],
  );

  const handleEntryKeyDown = useCallback(
    (
      e: KeyboardEvent<HTMLDivElement>,
      dayIndex: number,
      entryIndex: number,
      dayEntries: Entry[],
      entryId: string,
    ) => {
      const iso = isoFromParts(year, month, days[dayIndex]);

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (entryIndex < dayEntries.length - 1) {
            setFocusedEntryIndex(entryIndex + 1);
            entryRefs.current[`${iso}-${entryIndex + 1}`]?.focus();
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (entryIndex > 0) {
            setFocusedEntryIndex(entryIndex - 1);
            entryRefs.current[`${iso}-${entryIndex - 1}`]?.focus();
          } else {
            // Move back to day card
            setFocusedEntryIndex(-1);
            dayRefs.current[dayIndex]?.focus();
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (dayIndex < days.length - 1) {
            setFocusedDayIndex(dayIndex + 1);
            setFocusedEntryIndex(-1);
            dayRefs.current[dayIndex + 1]?.focus();
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (dayIndex > 0) {
            setFocusedDayIndex(dayIndex - 1);
            setFocusedEntryIndex(-1);
            dayRefs.current[dayIndex - 1]?.focus();
          }
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          onOpen(entryId);
          break;
        case 'Escape':
          e.preventDefault();
          setFocusedEntryIndex(-1);
          dayRefs.current[dayIndex]?.focus();
          break;
      }
    },
    [days, month, year, onOpen],
  );

  const byDate = useMemo(() => {
    const map = new Map<string, Entry[]>();
    days.forEach((day) => {
      const iso = isoFromParts(year, month, day);
      map.set(iso, []);
    });
    entries.forEach((entry) => {
      const arr = map.get(entry.date) || [];
      arr.push(entry);
      map.set(entry.date, arr);
    });
    return map;
  }, [days, month, year, entries]);

  return (
    <div
      className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
      role="grid"
      aria-label="Calendar month view"
    >
      {days.map((day, dayIndex) => {
        const iso = isoFromParts(year, month, day);
        const dayEntries = byDate.get(iso) || [];
        const label = new Date(year, month, day).toLocaleDateString(undefined, {
          weekday: 'short',
          day: '2-digit',
        });
        const isSelected = selectedDay === dayIndex;
        const isFocusedDay = focusedDayIndex === dayIndex;
        const isDragOver = dragOverDate === iso;
        return (
          <Card
            key={iso}
            ref={(el) => {
              dayRefs.current[dayIndex] = el;
            }}
            tabIndex={isFocusedDay ? 0 : -1}
            role="gridcell"
            aria-selected={isSelected}
            aria-label={`${label}, ${dayEntries.length} ${dayEntries.length === 1 ? 'item' : 'items'}`}
            onKeyDown={(e) => handleDayKeyDown(e, dayIndex, dayEntries)}
            onDragOver={(e) => handleDragOver(e, iso)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, iso)}
            className={cx(
              'flex h-64 flex-col bg-white outline-none transition-colors',
              'focus:ring-2 focus:ring-aqua-500 focus:ring-offset-2',
              isSelected && 'ring-2 ring-ocean-500 ring-offset-2',
              isDragOver && 'bg-aqua-100 ring-2 ring-aqua-400',
            )}
          >
            <CardHeader className="border-b border-graystone-200 py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-ocean-900">{label}</CardTitle>
                <div className="flex items-center gap-1">
                  {dailyPostTarget > 0 && dayEntries.length < dailyPostTarget && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      Gap
                    </span>
                  )}
                  <Badge variant={dayEntries.length ? 'default' : 'secondary'}>
                    {dayEntries.length} {dayEntries.length === 1 ? 'item' : 'items'}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-3 overflow-y-auto">
              {dayEntries.length === 0 && dailyPostTarget > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-700">
                  <span className="font-medium">Content gap</span>
                  <span>Need {dailyPostTarget - dayEntries.length} more</span>
                </div>
              )}
              {dayEntries.length === 0 && dailyPostTarget === 0 && (
                <p className="text-sm text-graystone-500">No items planned.</p>
              )}
              {dayEntries.map((entry, entryIndex) => {
                const checklist = ensureChecklist(entry.checklist);
                const completed = Object.values(checklist).filter(Boolean).length;
                const total = CHECKLIST_ITEMS.length;
                const hasPreviewImage = isImageMedia(entry.previewUrl);
                const hasPerformance = entry.analytics && Object.keys(entry.analytics).length > 0;
                const isFocusedEntry = isFocusedDay && focusedEntryIndex === entryIndex;
                const priorityTier = PRIORITY_TIERS.includes(entry.priorityTier)
                  ? entry.priorityTier
                  : 'Medium';
                return (
                  <div
                    key={entry.id}
                    ref={(el) => {
                      entryRefs.current[`${iso}-${entryIndex}`] = el;
                    }}
                    tabIndex={isFocusedEntry ? 0 : -1}
                    role="button"
                    aria-label={`${entry.assetType}: ${entry.caption || 'Untitled'}, ${entry.status}`}
                    draggable={!!onDateChange}
                    onDragStart={(e) => handleDragStart(e, entry.id)}
                    onClick={() => onOpen(entry.id)}
                    onKeyDown={(e) =>
                      handleEntryKeyDown(e, dayIndex, entryIndex, dayEntries, entry.id)
                    }
                    className={cx(
                      'cursor-pointer rounded-xl border border-graystone-200 bg-white p-3 outline-none transition',
                      'hover:border-aqua-400 hover:bg-aqua-50',
                      'focus:ring-2 focus:ring-aqua-500 focus:ring-offset-1',
                      onDateChange && 'cursor-grab active:cursor-grabbing',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-2">
                        {hasPreviewImage && (
                          <div className="overflow-hidden rounded-lg border border-graystone-200">
                            <img
                              src={entry.previewUrl}
                              alt={`${entry.assetType} preview`}
                              className="h-24 w-full object-cover"
                            />
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{entry.assetType}</Badge>
                          <Badge className={PRIORITY_TIER_BADGE_CLASSES[priorityTier]}>
                            {priorityTier}
                          </Badge>
                          <span className="inline-flex items-center rounded-full bg-aqua-100 px-2 py-1 text-xs font-medium text-ocean-700">
                            {entry.statusDetail || WORKFLOW_STAGES[0]}
                          </span>
                          {hasPerformance ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-ocean-500/10 px-2 py-0.5 text-xs font-medium text-ocean-700">
                              Performance
                            </span>
                          ) : null}
                          <div className="flex flex-wrap gap-1">
                            {entry.platforms.map((platform) => (
                              <span
                                key={platform}
                                className="inline-flex items-center gap-1 rounded-full bg-graystone-100 px-2 py-1 text-xs text-graystone-600"
                              >
                                <PlatformIcon platform={platform} />
                                {platform}
                              </span>
                            ))}
                          </div>
                        </div>
                        {entry.caption && (
                          <p className="line-clamp-3 text-sm text-graystone-700">{entry.caption}</p>
                        )}
                        {(entry.campaign || entry.contentPillar || entry.testingFrameworkName) && (
                          <div className="flex flex-wrap items-center gap-1 text-[11px] text-graystone-500">
                            {entry.campaign ? (
                              <span className="rounded-full bg-aqua-100 px-2 py-0.5 text-ocean-700">
                                {entry.campaign}
                              </span>
                            ) : null}
                            {entry.contentPillar ? (
                              <span className="rounded-full bg-graystone-100 px-2 py-0.5 text-graystone-700">
                                {entry.contentPillar}
                              </span>
                            ) : null}
                            {entry.testingFrameworkName ? (
                              <span className="rounded-full bg-ocean-500/10 px-2 py-0.5 text-ocean-700">
                                Test: {entry.testingFrameworkName}
                              </span>
                            ) : null}
                          </div>
                        )}
                        <div className="text-xs text-graystone-500">
                          Checklist {completed}/{total}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span
                          className={cx(
                            'rounded-full px-2 py-1 text-xs font-semibold',
                            entry.status === 'Approved' && 'bg-emerald-100 text-emerald-700',
                            entry.status === 'Pending' && 'bg-amber-100 text-amber-700',
                          )}
                        >
                          {entry.status}
                        </span>
                        <div className="flex items-center gap-1">
                          {entry.status !== 'Approved' ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={(event) => {
                                event.stopPropagation();
                                onApprove(entry.id);
                              }}
                              title="Approve entry"
                            >
                              <LoaderIcon className="h-5 w-5 text-amber-600" />
                            </Button>
                          ) : (
                            <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                              Approved
                            </span>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(event) => {
                              event.stopPropagation();
                              const confirmDelete = window.confirm(
                                'Move this item to the trash? You can restore it within 30 days.',
                              );
                              if (confirmDelete) onDelete(entry.id);
                            }}
                            title="Move to trash"
                          >
                            <TrashIcon className="h-5 w-5 text-graystone-500" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default MonthGrid;
