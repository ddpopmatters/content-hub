import React, { useMemo, useState } from 'react';
import { Badge, Button, Card, CardHeader, CardContent, CardTitle } from '../../components/ui';
import { cx } from '../../lib/utils';
import { CONTENT_PILLARS, CAMPAIGNS } from '../../constants';
import type { Entry } from '../../types/models';

export interface NarrativeViewProps {
  entries: Entry[];
  monthCursor: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onOpenEntry: (id: string) => void;
}

// ── Pillar colour map ────────────────────────────────────────────────────────

const PILLAR_COLOURS: Record<string, string> = {
  'Reproductive Rights & Bodily Autonomy': 'bg-pink-100 text-pink-800',
  'Population & Demographics': 'bg-ocean-100 text-ocean-800',
  'Environmental Sustainability': 'bg-emerald-100 text-emerald-800',
  'Social Justice': 'bg-amber-100 text-amber-800',
};

// Abbreviate pillar labels so they fit inside a pill
const PILLAR_SHORT: Record<string, string> = {
  'Reproductive Rights & Bodily Autonomy': 'Rights & Autonomy',
  'Population & Demographics': 'Population',
  'Environmental Sustainability': 'Environment',
  'Social Justice': 'Social Justice',
};

// ── ISO-week helpers ─────────────────────────────────────────────────────────

/** Return the Monday that starts the ISO week containing `date`. */
function isoWeekMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun … 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Format a date as YYYY-MM-DD using local time (avoids UTC shift). */
function toLocalISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse a YYYY-MM-DD string into a local-midnight Date. */
function parseLocalISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

interface WeekBucket {
  /** Unique key — ISO date of Monday */
  weekKey: string;
  /** Display label, e.g. "Week 1 · Mar 3–9" */
  label: string;
  /** Monday of this week (local midnight) */
  monday: Date;
  /** Sunday of this week (local midnight) */
  sunday: Date;
  entries: Entry[];
}

// ── Month summary helpers ────────────────────────────────────────────────────

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
}

// ── Chevron icons ────────────────────────────────────────────────────────────

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

function ChevronDown({ expanded }: { expanded: boolean }): React.ReactElement {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cx('transition-transform duration-200', expanded ? 'rotate-180' : '')}
    >
      <polyline points="4 6 8 10 12 6" />
    </svg>
  );
}

// ── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-2xl bg-graystone-50 px-4 py-3 text-center min-w-0">
      <span className="text-xl font-semibold text-ocean-700 leading-none">{value}</span>
      <span className="text-xs text-graystone-500 mt-1 leading-snug">{label}</span>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function NarrativeView({
  entries,
  monthCursor,
  onPrevMonth,
  onNextMonth,
  onOpenEntry,
}: NarrativeViewProps): React.ReactElement {
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);

  // ── Filter to active entries in this month ─────────────────────────────────

  const monthYear = monthCursor.getFullYear();
  const monthIndex = monthCursor.getMonth();

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

  // ── Build ISO week buckets that overlap with this month ───────────────────

  const weekBuckets = useMemo((): WeekBucket[] => {
    // First and last day of the month
    const firstDay = new Date(monthYear, monthIndex, 1);
    const lastDay = new Date(monthYear, monthIndex + 1, 0);

    // Walk week-by-week starting from the Monday of the first day's ISO week
    const buckets: WeekBucket[] = [];
    let monday = isoWeekMonday(firstDay);
    let weekNumber = 1;

    while (monday <= lastDay) {
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      const weekKey = toLocalISO(monday);

      // Determine display date range — clamp to month boundaries for clarity
      const displayStart = monday < firstDay ? firstDay : monday;
      const displayEnd = sunday > lastDay ? lastDay : sunday;

      const label = `Week ${weekNumber} · ${formatShortDate(displayStart)}–${displayEnd.getDate()}`;

      // Entries falling within Mon–Sun of this week (regardless of month)
      const weekEntries = activeEntries.filter((e) => {
        const d = parseLocalISO(e.date);
        return d >= monday && d <= sunday;
      });

      buckets.push({ weekKey, label, monday, sunday, entries: weekEntries });

      // Advance to next Monday
      const nextMonday = new Date(monday);
      nextMonday.setDate(monday.getDate() + 7);
      monday = nextMonday;
      weekNumber++;
    }

    return buckets;
  }, [activeEntries, monthYear, monthIndex]);

  // ── Month summary stats ────────────────────────────────────────────────────

  const summaryStats = useMemo(() => {
    const pillarsPresent = new Set(activeEntries.map((e) => e.contentPillar).filter(Boolean));
    const platformsPresent = new Set(
      activeEntries.flatMap((e) => (Array.isArray(e.platforms) ? e.platforms : [])),
    );
    const approvedCount = activeEntries.filter(
      (e) => e.status === 'Approved' || e.workflowStatus === 'Approved',
    ).length;

    return {
      total: activeEntries.length,
      pillars: pillarsPresent.size,
      platforms: [...platformsPresent].sort().join(', ') || '—',
      approved: approvedCount,
    };
  }, [activeEntries]);

  // ── Toggle week expansion ──────────────────────────────────────────────────

  function toggleWeek(weekKey: string) {
    setExpandedWeek((prev) => (prev === weekKey ? null : weekKey));
  }

  // ── Render ─────────────────────────────────────────────────────────────────

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

      {/* Month summary bar */}
      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-sm font-semibold text-graystone-500 uppercase tracking-wide">
            Month at a glance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatPill label="Total entries" value={String(summaryStats.total)} />
            <StatPill
              label="Pillars covered"
              value={`${summaryStats.pillars} / ${CONTENT_PILLARS.length}`}
            />
            <StatPill
              label={summaryStats.platforms === '—' ? 'Platforms' : 'Platforms active'}
              value={summaryStats.platforms}
            />
            <StatPill label="Approved" value={String(summaryStats.approved)} />
          </div>
        </CardContent>
      </Card>

      {/* Week-by-week grid */}
      <div className="flex flex-col gap-3">
        {weekBuckets.map((week) => {
          const isExpanded = expandedWeek === week.weekKey;
          const isEmpty = week.entries.length === 0;

          // Unique pillars this week
          const weekPillars = CONTENT_PILLARS.filter((p) =>
            week.entries.some((e) => e.contentPillar === p),
          );

          // Unique campaigns this week
          const weekCampaigns = CAMPAIGNS.filter((c) => week.entries.some((e) => e.campaign === c));

          // Unique platforms this week
          const weekPlatforms = [
            ...new Set(
              week.entries.flatMap((e) => (Array.isArray(e.platforms) ? e.platforms : [])),
            ),
          ];

          return (
            <Card key={week.weekKey} className="overflow-hidden">
              {/* Week row — clickable header */}
              <button
                type="button"
                onClick={() => toggleWeek(week.weekKey)}
                className={cx(
                  'w-full text-left px-5 py-4 flex flex-col gap-3 transition-colors',
                  'hover:bg-graystone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aqua-400 focus-visible:ring-inset',
                  isExpanded && 'bg-graystone-50',
                )}
                aria-expanded={isExpanded}
              >
                {/* Week label + count + expand toggle */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="font-semibold text-ocean-900 text-sm">{week.label}</span>
                    <Badge variant={isEmpty ? 'secondary' : 'primary'} className="text-xs">
                      {week.entries.length} {week.entries.length === 1 ? 'entry' : 'entries'}
                    </Badge>
                    {isEmpty && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2.5 py-0.5 text-xs font-semibold">
                        No content planned
                      </span>
                    )}
                  </div>
                  <ChevronDown expanded={isExpanded} />
                </div>

                {/* Pillars row */}
                {weekPillars.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <span className="text-xs text-graystone-400 w-16 shrink-0">Pillars</span>
                    {weekPillars.map((pillar) => (
                      <span
                        key={pillar}
                        className={cx(
                          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
                          PILLAR_COLOURS[pillar] ?? 'bg-graystone-100 text-graystone-700',
                        )}
                      >
                        {PILLAR_SHORT[pillar] ?? pillar}
                      </span>
                    ))}
                  </div>
                )}

                {/* Campaigns row */}
                {weekCampaigns.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <span className="text-xs text-graystone-400 w-16 shrink-0">Campaigns</span>
                    {weekCampaigns.map((campaign) => (
                      <Badge key={campaign} variant="outline" className="text-xs">
                        {campaign}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Platforms row */}
                {weekPlatforms.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <span className="text-xs text-graystone-400 w-16 shrink-0">Platforms</span>
                    {weekPlatforms.map((platform) => (
                      <span
                        key={platform}
                        className="inline-flex items-center rounded-full bg-graystone-100 text-graystone-700 px-2.5 py-0.5 text-xs font-medium"
                      >
                        {platform}
                      </span>
                    ))}
                  </div>
                )}
              </button>

              {/* Expanded entry list */}
              {isExpanded && week.entries.length > 0 && (
                <div className="border-t border-graystone-100">
                  <ul className="divide-y divide-graystone-100">
                    {week.entries.map((entry) => {
                      const entryDate = parseLocalISO(entry.date);
                      const entryDateLabel = entryDate.toLocaleDateString('en-GB', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      });
                      const entryPlatforms = Array.isArray(entry.platforms) ? entry.platforms : [];

                      return (
                        <li key={entry.id}>
                          <button
                            type="button"
                            onClick={() => onOpenEntry(entry.id)}
                            className={cx(
                              'w-full text-left px-5 py-3 flex flex-col gap-1.5',
                              'hover:bg-ocean-50 transition-colors',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aqua-400 focus-visible:ring-inset',
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <span className="text-sm font-medium text-graystone-900 leading-snug line-clamp-2">
                                {entry.caption ? entry.caption.slice(0, 120) : '(No caption)'}
                              </span>
                              <span className="text-xs text-graystone-400 whitespace-nowrap shrink-0 mt-0.5">
                                {entryDateLabel}
                              </span>
                            </div>

                            {/* Platform chips */}
                            {entryPlatforms.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {entryPlatforms.map((p) => (
                                  <span
                                    key={p}
                                    className="inline-flex items-center rounded-full bg-ocean-50 text-ocean-700 px-2 py-0.5 text-xs font-medium"
                                  >
                                    {p}
                                  </span>
                                ))}
                              </div>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Expanded — empty state */}
              {isExpanded && week.entries.length === 0 && (
                <div className="border-t border-graystone-100 px-5 py-4">
                  <p className="text-sm text-graystone-400 italic">
                    No entries scheduled for this week.
                  </p>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
