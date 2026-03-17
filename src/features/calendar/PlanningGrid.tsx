import React, { useState, useMemo, useCallback } from 'react';
import { cx, isoFromParts } from '../../lib/utils';

const PLANNING_NOTES_KEY = 'content-hub-planning-notes';

function loadNotes(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(PLANNING_NOTES_KEY) || '{}');
  } catch {
    return {};
  }
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

interface PlanningGridProps {
  days: number[];
  month: number;
  year: number;
}

export function PlanningGrid({ days, month, year }: PlanningGridProps): React.ReactElement {
  const [notes, setNotes] = useState<Record<string, string>>(loadNotes);

  const today = new Date();
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const handleChange = useCallback((iso: string, value: string) => {
    setNotes((prev) => {
      const next = { ...prev };
      if (value) next[iso] = value;
      else delete next[iso];
      return next;
    });
    const stored = loadNotes();
    if (value) stored[iso] = value;
    else delete stored[iso];
    localStorage.setItem(PLANNING_NOTES_KEY, JSON.stringify(stored));
  }, []);

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
    <div role="grid" aria-label="Planning calendar">
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
      <div className="space-y-1">
        {weeks.map((week) => (
          <div key={week.weekKey} className="grid grid-cols-7 gap-1">
            {week.slots.map((day, slotIndex) => {
              if (day === null) {
                return (
                  <div
                    key={`empty-${slotIndex}`}
                    className="min-h-24 rounded-lg bg-graystone-50 opacity-30"
                  />
                );
              }

              const iso = isoFromParts(year, month, day);
              const isToday = iso === todayISO;

              return (
                <div
                  key={iso}
                  className={cx(
                    'flex min-h-24 flex-col overflow-hidden rounded-lg border bg-white',
                    isToday ? 'border-ocean-400' : 'border-graystone-200',
                  )}
                >
                  {/* Day number */}
                  <div
                    className={cx(
                      'border-b px-1.5 py-1',
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
                  </div>

                  {/* Planning text */}
                  <textarea
                    value={notes[iso] ?? ''}
                    onChange={(e) => handleChange(iso, e.target.value)}
                    placeholder="Notes…"
                    aria-label={`Planning notes for ${iso}`}
                    className="flex-1 resize-none bg-transparent p-1 text-[11px] leading-snug text-graystone-700 placeholder-graystone-300 focus:outline-none"
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default PlanningGrid;
