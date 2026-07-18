import { describe, expect, it, vi } from 'vitest';
import {
  buildLocalCopyCheckResult,
  normalizeCopyCheckResult,
  runCopyCheck,
  type CopyCheckPayload,
} from './copyCheck';

const createPayload = (
  text: string,
  overrides: Partial<CopyCheckPayload> = {},
): CopyCheckPayload => ({
  text,
  platform: 'LinkedIn',
  assetType: 'Design',
  readingLevelTarget: 'Grade 7',
  constraints: { maxChars: 280, maxHashtags: 5, requireCTA: false },
  brand: {
    bannedWords: [],
    requiredPhrases: [],
    tone: { confident: 1, compassionate: 1, evidenceLed: 1 },
  },
  ...overrides,
});

describe('buildLocalCopyCheckResult', () => {
  it('blocks never-use terminology and leaves the original text untouched', () => {
    const text = 'Population control is the answer.';
    const result = buildLocalCopyCheckResult(createPayload(text));

    expect(result.blocked).toBe(true);
    expect(result.suggestion?.text).toBe(text);
    expect(result.findings?.some((finding) => finding.severity === 'blocker')).toBe(true);
    expect(result.flags).toEqual(expect.arrayContaining([expect.stringMatching(/^BLOCKED/)]));
  });

  it('warns when population or environmental framing leads before a rights anchor', () => {
    const result = buildLocalCopyCheckResult(
      createPayload(
        'Unsustainable population growth is straining ecosystems. Reproductive rights are part of the answer.',
      ),
    );

    expect(result.blocked).toBe(false);
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'sequence_population_before_rights',
          severity: 'high',
        }),
      ]),
    );
  });

  it('does not warn for quoted hostile framing that is immediately rejected', () => {
    const result = buildLocalCopyCheckResult(
      createPayload(
        "You've heard the claim that 'overpopulation' causes climate breakdown. It's wrong - and it's a framing with a coercive history. The real story is restricted rights and the consumption of the wealthiest.",
      ),
    );

    expect(result.blocked).toBe(false);
    expect(result.findings?.map((finding) => finding.id)).not.toContain('term:overpopulation');
    expect(result.findings?.map((finding) => finding.id)).not.toContain(
      'sequence_population_before_rights',
    );
  });

  it('blocks instrumentalising women or girls as a route to demographic outcomes', () => {
    const result = buildLocalCopyCheckResult(
      createPayload('Empowering girls so that population growth slows.'),
    );

    expect(result.blocked).toBe(true);
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'instrumental_empower_to_reduce',
          severity: 'blocker',
        }),
      ]),
    );
  });

  it('passes a rights-first draft without strategic wording mutations', () => {
    const text =
      'Every woman has the right to decide if and when to have children. Where that right is secured, communities and ecosystems thrive.';
    const result = buildLocalCopyCheckResult(createPayload(text));

    expect(result.blocked).toBe(false);
    expect(result.suggestion?.text).toBe(text);
    expect(result.findings).toEqual([]);
  });

  it('flags missing required phrases rather than prepending them', () => {
    const text = 'Every woman has the right to decide if and when to have children.';
    const result = buildLocalCopyCheckResult(
      createPayload(text, {
        brand: {
          bannedWords: [],
          requiredPhrases: ['Population Matters'],
          tone: { confident: 1, compassionate: 1, evidenceLed: 1 },
        },
      }),
    );

    expect(result.suggestion?.text).toBe(text);
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'missing-required-phrase:population matters',
          severity: 'medium',
        }),
      ]),
    );
  });

  it('flags missing CTAs rather than appending a generic one', () => {
    const text = 'Every woman has the right to decide if and when to have children.';
    const result = buildLocalCopyCheckResult(
      createPayload(text, {
        constraints: { maxChars: 280, maxHashtags: 5, requireCTA: true },
      }),
    );

    expect(result.suggestion?.text).toBe(text);
    expect(result.suggestion?.text).not.toMatch(/learn more/i);
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'missing-cta',
          severity: 'medium',
        }),
      ]),
    );
  });

  it('warns when trimming may remove evidence caveats', () => {
    const result = buildLocalCopyCheckResult(
      createPayload(
        'Every woman has the right to decide if and when to have children. '.repeat(5) +
          'UNFPA (2024)',
        {
          constraints: { maxChars: 140, maxHashtags: 5, requireCTA: false },
        },
      ),
    );

    expect(result.flags).toEqual(
      expect.arrayContaining([
        'Trim may have removed a source or caveat - re-check evidence fidelity',
      ]),
    );
  });
});

