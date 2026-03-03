import React, { useMemo } from 'react';
import { Button } from '../../components/ui';
import { cx } from '../../lib/utils';
import { KANBAN_STATUSES, PRIORITY_TIERS, PRIORITY_TIER_BADGE_CLASSES } from '../../constants';
import type { Entry, PriorityTier } from '../../types/models';

export interface MonthlyGlanceProps {
  entries: Entry[];
  monthCursor: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onOpenEntry: (id: string) => void;
  onUpdate: (updates: { id: string } & Partial<Entry>) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function toLocalISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseLocalISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function isoWeekMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' });
}

interface WeekGroup {
  weekKey: string;
  label: string;
  entries: Entry[];
}

// ── Status select ─────────────────────────────────────────────────────────────

function StatusSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}): React.ReactElement {
  const current = (KANBAN_STATUSES as readonly string[]).includes(value) ? value : 'Draft';
  return (
    <select
      value={current}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      className={cx(
        'rounded-lg border px-2 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ocean-400',
        current === 'Approved'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : current === 'Published'
            ? 'border-ocean-200 bg-ocean-50 text-ocean-700'
            : 'border-graystone-200 bg-white text-graystone-600',
      )}
    >
      {KANBAN_STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

// ── Priority select ───────────────────────────────────────────────────────────

function PrioritySelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}): React.ReactElement {
  const current = (
    (PRIORITY_TIERS as readonly string[]).includes(value) ? value : 'Medium'
  ) as PriorityTier;
  return (
    <select
      value={current}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      className={cx(
        'rounded-lg border px-2 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ocean-400',
        PRIORITY_TIER_BADGE_CLASSES[current] ?? 'border-graystone-200 bg-white text-graystone-600',
      )}
    >
      {PRIORITY_TIERS.map((p) => (
        <option key={p} value={p}>
          {p}
        </option>
      ))}
    </select>
  );
}

// ── Chevron icons ─────────────────────────────────────────────────────────────

function ChevronLeft(): React.ReactElement {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="10 12 6 8 10 4" />
    </svg>
  );
}

