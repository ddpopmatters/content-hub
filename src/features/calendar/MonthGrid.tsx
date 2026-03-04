import React, {
  useMemo,
  useState,
  useRef,
  useCallback,
  useEffect,
  type KeyboardEvent,
} from 'react';
import { PlatformIcon, LoaderIcon } from '../../components/common';
import { cx, isoFromParts } from '../../lib/utils';
import { ensureChecklist } from '../../lib/sanitizers';
import {
  getChecklistItemsForEntry,
  PRIORITY_TIERS,
  PRIORITY_TIER_BORDER_CLASSES,
} from '../../constants';
import type { Entry } from '../../types/models';

const THEMES_KEY = 'content-hub-calendar-themes';

function loadThemes(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(THEMES_KEY) || '{}');
  } catch {
    return {};
  }
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

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
  onDelete: _onDelete,
  onOpen,
  onDateChange,
  dailyPostTarget = 0,
}: MonthGridProps): React.ReactElement {
  const [focusedDayIndex, setFocusedDayIndex] = useState(0);
  const [focusedEntryIndex, setFocusedEntryIndex] = useState(-1);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [themes, setThemes] = useState<Record<string, string>>(loadThemes);
  const dayRefs = useRef<(HTMLDivElement | null)[]>([]);
  const entryRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const today = new Date();
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const monthThemeKey = `${year}-${String(month + 1).padStart(2, '0')}`;

  const handleThemeChange = useCallback((key: string, value: string) => {
    setThemes((prev) => {
      const next = { ...prev };
      if (value.trim()) next[key] = value;
      else delete next[key];
      return next;
    });
    const stored = loadThemes();
    if (value.trim()) stored[key] = value;
    else delete stored[key];
    localStorage.setItem(THEMES_KEY, JSON.stringify(stored));
  }, []);

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

  useEffect(() => {
    setFocusedDayIndex(0);
    setFocusedEntryIndex(-1);
    setSelectedDay(null);
    dayRefs.current = [];
    entryRefs.current = {};
  }, [days, month, year]);

  const handleDayKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>, dayIndex: number, dayEntries: Entry[]) => {
      const columnsPerRow = 7;

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
            setFocusedEntryIndex(0);
            const iso = isoFromParts(year, month, days[dayIndex]);
            entryRefs.current[`${iso}-0`]?.focus();
          } else {
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

  // Split days into week rows, padding leading slots for first day of month
  const weeks = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const result: { weekKey: string; slots: (number | null)[] }[] = [];
    let currentSlots: (number | null)[] = Array(firstDayOfMonth).fill(null);

    for (const day of days) {
      currentSlots.push(day);
      if (currentSlots.length === 7) {
        const firstActual = currentSlots.find((d) => d !== null) as number;
        result.push({ weekKey: isoFromParts(year, month, firstActual), slots: currentSlots });
        currentSlots = [];
      }
    }

    if (currentSlots.length > 0) {
      while (currentSlots.length < 7) currentSlots.push(null);
      const firstActual = currentSlots.find((d) => d !== null) as number;
      result.push({ weekKey: isoFromParts(year, month, firstActual), slots: currentSlots });
    }

    return result;
  }, [days, month, year]);

  return (
    <div role="grid" aria-label="Calendar month view">
      {/* Month theme */}
      <input
        type="text"
        value={themes[monthThemeKey] ?? ''}
        onChange={(e) => handleThemeChange(monthThemeKey, e.target.value)}
        placeholder={`Add a theme for ${new Date(year, month).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}…`}
        className="mb-3 w-full rounded-xl border border-ocean-200 bg-ocean-50 px-3 py-1.5 text-sm font-medium text-ocean-800 placeholder-graystone-400 focus:outline-none focus:ring-2 focus:ring-ocean-300"
      />

      {/* Day-of-week headers */}
      <div className="mb-1 grid grid-cols-7 gap-1">
        {DAY_LABELS.map((label) => (
          <div
            key={label}
            className="py-1 text-center text-[11px] font-semibold uppercase tracking-wide text-graystone-500"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Week rows */}
      <div className="space-y-3">
        {weeks.map((week) => (
          <div key={week.weekKey}>
            {/* Week theme */}
            <input
              type="text"
              value={themes[week.weekKey] ?? ''}
              onChange={(e) => handleThemeChange(week.weekKey, e.target.value)}
              placeholder="Week theme…"
              className="mb-1 w-full rounded border-0 border-b border-graystone-100 bg-transparent px-1 py-0.5 text-xs font-medium text-graystone-600 placeholder-graystone-300 focus:border-ocean-300 focus:bg-aqua-50 focus:outline-none"
            />

            {/* 7-column day grid */}
            <div className="grid grid-cols-7 gap-1">
              {week.slots.map((day, slotIndex) => {
                if (day === null) {
                  return (
                    <div
                      key={`empty-${slotIndex}`}
                      className="min-h-20 rounded-lg bg-graystone-50 opacity-30"
                    />
                  );
                }

                const dayIndex = day - 1;
                const iso = isoFromParts(year, month, day);
                const dayEntries = byDate.get(iso) || [];
                const isSelected = selectedDay === dayIndex;
                const isFocusedDay = focusedDayIndex === dayIndex;
                const isDragOver = dragOverDate === iso;
                const isToday = iso === todayISO;

                return (
                  <div
                    key={iso}
                    ref={(el) => {
                      dayRefs.current[dayIndex] = el;
                    }}
                    tabIndex={isFocusedDay ? 0 : -1}
                    role="gridcell"
                    aria-selected={isSelected}
                    aria-label={`${day}, ${dayEntries.length} ${dayEntries.length === 1 ? 'item' : 'items'}`}
                    onKeyDown={(e) => handleDayKeyDown(e, dayIndex, dayEntries)}
                    onDragOver={(e) => handleDragOver(e, iso)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, iso)}
                    className={cx(
                      'flex min-h-20 flex-col overflow-hidden rounded-lg border bg-white outline-none transition-colors',
                      'focus:ring-2 focus:ring-aqua-500 focus:ring-offset-1',
                      isToday ? 'border-ocean-400' : 'border-graystone-200',
                      isSelected && 'ring-2 ring-ocean-500 ring-offset-1',
                      isDragOver && 'bg-aqua-100 ring-2 ring-aqua-400',
                    )}
                  >
                    {/* Day header */}
                    <div
                      className={cx(
                        'flex items-center justify-between border-b px-1.5 py-1',
                        isToday ? 'border-ocean-200 bg-ocean-50' : 'border-graystone-100',
                      )}
                    >
                      <span
                        className={cx(
                          'text-xs font-semibold',
                          isToday ? 'text-ocean-700' : 'text-graystone-700',
                        )}
                      >
                        {day}
                      </span>
                      <div className="flex items-center gap-0.5">
                        {dailyPostTarget > 0 && dayEntries.length < dailyPostTarget && (
                          <span className="text-[9px] font-bold text-amber-500" title="Content gap">
                            !
                          </span>
                        )}
                        {dayEntries.length > 0 && (
                          <span className="text-[9px] text-graystone-400">{dayEntries.length}</span>
                        )}
                      </div>
                    </div>

                    {/* Entries */}
                    <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-1">
                      {dayEntries.map((entry, entryIndex) => {
                        const checklist = ensureChecklist(entry.checklist);
                        const relevantItems = getChecklistItemsForEntry(
                          entry.platforms,
                          entry.assetType,
                        );
                        const completed = relevantItems.filter(({ key }) => checklist[key]).length;
                        const total = relevantItems.length;
                        const isFocusedEntry = isFocusedDay && focusedEntryIndex === entryIndex;
                        const priorityTier = PRIORITY_TIERS.includes(entry.priorityTier)
                          ? entry.priorityTier
                          : 'Medium';
                        const borderClass = PRIORITY_TIER_BORDER_CLASSES[priorityTier];

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
                              'group cursor-pointer rounded border-l-2 bg-graystone-50 px-1 py-0.5 outline-none transition',
                              'hover:bg-aqua-50 focus:ring-1 focus:ring-aqua-400',
                              onDateChange && 'cursor-grab active:cursor-grabbing',
                              borderClass,
                            )}
                          >
                            {/* Platform icons */}
                            <div className="flex min-w-0 items-center gap-0.5">
                              {entry.platforms.slice(0, 2).map((p) => (
                                <React.Fragment key={p}>
                                  <PlatformIcon platform={p} />
                                </React.Fragment>
                              ))}
                              {entry.platforms.length > 2 && (
                                <span className="text-[9px] text-graystone-400">
                                  +{entry.platforms.length - 2}
                                </span>
                              )}
                            </div>
                            {/* Caption */}
                            <p className="truncate text-[10px] leading-tight text-graystone-700">
                              {entry.caption || entry.assetType}
                            </p>
                            {/* Checklist + approve */}
                            <div className="flex items-center justify-between">
                              {total > 0 && (
                                <span
                                  className={cx(
                                    'text-[9px]',
                                    completed === total ? 'text-emerald-600' : 'text-graystone-400',
                                  )}
                                >
                                  {completed}/{total}
                                </span>
                              )}
                              {entry.status !== 'Approved' && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onApprove(entry.id);
                                  }}
                                  className="hidden items-center text-[9px] text-amber-600 hover:text-amber-700 group-hover:flex"
                                  title="Approve"
                                >
                                  <LoaderIcon className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default MonthGrid;
