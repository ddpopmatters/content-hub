import { describe, expect, it } from 'vitest';
import { buildEntryEmailPayload, CONTENT_REVIEW_URL_PLACEHOLDER, entryReviewLink } from './email';

describe('entryReviewLink', () => {
  it('uses a server-replaced placeholder instead of exposing an entry ID', () => {
    const link = entryReviewLink({ id: 'entry-123' });

    expect(link).toBe(CONTENT_REVIEW_URL_PLACEHOLDER);
    expect(link).not.toContain('entry-123');
  });
});

describe('approval email planning language', () => {
  it('describes the entry date as planned rather than scheduled', () => {
    const payload = buildEntryEmailPayload({
      id: 'entry-123',
      date: '2026-07-20',
      author: 'Dan',
      platforms: ['BlueSky'],
      caption: 'Test content',
    });

    expect(payload?.text).toContain('Planned date:');
    expect(payload?.html).toContain('Planned date');
    expect(payload?.text).not.toContain('Scheduled:');
    expect(payload?.html).not.toContain('>Scheduled<');
  });
});
