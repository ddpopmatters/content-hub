import { describe, expect, it } from 'vitest';
import { buildLocalCopyCheckResult, normalizeCopyCheckResult } from './copyCheck';

describe('buildLocalCopyCheckResult', () => {
  it('injects required phrases and removes banned words', () => {
    const result = buildLocalCopyCheckResult({
      text: 'Maybe we could share this update.',
      platform: 'LinkedIn',
      assetType: 'Design',
      readingLevelTarget: 'Grade 7',
      constraints: { maxChars: 280, maxHashtags: 5, requireCTA: true },
      brand: {
        bannedWords: ['maybe'],
        requiredPhrases: ['Population Matters'],
        tone: { confident: 1, compassionate: 1, evidenceLed: 1 },
      },
    });

    expect(result.suggestion?.text).toContain('Population Matters');
    expect(result.suggestion?.text.toLowerCase()).not.toContain('maybe');
    expect(result.suggestion?.text).toMatch(/share|learn more/i);
  });

  it('trims the suggestion to the configured platform limit', () => {
    const result = buildLocalCopyCheckResult({
      text: 'Population Matters ' + 'x'.repeat(200),
      platform: 'BlueSky',
      assetType: 'Design',
      readingLevelTarget: 'Grade 7',
      constraints: { maxChars: 60, maxHashtags: 2, requireCTA: false },
      brand: {
        bannedWords: [],
        requiredPhrases: ['Population Matters'],
        tone: { confident: 1, compassionate: 1, evidenceLed: 1 },
      },
    });

    expect(result.suggestion?.text.length).toBeLessThanOrEqual(60);
  });

  it('adds a default CTA when none is present', () => {
    const result = buildLocalCopyCheckResult({
      text: 'Population Matters brings the evidence together.',
      platform: 'LinkedIn',
      assetType: 'Design',
      readingLevelTarget: 'Grade 7',
      constraints: { maxChars: 280, maxHashtags: 5, requireCTA: true },
      brand: {
        bannedWords: [],
        requiredPhrases: ['Population Matters'],
        tone: { confident: 1, compassionate: 1, evidenceLed: 1 },
      },
    });

    expect(result.suggestion?.text).toMatch(/learn more/i);
  });
});

describe('normalizeCopyCheckResult', () => {
  it('drops malformed score and suggestion values', () => {
    expect(
      normalizeCopyCheckResult({
        score: { clarity: 'bad-data' },
        suggestion: { text: 1234 },
        flags: ['ok', 42],
      }),
    ).toEqual({
      score: { readingLevel: '', clarity: 0, brevity: 0 },
      suggestion: undefined,
      flags: ['ok'],
    });
  });
});
