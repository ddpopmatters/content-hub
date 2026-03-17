import React, { useState, useMemo, useCallback, type ChangeEvent } from 'react';
import { Card, CardContent, Button, Input, Label, Toggle, MultiSelect } from '../../components/ui';
import { PlatformIcon, CalendarIcon } from '../../components/common';
import { downloadICS, exportEntriesForDateRange } from '../../lib/exportUtils';
import { isApprovalOverdue, matchesSearch } from '../../lib/filters';
import { cx, daysInMonth, monthStartISO, monthEndISO } from '../../lib/utils';
import { selectBaseClasses } from '../../lib/styles';
import { ALL_PLATFORMS, KANBAN_STATUSES, PRIORITY_TIERS } from '../../constants';
import MonthGrid from './MonthGrid';
import PlanningGrid from './PlanningGrid';
import WeekGrid from './WeekGrid';
import { MonthlyGlance } from './MonthlyGlance';
import UpcomingDeadlines from './UpcomingDeadlines';
import { KanbanView } from '../kanban';
import BulkDateShift from './BulkDateShift';
import { SavedFilters, loadFilterPresets, saveFilterPresets } from './SavedFilters';
import type { FilterPreset } from './SavedFilters';
import type { Entry } from '../../types/models';

type CalendarViewMode = 'month' | 'week' | 'board' | 'glance';

/** Get the Sunday of the week containing the given date */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Get the Saturday of the week containing the given date */
function getWeekEnd(date: Date): Date {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return end;
}

function formatLocalISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

interface PlatformFilterProps {
  value: string[];
  onChange: (value: string[]) => void;
}

function PlatformFilter({ value, onChange }: PlatformFilterProps): React.ReactElement {
  return (
    <MultiSelect
      placeholder="All platforms"
      value={value}
      onChange={onChange}
      options={ALL_PLATFORMS.map((platform) => ({
        value: platform,
        label: platform,
        icon: <PlatformIcon platform={platform} />,
      }))}
    />
  );
}

interface AssetMixPieProps {
  counts: Record<string, number>;
  total: number;
}

