// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Entry } from '../../../types/models';
import { AnalyticsView } from '../AnalyticsView';

const createEntry = (overrides: Partial<Entry>): Entry => ({
  id: overrides.id || 'entry-1',
  date: overrides.date || '2026-03-05',
  platforms: overrides.platforms || ['Instagram'],
  assetType: overrides.assetType || 'Design',
  caption: overrides.caption || 'Example post',
  platformCaptions: overrides.platformCaptions || {},
  firstComment: overrides.firstComment || '',
  status: overrides.status || 'Approved',
  priorityTier: overrides.priorityTier || 'Medium',
  approvers: overrides.approvers || [],
  author: overrides.author || 'Dan',
  campaign: overrides.campaign || 'Campaign',
  contentPillar: overrides.contentPillar || 'Social Justice',
  previewUrl: overrides.previewUrl || '',
  checklist: overrides.checklist || {},
  analytics: overrides.analytics || {},
  workflowStatus: overrides.workflowStatus || 'Published',
  statusDetail: overrides.statusDetail || '',
  aiFlags: overrides.aiFlags || [],
  aiScore: overrides.aiScore || {},
  testingFrameworkId: overrides.testingFrameworkId || '',
  testingFrameworkName: overrides.testingFrameworkName || '',
  createdAt: overrides.createdAt || '2026-03-01T09:00:00.000Z',
  updatedAt: overrides.updatedAt || '2026-03-01T09:00:00.000Z',
  approvedAt: overrides.approvedAt || null,
  deletedAt: overrides.deletedAt || null,
  evergreen: overrides.evergreen,
  publishStatus: overrides.publishStatus,
  publishedAt: overrides.publishedAt,
  variantOfId: overrides.variantOfId,
  variantIds: overrides.variantIds,
  relatedEntryIds: overrides.relatedEntryIds,
  audienceSegments: overrides.audienceSegments || [],
  goldenThreadPass: overrides.goldenThreadPass ?? null,
  assessmentScores: overrides.assessmentScores ?? null,
  influencerId: overrides.influencerId,
  url: overrides.url,
  script: overrides.script,
  designCopy: overrides.designCopy,
  carouselSlides: overrides.carouselSlides,
  approvalDeadline: overrides.approvalDeadline,
  analyticsUpdatedAt: overrides.analyticsUpdatedAt,
  comments: overrides.comments,
  links: overrides.links,
  attachments: overrides.attachments,
});

describe('AnalyticsView', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-20T09:00:00.000Z'));
  });

  it('updates the summary when metric and platform filters change', () => {
    const entries = [
      createEntry({
        id: 'instagram-post',
        date: '2026-03-05',
        platforms: ['Instagram'],
        analytics: {
          Instagram: { impressions: 100, likes: 10, comments: 2, shares: 1, clicks: 3 },
        },
      }),
      createEntry({
        id: 'linkedin-post',
        date: '2026-03-11',
        platforms: ['LinkedIn'],
        analytics: {
          LinkedIn: { impressions: 200, likes: 5, comments: 1, clicks: 20 },
        },
      }),
    ];

    render(<AnalyticsView entries={entries} onOpenImport={() => {}} />);

    fireEvent.change(screen.getByLabelText('Metric'), {
      target: { value: 'impressions' },
    });

    const metricSummary = screen
      .getByText('Total across the current scope')
      .closest('div')?.parentElement;
    expect(metricSummary).not.toBeNull();
    expect(within(metricSummary as HTMLElement).getByText('300')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'All platforms' }));
    fireEvent.click(screen.getByLabelText('Instagram'));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(within(metricSummary as HTMLElement).getByText('100')).toBeInTheDocument();
    expect(screen.getByText('1/1 posts include impressions data')).toBeInTheDocument();
  });
});
