import { describe, expect, it } from 'vitest';
import { buildRapidResponseFromOpportunity, buildRapidResponseSnapshot } from './rapidResponses';
import type { Opportunity, RapidResponse } from '../types/models';

describe('rapidResponses', () => {
  it('builds a rapid response from a high urgency opportunity', () => {
    const opportunity: Opportunity = {
      id: 'opp-1',
      date: '2026-03-06',
      description: 'Breaking policy announcement',
      angle: 'Respond with rights framing',
      urgency: 'High',
      status: 'Open',
      createdBy: 'Dan',
      createdAt: '2026-03-06T08:00:00.000Z',
      updatedAt: '2026-03-06T08:00:00.000Z',
    };
    const response = buildRapidResponseFromOpportunity(opportunity, 'Dan');
    expect(response.responseMode).toBe('Rapid response');
    expect(response.signOffRoute).toBe('Reactive / rapid response');
  });

  it('marks an open response overdue when past due', () => {
    const response: RapidResponse = {
      id: 'rr-1',
      title: 'Response',
      owner: 'Dan',
      status: 'Drafting',
      responseMode: 'Rapid response',
      triggerDate: '2026-03-06',
      dueAt: '2026-03-06T09:00:00.000Z',
      targetPlatforms: [],
      createdAt: '2026-03-06T08:00:00.000Z',
      updatedAt: '2026-03-06T08:00:00.000Z',
    };
    const snapshot = buildRapidResponseSnapshot(response, new Date('2026-03-06T12:00:00.000Z'));
    expect(snapshot.overdue).toBe(true);
  });
});
