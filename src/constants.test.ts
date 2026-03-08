import { describe, expect, it } from 'vitest';
import { recommendApproversForRoute, recommendSignOffRoute } from './constants';

describe('recommendSignOffRoute', () => {
  it('prioritizes rapid-response content', () => {
    expect(recommendSignOffRoute({ responseMode: 'Rapid response' })).toBe(
      'Reactive / rapid response',
    );
    expect(recommendSignOffRoute({ responseMode: 'Reactive' })).toBe('Reactive / rapid response');
  });

  it('routes pre-bunk and counter-disinformation content correctly', () => {
    expect(recommendSignOffRoute({ responseMode: 'Pre-bunk' })).toBe(
      'Counter-disinformation / pre-bunking',
    );
    expect(
      recommendSignOffRoute({
        contentCategory: 'Counter-disinformation',
      }),
    ).toBe('Counter-disinformation / pre-bunking');
  });

  it('routes research launches and partner content', () => {
    expect(recommendSignOffRoute({ campaign: 'Research Launch' })).toBe(
      'Research publication content',
    );
    expect(recommendSignOffRoute({ partnerOrg: 'Population Europe' })).toBe(
      'Partner / E2P content',
    );
  });

  it('falls back to standard scheduled content', () => {
    expect(recommendSignOffRoute({})).toBe('Standard scheduled content');
  });

  it('recommends approvers for a route using matched roles first', () => {
    expect(
      recommendApproversForRoute('Research publication content', [
        'Social Lead',
        'Policy Lead',
        'Comms Lead',
      ]),
    ).toEqual(['Policy Lead', 'Comms Lead']);
  });

  it('falls back to the first available approvers when no route match exists', () => {
    expect(recommendApproversForRoute(undefined, ['A', 'B', 'C'])).toEqual(['A', 'B']);
  });
});