describe('PM doctrine acceptance bank', () => {
  const failSamples = [
    'Overpopulation is destroying the planet - act now.',
    'Developing countries need to lower their birth rates to meet climate goals.',
    'Women in Africa should have fewer children to protect wildlife.',
    'Contraception is the cheapest climate solution we have.',
    'Empowering girls so that population growth slows.',
    'There are simply too many people for the Earth to sustain.',
    'Our housing crisis is driven by migration and rising birth rates.',
    'Population management programmes deliver results for the planet.',
    'The population bomb is still ticking.',
    "We're proud to support family size targets in high-fertility regions.",
  ];

  const warnSamples = [
    'Unsustainable population growth is straining ecosystems. Reproductive rights are part of the answer.',
    'Great news - global birth rates are falling faster than predicted.',
    'Rapid population growth across the Global South is accelerating biodiversity loss.',
    'Research shows family planning access transforms communities.',
    'Population Matters is pleased to announce our commitment to empowering women and girls.',
  ];

  const passSamples = [
    'Every woman has the right to decide if and when to have children. Where that right is secured, communities - and the ecosystems around them - thrive.',
    "You've heard the claim that 'overpopulation' causes climate breakdown. It's wrong - and it's a framing with a coercive history. The real story is restricted rights and the consumption of the wealthiest.",
    'Underfunded health systems deny 218 million women the contraception they want [Claim Locker ID or marked unverified]. That is a policy failure, not a personal one.',
    "The wealthiest 10% of the world's people account for the largest share of consumption emissions - pressure on the planet is not about who is having children.",
    'Her choice. Her future. Voluntary family planning, healthcare, and education - rights, not tools.',
  ];

  it('blocks all 10 fail examples', () => {
    const results = failSamples.map((sample) => buildLocalCopyCheckResult(createPayload(sample)));

    expect(results).toHaveLength(10);
    expect(results.every((result) => result.blocked)).toBe(true);
  });

  it('warns without blocking all 5 warning examples', () => {
    const results = warnSamples.map((sample) => buildLocalCopyCheckResult(createPayload(sample)));

    expect(results).toHaveLength(5);
    expect(results.every((result) => result.blocked === false)).toBe(true);
    expect(results.every((result) => (result.findings ?? []).length > 0)).toBe(true);
  });

  it('passes all 5 clean examples', () => {
    const results = passSamples.map((sample) => buildLocalCopyCheckResult(createPayload(sample)));

    expect(results).toHaveLength(5);
    expect(results.every((result) => result.blocked === false)).toBe(true);
    expect(results.every((result) => (result.findings ?? []).length === 0)).toBe(true);
  });
});

describe('runCopyCheck', () => {
  it('uses the local evaluator and does not call the retired remote copy-check endpoint', async () => {
    const originalWindow = globalThis.window;
    const fetchSpy = vi.fn();

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        CONTENT_HUB_PUBLIC_CONFIG: {
          supabaseFunctionsUrl: 'https://example.supabase.co/functions/v1',
        },
      },
    });
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: fetchSpy,
    });

    try {
      const result = await runCopyCheck(createPayload('Population control is the answer.'));

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(result.blocked).toBe(true);
      expect(result.findings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'term:population control',
            severity: 'blocker',
          }),
        ]),
      );
    } finally {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: originalWindow,
      });
    }
  });
});

describe('normalizeCopyCheckResult', () => {
  it('drops malformed score and suggestion values but preserves valid findings', () => {
    expect(
      normalizeCopyCheckResult({
        score: { clarity: 'bad-data' },
        suggestion: { text: 1234 },
        flags: ['ok', 42],
        blocked: true,
        findings: [
          {
            id: 'pm_never_use_term',
            severity: 'blocker',
            match: 'overpopulation',
            suggestion: 'Reframe around rights and systems.',
            category: 'never_use_terminology',
          },
          { id: 'broken' },
        ],
      }),
    ).toEqual({
      score: { readingLevel: '', clarity: 0, brevity: 0 },
      suggestion: undefined,
      flags: ['ok'],
      blocked: true,
      findings: [
        {
          id: 'pm_never_use_term',
          severity: 'blocker',
          match: 'overpopulation',
          suggestion: 'Reframe around rights and systems.',
          category: 'never_use_terminology',
        },
      ],
    });
  });
});
