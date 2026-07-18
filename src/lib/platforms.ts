/**
 * Platform normalisation and performance CSV header matching.
 * Extracted from app.jsx.
 */
import { ALL_PLATFORMS, PLATFORM_METRICS } from '../constants';
import type { Platform } from '../constants';

export const PLATFORM_ALIAS_MAP: Record<string, Platform> = (() => {
  const map: Record<string, Platform> = {};
  const add = (alias: string, canonical: Platform) => {
    if (!alias) return;
    const key = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!key) return;
    map[key] = canonical;
  };
  ALL_PLATFORMS.forEach((platform) => {
    add(platform, platform);
  });
  add('bluesky', 'BlueSky');
  add('blue sky', 'BlueSky');
  add('bsky', 'BlueSky');
  add('linkedin', 'LinkedIn');
  add('facebook', 'Facebook');
  add('fb', 'Facebook');
  add('instagram', 'Instagram');
  add('ig', 'Instagram');
  add('youtube', 'YouTube');
  add('yt', 'YouTube');
  return map;
})();

export const normalizePlatform = (value: unknown): string => {
  if (!value) return '';
  const cleaned = String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  if (!cleaned) return '';
  return PLATFORM_ALIAS_MAP[cleaned] || '';
};

export const PERFORMANCE_METRIC_ALIAS_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  const add = (alias: string, canonical: string) => {
    const key = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (key) map[key] = canonical;
  };

  Object.values(PLATFORM_METRICS).forEach((fields) => {
    fields.forEach((field) => {
      add(field.key, field.key);
      add(field.label, field.key);
    });
  });

  add('Post impressions', 'impressions');
  add('Organic impressions', 'impressions');
  add('Post reach', 'reach');
  add('Organic reach', 'reach');
  add('Accounts reached', 'reach');
  add('Total engagements', 'engagements');
  add('Post engagements', 'engagements');
  add('Video views', 'views');
  add('New subscribers', 'subscribersGained');

  return map;
})();

export const normalizePerformanceMetricKey = (value: unknown): string => {
  const original = String(value || '').trim();
  if (!original) return '';
  const cleaned = original.toLowerCase().replace(/[^a-z0-9]/g, '');
  return PERFORMANCE_METRIC_ALIAS_MAP[cleaned] || original;
};

export const PERFORMANCE_HEADER_KEYS: Record<string, string[]> = {
  entryId: ['entry_id', 'content_id', 'dashboard_id', 'id'],
  date: ['date', 'post_date', 'published_date', 'scheduled_date'],
  platform: ['platform', 'channel', 'network'],
  caption: ['caption', 'copy', 'post_text', 'text'],
  url: ['url', 'link', 'permalink'],
};

export const PERFORMANCE_IGNORED_METRIC_KEYS = new Set([
  ...PERFORMANCE_HEADER_KEYS.entryId,
  ...PERFORMANCE_HEADER_KEYS.date,
  ...PERFORMANCE_HEADER_KEYS.platform,
  ...PERFORMANCE_HEADER_KEYS.caption,
  ...PERFORMANCE_HEADER_KEYS.url,
  'notes',
]);
