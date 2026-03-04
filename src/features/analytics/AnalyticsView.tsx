import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardContent, CardTitle, Button, Label } from '../../components/ui';
import { cx } from '../../lib/utils';
import { selectBaseClasses } from '../../lib/styles';
import { ALL_PLATFORMS } from '../../constants';
import type { Entry } from '../../types/models';
import { AnalyticsInputWizard } from './AnalyticsInputWizard';

// Time period options
const TIME_PERIODS = [
  { value: 'this-week', label: 'This Week' },
  { value: 'this-month', label: 'This Month' },
  { value: 'last-month', label: 'Last Month' },
  { value: 'this-quarter', label: 'This Quarter' },
  { value: 'all-time', label: 'All Time' },
] as const;

type TimePeriod = (typeof TIME_PERIODS)[number]['value'];

interface AnalyticsViewProps {
  entries: Entry[];
  onUpdateEntry?: (id: string, updates: Partial<Entry>) => void;
}

// Helper to get date range for a time period
const getDateRange = (period: TimePeriod): { start: Date; end: Date } => {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  let start = new Date(now);
  start.setHours(0, 0, 0, 0);

  switch (period) {
    case 'this-week': {
      const day = start.getDay();
      start.setDate(start.getDate() - day);
      break;
    }
    case 'this-month': {
      start.setDate(1);
      break;
    }
    case 'last-month': {
      start.setMonth(start.getMonth() - 1);
      start.setDate(1);
      end.setDate(0); // Last day of previous month
      break;
    }
    case 'this-quarter': {
      const quarter = Math.floor(start.getMonth() / 3);
      start.setMonth(quarter * 3);
      start.setDate(1);
      break;
    }
    case 'all-time': {
      start = new Date(0);
      break;
    }
  }

  return { start, end };
};

// Helper to calculate metrics from entries
const calculateMetrics = (entries: Entry[], platform?: string) => {
  const filtered = platform ? entries.filter((e) => e.platforms?.includes(platform)) : entries;

  const totalPosts = filtered.length;

  // Calculate totals from analytics
  let totalEngagements = 0;
  let totalReach = 0;
  let totalImpressions = 0;
  let postsWithAnalytics = 0;

  filtered.forEach((entry) => {
    if (!entry.analytics) return;

    const platforms = platform ? [platform] : entry.platforms || [];
    platforms.forEach((p) => {
      const stats = entry.analytics?.[p];
      if (stats && typeof stats === 'object') {
        const s = stats as Record<string, number>;
        const likes = s.likes || 0;
        const comments = s.comments || 0;
        const shares = s.shares || 0;
        const reach = s.reach || 0;
        const impressions = s.impressions || 0;

        if (likes || comments || shares || reach || impressions) {
          postsWithAnalytics++;
          totalEngagements += likes + comments + shares;
          totalReach += reach;
          totalImpressions += impressions;
        }
      }
    });
  });

  const avgEngagementRate =
    postsWithAnalytics > 0 && totalReach > 0
      ? ((totalEngagements / totalReach) * 100).toFixed(2)
      : '0.00';

  return {
    totalPosts,
    totalEngagements,
    totalReach,
    totalImpressions,
    avgEngagementRate,
    postsWithAnalytics,
  };
};

// Summary Card Component
const SummaryCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
}> = ({ title, value, subtitle }) => (
  <Card className="shadow-md">
    <CardContent className="p-6">
      <div className="text-sm font-medium text-graystone-500 uppercase tracking-wide">{title}</div>
      <div className="mt-2 text-3xl font-bold text-ocean-900">{value}</div>
      {subtitle && <div className="mt-1 text-xs text-graystone-500">{subtitle}</div>}
    </CardContent>
  </Card>
);

