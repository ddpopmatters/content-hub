import { describe, expect, it } from 'vitest';

import {
  normalizePerformanceMetricKey,
  normalizePlatform,
  PERFORMANCE_IGNORED_METRIC_KEYS,
} from './platforms';

describe('platform normalisation', () => {
  it('accepts BlueSky aliases without treating X or Twitter as BlueSky', () => {
    expect(normalizePlatform('BlueSky')).toBe('BlueSky');
    expect(normalizePlatform('blue sky')).toBe('BlueSky');
    expect(normalizePlatform('bsky')).toBe('BlueSky');
    expect(normalizePlatform('X')).toBe('');
    expect(normalizePlatform('Twitter')).toBe('');
    expect(normalizePlatform('X/Twitter')).toBe('');
  });
});

describe('performance metric normalisation', () => {
  it('maps platform export headings to Content Hub metric keys', () => {
    expect(normalizePerformanceMetricKey('Post impressions')).toBe('impressions');
    expect(normalizePerformanceMetricKey('Likes / Reactions')).toBe('likes');
    expect(normalizePerformanceMetricKey('Reposts / Shares')).toBe('shares');
    expect(normalizePerformanceMetricKey('Watch time (mins)')).toBe('watchTime');
  });

  it('does not discard the comments metric during CSV import', () => {
    expect(PERFORMANCE_IGNORED_METRIC_KEYS.has('comments')).toBe(false);
  });
});
