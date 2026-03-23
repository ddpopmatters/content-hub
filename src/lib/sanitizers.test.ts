import { describe, expect, it } from 'vitest';
import { determineWorkflowStatus, getWorkflowBlockers } from './sanitizers';

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
