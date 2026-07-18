import defaultRuleRegistry from './rightsFramingRules.json';

export interface CopyCheckScore {
  readingLevel: string;
  clarity: number;
  brevity: number;
}

export interface CopyCheckSuggestion {
  text: string;
}

export type CopyCheckSeverity = 'blocker' | 'high' | 'medium';

export interface CopyCheckFinding {
  id: string;
  severity: CopyCheckSeverity;
  match: string;
  suggestion: string;
  category?: string;
}

export interface CopyCheckResult {
  score?: CopyCheckScore;
  suggestion?: CopyCheckSuggestion;
  flags?: string[];
  blocked?: boolean;
  findings?: CopyCheckFinding[];
}

interface RuleRegistryEntry {
  phrase?: string;
  id?: string;
  category?: string;
  severity?: string;
  pattern?: string;
  suggestion?: string;
}

export interface RuleRegistry {
  version?: string;
  terminology?: RuleRegistryEntry[];
  patternChecks?: RuleRegistryEntry[];
}

export interface CopyCheckPayload {
  text: string;
  platform: string;
  assetType: string;
  readingLevelTarget: string;
  constraints: {
    maxChars: number;
    maxHashtags: number;
    requireCTA: boolean;
  };
  brand: {
    bannedWords: string[];
    requiredPhrases: string[];
    rules?: RuleRegistry;
    tone: {
      confident: number;
      compassionate: number;
      evidenceLed: number;
    };
  };
}

declare global {
  interface Window {
    copyChecker?: {
      runCopyCheck: (payload: CopyCheckPayload) => Promise<CopyCheckResult>;
    };
  }
}

const DEFAULT_RULE_REGISTRY = defaultRuleRegistry as RuleRegistry;

const CTA_PATTERN =
  /\b(read more|learn more|find out more|share|comment|follow|donate|register|sign petition)\b/i;
const RIGHTS_ANCHOR =
  /\b(reproductive rights|her choice|bodily autonomy|voluntary family planning|right to decide|access to (?:contraception|healthcare|education))\b/i;
const OUTCOME_LEAD =
  /\b(population (?:growth|pressure|numbers|size)|birth\s*rates?|fertility rates?|climate (?:change|crisis|breakdown)|emissions)\b/i;
const REJECTION_CONTEXT =
  /\b(reject|rejects|rejected|refute|refutes|refuted|debunk|debunks|myth|wrong|coercive history|historical|hostile|narrative)\b/i;
const ASYMMETRY_CONTEXT = /\b(consum|wealthiest|richest|highest-consuming)\b/i;
const CAVEAT_PATTERN = /\b(source|caveat|unverified|UNFPA|WHO|UN DESA|\(\d{4}\))\b/i;

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim();

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeSeverity = (severity: string | undefined): CopyCheckSeverity => {
  if (severity === 'blocker' || severity === 'high' || severity === 'medium') {
    return severity;
  }
  return 'medium';
};

const hasRejectionContext = (text: string, index: number, length: number): boolean => {
  const windowStart = Math.max(0, index - 100);
  const windowEnd = Math.min(text.length, index + length + 100);
  const window = text.slice(windowStart, windowEnd);
  return REJECTION_CONTEXT.test(window);
};

const shouldSuppressRuleFinding = (
  rule: RuleRegistryEntry,
  text: string,
  index: number,
  length: number,
): boolean => {
  if (rule.id === 'global_south_environment_link') {
    const window = text.slice(
      Math.max(0, index - 200),
      Math.min(text.length, index + length + 200),
    );
    return ASYMMETRY_CONTEXT.test(window);
  }

  if (rule.id === 'sequence_population_before_rights') {
    const window = text.slice(
      Math.max(0, index - 160),
      Math.min(text.length, index + length + 160),
    );
    if (ASYMMETRY_CONTEXT.test(window)) return true;
  }

  if (
    rule.id === 'sequence_population_before_rights' ||
    rule.category === 'never_use_terminology' ||
    rule.category === 'false_urgency'
  ) {
    return hasRejectionContext(text, index, length);
  }

  return false;
};

const stripExtraHashtags = (text: string, maxHashtags: number): string => {
  if (maxHashtags < 0) return text;

  let seen = 0;
  return normalizeWhitespace(
    text.replace(/(^|\s)(#[\p{L}\p{N}_-]+)/gu, (match, prefix) => {
      seen += 1;
      return seen <= maxHashtags ? match : prefix;
    }),
  );
};

const trimToMaxChars = (
  text: string,
  maxChars: number,
): { text: string; trimmed: boolean; removedTail: string } => {
  if (maxChars <= 0 || text.length <= maxChars) {
    return { text, trimmed: false, removedTail: '' };
  }

  const slice = text.slice(0, maxChars).trimEnd();
  const lastSpace = slice.lastIndexOf(' ');
  const trimmed = lastSpace > Math.floor(maxChars * 0.6) ? slice.slice(0, lastSpace) : slice;

  return {
    text: trimmed.trimEnd(),
    trimmed: true,
    removedTail: text.slice(trimmed.length),
  };
};