// Platform Bar Component for comparison chart
const PlatformBar: React.FC<{
  platform: string;
  value: number;
  maxValue: number;
  label: string;
  onClick: () => void;
  isSelected: boolean;
}> = ({ platform, value, maxValue, label, onClick, isSelected }) => {
  const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;

  return (
    <button
      onClick={onClick}
      className={cx(
        'w-full text-left p-3 rounded-xl transition-all',
        isSelected ? 'bg-ocean-100 ring-2 ring-ocean-500' : 'hover:bg-graystone-50',
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-ocean-900">{platform}</span>
        <span className="text-sm text-graystone-600">{label}</span>
      </div>
      <div className="h-3 bg-graystone-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-ocean-500 rounded-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </button>
  );
};

// Top Performer Card
const TopPerformerCard: React.FC<{
  entry: Entry;
  metric: string;
  value: number;
  rank: number;
}> = ({ entry, metric, value, rank }) => (
  <div className="flex items-start gap-3 p-3 rounded-xl bg-white border border-graystone-200">
    <div
      className={cx(
        'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
        rank === 1
          ? 'bg-amber-100 text-amber-700'
          : rank === 2
            ? 'bg-graystone-200 text-graystone-700'
            : 'bg-orange-100 text-orange-700',
      )}
    >
      {rank}
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-sm font-medium text-ocean-900 truncate">
        {entry.caption?.slice(0, 50) || 'Untitled'}
        {(entry.caption?.length || 0) > 50 ? '...' : ''}
      </div>
      <div className="text-xs text-graystone-500 mt-1">
        {entry.platforms?.join(', ')} · {new Date(entry.date).toLocaleDateString()}
      </div>
    </div>
    <div className="text-right">
      <div className="text-lg font-bold text-ocean-600">{value.toLocaleString()}</div>
      <div className="text-xs text-graystone-500">{metric}</div>
    </div>
  </div>
);

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ entries, onUpdateEntry }) => {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('this-month');
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [comparisonMetric, setComparisonMetric] = useState<'engagements' | 'reach' | 'posts'>(
    'engagements',
  );
  const [wizardOpen, setWizardOpen] = useState(false);

  // Filter entries by time period
  const filteredEntries = useMemo(() => {
    const { start, end } = getDateRange(timePeriod);
    return entries.filter((entry) => {
      if (!entry.date) return false;
      const entryDate = new Date(entry.date);
      return entryDate >= start && entryDate <= end && entry.status === 'Approved';
    });
  }, [entries, timePeriod]);

  // Calculate overall metrics
  const metrics = useMemo(
    () => calculateMetrics(filteredEntries, selectedPlatform || undefined),
    [filteredEntries, selectedPlatform],
  );

  // Calculate per-platform metrics for comparison
  const platformMetrics = useMemo(() => {
    const results: Record<string, ReturnType<typeof calculateMetrics>> = {};
    ALL_PLATFORMS.forEach((platform) => {
      results[platform] = calculateMetrics(filteredEntries, platform);
    });
    return results;
  }, [filteredEntries]);

  // Get max value for bar chart scaling
  const maxPlatformValue = useMemo(() => {
    let max = 0;
    (Object.values(platformMetrics) as ReturnType<typeof calculateMetrics>[]).forEach((m) => {
      const value =
        comparisonMetric === 'engagements'
          ? m.totalEngagements
          : comparisonMetric === 'reach'
            ? m.totalReach
            : m.totalPosts;
      if (value > max) max = value;
    });
    return max;
  }, [platformMetrics, comparisonMetric]);

  // Get top performers
  const topPerformers = useMemo(() => {
    const withEngagements = filteredEntries
      .map((entry) => {
        let totalEngagements = 0;
        if (entry.analytics) {
          (entry.platforms || []).forEach((p) => {
            const stats = entry.analytics?.[p];
            if (stats && typeof stats === 'object') {
              const s = stats as Record<string, number>;
              totalEngagements += (s.likes || 0) + (s.comments || 0) + (s.shares || 0);
            }
          });
        }
        return { entry, totalEngagements };
      })
      .filter((item) => item.totalEngagements > 0)
      .sort((a, b) => b.totalEngagements - a.totalEngagements)
      .slice(0, 5);

    return withEngagements;
  }, [filteredEntries]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="gradient-header rounded-2xl p-8 text-white shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="heading-font text-3xl font-bold mb-2">Analytics</h1>
            <p className="text-ocean-100">Track your content performance across platforms.</p>
          </div>
          <div className="flex items-center gap-3">
            {onUpdateEntry && (
              <Button
                onClick={() => setWizardOpen(true)}
                className="bg-white/20 text-white hover:bg-white/30 border-white/30"
                variant="outline"
              >
                Log metrics
              </Button>
            )}
            <Label className="text-white text-sm">Period</Label>
            <select
              value={timePeriod}
              onChange={(e) => setTimePeriod(e.target.value as TimePeriod)}
              className={cx(
                selectBaseClasses,
                'px-4 py-2 text-sm bg-white/10 text-white border-white/20',
              )}
            >
              {TIME_PERIODS.map((period) => (
                <option key={period.value} value={period.value} className="text-ocean-900">
                  {period.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Total Posts"
          value={metrics.totalPosts}
          subtitle={selectedPlatform ? `on ${selectedPlatform}` : 'across all platforms'}
        />
        <SummaryCard
          title="Total Engagements"
          value={metrics.totalEngagements.toLocaleString()}
          subtitle="likes, comments, shares"
        />
        <SummaryCard
          title="Total Reach"
          value={metrics.totalReach.toLocaleString()}
          subtitle="unique accounts reached"
        />
        <SummaryCard
          title="Avg Engagement Rate"
          value={`${metrics.avgEngagementRate}%`}
          subtitle={`from ${metrics.postsWithAnalytics} posts with data`}
        />
      </div>

      {/* Platform Comparison & Top Performers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Platform Comparison */}
        <Card className="shadow-xl">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-xl text-ocean-900">Platform Comparison</CardTitle>
              <div className="flex gap-2">
                {(['engagements', 'reach', 'posts'] as const).map((metric) => (
                  <Button
                    key={metric}
                    variant={comparisonMetric === metric ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setComparisonMetric(metric)}
                    className="text-xs capitalize"
                  >
                    {metric}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedPlatform && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedPlatform(null)}
                className="text-xs text-ocean-600 mb-2"
              >
                Clear filter: {selectedPlatform}
              </Button>
            )}
            {ALL_PLATFORMS.map((platform) => {
              const m = platformMetrics[platform];
              const value =
                comparisonMetric === 'engagements'
                  ? m.totalEngagements
                  : comparisonMetric === 'reach'
                    ? m.totalReach
                    : m.totalPosts;
              return (
                <PlatformBar
                  key={platform}
                  platform={platform}
                  value={value}
                  maxValue={maxPlatformValue}
                  label={value.toLocaleString()}
                  onClick={() =>
                    setSelectedPlatform(selectedPlatform === platform ? null : platform)
                  }
                  isSelected={selectedPlatform === platform}
                />
              );
            })}
          </CardContent>
        </Card>

        {/* Top Performers */}
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl text-ocean-900">Top Performers</CardTitle>
            <p className="text-sm text-graystone-500">
              Highest engagement posts in selected period
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {topPerformers.length === 0 ? (
              <div className="text-center py-8 text-graystone-500">
                <p className="text-sm">No posts with engagement data in this period.</p>
                <p className="text-xs mt-2">
                  Import analytics data or manually add metrics to see top performers.
                </p>
              </div>
            ) : (
              topPerformers.map((item, index) => (
                <TopPerformerCard
                  key={item.entry.id}
                  entry={item.entry}
                  metric="engagements"
                  value={item.totalEngagements}
                  rank={index + 1}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Empty State */}
      {filteredEntries.length === 0 && (
        <Card className="shadow-xl">
          <CardContent className="py-12 text-center">
            <div className="text-graystone-400 mb-4">
              <svg
                className="w-16 h-16 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-ocean-900 mb-2">No approved posts found</h3>
            <p className="text-sm text-graystone-600">
              There are no approved posts in the selected time period.
              <br />
              Try selecting a different period or create some content!
            </p>
          </CardContent>
        </Card>
      )}

      {wizardOpen && onUpdateEntry && (
        <AnalyticsInputWizard
          entries={entries}
          onSave={(entryId, analytics) =>
            onUpdateEntry(entryId, { analytics, analyticsUpdatedAt: new Date().toISOString() })
          }
          onClose={() => setWizardOpen(false)}
        />
      )}
    </div>
  );
};

export default AnalyticsView;
