import { describe, expect, it } from 'vitest';

import type { Entry } from '../types/models';
import { mergePerformanceData } from './performance';

const entry = {
  id: 'entry-1',
  date: '2026-07-14',
  platforms: ['BlueSky'],
  analytics: {},
} as Entry;

describe('mergePerformanceData', () => {
  it('stores recognised CSV headings under canonical metric keys', () => {
    const result = mergePerformanceData([entry], {
      headers: ['entry_id', 'platform', 'Post impressions', 'Reposts / Shares', 'Comments'],
      records: [
        {
          rowNumber: 2,
          record: {
            entry_id: 'entry-1',
            platform: 'BlueSky',
            'Post impressions': '1,250',
            'Reposts / Shares': '7',
            Comments: '3',
          },
        },
      ],
    });
    const analytics = result.nextEntries[0].analytics as Record<string, Record<string, unknown>>;

    expect(analytics.BlueSky.impressions).toBe(1250);
    expect(analytics.BlueSky.shares).toBe(7);
    expect(analytics.BlueSky.comments).toBe(3);
  });
});
