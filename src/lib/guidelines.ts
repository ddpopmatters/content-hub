/**
 * Guidelines normalization and storage utilities
 */
import { GUIDELINES_STORAGE_KEY, PLATFORM_DEFAULT_LIMITS } from '../constants';
import { storageAvailable } from './utils';
import type { Guidelines } from '../types/models';

/**
 * Default guidelines used when no guidelines are configured
 */
export const FALLBACK_GUIDELINES: Guidelines = {
  bannedWords: [],
  requiredPhrases: [],
  languageGuide: '',
  hashtagTips: '',
  charLimits: { ...PLATFORM_DEFAULT_LIMITS },
  approverDirectory: [],
};

/**
 * Normalizes raw guidelines data to ensure all fields are properly typed
 */
export const normalizeGuidelines = (raw: unknown): Guidelines => {
  if (!raw || typeof raw !== 'object') {
    return {
      ...FALLBACK_GUIDELINES,
      charLimits: { ...FALLBACK_GUIDELINES.charLimits },
    };
  }
  const data = raw as Record<string, unknown>;
  const bannedWords = Array.isArray(data.bannedWords)
    ? data.bannedWords.map((word) => String(word).trim()).filter(Boolean)
    : [...FALLBACK_GUIDELINES.bannedWords];
  const requiredPhrases = Array.isArray(data.requiredPhrases)
    ? data.requiredPhrases.map((p) => String(p).trim()).filter(Boolean)
    : [...FALLBACK_GUIDELINES.requiredPhrases];
  const languageGuide =
    typeof data.languageGuide === 'string' ? data.languageGuide : FALLBACK_GUIDELINES.languageGuide;
  const hashtagTips =
    typeof data.hashtagTips === 'string' ? data.hashtagTips : FALLBACK_GUIDELINES.hashtagTips;
  const charLimits: Record<string, number> = { ...FALLBACK_GUIDELINES.charLimits };
  const rawCharLimits = (data.charLimits as Record<string, unknown>) || {};
  Object.keys(charLimits).forEach((platform) => {
    const rawValue = rawCharLimits[platform] ?? charLimits[platform];
    const value = Number(rawValue);
    charLimits[platform] =
      Number.isFinite(value) && value > 0
        ? value
        : (PLATFORM_DEFAULT_LIMITS as Record<string, number>)[platform] || 500;
  });
  const approverDirectory = Array.isArray(data.approverDirectory)
    ? (data.approverDirectory as unknown[]).filter(
        (e): e is { name: string; email: string } =>
          typeof e === 'object' &&
          e !== null &&
          typeof (e as Record<string, unknown>).name === 'string' &&
          typeof (e as Record<string, unknown>).email === 'string',
      )
    : [];
  return {
    bannedWords,
    requiredPhrases,
    languageGuide,
    hashtagTips,
    charLimits,
    approverDirectory,
  };
};

/**
 * Loads guidelines from localStorage
 */
export const loadGuidelines = (): Guidelines => {
  if (!storageAvailable) {
    return normalizeGuidelines(FALLBACK_GUIDELINES);
  }
  try {
    const raw = window.localStorage.getItem(GUIDELINES_STORAGE_KEY);
    if (!raw) return normalizeGuidelines(FALLBACK_GUIDELINES);
    return normalizeGuidelines(JSON.parse(raw));
  } catch {
    return normalizeGuidelines(FALLBACK_GUIDELINES);
  }
};

/**
 * Saves guidelines to localStorage
 */
export const saveGuidelines = (guidelines: unknown): void => {
  if (!storageAvailable) return;
  try {
    window.localStorage.setItem(
      GUIDELINES_STORAGE_KEY,
      JSON.stringify(normalizeGuidelines(guidelines)),
    );
  } catch {
    // ignore storage errors
  }
};