function AssetMixPie({ counts, total }: AssetMixPieProps): React.ReactElement | null {
  const palette: Record<string, string> = {
    Video: '#2563eb',
    Design: '#1d4ed8',
    Carousel: '#60a5fa',
  };
  const entries = ['Video', 'Design', 'Carousel']
    .map((type) => ({ type, value: counts[type] || 0 }))
    .filter((item) => item.value > 0);
  if (!entries.length || !total) return null;
  let cumulative = 0;
  const segments = entries.map(({ type, value }) => {
    const start = (cumulative / total) * 100;
    cumulative += value;
    const end = (cumulative / total) * 100;
    const color = palette[type] || '#2563eb';
    return `${color} ${start}% ${end}%`;
  });
  const gradient = `conic-gradient(${segments.join(', ')})`;

  return (
    <div className="flex items-center gap-4">
      <div
        className="h-16 w-16 rounded-full border border-aqua-200"
        style={{ background: gradient }}
      />
      <div className="space-y-1 text-xs text-graystone-600">
        {entries.map(({ type, value }) => {
          const color = palette[type] || '#2563eb';
          const percentage = Math.round((value / total) * 100);
          return (
            <div key={type} className="flex items-center gap-2">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="font-medium text-graystone-700">{type}</span>
              <span>
                {value} ({percentage}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface AssetRatioCardProps {
  summary: { counts: Record<string, number>; total: number } | null;
  monthLabel: string;
  goals: Record<string, number> | null;
  onGoalsChange: ((goals: Record<string, number>) => void) | null;
}

function AssetRatioCard({
  summary,
  monthLabel,
  goals,
  onGoalsChange,
}: AssetRatioCardProps): React.ReactElement {
  const baseCounts = summary?.counts || {};
  const total = summary?.total || 0;
  const counts = baseCounts;
  const adjustedTotal = total;
  const types = ['Video', 'Design', 'Carousel'];

  const goalTotal =
    Object.values(goals || {}).reduce((acc, value) => acc + Number(value || 0), 0) || 100;
  const normalizedGoals = types.reduce<Record<string, number>>((acc, type) => {
    const raw = Number(goals?.[type] || 0);
    acc[type] = goalTotal ? Math.round((raw / goalTotal) * 100) : 0;
    return acc;
  }, {});

  const handleGoalChange = (type: string, value: string) => {
    const next = Math.max(0, Math.min(100, Number(value) || 0));
    onGoalsChange?.({
      ...(goals ?? {}),
      [type]: next,
    });
  };

  return (
    <Card className="shadow-md">
      <CardContent className="pt-4">
        <div className="mb-3">
          <div className="text-base font-semibold text-ocean-900">Asset ratio</div>
          <p className="text-xs text-graystone-500">{monthLabel}</p>
        </div>
        {adjustedTotal === 0 ? (
          <p className="text-sm text-graystone-500">No assets scheduled for this month yet.</p>
        ) : (
          <>
            <div className="mb-4 flex justify-center">
              <AssetMixPie counts={counts} total={adjustedTotal} />
            </div>
            <div className="space-y-2 text-xs">
              {types.map((type) => {
                const value = counts[type] || 0;
                const percent = value === 0 ? 0 : Math.round((value / adjustedTotal) * 100);
                const goalPercent = normalizedGoals[type] || 0;
                return (
                  <div key={type} className="flex items-center justify-between gap-3">
                    <div>
                      <span className="font-medium text-graystone-700">{type}</span>
                      <span className="ml-1 text-graystone-400">| goal {goalPercent}%</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-graystone-600">
                        {percent}% ({value})
                      </div>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={goals?.[type] ?? 0}
                        onChange={(event) => handleGoalChange(type, event.target.value)}
                        className="dropdown-font w-16 rounded-full border border-black px-3 py-1 text-xs"
                        aria-label={`Goal percentage for ${type}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export interface CalendarViewProps {
  /** All calendar entries */
  entries: Entry[];
  /** Controlled month cursor (shared with Narrative / Glance tabs) */
  monthCursor: Date;
  /** Called when the user navigates to a new month */
  onMonthChange: (date: Date) => void;
  /** Callback when entry is approved */
  onApprove: (id: string) => void;
  /** Callback when entry is deleted */
  onDelete: (id: string) => void;
  /** Callback when entry is opened */
  onOpenEntry: (id: string) => void;
  /** Callback to import performance data */
  onImportPerformance: () => void;
  /** Asset type goals (percentage targets) */
  assetGoals: Record<string, number> | null;
  /** Callback when goals change */
  onGoalsChange: ((goals: Record<string, number>) => void) | null;
  /** Callback when entry date is changed via drag-and-drop */
  onEntryDateChange?: (entryId: string, newDate: string) => void;
  /** Daily post target for content gap indicators */
  dailyPostTarget?: number;
  /** Callback when daily post target changes */
  onDailyPostTargetChange?: (target: number) => void;
  /** Callback when bulk date shift is applied */
  onBulkDateShift?: (entryIds: string[], daysDelta: number) => void;
  /** Callback to update workflow status (used by Board view) */
  onUpdateStatus?: (id: string, status: string) => void;
  /** Callback to update an entry (used by Glance view) */
  onUpdate?: (updates: { id: string } & Partial<Entry>) => void;
  /** Number of outstanding approvals — shows sidebar card when provided */
  outstandingCount?: number;
  /** Opens the approvals modal — shows sidebar card when provided */
  onOpenApprovals?: () => void;
  /** Number of open opportunities — shows sidebar card when provided */
  openOpportunitiesCount?: number;
  /** Opens the opportunities modal — shows sidebar card when provided */
  onOpenOpportunities?: () => void;
}

export function CalendarView({
  entries,
  monthCursor,
  onMonthChange,
  onApprove,
  onDelete: _onDelete,
  onOpenEntry,
  onImportPerformance,
  assetGoals,
  onGoalsChange,
  onEntryDateChange,
  dailyPostTarget = 0,
  onDailyPostTargetChange,
  onBulkDateShift,
  onUpdateStatus,
  onUpdate,
  outstandingCount,
  onOpenApprovals,
  openOpportunitiesCount,
  onOpenOpportunities,
}: CalendarViewProps): React.ReactElement {
  // View mode and week navigation (week cursor stays internal)
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [weekCursor, setWeekCursor] = useState(() => getWeekStart(new Date()));
  const [calendarLayer, setCalendarLayer] = useState<'confirmed' | 'planning'>('confirmed');

  // Panel visibility
  const [showFilters, setShowFilters] = useState(false);
  const [showExport, setShowExport] = useState(false);

  // Filter state
  const [filterType, setFilterType] = useState('All');
  const [filterWorkflow, setFilterWorkflow] = useState('All');
  const [filterPriority, setFilterPriority] = useState('All');
  const [filterPlatforms, setFilterPlatforms] = useState<string[]>([]);
  const [filterQuery, setFilterQuery] = useState('');
  const [filterOverdue, setFilterOverdue] = useState(false);
  const [filterEvergreen, setFilterEvergreen] = useState(false);

  // Export state
  const [useCustomExportRange, setUseCustomExportRange] = useState(false);
  const [customExportStartDate, setCustomExportStartDate] = useState('');
  const [customExportEndDate, setCustomExportEndDate] = useState('');

  // Saved filter presets
  const [filterPresets, setFilterPresets] = useState<FilterPreset[]>(() => loadFilterPresets());

  // Computed values
  const monthLabel = monthCursor.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const days = useMemo(
    () =>
      Array.from(
        { length: daysInMonth(monthCursor.getFullYear(), monthCursor.getMonth()) },
        (_, index) => index + 1,
      ),
    [monthCursor],
  );

  const startISO = monthStartISO(monthCursor);
  const endISO = monthEndISO(monthCursor);
  const weekEnd = getWeekEnd(weekCursor);
  const weekStartISO = formatLocalISO(weekCursor);
  const weekEndISO = formatLocalISO(weekEnd);
  const visibleExportStartDate = viewMode === 'month' ? startISO : weekStartISO;
  const visibleExportEndDate = viewMode === 'month' ? endISO : weekEndISO;
  const exportStartDate = useCustomExportRange
    ? customExportStartDate || visibleExportStartDate
    : visibleExportStartDate;
  const exportEndDate = useCustomExportRange
    ? customExportEndDate || visibleExportEndDate
    : visibleExportEndDate;
  const hasValidExportRange = Boolean(
    exportStartDate && exportEndDate && exportStartDate <= exportEndDate,
  );
  const monthEntryTotal = useMemo(
    () =>
      entries.filter((entry) => !entry.deletedAt && entry.date >= startISO && entry.date <= endISO)
        .length,
    [entries, startISO, endISO],
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterType !== 'All') count += 1;
    if (filterWorkflow !== 'All') count += 1;
    if (filterPriority !== 'All') count += 1;
    if (filterPlatforms.length) count += 1;
    if (filterQuery.trim()) count += 1;
    if (filterOverdue) count += 1;
    if (filterEvergreen) count += 1;
    return count;
  }, [
    filterType,
    filterWorkflow,
    filterPriority,
    filterPlatforms,
    filterQuery,
    filterOverdue,
    filterEvergreen,
  ]);

  // Base filtered entries (no date range filter) - used by both month and week views
  const filteredEntries = useMemo(() => {
    return entries
      .filter((entry) => !entry.deletedAt)
      .filter((entry) => (filterType === 'All' ? true : entry.assetType === filterType))
      .filter((entry) =>
        filterWorkflow === 'All' ? true : entry.workflowStatus === filterWorkflow,
      )
      .filter((entry) => (filterPriority === 'All' ? true : entry.priorityTier === filterPriority))
      .filter((entry) =>
        filterPlatforms.length === 0
          ? true
          : filterPlatforms.some((platform) => entry.platforms.includes(platform)),
      )
      .filter((entry) => (!filterOverdue ? true : isApprovalOverdue(entry)))
      .filter((entry) => (!filterEvergreen ? true : entry.evergreen))
      .filter((entry) => matchesSearch(entry, filterQuery))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [
    entries,
    filterType,
    filterWorkflow,
    filterPriority,
    filterPlatforms,
    filterOverdue,
    filterEvergreen,
    filterQuery,
  ]);

  // Month-specific filtered entries
  const monthEntries = useMemo(() => {
    return filteredEntries.filter((entry) => entry.date >= startISO && entry.date <= endISO);
  }, [filteredEntries, startISO, endISO]);

  const assetTypeSummary = useMemo(() => {
    const counts = monthEntries.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.assetType] = (acc[entry.assetType] || 0) + 1;
      return acc;
    }, {});
    const total = (Object.values(counts) as number[]).reduce((sum, value) => sum + value, 0);
    return { counts, total };
  }, [monthEntries]);

  const resetFilters = useCallback(() => {
    setFilterType('All');
    setFilterWorkflow('All');
    setFilterPriority('All');
    setFilterPlatforms([]);
    setFilterQuery('');
    setFilterOverdue(false);
    setFilterEvergreen(false);
  }, []);

  // Month navigation — delegates to parent so all tabs stay in sync
  const goToPrevMonth = () =>
    onMonthChange(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1));
  const goToNextMonth = () =>
    onMonthChange(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1));

  const goToPrevWeek = () => {
    const prev = new Date(weekCursor);
    prev.setDate(prev.getDate() - 7);
    setWeekCursor(prev);
  };

  const goToNextWeek = () => {
    const next = new Date(weekCursor);
    next.setDate(next.getDate() + 7);
    setWeekCursor(next);
  };

  const goToToday = () => {
    const today = new Date();
    onMonthChange(new Date(today.getFullYear(), today.getMonth(), 1));
    setWeekCursor(getWeekStart(today));
  };

  // Week date range label
  const weekLabel = `${weekCursor.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })} - ${weekEnd.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;

  const weekEntries = useMemo(
    () => filteredEntries.filter((entry) => entry.date >= weekStartISO && entry.date <= weekEndISO),
    [filteredEntries, weekStartISO, weekEndISO],
  );

  const exportEntries = useMemo(() => {
    if (!hasValidExportRange) return [];
    return filteredEntries.filter(
      (entry) => entry.date >= exportStartDate && entry.date <= exportEndDate,
    );
  }, [filteredEntries, exportStartDate, exportEndDate, hasValidExportRange]);

  const handleToggleCustomExportRange = (enabled: boolean) => {
    setUseCustomExportRange(enabled);
    if (enabled) {
      setCustomExportStartDate(visibleExportStartDate);
      setCustomExportEndDate(visibleExportEndDate);
    }
  };

  const handleExportCalendarCSV = () => {
    if (!hasValidExportRange) return;
    exportEntriesForDateRange(filteredEntries, exportStartDate, exportEndDate);
  };

  const handleExportCalendarICS = () => {
    if (!hasValidExportRange) return;
    downloadICS(exportEntries, `pm-calendar-${exportStartDate}-to-${exportEndDate}.ics`);
  };

  const handlePresetsChange = (presets: FilterPreset[]) => {
    setFilterPresets(presets);
    saveFilterPresets(presets);
  };

  const handleApplyPreset = (filters: FilterPreset['filters']) => {
    if (filters.filterType) setFilterType(filters.filterType);
    if (filters.filterWorkflow) setFilterWorkflow(filters.filterWorkflow);
    if (filters.filterPlatforms) setFilterPlatforms(filters.filterPlatforms);
    if (filters.filterQuery !== undefined) setFilterQuery(filters.filterQuery);
    if (filters.filterOverdue !== undefined) setFilterOverdue(filters.filterOverdue);
    if (filters.filterEvergreen !== undefined) setFilterEvergreen(filters.filterEvergreen);
    setShowFilters(true);
  };

  const currentFilters: FilterPreset['filters'] = {
    filterType,
    filterWorkflow,
    filterPlatforms,
    filterQuery,
    filterOverdue,
    filterEvergreen,
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: view mode + navigation */}
        <div className="flex items-center gap-2">
          {/* Month / Week / Board / Glance toggle */}
          <div className="inline-flex rounded-lg border border-graystone-200 bg-graystone-50 p-0.5">
            {(['month', 'week', 'board', 'glance'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={cx(
                  'rounded-md px-3 py-1 text-xs font-medium transition capitalize',
                  viewMode === mode
                    ? 'bg-white text-ocean-700 shadow-sm'
                    : 'text-graystone-600 hover:text-graystone-900',
                )}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Confirmed / Planning toggle — month view only */}
          {viewMode === 'month' && (
            <div className="inline-flex rounded-lg border border-graystone-200 bg-graystone-50 p-0.5">
              {(['confirmed', 'planning'] as const).map((layer) => (
                <button
                  key={layer}
                  type="button"
                  onClick={() => setCalendarLayer(layer)}
                  className={cx(
                    'rounded-md px-3 py-1 text-xs font-medium transition capitalize',
                    calendarLayer === layer
                      ? 'bg-white text-ocean-700 shadow-sm'
                      : 'text-graystone-600 hover:text-graystone-900',
                  )}
                >
                  {layer}
                </button>
              ))}
            </div>
          )}

          {/* Prev / date label / Next */}
          <Button
            variant="outline"
            size="sm"
            onClick={viewMode === 'month' ? goToPrevMonth : goToPrevWeek}
          >
            Prev
          </Button>
          <button
            type="button"
            onClick={goToToday}
            className="inline-flex items-center gap-2 rounded-md border border-graystone-200 bg-white px-3 py-1 text-sm font-medium text-graystone-700 shadow-sm hover:bg-graystone-50"
          >
            <CalendarIcon className="h-4 w-4 text-graystone-500" />
            {viewMode === 'month' ? monthLabel : weekLabel}
          </button>
          <Button
            variant="outline"
            size="sm"
            onClick={viewMode === 'month' ? goToNextMonth : goToNextWeek}
          >
            Next
          </Button>
        </div>

        {/* Right: action buttons */}
        <div className="flex items-center gap-2">
          {/* Filters toggle */}
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={cx(
              'inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium transition',
              showFilters
                ? 'border-ocean-300 bg-ocean-50 text-ocean-700'
                : 'border-graystone-200 bg-white text-graystone-600 hover:border-graystone-300 hover:bg-graystone-50',
            )}
          >
            Filters
            {activeFilterCount > 0 && (
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-ocean-500 text-[10px] font-semibold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Export toggle */}
          <button
            type="button"
            onClick={() => setShowExport((v) => !v)}
            className={cx(
              'inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium transition',
              showExport
                ? 'border-ocean-300 bg-ocean-50 text-ocean-700'
                : 'border-graystone-200 bg-white text-graystone-600 hover:border-graystone-300 hover:bg-graystone-50',
            )}
          >
            Export
          </button>

          <Button variant="outline" size="sm" onClick={onImportPerformance}>
            Import performance
          </Button>
        </div>
      </div>

      {/* ── Filters panel ───────────────────────────────────────────────────── */}
      {showFilters && (
        <div className="rounded-2xl border border-graystone-200 bg-white px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <span className="text-sm font-semibold text-graystone-700">
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-2 text-xs font-normal text-graystone-400">
                  {activeFilterCount} active · showing {monthEntries.length} of {monthEntryTotal}
                </span>
              )}
            </span>
            <div className="flex items-center gap-2">
              <SavedFilters
                presets={filterPresets}
                currentFilters={currentFilters}
                onApplyPreset={handleApplyPreset}
                onPresetsChange={handlePresetsChange}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={resetFilters}
                disabled={!activeFilterCount}
              >
                Reset
              </Button>
            </div>
          </div>

          {/* Five dropdowns */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5 mb-4">
            <div>
              <Label className="text-xs text-graystone-600">Asset type</Label>
              <select
                value={filterType}
                onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                  setFilterType(event.target.value)
                }
                className={cx(selectBaseClasses, 'mt-1 w-full')}
              >
                <option value="All">All</option>
                <option value="Video">Video</option>
                <option value="Design">Design</option>
                <option value="Carousel">Carousel</option>
              </select>
            </div>
            <div>
              <Label className="text-xs text-graystone-600">Workflow</Label>
              <select
                value={filterWorkflow}
                onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                  setFilterWorkflow(event.target.value)
                }
                className={cx(selectBaseClasses, 'mt-1 w-full')}
              >
                <option value="All">All</option>
                {KANBAN_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs text-graystone-600">Platforms</Label>
              <div className="mt-1">
                <PlatformFilter value={filterPlatforms} onChange={setFilterPlatforms} />
              </div>
            </div>
            <div>
              <Label className="text-xs text-graystone-600">Priority</Label>
              <select
                value={filterPriority}
                onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                  setFilterPriority(event.target.value)
                }
                className={cx(selectBaseClasses, 'mt-1 w-full')}
              >
                <option value="All">All</option>
                {PRIORITY_TIERS.map((tier) => (
                  <option key={tier} value={tier}>
                    {tier}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Search + toggles */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
            <div>
              <Label className="text-xs text-graystone-600" htmlFor="plan-search">
                Search
              </Label>
              <Input
                id="plan-search"
                value={filterQuery}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setFilterQuery(event.target.value)
                }
                placeholder="Search captions, campaigns, authors..."
                className="mt-1 w-full rounded-2xl border border-graystone-200 px-3 py-2 text-sm focus:border-ocean-500 focus:ring-2 focus:ring-aqua-200"
              />
            </div>
            <div className="flex items-end justify-between gap-3 rounded-2xl border border-graystone-200 px-4 py-3 text-xs text-graystone-600">
              <div>
                <div className="font-semibold text-graystone-700">Overdue</div>
                <div>Past deadline.</div>
              </div>
              <Toggle
                checked={filterOverdue}
                onChange={setFilterOverdue}
                aria-label="Show overdue approvals only"
              />
            </div>
            <div className="flex items-end justify-between gap-3 rounded-2xl border border-graystone-200 px-4 py-3 text-xs text-graystone-600">
              <div>
                <div className="font-semibold text-graystone-700">Evergreen</div>
                <div>Reusable only.</div>
              </div>
              <Toggle
                checked={filterEvergreen}
                onChange={setFilterEvergreen}
                aria-label="Show evergreen content only"
              />
            </div>
            <div className="flex items-end justify-between gap-3 rounded-2xl border border-graystone-200 px-4 py-3 text-xs text-graystone-600">
              <div>
                <div className="font-semibold text-graystone-700">Daily target</div>
                <div>Flag gaps (0 = off).</div>
              </div>
              <input
                type="number"
                min="0"
                max="10"
                value={dailyPostTarget}
                onChange={(e) =>
                  onDailyPostTargetChange?.(Math.max(0, parseInt(e.target.value) || 0))
                }
                className="w-16 rounded-full border border-graystone-300 px-3 py-1 text-center text-xs"
                aria-label="Daily post target"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Export panel ────────────────────────────────────────────────────── */}
      {showExport && (
        <div className="rounded-2xl border border-graystone-200 bg-white px-4 py-4">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
            <div className="text-xs text-graystone-600">
              <div className="font-semibold text-graystone-700">Export calendar</div>
              <div>
                Default {viewMode} range: {visibleExportStartDate} to {visibleExportEndDate}
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-graystone-600">
              <span className="font-medium text-graystone-700">Custom range</span>
              <Toggle
                checked={useCustomExportRange}
                onChange={handleToggleCustomExportRange}
                aria-label="Use custom export range"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <div>
              <Label className="text-xs text-graystone-600" htmlFor="export-start-date">
                From
              </Label>
              <Input
                id="export-start-date"
                type="date"
                value={useCustomExportRange ? customExportStartDate : visibleExportStartDate}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setCustomExportStartDate(event.target.value)
                }
                disabled={!useCustomExportRange}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-graystone-600" htmlFor="export-end-date">
                To
              </Label>
              <Input
                id="export-end-date"
                type="date"
                value={useCustomExportRange ? customExportEndDate : visibleExportEndDate}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setCustomExportEndDate(event.target.value)
                }
                disabled={!useCustomExportRange}
                className="mt-1"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCalendarCSV}
                disabled={!hasValidExportRange}
              >
                Export CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCalendarICS}
                disabled={!hasValidExportRange}
              >
                Export ICS
              </Button>
            </div>
          </div>
          {!hasValidExportRange && (
            <p className="mt-2 text-xs text-rose-600">
              Export start date must be on or before end date.
            </p>
          )}
          <p className="mt-2 text-xs text-graystone-500">
            {exportEntries.length} filtered entr{exportEntries.length === 1 ? 'y' : 'ies'} in range{' '}
            {exportStartDate} to {exportEndDate}.
          </p>

          {/* Bulk date shift lives here — it's an edit action, not a filter */}
          {onBulkDateShift && (
            <div className="mt-4 border-t border-graystone-100 pt-4">
              <BulkDateShift entries={entries} onShift={onBulkDateShift} />
            </div>
          )}
        </div>
      )}

      {/* ── Board view ───────────────────────────────────────────────────────── */}
      {viewMode === 'board' && (
        <KanbanView
          entries={filteredEntries}
          onOpenEntry={onOpenEntry}
          onUpdateStatus={onUpdateStatus ?? (() => {})}
        />
      )}

      {/* ── Glance view ──────────────────────────────────────────────────────── */}
      {viewMode === 'glance' && (
        <MonthlyGlance
          entries={entries}
          monthCursor={monthCursor}
          onPrevMonth={goToPrevMonth}
          onNextMonth={goToNextMonth}
          onOpenEntry={onOpenEntry}
          onUpdate={onUpdate ?? (() => {})}
        />
      )}

      {/* ── Calendar grid + sidebar ──────────────────────────────────────────── */}
      {(viewMode === 'month' || viewMode === 'week') && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(240px,0.8fr)]">
          <div>
            {viewMode === 'month' && calendarLayer === 'planning' ? (
              <PlanningGrid
                days={days}
                month={monthCursor.getMonth()}
                year={monthCursor.getFullYear()}
              />
            ) : viewMode === 'month' ? (
              <MonthGrid
                days={days}
                month={monthCursor.getMonth()}
                year={monthCursor.getFullYear()}
                entries={monthEntries}
                onApprove={onApprove}
                onDelete={_onDelete}
                onOpen={onOpenEntry}
                onDateChange={onEntryDateChange}
                dailyPostTarget={dailyPostTarget}
              />
            ) : (
              <WeekGrid
                weekStart={weekCursor}
                entries={weekEntries}
                onApprove={onApprove}
                onDelete={_onDelete}
                onOpen={onOpenEntry}
                onDateChange={onEntryDateChange}
                dailyPostTarget={dailyPostTarget}
              />
            )}
          </div>
          <div className="space-y-4">
            {onOpenApprovals && (
              <Card className="shadow-md">
                <CardContent className="pt-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <div className="text-base font-semibold text-ocean-900">Approvals</div>
                      <p className="text-xs text-graystone-500">
                        {outstandingCount ? `${outstandingCount} pending` : 'All clear'}
                      </p>
                    </div>
                    {!!outstandingCount && (
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-ocean-500 text-xs font-semibold text-white">
                        {outstandingCount}
                      </span>
                    )}
                  </div>
                  <Button variant="outline" size="sm" className="w-full" onClick={onOpenApprovals}>
                    View approvals
                  </Button>
                </CardContent>
              </Card>
            )}
            {onOpenOpportunities && (
              <Card className="shadow-md">
                <CardContent className="pt-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <div className="text-base font-semibold text-ocean-900">Opportunities</div>
                      <p className="text-xs text-graystone-500">
                        {openOpportunitiesCount ? `${openOpportunitiesCount} open` : 'None open'}
                      </p>
                    </div>
                    {!!openOpportunitiesCount && (
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-aqua-600 text-xs font-semibold text-white">
                        {openOpportunitiesCount}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={onOpenOpportunities}
                  >
                    View opportunities
                  </Button>
                </CardContent>
              </Card>
            )}
            <UpcomingDeadlines entries={entries} onOpenEntry={onOpenEntry} />
            <AssetRatioCard
              summary={assetTypeSummary}
              monthLabel={monthLabel}
              goals={assetGoals}
              onGoalsChange={onGoalsChange}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default CalendarView;
