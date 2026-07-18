import { describe, expect, it } from 'vitest';
import {
  determineWorkflowStatus,
  getWorkflowBlockers,
  hasPublicationRelevantChanges,
  sanitizeEntry,
} from './sanitizers';

describe('workflow readiness helpers', () => {
  it('flags required execution blockers for video content awaiting review', () => {
    const blockers = getWorkflowBlockers({
      approvers: ['Fran'],
      assetType: 'Video',
      platforms: ['LinkedIn', 'YouTube'],
      previewUrl: '',
      subtitlesStatus: 'Pending',
      sourceVerified: false,
      seoPrimaryQuery: '',
    });

    expect(blockers.map((item) => item.label)).toEqual([
      'Asset preview uploaded',
      'Source verified',
      'CTA defined',
      'SEO query set',
      'Subtitles/transcript ready',
    ]);
  });

  it('requires alt text and UTM setup only when relevant', () => {
    const blockers = getWorkflowBlockers({
      approvers: ['Fran'],
      assetType: 'Design',
      previewUrl: 'https://cdn.pm/image.png',
      url: 'https://populationmatters.org/article',
      linkPlacement: 'First comment',
      altTextStatus: 'Pending',
      utmStatus: 'Pending',
      sourceVerified: true,
      ctaType: 'Read more',
    });

    expect(blockers.map((item) => item.label)).toEqual(['UTM plan ready', 'Alt text ready']);
  });

  it('marks entries ready for review when approvers exist, regardless of incomplete fields', () => {
    expect(
      determineWorkflowStatus({
        approvers: ['Fran'],
        assetType: 'Design',
        previewUrl: 'https://cdn.pm/image.png',
        altTextStatus: 'Ready',
        sourceVerified: true,
        ctaType: 'Donate',
        platforms: ['Instagram'],
      }),
    ).toBe('Ready for Review');

    // incomplete fields (altTextStatus Pending) should not block approval
    expect(
      determineWorkflowStatus({
        approvers: ['Fran'],
        assetType: 'Design',
        previewUrl: 'https://cdn.pm/image.png',
        altTextStatus: 'Pending',
        sourceVerified: false,
        platforms: ['Instagram'],
      }),
    ).toBe('Ready for Review');

    // no approvers → still Draft
    expect(
      determineWorkflowStatus({
        approvers: [],
        assetType: 'Design',
        previewUrl: 'https://cdn.pm/image.png',
        altTextStatus: 'Ready',
        sourceVerified: true,
        ctaType: 'Donate',
        platforms: ['Instagram'],
      }),
    ).toBe('Draft');
  });
});

describe('publication approval helpers', () => {
  const approvedEntry = {
    platforms: ['BlueSky'],
    assetType: 'Design',
    caption: 'Approved caption',
    platformCaptions: { BlueSky: 'Approved platform caption' },
    firstComment: 'Approved first comment',
    assetPreviews: ['https://cdn.example.org/image.jpg'],
    previewUrl: 'https://cdn.example.org/image.jpg',
    comments: [],
  };

  it('detects changes to fields sent to social providers', () => {
    expect(
      hasPublicationRelevantChanges(approvedEntry, {
        ...approvedEntry,
        caption: 'Edited caption',
      }),
    ).toBe(true);
    expect(
      hasPublicationRelevantChanges(approvedEntry, {
        ...approvedEntry,
        assetPreviews: ['https://cdn.example.org/replacement.jpg'],
      }),
    ).toBe(true);
  });

  it('ignores comments and planning metadata that are not published', () => {
    expect(
      hasPublicationRelevantChanges(approvedEntry, {
        ...approvedEntry,
        comments: [
          {
            id: 'comment-1',
            author: 'Fran',
            body: 'Looks good',
            createdAt: '2026-07-17T09:30:00.000Z',
          },
        ],
        campaign: 'Choice',
      }),
    ).toBe(false);
  });

  it('normalises database-owned approval revisions', () => {
    const current = sanitizeEntry({
      id: 'entry-1',
      contentRevision: 5,
      approvedRevision: 5,
    });
    const invalid = sanitizeEntry({
      id: 'entry-2',
      contentRevision: 2,
      approvedRevision: 3,
    });

    expect(current).toMatchObject({ contentRevision: 5, approvedRevision: 5 });
    expect(invalid).toMatchObject({ contentRevision: 2, approvedRevision: null });
  });
});
