import { describe, it, expect } from 'vitest';
import { buildPublishPayload, getAggregatePublishStatus } from '../publishUtils';
import type { Entry } from '../../../types/models';

const baseEntry = {
  id: '1',
  platforms: ['LinkedIn'],
  caption: 'Test caption',
  platformCaptions: {},
  assetType: 'Design',
  assetPreviews: [],
  previewUrl: '',
  date: '2026-03-27',
  firstComment: '',
  campaign: '',
  contentPillar: '',
  links: [],
} as unknown as Entry;

describe('buildPublishPayload', () => {
  it('includes assetType in the payload', () => {
    const payload = buildPublishPayload({ ...baseEntry, assetType: 'Video' } as unknown as Entry);
    expect(payload.assetType).toBe('Video');
  });

  it('uses assetPreviews as mediaUrls', () => {
    const entry = {
      ...baseEntry,
      assetPreviews: [
        'https://storage.example.com/img1.jpg',
        'https://storage.example.com/img2.jpg',
      ],
    } as unknown as Entry;
    const payload = buildPublishPayload(entry);
    expect(payload.mediaUrls).toEqual([
      'https://storage.example.com/img1.jpg',
      'https://storage.example.com/img2.jpg',
    ]);
  });

  it('filters base64 data URLs out of mediaUrls', () => {
    const entry = {
      ...baseEntry,
      assetPreviews: ['https://storage.example.com/img1.jpg', 'data:image/jpeg;base64,/9j/4AAQ=='],
    } as unknown as Entry;
    const payload = buildPublishPayload(entry);
    expect(payload.mediaUrls).toEqual(['https://storage.example.com/img1.jpg']);
  });

  it('falls back to legacy attachment urls when asset previews are absent', () => {
    const entry = {
      ...baseEntry,
      attachments: [
        {
          id: 'attachment-1',
          name: 'legacy-image.jpg',
          dataUrl: 'data:image/jpeg;base64,/9j/4AAQ==',
          url: 'https://legacy.example.com/image.jpg',
          type: 'image/jpeg',
          size: 1024,
        },
      ],
    } as unknown as Entry;
    const payload = buildPublishPayload(entry);
    expect(payload.mediaUrls).toEqual(['https://legacy.example.com/image.jpg']);
  });

  it('deduplicates matching asset preview and attachment urls', () => {
    const url = 'https://storage.example.com/shared-image.jpg';
    const entry = {
      ...baseEntry,
      assetPreviews: [url],
      attachments: [
        {
          id: 'attachment-1',
          name: 'shared-image.jpg',
          dataUrl: 'data:image/jpeg;base64,/9j/4AAQ==',
          url,
          type: 'image/jpeg',
          size: 1024,
        },
      ],
    } as unknown as Entry;
    const payload = buildPublishPayload(entry);
    expect(payload.mediaUrls).toEqual([url]);
  });
});

describe('getAggregatePublishStatus', () => {
  it('returns failed when all platforms are skipped', () => {
    expect(
      getAggregatePublishStatus({
        Instagram: { status: 'skipped', url: null, error: 'not implemented', timestamp: 't' },
      }),
    ).toBe('failed');
  });
});
