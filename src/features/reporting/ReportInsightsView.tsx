import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { REPORTING_PLATFORM_METRICS } from '../../constants';
import { selectBaseClasses } from '../../lib/styles';
import { SUPABASE_API } from '../../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, Label } from '../../components/ui';
import type { MonthlyReport } from '../../types/models';

// ─── Period helpers ───────────────────────────────────────────────────────────

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const QUARTER_SHORT = ['Q1', 'Q2', 'Q3', 'Q4'];

function periodSortKey(r: MonthlyReport): string {
  if (r.reportType === 'monthly')
    return `${r.periodYear}-${String(r.periodMonth ?? 0).padStart(2, '0')}-M`;
  if (r.reportType === 'quarterly')
    return `${r.periodYear}-${String((r.periodQuarter ?? 1) * 3).padStart(2, '0')}-Q`;
  if (r.reportType === 'annual') return `${r.periodYear}-00-A`;
  return r.dateFrom ?? `${r.periodYear}-00-C`;
}

function periodLabel(r: MonthlyReport): string {
  if (r.reportType === 'monthly') return `${MONTH_SHORT[(r.periodMonth ?? 1) - 1]} ${r.periodYear}`;
  if (r.reportType === 'quarterly')
    return `${QUARTER_SHORT[(r.periodQuarter ?? 1) - 1]} ${r.periodYear}`;
  if (r.reportType === 'annual') return `${r.periodYear} Annual`;
  return r.campaignName ?? 'Campaign';
}

// ─── Metric helpers ───────────────────────────────────────────────────────────

const ALL_PLATFORMS = Object.keys(REPORTING_PLATFORM_METRICS);

interface MetricOption {
  key: string;
  label: string;
  isRate: boolean;
}

function getMetricOptions(platform: string): MetricOption[] {
  if (platform === 'all') {
    const seen = new Map<string, { label: string; isRate: boolean }>();
    ALL_PLATFORMS.forEach((p) => {
      REPORTING_PLATFORM_METRICS[p].forEach((m) => {
        if (!seen.has(m.key)) seen.set(m.key, { label: m.label, isRate: m.isRate ?? false });
      });
    });
    // Exclude rate metrics from aggregate — they don't sum meaningfully
    return Array.from(seen.entries())
      .filter(([, meta]) => !meta.isRate)
      .map(([key, meta]) => ({ key, label: meta.label, isRate: false }));
  }
  return (REPORTING_PLATFORM_METRICS[platform] ?? []).map((m) => ({
    key: m.key,
    label: m.label,
    isRate: m.isRate ?? false,
  }));
}

function getMetricValue(report: MonthlyReport, platform: string, metricKey: string): number {
  if (platform === 'all') {
    return ALL_PLATFORMS.reduce((sum, p) => sum + (report.platformMetrics[p]?.[metricKey] ?? 0), 0);
  }
  return report.platformMetrics[platform]?.[metricKey] ?? 0;
}

