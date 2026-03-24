import { describe, it, expect } from 'vitest';
import { getAggregatePublishStatus } from '../publishUtils';

describe('getAggregatePublishStatus', () => {
  it('returns failed when all platforms are skipped', () => {
    expect(
      getAggregatePublishStatus({
        Instagram: { status: 'skipped', url: null, error: 'not implemented', timestamp: 't' },
      }),
    ).toBe('failed');
  });
});
