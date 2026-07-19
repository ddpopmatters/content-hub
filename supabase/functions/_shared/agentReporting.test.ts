import { assertEquals } from 'jsr:@std/assert@1';
import { buildReportingSnapshot, compareSavedReports } from './agentReporting.ts';

Deno.test('reporting snapshot keeps missing analytics distinct from measured zero', () => {
  const snapshot = buildReportingSnapshot(
    [
      {
        id: 'one',
        date: '2026-07-01',
        platforms: ['Instagram'],
        status: 'Published',
        analytics: { Instagram: { reach: 0, likes: 0 } },
      },
      {
        id: 'two',
        date: '2026-07-02',
        platforms: ['Instagram'],
        status: 'Published',
        analytics: {},
      },
    ],
    { startDate: '2026-07-01', endDate: '2026-07-31', platform: 'Instagram' },
  );
  const instagram = (snapshot.snapshots as Record<string, Record<string, unknown>>).Instagram;
  assertEquals(instagram.postsInWindow, 2);
  assertEquals(instagram.postsWithAnalytics, 1);
  assertEquals(instagram.analyticsCoveragePercent, 50);
  assertEquals((instagram.totals as Record<string, unknown>).reach, 0);
  assertEquals((instagram.totals as Record<string, unknown>).impressions, null);
});

Deno.test('reporting snapshot excludes unpublished entries with no platform metrics', () => {
  const snapshot = buildReportingSnapshot(
    [
      {
        id: 'draft-one',
        date: '2026-07-03',
        platforms: ['Instagram'],
        status: 'Draft',
        analytics: {},
      },
    ],
    { startDate: '2026-07-01', endDate: '2026-07-31', platform: 'Instagram' },
  );
  const instagram = (snapshot.snapshots as Record<string, Record<string, unknown>>).Instagram;
  assertEquals(instagram.postsInWindow, 0);
  assertEquals(instagram.dataStatus, 'no_recent_posts');
});

Deno.test('saved report comparison returns null when either period lacks a metric', () => {
  const comparison = compareSavedReports(
    { id: 'left', platformMetrics: { Instagram: { reach: 100, views: 20 } } },
    { id: 'right', platformMetrics: { Instagram: { reach: 130 } } },
  );
  const instagram = (comparison.comparison as Record<string, Record<string, unknown>>).Instagram;
  assertEquals(instagram.reach, { left: 100, right: 130, delta: 30 });
  assertEquals(instagram.views, { left: 20, right: null, delta: null });
});
