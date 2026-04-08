export interface CopyCheckScore {
  readingLevel: string;
  clarity: number;
  brevity: number;
}

export interface CopyCheckSuggestion {
  text: string;
}

export interface CopyCheckResult {
  score?: CopyCheckScore;
  suggestion?: CopyCheckSuggestion;
  flags?: string[];
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
    tone: {
      confident: number;
      compassionate: number;
      evidenceLed: number;
    };
  };
}

interface PublicConfig {
  supabaseFunctionsUrl?: string;
}

declare global {
  interface Window {
    copyChecker?: {
      runCopyCheck: (payload: CopyCheckPayload) => Promise<CopyCheckResult>;
    };
    CONTENT_HUB_PUBLIC_CONFIG?: PublicConfig;
  }
}

const CTA_PATTERN =
  /\b(read more|learn more|find out more|share|comment|follow|donate|register|sign petition)\b/i;

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim();

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

const removeBannedWords = (
  text: string,
  bannedWords: string[],
): { text: string; removed: string[] } => {
  let next = text;
  const removed: string[] = [];

  bannedWords.forEach((word) => {
    const trimmed = normalizeWhitespace(word);
    if (!trimmed) return;

    const pattern = new RegExp(`\\b${escapeRegex(trimmed)}\\b`, 'gi');
    if (pattern.test(next)) {
      removed.push(trimmed);
      next = next.replace(pattern, ' ');
    }
  });

  return { text: normalizeWhitespace(next), removed };
};

const ensureRequiredPhrases = (
  text: string,
  requiredPhrases: string[],
): { text: string; injected: string[] } => {
  let next = text;
  const injected: string[] = [];

  requiredPhrases.forEach((phrase) => {
    const trimmed = normalizeWhitespace(phrase);
    if (!trimmed) return;

    const pattern = new RegExp(`\\b${escapeRegex(trimmed)}\\b`, 'i');
    if (!pattern.test(next)) {
      next = next ? `${trimmed}: ${next}` : trimmed;
      injected.push(trimmed);
    }
  });

  return { text: normalizeWhitespace(next), injected };
};

const ensureCta = (text: string, requireCta: boolean): { text: string; added: boolean } => {
  if (!requireCta || CTA_PATTERN.test(text)) {
    return { text, added: false };
  }

  const suffix = text.endsWith('.') ? ' Learn more.' : '. Learn more.';
  return { text: normalizeWhitespace(`${text}${suffix}`), added: true };
};

const trimToMaxChars = (text: string, maxChars: number): { text: string; trimmed: boolean } => {
  if (maxChars <= 0 || text.length <= maxChars) {
    return { text, trimmed: false };
  }

  const slice = text.slice(0, maxChars).trimEnd();
  const lastSpace = slice.lastIndexOf(' ');
  const trimmed = lastSpace > Math.floor(maxChars * 0.6) ? slice.slice(0, lastSpace) : slice;

  return { text: trimmed.trimEnd(), trimmed: true };
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

  return { score, suggestion, flags };
}

export function buildLocalCopyCheckResult(payload: CopyCheckPayload): CopyCheckResult {
  const initialText = normalizeWhitespace(payload.text);
  const flags: string[] = [];

  const bannedResult = removeBannedWords(initialText, payload.brand.bannedWords ?? []);
  if (bannedResult.removed.length) {
    flags.push(`Removed banned words: ${bannedResult.removed.join(', ')}`);
  }

  const phraseResult = ensureRequiredPhrases(
    bannedResult.text,
    payload.brand.requiredPhrases ?? [],
  );
  if (phraseResult.injected.length) {
    flags.push(`Added required phrase: ${phraseResult.injected.join(', ')}`);
  }

  const hashtagResult = stripExtraHashtags(
    phraseResult.text,
    payload.constraints.maxHashtags ?? 10,
  );
  if (hashtagResult !== phraseResult.text) {
    flags.push('Trimmed extra hashtags');
  }

  const ctaResult = ensureCta(hashtagResult, Boolean(payload.constraints.requireCTA));
  if (ctaResult.added) {
    flags.push('Added CTA');
  }

  const trimResult = trimToMaxChars(ctaResult.text, payload.constraints.maxChars ?? 280);
  if (trimResult.trimmed) {
    flags.push('Trimmed to platform limit');
  }

  return {
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

export const resolveCopyCheckEndpoint = (): string | null => {
  if (typeof window === 'undefined') return null;

  const base = window.CONTENT_HUB_PUBLIC_CONFIG?.supabaseFunctionsUrl;
  if (!base) return null;

  return `${base.replace(/\/+$/, '')}/copy-check`;
};

export async function runCopyCheck(payload: CopyCheckPayload): Promise<CopyCheckResult> {
  if (typeof window !== 'undefined' && window.copyChecker?.runCopyCheck) {
    return normalizeCopyCheckResult(await window.copyChecker.runCopyCheck(payload));
  }

  const endpoint = resolveCopyCheckEndpoint();
  if (endpoint) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        return normalizeCopyCheckResult(await response.json());
      }
    } catch {
      // Fall through to local heuristic copy check when the endpoint is unavailable.
    }
  }

  return buildLocalCopyCheckResult(payload);
}
