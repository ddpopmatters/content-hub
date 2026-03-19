// src/lib/terminology.test.ts
import { describe, it, expect } from 'vitest';
import { checkTerminology, hasTerminologyIssues } from './terminology';

describe('checkTerminology', () => {
  it('returns empty array for clean text', () => {
    expect(checkTerminology('Reproductive rights are fundamental.')).toEqual([]);
  });

  it('flags "overpopulation" with the correct replacement suggestion', () => {
    const matches = checkTerminology('The problem of overpopulation is often misunderstood.');
    expect(matches).toHaveLength(1);
    expect(matches[0].term.toLowerCase()).toBe('overpopulation');
    expect(matches[0].useInstead).toContain('unsustainable population growth');
  });

  it('flags "population control" with the correct replacement suggestion', () => {
    const matches = checkTerminology('We oppose population control policies.');
    expect(matches).toHaveLength(1);
    expect(matches[0].term.toLowerCase()).toBe('population control');
    expect(matches[0].useInstead).toContain('voluntary family planning access');
  });

  it('flags "overpopulated countries"', () => {
    const matches = checkTerminology('overpopulated countries face real pressures');
    expect(matches).toHaveLength(1);
    expect(matches[0].useInstead).toContain('rapid population growth');
  });

  it('flags "too many people"', () => {
    const matches = checkTerminology('There are too many people on the planet.');
    expect(matches).toHaveLength(1);
    expect(matches[0].useInstead).toContain('rights');
  });

  it('flags "population stabilisation"', () => {
    const matches = checkTerminology('population stabilisation is our stated goal');
    expect(matches).toHaveLength(1);
  });

  it('is case-insensitive', () => {
    expect(checkTerminology('Overpopulation is wrong framing.')).toHaveLength(1);
    expect(checkTerminology('OVERPOPULATION concerns')).toHaveLength(1);
    expect(checkTerminology('Population Control')).toHaveLength(1);
  });

  it('does not flag "population" as a partial match for "population control"', () => {
    expect(checkTerminology('population matters as an organisation')).toHaveLength(0);
  });

  it('finds multiple banned terms in the same text', () => {
    const matches = checkTerminology('Overpopulation leads some to support population control.');
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('returns matches sorted by their position in the text', () => {
    const matches = checkTerminology(
      'Overpopulation and population control are both wrong frames.',
    );
    expect(matches[0].index).toBeLessThan(matches[1].index);
  });

  it('returns the correct index and length of the match', () => {
    const text = 'The word overpopulation appears here.';
    const matches = checkTerminology(text);
    expect(matches[0].index).toBe(text.indexOf('overpopulation'));
    expect(matches[0].length).toBe('overpopulation'.length);
  });

  it('returns empty array for empty string', () => {
    expect(checkTerminology('')).toEqual([]);
  });

  it('returns empty array for whitespace-only input', () => {
    expect(checkTerminology('   ')).toEqual([]);
  });
});

describe('hasTerminologyIssues', () => {
  it('returns false for clean text', () => {
    expect(hasTerminologyIssues('Rights-based approach to family planning.')).toBe(false);
  });

  it('returns true when text contains a banned term', () => {
    expect(hasTerminologyIssues('overpopulation is the real issue')).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(hasTerminologyIssues('')).toBe(false);
  });
});
