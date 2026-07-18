import { describe, expect, it } from 'vitest';
import { buildContentMediaPath, getContentMediaFileIssue } from './useAssetPreviewUpload';

describe('content media upload contract', () => {
  it('accepts direct-publication images and planning-only video or PDF media', () => {
    for (const type of [
      'application/pdf',
      'image/gif',
      'image/jpeg',
      'image/png',
      'image/webp',
      'video/mp4',
      'video/quicktime',
      'video/webm',
    ]) {
      expect(getContentMediaFileIssue({ type, size: 1024 })).toBeNull();
    }
  });

  it('rejects unsafe formats, empty files and format-specific oversize files', () => {
    expect(getContentMediaFileIssue({ type: 'image/svg+xml', size: 1024 })).toContain('supported');
    expect(getContentMediaFileIssue({ type: 'image/png', size: 0 })).toContain('empty');
    expect(getContentMediaFileIssue({ type: 'image/png', size: 10 * 1024 * 1024 + 1 })).toContain(
      '10 MB',
    );
    expect(
      getContentMediaFileIssue({ type: 'application/pdf', size: 25 * 1024 * 1024 + 1 }),
    ).toContain('25 MB');
  });

  it('derives the stored extension from MIME rather than the supplied filename', () => {
    expect(
      buildContentMediaPath({ type: 'image/jpeg' }, '00000000-0000-0000-0000-000000000001'),
    ).toBe('entries/00000000-0000-0000-0000-000000000001.jpg');
  });
});