function formatValue(value: number, isRate: boolean): string {
  if (!value) return '—';
  if (isRate) return `${value.toFixed(1)}%`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

function deltaClass(delta: number): string {
  if (delta > 0) return 'text-emerald-600';
  if (delta < 0) return 'text-rose-600';
  return 'text-graystone-400';
}

function deltaLabel(delta: number, pct: number | null): string {
  if (delta === 0) return '—';
  const sign = delta > 0 ? '+' : '';
  return pct !== null ? `${sign}${pct.toFixed(0)}%` : `${sign}${delta.toLocaleString()}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewMode = 'trend' | 'compare' | 'snapshot';

// ─── Sub-components ───────────────────────────────────────────────────────────

function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  return (
    <div className="flex gap-1 rounded-xl border border-graystone-200 bg-graystone-50 p-1">
      {(['trend', 'compare', 'snapshot'] as ViewMode[]).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={`rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
            mode === m
              ? 'bg-ocean-500 text-white shadow-sm'
              : 'text-graystone-600 hover:bg-graystone-100'
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ReportInsightsView(): ReactElement {
  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('trend');
  const [platform, setPlatform] = useState('all');
  const [metricKey, setMetricKey] = useState('views');
  const [compareA, setCompareA] = useState('');
  const [compareB, setCompareB] = useState('');
  const [snapshotId, setSnapshotId] = useState('');

  useEffect(() => {
    SUPABASE_API.getMonthlyReports()
      .then((data) => {
        const sorted = [...data].sort((a, b) => periodSortKey(a).localeCompare(periodSortKey(b)));
        setReports(sorted);
        if (sorted.length >= 1) {
          setSnapshotId(sorted[sorted.length - 1].id);
          setCompareB(sorted[sorted.length - 1].id);
        }
        if (sorted.length >= 2) {
          setCompareA(sorted[sorted.length - 2].id);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const metricOptions = useMemo(() => getMetricOptions(platform), [platform]);

  // When platform changes, keep metric if available, else fall back to first option
  useEffect(() => {
    if (!metricOptions.find((m) => m.key === metricKey)) {
      setMetricKey(metricOptions[0]?.key ?? '');
    }
  }, [metricOptions, metricKey]);

  const selectedMetric = metricOptions.find((m) => m.key === metricKey);

  // Trend: value per report in chronological order
  const trendData = useMemo(
    () =>
      reports.map((r) => ({
        id: r.id,
        label: periodLabel(r),
        value: getMetricValue(r, platform, metricKey),
      })),
    [reports, platform, metricKey],
  );
  const maxTrend = Math.max(...trendData.map((d) => d.value), 1);

  // Compare: metric-by-metric delta between two chosen periods
  const reportA = reports.find((r) => r.id === compareA);
  const reportB = reports.find((r) => r.id === compareB);

  const compareRows = useMemo(
    () =>
      metricOptions.map((m) => {
        const aVal = reportA ? getMetricValue(reportA, platform, m.key) : null;
        const bVal = reportB ? getMetricValue(reportB, platform, m.key) : null;
        const delta = aVal !== null && bVal !== null ? bVal - aVal : null;
        const pct = delta !== null && aVal !== null && aVal > 0 ? (delta / aVal) * 100 : null;
        return { ...m, aVal, bVal, delta, pct };
      }),
    [reportA, reportB, metricOptions, platform],
  );

  // Snapshot: one report, one or all platforms
  const snapshotReport = reports.find((r) => r.id === snapshotId);
  const snapshotPlatforms = platform === 'all' ? ALL_PLATFORMS : [platform];

  const platformOptions = [
    { value: 'all', label: 'All platforms (aggregate)' },
    ...ALL_PLATFORMS.map((p) => ({ value: p, label: p })),
  ];

  const reportSelectOptions = [...reports]
    .reverse()
    .map((r) => ({ value: r.id, label: `${periodLabel(r)} · ${r.reportType}` }));

  // ── Empty / loading states ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-graystone-500">
        Loading reports…
      </div>
    );
  }

  if (!reports.length) {
    return (
      <Card className="shadow-xl">
        <CardContent className="py-16 text-center">
          <h3 className="mb-2 text-lg font-semibold text-ocean-900">No reports yet</h3>
          <p className="text-sm text-graystone-600">
            Submit your first report from the Reporting tab to start tracking trends here.
          </p>
        </CardContent>
      </Card>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="gradient-header rounded-2xl p-8 text-white shadow-xl">
        <h1 className="heading-font text-3xl font-bold">Report Insights</h1>
        <p className="mt-2 text-ocean-100">
          Visualise and compare platform metrics across submitted reports.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm text-ocean-200">
          <span>
            {reports.length} {reports.length === 1 ? 'report' : 'reports'} submitted
          </span>
          <span>·</span>
          <span>{ALL_PLATFORMS.length} platforms tracked</span>
        </div>
      </div>

      {/* Controls */}
      <Card className="shadow-md">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label>View</Label>
              <ViewToggle mode={viewMode} onChange={setViewMode} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="platform-select">Platform</Label>
              <select
                id="platform-select"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className={`${selectBaseClasses} min-w-[200px]`}
              >
                {platformOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {viewMode !== 'snapshot' && (
              <div className="space-y-2">
                <Label htmlFor="metric-select">Metric</Label>
                <select
                  id="metric-select"
                  value={metricKey}
                  onChange={(e) => setMetricKey(e.target.value)}
                  className={`${selectBaseClasses} min-w-[220px]`}
                >
                  {metricOptions.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── TREND VIEW ─────────────────────────────────────────────────────── */}
      {viewMode === 'trend' && (
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl text-ocean-900">
              {selectedMetric?.label ?? metricKey} over time
            </CardTitle>
            <p className="text-sm text-graystone-500">
              {platform === 'all' ? 'Summed across all platforms' : platform} · {reports.length}{' '}
              {reports.length === 1 ? 'period' : 'periods'}
            </p>
          </CardHeader>
          <CardContent>
            {trendData.every((d) => d.value === 0) ? (
              <div className="rounded-2xl border border-dashed border-graystone-200 px-4 py-8 text-center text-sm text-graystone-500">
                No data recorded for this metric yet.
              </div>
            ) : (
              <div className="space-y-3">
                {trendData.map((point) => (
                  <div
                    key={point.id}
                    className="grid gap-2 md:grid-cols-[160px_1fr_88px] md:items-center"
                  >
                    <div className="text-sm font-medium text-ocean-900">{point.label}</div>
                    <div className="h-3 overflow-hidden rounded-full bg-graystone-100">
                      <div
                        className="h-full rounded-full bg-ocean-500 transition-all duration-500"
                        style={{ width: `${(point.value / maxTrend) * 100}%` }}
                      />
                    </div>
                    <div className="text-right text-sm font-semibold text-ocean-700">
                      {formatValue(point.value, selectedMetric?.isRate ?? false)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── COMPARE VIEW ───────────────────────────────────────────────────── */}
      {viewMode === 'compare' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="space-y-2">
              <Label htmlFor="compare-a">Period A (baseline)</Label>
              <select
                id="compare-a"
                value={compareA}
                onChange={(e) => setCompareA(e.target.value)}
                className={`${selectBaseClasses} min-w-[220px]`}
              >
                {reportSelectOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="compare-b">Period B (target)</Label>
              <select
                id="compare-b"
                value={compareB}
                onChange={(e) => setCompareB(e.target.value)}
                className={`${selectBaseClasses} min-w-[220px]`}
              >
                {reportSelectOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Card className="shadow-xl">
            <CardContent className="pt-6">
              {/* Table header */}
              <div className="mb-3 grid grid-cols-[1fr_100px_100px_80px] gap-2 border-b border-graystone-200 pb-2 text-xs font-semibold uppercase tracking-wide text-graystone-500">
                <div>Metric</div>
                <div className="text-right">{reportA ? periodLabel(reportA) : 'Period A'}</div>
                <div className="text-right">{reportB ? periodLabel(reportB) : 'Period B'}</div>
                <div className="text-right">Change</div>
              </div>

              {/* Rows */}
              <div className="space-y-0.5">
                {compareRows.map((m) => (
                  <div
                    key={m.key}
                    className="grid grid-cols-[1fr_100px_100px_80px] items-center gap-2 rounded-xl px-2 py-2 text-sm even:bg-graystone-50"
                  >
                    <div className="text-graystone-700">{m.label}</div>
                    <div className="text-right font-medium text-ocean-900">
                      {formatValue(m.aVal ?? 0, m.isRate)}
                    </div>
                    <div className="text-right font-medium text-ocean-900">
                      {formatValue(m.bVal ?? 0, m.isRate)}
                    </div>
                    <div
                      className={`text-right text-xs font-semibold ${
                        m.delta !== null ? deltaClass(m.delta) : 'text-graystone-400'
                      }`}
                    >
                      {m.delta !== null ? deltaLabel(m.delta, m.pct) : '—'}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── SNAPSHOT VIEW ──────────────────────────────────────────────────── */}
      {viewMode === 'snapshot' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="snapshot-period">Period</Label>
            <select
              id="snapshot-period"
              value={snapshotId}
              onChange={(e) => setSnapshotId(e.target.value)}
              className={`${selectBaseClasses} min-w-[220px]`}
            >
              {reportSelectOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {snapshotReport && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {snapshotPlatforms.map((p) => {
                const fields = REPORTING_PLATFORM_METRICS[p] ?? [];
                const hasAny = fields.some(
                  (m) => (snapshotReport.platformMetrics[p]?.[m.key] ?? 0) > 0,
                );

                return (
                  <Card
                    key={p}
                    className={`shadow-md transition-opacity ${!hasAny ? 'opacity-40' : ''}`}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base text-ocean-900">{p}</CardTitle>
                      {!hasAny && <p className="text-xs text-graystone-400">No data entered</p>}
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {fields.map((m) => {
                        const val = snapshotReport.platformMetrics[p]?.[m.key] ?? 0;
                        return (
                          <div key={m.key} className="flex items-center justify-between text-sm">
                            <span className="text-graystone-600">{m.label}</span>
                            <span
                              className={`font-semibold ${
                                val > 0 ? 'text-ocean-700' : 'text-graystone-300'
                              }`}
                            >
                              {formatValue(val, m.isRate ?? false)}
                            </span>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
