import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UpcomingPeaksWidget } from '../UpcomingPeaksWidget';
import type { ContentPeak, Entry } from '../../../../types/models';

const peaks: ContentPeak[] = [
  {
    id: 'peak-1',
    title: 'World Population Day',
    startDate: '2026-07-01',
    endDate: '2026-07-14',
    priorityTier: 'Urgent',
    owner: 'Dan',
    requiredPlatforms: ['Instagram', 'LinkedIn'],
    requiredAssetTypes: ['Video'],
    linkedEntryIds: ['entry-1'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

const entries: Entry[] = [
  {
    id: 'entry-1',
    date: '2026-07-02',
    status: 'Approved',
    workflowStatus: 'Approved',
    caption: 'Population day post',
    platforms: ['Instagram'],
    assetType: 'Video',
  } as Entry,
];

describe('UpcomingPeaksWidget', () => {
  it('renders upcoming peak readiness', () => {
    render(<UpcomingPeaksWidget contentPeaks={peaks} entries={entries} onOpenPeaks={vi.fn()} />);

    expect(screen.getByText('Upcoming Peaks')).toBeInTheDocument();
    expect(screen.getByText('World Population Day')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
  });
});
