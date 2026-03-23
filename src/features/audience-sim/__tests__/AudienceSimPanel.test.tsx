// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AudienceSimPanel } from '../AudienceSimPanel';
import type { Entry } from '../../../types/models';

vi.mock('../useAudienceSim', () => ({
  useAudienceSim: () => ({
    sim: null,
    history: [],
    loading: false,
    error: null,
    runSim: vi.fn(),
    loadHistory: vi.fn().mockResolvedValue([]),
    polling: false,
  }),
}));

vi.mock('../useIterate', () => ({
  useIterate: () => ({
    diff: null,
    revised: null,
    iterating: false,
    error: null,
    iterate: vi.fn(),
    accept: vi.fn(),
    reject: vi.fn(),
  }),
}));

const entry: Entry = {
  id: 'entry-1',
  date: '2026-03-21',
  platforms: ['LinkedIn'],
  assetType: 'Social',
  caption: 'Population Matters supports rights-based climate action.',
  platformCaptions: {},
  firstComment: '',
  status: 'Pending',
  priorityTier: 'Medium',
  approvers: [],
  author: 'Dan',
  campaign: '',
  contentPillar: '',
  previewUrl: '',
  checklist: {},
  analytics: {},
  workflowStatus: 'Draft',
  statusDetail: '',
  aiFlags: [],
  aiScore: {},
  testingFrameworkId: '',
  testingFrameworkName: '',
  createdAt: '2026-03-21T10:00:00.000Z',
  updatedAt: '2026-03-21T10:00:00.000Z',
  approvedAt: null,
  deletedAt: null,
};

describe('AudienceSimPanel', () => {
  it('renders the segment picker and run button', () => {
    render(<AudienceSimPanel entry={entry} />);

    expect(screen.getByText('Audience Sim')).toBeInTheDocument();
    expect(screen.getByText('The Guardians')).toBeInTheDocument();
    expect(screen.getByText('The Persuadables')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run' })).toBeInTheDocument();
  });
});
