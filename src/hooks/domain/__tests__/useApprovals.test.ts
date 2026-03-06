import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useApprovals } from '../useApprovals';

describe('useApprovals', () => {
  it('matches outstanding approvals using the shared viewer matcher', () => {
    const { result } = renderHook(() =>
      useApprovals({
        apiGet: vi.fn(),
        entries: [
          {
            id: 'entry-1',
            date: '2026-03-20',
            status: 'Pending',
            approvers: ['Fran Harrison'],
          },
          {
            id: 'entry-2',
            date: '2026-03-21',
            status: 'Pending',
            approvers: ['fran.harrison@example.org'],
          },
          {
            id: 'entry-3',
            date: '2026-03-22',
            status: 'Approved',
            approvers: ['Fran Harrison'],
          },
        ],
        viewerMatchesValue: (value) =>
          ['fran harrison', 'fran.harrison@example.org'].includes(
            String(value || '')
              .trim()
              .toLowerCase(),
          ),
      }),
    );

    expect(result.current.outstandingApprovals.map((entry) => entry.id)).toEqual([
      'entry-1',
      'entry-2',
    ]);
  });
});
