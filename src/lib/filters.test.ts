// src/lib/filters.test.ts
import { describe, it, expect } from 'vitest';
import { isApprovalOverdue, matchesSearch } from './filters';
import type { Entry } from '../types/models';

// Minimal stub covering all required Entry fields.
// Optional fields are omitted; add overrides as needed per test.
function makeEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 'entry-1',
    date: '2026-01-01',
    platforms: [],
    assetType: '',
    caption: '',
    platformCaptions: {},
    firstComment: '',
    status: 'Draft',
    priorityTier: 'Medium',
    approvers: [],
    author: '',
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
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    approvedAt: null,
    deletedAt: null,
    ...overrides,
  } as Entry;
}

describe('isApprovalOverdue', () => {
  it('returns false when entry has no approvalDeadline', () => {
    expect(isApprovalOverdue(makeEntry())).toBe(false);
  });

  it('returns false when approvalDeadline is in the future', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    expect(isApprovalOverdue(makeEntry({ approvalDeadline: future, status: 'Draft' }))).toBe(false);
  });

  it('returns true when approvalDeadline is in the past and status is not Approved', () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    expect(isApprovalOverdue(makeEntry({ approvalDeadline: past, status: 'Draft' }))).toBe(true);
  });

  it('returns false when deadline is past but status is Approved', () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    expect(isApprovalOverdue(makeEntry({ approvalDeadline: past, status: 'Approved' }))).toBe(
      false,
    );
  });

  it('returns false for an invalid date string', () => {
    expect(isApprovalOverdue(makeEntry({ approvalDeadline: 'not-a-date' }))).toBe(false);
  });
});

describe('matchesSearch', () => {
  it('returns true for empty query — all entries match', () => {
    expect(matchesSearch(makeEntry({ caption: 'hello' }), '')).toBe(true);
    expect(matchesSearch(makeEntry({ caption: 'hello' }), '   ')).toBe(true);
  });

  it('matches against caption, case-insensitively', () => {
    const entry = makeEntry({ caption: 'Climate action is urgent' });
    expect(matchesSearch(entry, 'climate')).toBe(true);
    expect(matchesSearch(entry, 'CLIMATE')).toBe(true);
  });

  it('returns false when query does not appear in any field', () => {
    expect(
      matchesSearch(makeEntry({ caption: 'Population rights', platforms: ['LinkedIn'] }), 'xyz123'),
    ).toBe(false);
  });

  it('matches against platforms array', () => {
    expect(matchesSearch(makeEntry({ platforms: ['LinkedIn', 'Twitter'] }), 'linkedin')).toBe(true);
  });

  it('matches against author field', () => {
    expect(matchesSearch(makeEntry({ author: 'Fran Harrison' }), 'fran')).toBe(true);
  });

  it('matches against campaign field', () => {
    expect(matchesSearch(makeEntry({ campaign: 'World Population Day' }), 'population day')).toBe(
      true,
    );
  });

  it('matches against assetType field', () => {
    expect(matchesSearch(makeEntry({ assetType: 'Video' }), 'video')).toBe(true);
  });

  it('matches against contentPillar field', () => {
    expect(matchesSearch(makeEntry({ contentPillar: 'Health & Rights' }), 'health')).toBe(true);
  });

  it('matches against firstComment field', () => {
    expect(matchesSearch(makeEntry({ firstComment: 'Urgent: verify sources' }), 'verify')).toBe(
      true,
    );
  });
});