function ChevronRight(): React.ReactElement {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 4 10 8 6 12" />
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function MonthlyGlance({
  entries,
  monthCursor,
  onPrevMonth,
  onNextMonth,
  onOpenEntry,
  onUpdate,
}: MonthlyGlanceProps): React.ReactElement {
  const monthYear = monthCursor.getFullYear();
  const monthIndex = monthCursor.getMonth();

  // Filter to active entries in this month
  const activeEntries = useMemo(
    () =>
      entries.filter((e) => {
        if (e.deletedAt) return false;
        if (!e.date) return false;
        const d = parseLocalISO(e.date);
        return d.getFullYear() === monthYear && d.getMonth() === monthIndex;
      }),
    [entries, monthYear, monthIndex],
  );

  // Sort entries by date ascending
  const sortedEntries = useMemo(
    () => [...activeEntries].sort((a, b) => a.date.localeCompare(b.date)),
    [activeEntries],
  );

  // Group into ISO week buckets
  const weekGroups = useMemo((): WeekGroup[] => {
    const firstDay = new Date(monthYear, monthIndex, 1);
    const lastDay = new Date(monthYear, monthIndex + 1, 0);

    const groups: WeekGroup[] = [];
    let monday = isoWeekMonday(firstDay);
    let weekNumber = 1;

    while (monday <= lastDay) {
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      const weekKey = toLocalISO(monday);
      const displayStart = monday < firstDay ? firstDay : monday;
      const displayEnd = sunday > lastDay ? lastDay : sunday;

      const label = `Week ${weekNumber} · ${formatShortDate(displayStart)}–${displayEnd.getDate()}`;

      const weekEntries = sortedEntries.filter((e) => {
        const d = parseLocalISO(e.date);
        return d >= monday && d <= sunday;
      });

      groups.push({ weekKey, label, entries: weekEntries });

      const nextMonday = new Date(monday);
      nextMonday.setDate(monday.getDate() + 7);
      monday = nextMonday;
      weekNumber++;
    }

    return groups;
  }, [sortedEntries, monthYear, monthIndex]);

  const isEmpty = sortedEntries.length === 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Month header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-ocean-900">{formatMonthYear(monthCursor)}</h2>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onPrevMonth} aria-label="Previous month">
            <ChevronLeft />
          </Button>
          <Button variant="ghost" size="icon" onClick={onNextMonth} aria-label="Next month">
            <ChevronRight />
          </Button>
        </div>
      </div>

      {/* Summary count */}
      <p className="text-sm text-graystone-500">
        {isEmpty
          ? 'No entries scheduled this month.'
          : `${sortedEntries.length} ${sortedEntries.length === 1 ? 'entry' : 'entries'} planned`}
      </p>

      {/* Table */}
      {!isEmpty && (
        <div className="overflow-x-auto rounded-xl border border-graystone-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-graystone-200 bg-graystone-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-graystone-500 w-36">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-graystone-500">
                  Caption
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-graystone-500 w-32">
                  Platforms
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-graystone-500 w-40">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-graystone-500 w-32">
                  Priority
                </th>
              </tr>
            </thead>
            <tbody>
              {weekGroups.map((group) => (
                <React.Fragment key={group.weekKey}>
                  {/* Week separator row */}
                  <tr className="bg-graystone-50/60">
                    <td
                      colSpan={5}
                      className="border-b border-t border-graystone-100 px-4 py-1.5 text-xs font-semibold text-graystone-400 uppercase tracking-wide"
                    >
                      {group.label}
                      {group.entries.length === 0 && (
                        <span className="ml-2 font-normal text-amber-500 normal-case">
                          — no content planned
                        </span>
                      )}
                    </td>
                  </tr>

                  {/* Entry rows */}
                  {group.entries.map((entry) => {
                    const entryDate = parseLocalISO(entry.date);
                    const dateLabel = entryDate.toLocaleDateString('en-GB', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    });
                    const platforms = Array.isArray(entry.platforms) ? entry.platforms : [];
                    const status = entry.workflowStatus || entry.status || 'Draft';
                    const priority = entry.priorityTier || 'Medium';

                    return (
                      <tr
                        key={entry.id}
                        className="group border-b border-graystone-100 transition-colors hover:bg-ocean-50/40 last:border-b-0"
                      >
                        {/* Date */}
                        <td className="px-4 py-3 text-xs text-graystone-500 whitespace-nowrap">
                          {dateLabel}
                        </td>

                        {/* Caption — clickable */}
                        <td className="px-4 py-3 max-w-xs">
                          <button
                            type="button"
                            onClick={() => onOpenEntry(entry.id)}
                            className="text-left text-sm text-graystone-800 line-clamp-2 hover:text-ocean-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-400 rounded"
                          >
                            {entry.caption ? (
                              entry.caption.slice(0, 120)
                            ) : (
                              <span className="text-graystone-400 italic">No caption</span>
                            )}
                          </button>
                        </td>

                        {/* Platforms */}
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {platforms.slice(0, 3).map((p) => (
                              <span
                                key={p}
                                className="inline-block rounded-full bg-ocean-50 px-2 py-0.5 text-[10px] font-medium text-ocean-700"
                              >
                                {p}
                              </span>
                            ))}
                            {platforms.length > 3 && (
                              <span className="text-[10px] text-graystone-400">
                                +{platforms.length - 3}
                              </span>
                            )}
                            {platforms.length === 0 && (
                              <span className="text-xs text-graystone-400">—</span>
                            )}
                          </div>
                        </td>

                        {/* Status — inline edit */}
                        <td className="px-4 py-3">
                          <StatusSelect
                            value={status}
                            onChange={(v) =>
                              onUpdate({ id: entry.id, workflowStatus: v, status: v })
                            }
                          />
                        </td>

                        {/* Priority — inline edit */}
                        <td className="px-4 py-3">
                          <PrioritySelect
                            value={priority}
                            onChange={(v) =>
                              onUpdate({ id: entry.id, priorityTier: v as PriorityTier })
                            }
                          />
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default MonthlyGlance;