const scoreClarity = (text: string): number => {
  const sentencePenalty = Math.max(text.split(/[.!?]+/).filter(Boolean).length - 2, 0) * 8;
  const longWordPenalty = (text.match(/\b\w{13,}\b/g) ?? []).length * 6;
  return Math.max(0, Math.min(100, 92 - sentencePenalty - longWordPenalty));
};

const scoreBrevity = (text: string, maxChars: number): number => {
  if (!maxChars) return 80;
  const ratio = text.length / maxChars;
  if (ratio <= 0.55) return 95;
  if (ratio <= 0.75) return 88;
  if (ratio <= 0.9) return 78;
  if (ratio <= 1) return 68;
  return 50;
};

const createFinding = (
  id: string,
  severity: CopyCheckSeverity,
  match: string,
  suggestion: string,
  category?: string,
): CopyCheckFinding => ({
  id,
  severity,
  match,
  suggestion,
  ...(category ? { category } : {}),
});

const detectTerminology = (text: string, rules: RuleRegistryEntry[]): CopyCheckFinding[] =>
  rules.flatMap((rule) => {
    const phrase = normalizeWhitespace(rule.phrase ?? '');
    if (!phrase) return [];

    const pattern = new RegExp(`\\b${escapeRegex(phrase)}\\b`, 'giu');
    const hits: CopyCheckFinding[] = [];

    for (const match of text.matchAll(pattern)) {
      if (match.index === undefined) continue;
      if (shouldSuppressRuleFinding(rule, text, match.index, match[0].length)) continue;

      hits.push(
        createFinding(
          `term:${phrase.toLowerCase()}`,
          normalizeSeverity(rule.severity),
          match[0],
          rule.suggestion ??
            'Reframe the sentence; replacing the term alone does not fix the framing.',
          rule.category,
        ),
      );
    }

    return hits;
  });

const detectPatternChecks = (text: string, rules: RuleRegistryEntry[]): CopyCheckFinding[] =>
  rules.flatMap((rule) => {
    if (!rule.pattern || !rule.id) return [];

    let pattern: RegExp;
    try {
      pattern = new RegExp(rule.pattern, 'iu');
    } catch {
      return [
        createFinding(
          `invalid-rule:${rule.id}`,
          'medium',
          rule.id,
          'This copy-check rule has an invalid regular expression and needs developer review.',
          'rule_registry',
        ),
      ];
    }

    const match = pattern.exec(text);
    if (!match || match.index === undefined) return [];
    if (shouldSuppressRuleFinding(rule, text, match.index, match[0].length)) return [];

    return [
      createFinding(
        rule.id,
        normalizeSeverity(rule.severity),
        match[0],
        rule.suggestion ?? 'Review this wording against the PM communication doctrine.',
        rule.category,
      ),
    ];
  });

const sequenceCheck = (text: string): CopyCheckFinding | null => {
  const head = text.slice(0, 240);
  const outcome = OUTCOME_LEAD.exec(head);
  if (!outcome || outcome.index === undefined) return null;

  const anchor = RIGHTS_ANCHOR.exec(head);
  if (anchor && anchor.index !== undefined && anchor.index < outcome.index) return null;
  if (hasRejectionContext(head, outcome.index, outcome[0].length)) return null;
  if (ASYMMETRY_CONTEXT.test(head)) return null;

  return createFinding(
    'sequence',
    'high',
    outcome[0],
    'Open with the rights anchor before any population or environmental framing.',
    'sequencing',
  );
};

const detectFallbackBannedWords = (text: string, bannedWords: string[]): CopyCheckFinding[] =>
  bannedWords.flatMap((word) => {
    const trimmed = normalizeWhitespace(word);
    if (!trimmed) return [];

    const pattern = new RegExp(`\\b${escapeRegex(trimmed)}\\b`, 'giu');
    const hits: CopyCheckFinding[] = [];

    for (const match of text.matchAll(pattern)) {
      if (match.index === undefined) continue;
      if (hasRejectionContext(text, match.index, match[0].length)) continue;

      hits.push(
        createFinding(
          `banned:${trimmed.toLowerCase()}`,
          'blocker',
          match[0],
          'Reframe the sentence; replacing the term alone does not fix the framing.',
          'never_use_terminology',
        ),
      );
    }

    return hits;
  });

const detectMissingRequiredPhrases = (
  text: string,
  requiredPhrases: string[],
): CopyCheckFinding[] =>
  requiredPhrases.flatMap((phrase) => {
    const trimmed = normalizeWhitespace(phrase);
    if (!trimmed) return [];

    const pattern = new RegExp(`\\b${escapeRegex(trimmed)}\\b`, 'iu');
    if (pattern.test(text)) return [];

    return [
      createFinding(
        `missing-required-phrase:${trimmed.toLowerCase()}`,
        'medium',
        trimmed,
        `Consider whether this draft needs the required phrase: ${trimmed}.`,
        'required_phrase',
      ),
    ];
  });

