// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WeeklyStatsWidget } from '../WeeklyStatsWidget';
import type { Entry } from '../../../../types/models';

function makeEntry(overrides: Partial<Entry>): Entry {
  return {
    id: 'e1',
    date: new Date().toISOString().split('T')[0],
    platforms: ['Instagram'],
    caption: 'Test post',
    platformCaptions: {},
    firstComment: '',
    status: 'Approved',
    priorityTier: 'Medium',
    approvers: [],
    author: 'dan@example.com',
    campaign: '',
    contentPillar: 'Social Justice',
    assetType: 'Design',
    previewUrl: '',
    checklist: {},
    analytics: {},
    workflowStatus: 'Published',
    statusDetail: '',
    aiFlags: [],
    aiScore: {},
    testingFrameworkId: '',
    testingFrameworkName: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    approvedAt: null,
    deletedAt: null,
    ...overrides,
  } as Entry;
}

describe('WeeklyStatsWidget', () => {
  it('shows Shares count from analytics', () => {
    const entry = makeEntry({
      analytics: { Instagram: { shares: 42, likes: 10, comments: 5, reach: 1000 } },
    });
    render(<WeeklyStatsWidget entries={[entry]} />);
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Shares')).toBeInTheDocument();
  });

  it('shows Saves count from analytics', () => {
    const entry = makeEntry({
      analytics: { Instagram: { saves: 17, likes: 10, comments: 2, reach: 500 } },
    });
    render(<WeeklyStatsWidget entries={[entry]} />);
    expect(screen.getByText('17')).toBeInTheDocument();
    expect(screen.getByText('Saves')).toBeInTheDocument();
  });

  it('does not show Total Reach as a primary metric label', () => {
    const entry = makeEntry({
      analytics: { Instagram: { reach: 9999, likes: 1 } },
    });
    render(<WeeklyStatsWidget entries={[entry]} />);
    expect(screen.queryByText('Total Reach')).not.toBeInTheDocument();
  });

  it('shows zero saves gracefully when analytics has no saves field', () => {
    const entry = makeEntry({ analytics: {} });
    render(<WeeklyStatsWidget entries={[entry]} />);
    expect(screen.getByText('Saves')).toBeInTheDocument();
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(2);
  });
});
