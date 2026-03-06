import React, { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  MultiSelect,
} from '../../components/ui';
import { cx } from '../../lib/utils';
import { selectBaseClasses } from '../../lib/styles';
import type { Entry } from '../../types/models';
import { AnalyticsInputWizard } from './AnalyticsInputWizard';
import {
  buildInsightsSnapshot,
  createDefaultInsightFilters,
  formatMetricValue,
  getInsightFilterOptions,
  metricLabel,
  TIME_PERIODS,
  type InsightBreakdownRow,
  type InsightFilters,
  type TopPerformer,
  type TimePeriod,
} from './analyticsUtils';

interface AnalyticsViewProps {
  entries: Entry[];
  onUpdateEntry?: (id: string, updates: Partial<Entry>) => void;
  onOpenImport?: () => void;
}

const SummaryCard: React.FC<{
  title: string;
  value: string;
  subtitle: string;
}> = ({ title, value, subtitle }) => (
  <Card className="shadow-md">
    <CardContent className="p-6">
      <div className="text-sm font-medium uppercase tracking-wide text-graystone-500">{title}</div>
      <div className="mt-2 text-3xl font-bold text-ocean-900">{value}</div>
      <div className="mt-1 text-xs text-graystone-500">{subtitle}</div>
    </CardContent>
  </Card>
);

