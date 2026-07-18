import React, { useMemo } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '../../components/ui';
import { cx, daysInMonth, isoFromParts } from '../../lib/utils';
import { WEEKDAY_LABELS } from '../../constants';
import type { Entry } from '../../types/models';

export interface MiniCalendarProps {
  /** Date cursor indicating the month to display */
  monthCursor: Date;
  /** List of entries to display */
  entries: Entry[];
  /** Callback when an entry dot is clicked */
  onPreviewEntry?: (entry: Entry) => void;
}

interface CalendarCell {
  key: string;
  inMonth: boolean;
  label?: number;
  iso?: string;
  entries?: Entry[];
}

/**
 * MiniCalendar - Compact calendar widget showing month overview with entry dots
 */
export const MiniCalendar: React.FC<MiniCalendarProps> = ({
  monthCursor,
  entries,
  onPreviewEntry,
}) => {
  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  const totalDays = daysInMonth(year, month);
  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalCells = Math.ceil((firstDayIndex + totalDays) / 7) * 7;

  const entriesByDate = useMemo(() => {
    const map = new Map<string, Entry[]>();
    entries.forEach((entry) => {
      if (!entry?.date) return;
      const list = map.get(entry.date) || [];
      list.push(entry);
      map.set(entry.date, list);
    });
    return map;
  }, [entries]);

  const cells = useMemo(() => {
    const items: CalendarCell[] = [];
    for (let i = 0; i < totalCells; i += 1) {
      const dayNumber = i - firstDayIndex + 1;
      const inMonth = dayNumber >= 1 && dayNumber <= totalDays;
      if (!inMonth) {
        items.push({ key: `pad-${i}`, inMonth: false });
        continue;
      }
      const iso = isoFromParts(year, month, dayNumber);
      const dayEntries = entriesByDate.get(iso) || [];
      items.push({
        key: iso,
        inMonth: true,
        label: dayNumber,
        iso,
        entries: dayEntries,
      });
    }
    return items;
  }, [entriesByDate, firstDayIndex, month, totalCells, totalDays, year]);

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="text-base text-ocean-900">Month at a glance</CardTitle>
        <p className="text-xs text-graystone-500">Tap a turquoise dot to preview that post.</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-semibold uppercase text-graystone-400">
          {WEEKDAY_LABELS.map((label, index) => (
            <span key={`${label}-${index}`}>{label}</span>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-2 text-xs">
          {cells.map((cell) => {
            if (!cell.inMonth) {
              return (
                <div
                  key={cell.key}
                  className="min-h-[56px] rounded-xl border border-transparent bg-transparent"
                />
              );
            }
            const hasEntries = cell.entries && cell.entries.length > 0;
            return (
              <div
                key={cell.key}
                className={cx(
                  'min-h-[64px] rounded-xl border px-2 py-2',
                  hasEntries ? 'border-[#00F5FF]/60 bg-[#E8FBFF]' : 'border-graystone-200 bg-white',
                )}
              >
                <div className="text-[11px] font-semibold text-graystone-700">{cell.label}</div>
                {hasEntries ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {cell.entries!.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => onPreviewEntry?.(entry)}
                        className="h-3 w-3 rounded-full bg-[#00F5FF] text-transparent transition hover:scale-125 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00F5FF]"
                        title={`${entry.assetType} • ${entry.platforms?.join(', ') || ''}`}
                        aria-label={`Open ${entry.assetType} planned for ${new Date(entry.date).toLocaleDateString()}`}
                      >
                        •
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 text-[10px] text-graystone-300">—</div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default MiniCalendar;
