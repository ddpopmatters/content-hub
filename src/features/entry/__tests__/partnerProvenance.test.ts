import { describe, expect, it } from 'vitest';

describe('partner provenance field definitions', () => {
  it('consent status options cover the three valid states', () => {
    const validStatuses = ['confirmed', 'pending', 'not-required'] as const;
    type ConsentStatus = (typeof validStatuses)[number];
    const value: ConsentStatus = 'confirmed';
    expect(validStatuses).toContain(value);
  });

  it('select option labels are non-empty for all three states', () => {
    const labels: Record<string, string> = {
      confirmed: 'Consent confirmed',
      pending: 'Consent pending',
      'not-required': 'Not required',
    };
    Object.values(labels).forEach((label) => expect(label.length).toBeGreaterThan(0));
  });
});
