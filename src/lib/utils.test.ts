// src/lib/utils.test.ts
import { describe, it, expect } from 'vitest';
import {
  cx,
  daysInMonth,
  isoFromParts,
  monthStartISO,
  monthEndISO,
  isOlderThanDays,
  localMonthKey,
  ensureArray,
  ensurePeopleArray,
  uuid,
} from './utils';

describe('cx', () => {
  it('joins truthy strings with a space', () => {
    expect(cx('a', 'b', 'c')).toBe('a b c');
  });

  it('filters out falsy values', () => {
    expect(cx('a', false, null, undefined, 'b')).toBe('a b');
  });

  it('returns empty string when all values are falsy', () => {
    expect(cx(false, null, undefined)).toBe('');
  });
});

describe('daysInMonth', () => {
  it('returns 31 for January (monthIndex 0)', () => {
    expect(daysInMonth(2024, 0)).toBe(31);
  });

  it('returns 28 for February in a non-leap year', () => {
    expect(daysInMonth(2023, 1)).toBe(28);
  });

  it('returns 29 for February in a leap year', () => {
    expect(daysInMonth(2024, 1)).toBe(29);
  });

  it('returns 30 for April (monthIndex 3)', () => {
    expect(daysInMonth(2024, 3)).toBe(30);
  });
});

describe('isoFromParts', () => {
  it('formats year + monthIndex + day into ISO date string', () => {
    // monthIndex 2 = March
    expect(isoFromParts(2024, 2, 5)).toBe('2024-03-05');
  });

  it('pads single-digit month and day', () => {
    expect(isoFromParts(2024, 0, 1)).toBe('2024-01-01');
  });

  it('handles double-digit day correctly', () => {
    expect(isoFromParts(2024, 11, 31)).toBe('2024-12-31');
  });
});

describe('monthStartISO', () => {
  it('returns the first day of the month as ISO string', () => {
    expect(monthStartISO(new Date(2024, 2, 15))).toBe('2024-03-01');
  });
});

describe('monthEndISO', () => {
  it('returns the last day of February in a leap year (29th)', () => {
    expect(monthEndISO(new Date(2024, 1, 1))).toBe('2024-02-29');
  });

  it('returns the last day of November (30th)', () => {
    expect(monthEndISO(new Date(2024, 10, 1))).toBe('2024-11-30');
  });
});

describe('isOlderThanDays', () => {
  it('returns true when ISO date is older than the given number of days', () => {
    const now = Date.now();
    const old = new Date(now - 8 * 864e5).toISOString(); // 8 days ago
    expect(isOlderThanDays(old, 7)).toBe(true);
  });

  it('returns false when ISO date is within the given number of days', () => {
    const now = Date.now();
    const recent = new Date(now - 2 * 864e5).toISOString(); // 2 days ago
    expect(isOlderThanDays(recent, 7)).toBe(false);
  });
});

describe('localMonthKey', () => {
  it('returns YYYY-MM string for the given date', () => {
    expect(localMonthKey(new Date(2024, 2, 15))).toBe('2024-03');
    expect(localMonthKey(new Date(2026, 0, 1))).toBe('2026-01');
  });
});

describe('uuid', () => {
  it('returns a string', () => {
    expect(typeof uuid()).toBe('string');
  });

  it('returns a non-empty string', () => {
    expect(uuid().length).toBeGreaterThan(0);
  });

  it('returns unique values on successive calls', () => {
    expect(uuid()).not.toBe(uuid());
  });

  it('returns a value at least 20 characters long', () => {
    expect(uuid().length).toBeGreaterThanOrEqual(20);
  });
});

describe('ensureArray', () => {
  it('returns an array unchanged (filtering falsy elements)', () => {
    expect(ensureArray(['a', 'b'])).toEqual(['a', 'b']);
  });

  it('filters falsy values from arrays', () => {
    expect(ensureArray(['a', '', false, null, 'b'] as unknown[])).toEqual(['a', 'b']);
  });

  it('returns empty array for non-array input', () => {
    expect(ensureArray('a string')).toEqual([]);
    expect(ensureArray(null)).toEqual([]);
    expect(ensureArray(undefined)).toEqual([]);
  });
});

describe('ensurePeopleArray', () => {
  it('returns array of trimmed strings', () => {
    expect(ensurePeopleArray(['Fran ', ' Dan'])).toEqual(['Fran', 'Dan']);
  });

  it('converts a single non-empty string to a one-element array', () => {
    expect(ensurePeopleArray('Fran')).toEqual(['Fran']);
  });

  it('returns empty array for empty string', () => {
    expect(ensurePeopleArray('')).toEqual([]);
  });

  it('returns empty array for null or undefined', () => {
    expect(ensurePeopleArray(null)).toEqual([]);
    expect(ensurePeopleArray(undefined)).toEqual([]);
  });

  it('filters out empty strings in arrays', () => {
    expect(ensurePeopleArray(['Fran', '', 'Dan'])).toEqual(['Fran', 'Dan']);
  });
});