const detectFindings = (text: string, payload: CopyCheckPayload): CopyCheckFinding[] => {
  const registry = payload.brand.rules ?? DEFAULT_RULE_REGISTRY;
  const terminology = registry.terminology ?? [];
  const patternChecks = registry.patternChecks ?? [];
  const findings = [
    ...detectTerminology(text, terminology),
    ...detectPatternChecks(text, patternChecks),
    ...detectMissingRequiredPhrases(text, payload.brand.requiredPhrases ?? []),
  ];
  const sequenceFinding = sequenceCheck(text);

  if (
    sequenceFinding &&
    !findings.some((finding) => finding.id === 'sequence_population_before_rights')
  ) {
    findings.push(sequenceFinding);
  }

  if (!terminology.length) {
    findings.push(...detectFallbackBannedWords(text, payload.brand.bannedWords ?? []));
  }

  if (payload.constraints.requireCTA && !CTA_PATTERN.test(text)) {
    findings.push(
      createFinding(
        'missing-cta',
        'medium',
        'CTA',
        'Add a campaign-specific CTA; do not rely on a generic Learn more line.',
        'cta',
      ),
    );
  }

  return findings;
};

const normalizeFinding = (candidate: unknown): CopyCheckFinding | null => {
  if (!candidate || typeof candidate !== 'object') return null;
  const item = candidate as Record<string, unknown>;
  if (
    typeof item.id !== 'string' ||
    typeof item.match !== 'string' ||
    typeof item.suggestion !== 'string'
  ) {
    return null;
  }

  return createFinding(
    item.id,
    normalizeSeverity(typeof item.severity === 'string' ? item.severity : undefined),
    item.match,
    item.suggestion,
    typeof item.category === 'string' ? item.category : undefined,
  );
};

export function normalizeCopyCheckResult(raw: unknown): CopyCheckResult {
  if (!raw || typeof raw !== 'object') return {};
  const result = raw as Record<string, unknown>;

  let score: CopyCheckScore | undefined;
  if (result.score && typeof result.score === 'object') {
    const candidate = result.score as Record<string, unknown>;
    score = {
      readingLevel: typeof candidate.readingLevel === 'string' ? candidate.readingLevel : '',
      clarity: typeof candidate.clarity === 'number' ? candidate.clarity : 0,
      brevity: typeof candidate.brevity === 'number' ? candidate.brevity : 0,
    };
  }

  let suggestion: CopyCheckSuggestion | undefined;
  if (result.suggestion && typeof result.suggestion === 'object') {
    const candidate = result.suggestion as Record<string, unknown>;
    if (typeof candidate.text === 'string') {
      suggestion = { text: candidate.text };
    }
  }

  const flags = Array.isArray(result.flags)
    ? result.flags.filter((value): value is string => typeof value === 'string')
    : undefined;

  const findings = Array.isArray(result.findings)
    ? result.findings
        .map(normalizeFinding)
        .filter((value): value is CopyCheckFinding => Boolean(value))
    : undefined;

  return {
    score,
    suggestion,
    flags,
    blocked: typeof result.blocked === 'boolean' ? result.blocked : undefined,
    findings,
  };
}

export function buildLocalCopyCheckResult(payload: CopyCheckPayload): CopyCheckResult {
  const initialText = normalizeWhitespace(payload.text);
  const flags: string[] = [];
  const findings = detectFindings(initialText, payload);
  const blocked = findings.some((finding) => finding.severity === 'blocker');

  if (blocked) {
    return {
      blocked: true,
      findings,
      suggestion: { text: payload.text },
      flags: [
        `BLOCKED - ${findings
          .filter((finding) => finding.severity === 'blocker')
          .map((finding) => finding.id)
          .join(', ')}`,
      ],
    };
  }

  const hashtagResult = stripExtraHashtags(initialText, payload.constraints.maxHashtags ?? 10);
  if (hashtagResult !== initialText) {
    flags.push('Trimmed extra hashtags');
  }

  const trimResult = trimToMaxChars(hashtagResult, payload.constraints.maxChars ?? 280);
  if (trimResult.trimmed) {
    flags.push('Trimmed to platform limit');
    if (CAVEAT_PATTERN.test(trimResult.removedTail)) {
      flags.push('Trim may have removed a source or caveat - re-check evidence fidelity');
    }
  }

  return {
    blocked: false,
    findings,
    score: {
      readingLevel: payload.readingLevelTarget,
      clarity: scoreClarity(trimResult.text),
      brevity: scoreBrevity(trimResult.text, payload.constraints.maxChars),
    },
    suggestion: {
      text: trimResult.text,
    },
    flags,
  };
}

export async function runCopyCheck(payload: CopyCheckPayload): Promise<CopyCheckResult> {
  if (typeof window !== 'undefined' && window.copyChecker?.runCopyCheck) {
    return normalizeCopyCheckResult(await window.copyChecker.runCopyCheck(payload));
  }

  return buildLocalCopyCheckResult(payload);
}