const BreakdownCard: React.FC<{
  title: string;
  rows: InsightBreakdownRow[];
  metric: string;
  emptyLabel: string;
}> = ({ title, rows, metric, emptyLabel }) => {
  const maxValue = rows.reduce((max, row) => Math.max(max, row.value), 0);

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-lg text-ocean-900">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {!rows.length ? (
          <div className="rounded-2xl border border-dashed border-graystone-200 px-4 py-6 text-sm text-graystone-500">
            {emptyLabel}
          </div>
        ) : (
          <div className="space-y-3">
            {rows.slice(0, 6).map((row) => {
              const width = maxValue > 0 ? (row.value / maxValue) * 100 : 0;
              return (
                <div key={row.label} className="space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-ocean-900">
                        {row.label}
                      </div>
                      <div className="text-xs text-graystone-500">
                        {row.posts} posts · {row.postsWithMetric} with{' '}
                        {metricLabel(metric).toLowerCase()}
                      </div>
                    </div>
                    <div className="text-right text-sm font-semibold text-ocean-700">
                      {formatMetricValue(metric, row.value)}
                    </div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-graystone-100">
                    <div
                      className="h-full rounded-full bg-ocean-500 transition-all"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const TrendCard: React.FC<{
  metric: string;
  trend: { key: string; label: string; value: number; posts: number }[];
}> = ({ metric, trend }) => {
  const maxValue = trend.reduce((max, point) => Math.max(max, point.value), 0);

  return (
    <Card className="shadow-xl">
      <CardHeader>
        <CardTitle className="text-xl text-ocean-900">Trend over time</CardTitle>
        <p className="text-sm text-graystone-500">
          {metricLabel(metric)} across the active timeframe and filters.
        </p>
      </CardHeader>
      <CardContent>
        {!trend.length ? (
          <div className="rounded-2xl border border-dashed border-graystone-200 px-4 py-8 text-sm text-graystone-500">
            No data points available for this combination of filters yet.
          </div>
        ) : (
          <div className="space-y-3">
            {trend.map((point) => {
              const width = maxValue > 0 ? (point.value / maxValue) * 100 : 0;
              return (
                <div
                  key={point.key}
                  className="grid gap-2 md:grid-cols-[160px_1fr_96px] md:items-center"
                >
                  <div className="text-sm font-medium text-ocean-900">{point.label}</div>
                  <div className="h-3 overflow-hidden rounded-full bg-graystone-100">
                    <div
                      className="h-full rounded-full bg-aqua-400 transition-all"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <div className="text-right text-sm font-semibold text-ocean-700">
                    {formatMetricValue(metric, point.value)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const TopPerformerCard: React.FC<{
  performer: TopPerformer;
  rank: number;
  metric: string;
}> = ({ performer, rank, metric }) => (
  <div className="flex items-start gap-3 rounded-2xl border border-graystone-200 bg-white p-3">
    <div
      className={cx(
        'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold',
        rank === 1
          ? 'bg-amber-100 text-amber-700'
          : rank === 2
            ? 'bg-graystone-200 text-graystone-700'
            : 'bg-orange-100 text-orange-700',
      )}
    >
      {rank}
    </div>
    <div className="min-w-0 flex-1">
      <div className="truncate text-sm font-semibold text-ocean-900">
        {performer.entry.caption?.slice(0, 72) || 'Untitled'}
      </div>
      <div className="mt-1 text-xs text-graystone-500">
        {performer.entry.platforms.join(', ') || 'No platform'} ·{' '}
        {new Date(performer.entry.date).toLocaleDateString()}
      </div>
      <div className="mt-1 text-xs text-graystone-500">
        {performer.entry.contentPillar || 'No pillar'} · {performer.entry.assetType || 'No asset'}
      </div>
    </div>
    <div className="text-right">
      <div className="text-lg font-bold text-ocean-700">
        {formatMetricValue(metric, performer.value)}
      </div>
      <div className="text-xs text-graystone-500">{metricLabel(metric)}</div>
    </div>
  </div>
);

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  entries,
  onUpdateEntry,
  onOpenImport,
}) => {
  const filterOptions = useMemo(() => getInsightFilterOptions(entries), [entries]);
  const [filters, setFilters] = useState<InsightFilters>(() =>
    createDefaultInsightFilters(entries),
  );
  const [wizardOpen, setWizardOpen] = useState(false);

  useEffect(() => {
    setFilters((current) => {
      const nextMetric =
        filterOptions.metrics.find((option) => option.value === current.metric)?.value ||
        filterOptions.metrics.find((option) => option.value === 'engagements')?.value ||
        filterOptions.metrics[0]?.value ||
        'posts';

      return {
        ...current,
        metric: nextMetric,
        platforms: current.platforms.filter((platform) =>
          filterOptions.platforms.includes(platform),
        ),
        campaigns: current.campaigns.filter((campaign) =>
          filterOptions.campaigns.includes(campaign),
        ),
        contentPillars: current.contentPillars.filter((pillar) =>
          filterOptions.contentPillars.includes(pillar),
        ),
        assetTypes: current.assetTypes.filter((assetType) =>
          filterOptions.assetTypes.includes(assetType),
        ),
        statuses: current.statuses.filter((status) => filterOptions.statuses.includes(status)),
        authors: current.authors.filter((author) => filterOptions.authors.includes(author)),
        audienceSegments: current.audienceSegments.filter((segment) =>
          filterOptions.audienceSegments.includes(segment),
        ),
      };
    });
  }, [filterOptions]);

  const insights = useMemo(() => buildInsightsSnapshot(entries, filters), [entries, filters]);

  const activeFilterCount = [
    filters.platforms.length,
    filters.campaigns.length,
    filters.contentPillars.length,
    filters.assetTypes.length,
    filters.authors.length,
    filters.audienceSegments.length,
    filters.statuses.length < filterOptions.statuses.length ? 1 : 0,
    filters.timePeriod === 'custom' && (filters.customStartDate || filters.customEndDate) ? 1 : 0,
  ].reduce((sum, value) => sum + value, 0);

  const updateFilter = <K extends keyof InsightFilters>(key: K, value: InsightFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const resetFilters = () => {
    setFilters(createDefaultInsightFilters(entries));
  };

  const statusOptions = filterOptions.statuses.map((status) => ({ value: status, label: status }));
  const metricOptions = filterOptions.metrics.map((metric) => ({
    value: metric.value,
    label: metric.label,
  }));

  return (
    <div className="space-y-6">
      <div className="gradient-header rounded-2xl p-8 text-white shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-3xl">
            <h1 className="heading-font mb-2 text-3xl font-bold">Insights</h1>
            <p className="text-ocean-100">
              Assess performance across platform, metric, timeframe, content pillar, campaign, asset
              type, author, audience segment, and status from one workspace.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge className="bg-white/15 text-white">{insights.rangeLabel}</Badge>
              <Badge className="bg-white/15 text-white">
                {metricLabel(filters.metric)} in focus
              </Badge>
              {activeFilterCount > 0 ? (
                <Badge className="bg-white/15 text-white">{activeFilterCount} active filters</Badge>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {onOpenImport ? (
              <Button
                onClick={onOpenImport}
                variant="outline"
                className="border-white/30 bg-white/10 text-white hover:bg-white/20"
              >
                Import CSV
              </Button>
            ) : null}
            {onUpdateEntry ? (
              <Button
                onClick={() => setWizardOpen(true)}
                className="bg-white text-ocean-700 hover:bg-ocean-50"
              >
                Log metrics
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-xl text-ocean-900">Filters</CardTitle>
              <p className="mt-1 text-sm text-graystone-500">
                Slice performance by the variables that matter most to the question you are asking.
              </p>
            </div>
            <Button variant="ghost" onClick={resetFilters} className="text-sm text-ocean-700">
              Clear filters
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="insights-time-period">Timeframe</Label>
            <select
              id="insights-time-period"
              value={filters.timePeriod}
              onChange={(event) => updateFilter('timePeriod', event.target.value as TimePeriod)}
              className={cx(selectBaseClasses, 'w-full px-4 py-2 text-sm')}
            >
              {TIME_PERIODS.map((period) => (
                <option key={period.value} value={period.value}>
                  {period.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="insights-metric">Metric</Label>
            <select
              id="insights-metric"
              value={filters.metric}
              onChange={(event) => updateFilter('metric', event.target.value)}
              className={cx(selectBaseClasses, 'w-full px-4 py-2 text-sm')}
            >
              {metricOptions.map((metric) => (
                <option key={metric.value} value={metric.value}>
                  {metric.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Platforms</Label>
            <MultiSelect
              placeholder="All platforms"
              value={filters.platforms}
              onChange={(value) => updateFilter('platforms', value)}
              options={filterOptions.platforms.map((platform) => ({
                value: platform,
                label: platform,
              }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <MultiSelect
              placeholder="All statuses"
              value={filters.statuses}
              onChange={(value) => updateFilter('statuses', value)}
              options={statusOptions}
            />
          </div>

          {filters.timePeriod === 'custom' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="insights-start-date">Start date</Label>
                <Input
                  id="insights-start-date"
                  type="date"
                  value={filters.customStartDate}
                  onChange={(event) => updateFilter('customStartDate', event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="insights-end-date">End date</Label>
                <Input
                  id="insights-end-date"
                  type="date"
                  value={filters.customEndDate}
                  onChange={(event) => updateFilter('customEndDate', event.target.value)}
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label>Content pillars</Label>
            <MultiSelect
              placeholder="All pillars"
              value={filters.contentPillars}
              onChange={(value) => updateFilter('contentPillars', value)}
              options={filterOptions.contentPillars.map((pillar) => ({
                value: pillar,
                label: pillar,
              }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Campaigns</Label>
            <MultiSelect
              placeholder="All campaigns"
              value={filters.campaigns}
              onChange={(value) => updateFilter('campaigns', value)}
              options={filterOptions.campaigns.map((campaign) => ({
                value: campaign,
                label: campaign,
              }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Asset types</Label>
            <MultiSelect
              placeholder="All asset types"
              value={filters.assetTypes}
              onChange={(value) => updateFilter('assetTypes', value)}
              options={filterOptions.assetTypes.map((assetType) => ({
                value: assetType,
                label: assetType,
              }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Authors</Label>
            <MultiSelect
              placeholder="All authors"
              value={filters.authors}
              onChange={(value) => updateFilter('authors', value)}
              options={filterOptions.authors.map((author) => ({
                value: author,
                label: author,
              }))}
            />
          </div>

          <div className="space-y-2 md:col-span-2 xl:col-span-4">
            <Label>Audience segments</Label>
            <MultiSelect
              placeholder="All segments"
              value={filters.audienceSegments}
              onChange={(value) => updateFilter('audienceSegments', value)}
              options={filterOptions.audienceSegments.map((segment) => ({
                value: segment,
                label: segment,
              }))}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          title="Posts in scope"
          value={insights.totalPosts.toLocaleString()}
          subtitle="Entries matching the current filters"
        />
        <SummaryCard
          title={metricLabel(filters.metric)}
          value={formatMetricValue(filters.metric, insights.totalMetricValue)}
          subtitle="Total across the current scope"
        />
        <SummaryCard
          title={filters.metric === 'engagementRate' ? 'Weighted average rate' : 'Average per post'}
          value={formatMetricValue(filters.metric, insights.averageMetricValue)}
          subtitle="Average contribution per post in scope"
        />
        <SummaryCard
          title="Metric coverage"
          value={`${insights.coverageRate.toFixed(0)}%`}
          subtitle={`${insights.postsWithSelectedMetric}/${insights.totalPosts || 0} posts include ${metricLabel(filters.metric).toLowerCase()} data`}
        />
        <SummaryCard
          title="Analytics coverage"
          value={`${insights.analyticsCoverageRate.toFixed(0)}%`}
          subtitle={`${insights.postsWithAnyAnalytics}/${insights.totalPosts || 0} posts have any analytics`}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[2fr_1fr]">
        <TrendCard metric={filters.metric} trend={insights.trend} />

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl text-ocean-900">Data readiness</CardTitle>
            <p className="text-sm text-graystone-500">
              Spot where missing analytics are suppressing the picture.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl bg-ocean-50 p-4">
              <div className="text-sm font-semibold text-ocean-900">
                {insights.postsWithSelectedMetric} of {insights.totalPosts} posts have{' '}
                {metricLabel(filters.metric).toLowerCase()} data.
              </div>
              <div className="mt-1 text-xs text-graystone-600">
                Use manual logging for one-off updates or CSV import for bulk platform exports.
              </div>
            </div>

            <div className="space-y-2 text-sm text-graystone-600">
              <div className="flex items-center justify-between rounded-xl border border-graystone-200 px-3 py-2">
                <span>Selected metric coverage</span>
                <span className="font-semibold text-ocean-700">
                  {insights.coverageRate.toFixed(0)}%
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-graystone-200 px-3 py-2">
                <span>Any analytics coverage</span>
                <span className="font-semibold text-ocean-700">
                  {insights.analyticsCoverageRate.toFixed(0)}%
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-graystone-200 px-3 py-2">
                <span>Posts without analytics</span>
                <span className="font-semibold text-ocean-700">
                  {(insights.totalPosts - insights.postsWithAnyAnalytics).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {onOpenImport ? (
                <Button onClick={onOpenImport} variant="outline">
                  Import CSV
                </Button>
              ) : null}
              {onUpdateEntry ? (
                <Button onClick={() => setWizardOpen(true)}>Log metrics</Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <BreakdownCard
          title="Platform breakdown"
          rows={insights.breakdowns.platforms}
          metric={filters.metric}
          emptyLabel="No platform performance is available for this filter set."
        />
        <BreakdownCard
          title="Content pillar breakdown"
          rows={insights.breakdowns.contentPillars}
          metric={filters.metric}
          emptyLabel="No content pillars match the current filters."
        />
        <BreakdownCard
          title="Campaign breakdown"
          rows={insights.breakdowns.campaigns}
          metric={filters.metric}
          emptyLabel="No campaigns match the current filters."
        />
        <BreakdownCard
          title="Asset type breakdown"
          rows={insights.breakdowns.assetTypes}
          metric={filters.metric}
          emptyLabel="No asset types match the current filters."
        />
        <BreakdownCard
          title="Author breakdown"
          rows={insights.breakdowns.authors}
          metric={filters.metric}
          emptyLabel="No author data matches the current filters."
        />
        <BreakdownCard
          title="Audience segment breakdown"
          rows={insights.breakdowns.audienceSegments}
          metric={filters.metric}
          emptyLabel="No audience segment data matches the current filters."
        />
      </div>

      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-xl text-ocean-900">Top performers</CardTitle>
          <p className="text-sm text-graystone-500">
            Highest-performing posts using the active metric and filters.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {!insights.topPerformers.length ? (
            <div className="rounded-2xl border border-dashed border-graystone-200 px-4 py-8 text-center text-sm text-graystone-500">
              No posts have {metricLabel(filters.metric).toLowerCase()} data in this filtered scope
              yet.
            </div>
          ) : (
            insights.topPerformers.map((performer, index) => (
              <TopPerformerCard
                key={performer.entry.id}
                performer={performer}
                rank={index + 1}
                metric={filters.metric === 'posts' ? 'engagements' : filters.metric}
              />
            ))
          )}
        </CardContent>
      </Card>

      {!insights.filteredEntries.length && (
        <Card className="shadow-xl">
          <CardContent className="py-12 text-center">
            <h3 className="mb-2 text-lg font-semibold text-ocean-900">
              No posts match these filters
            </h3>
            <p className="text-sm text-graystone-600">
              Try widening the timeframe, clearing some filters, or logging/importing analytics for
              more entries.
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
