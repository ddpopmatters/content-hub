/**
 * Core utility functions for the PM Dashboard
 */
import type { Attachment } from '../types/models';

// Re-export for convenience
export type { Attachment };

// Class name utility - joins truthy class names
export const cx = (...xs: (string | boolean | null | undefined)[]): string =>
  xs.filter(Boolean).join(' ');

// Date utilities
export const daysInMonth = (y: number, m: number): number => new Date(y, m + 1, 0).getDate();

export const isoFromParts = (year: number, monthIndex: number, day: number): string =>
  `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export const monthStartISO = (d: Date): string => isoFromParts(d.getFullYear(), d.getMonth(), 1);

export const monthEndISO = (d: Date): string =>
  isoFromParts(d.getFullYear(), d.getMonth(), daysInMonth(d.getFullYear(), d.getMonth()));

export const isOlderThanDays = (iso: string, days: number): boolean =>
  Date.now() - new Date(iso).getTime() > days * 864e5;

export const localMonthKey = (d: Date): string =>
  isoFromParts(d.getFullYear(), d.getMonth(), 1).slice(0, 7);

// UUID generator - uses crypto API for better randomness
export const uuid = (): string => {
  // Use crypto.randomUUID if available (modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback using crypto.getRandomValues
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    // Convert to hex string
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Last resort fallback (not cryptographically secure)
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
};

// Array utilities
export const ensureArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter(Boolean) : [];

export const ensurePeopleArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((name) => (typeof name === 'string' ? name.trim() : '')).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }
  return [];
};

/**
 * Validates that a URL uses a safe protocol (http/https only).
 * Rejects javascript:, data:, and other potentially dangerous schemes.
 */
export const isSafeUrl = (url: string): boolean => {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    // Relative URLs or invalid URLs - allow relative paths starting with /
    return trimmed.startsWith('/') && !trimmed.startsWith('//');
  }
};

export const ensureLinksArray = (value: unknown): string[] => {
  if (!value) return [];
  let links: string[] = [];
  if (Array.isArray(value)) {
    links = value.map((link) => (typeof link === 'string' ? link.trim() : '')).filter(Boolean);
  } else if (typeof value === 'string') {
    links = value
      .split(/\n+/)
      .map((link) => link.trim())
      .filter(Boolean);
  }
  // Filter out unsafe URLs (javascript:, data:, etc.)
  return links.filter(isSafeUrl);
};

export const ensureAttachments = (value: unknown): Attachment[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((attachment): Attachment | null => {
      if (!attachment || typeof attachment !== 'object') return null;
      const obj = attachment as Record<string, unknown>;
      const name = typeof obj.name === 'string' ? obj.name : 'Attachment';
      const dataUrl = typeof obj.dataUrl === 'string' ? obj.dataUrl : '';
      const type = typeof obj.type === 'string' ? obj.type : '';
      const size = typeof obj.size === 'number' ? obj.size : 0;
      if (!dataUrl) return null;
      return {
        id: typeof obj.id === 'string' ? obj.id : uuid(),
        name,
        dataUrl,
        type,
        size,
      };
    })
    .filter((item): item is Attachment => item !== null);
};

// HTML escaping for email templates
export const escapeHtml = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

// Serialization helper for comparison
export const serializeForComparison = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

// Email normalization
export const normalizeEmail = (value: unknown): string => {
  if (!value) return '';
  return String(value).trim().toLowerCase();
};

// Mention extraction from text
export const extractMentions = (text: string | null | undefined): string[] => {
  if (!text) return [];
  const matches = text.match(/@([A-Z][\w.&'-]*(?:\s+[A-Z][\w.&'-]*){0,2})/g);
  if (!matches) return [];
  return Array.from(new Set(matches.map((token) => token.trim())));
};

// Storage availability check
export const storageAvailable: boolean =
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

// Storage keys
// Note: GUIDELINES_STORAGE_KEY is defined in constants.ts to avoid duplication
export const STORAGE_KEYS = {
  ENTRIES: 'pm-content-dashboard-v1',
  USER: 'pm-content-dashboard-user',
  NOTIFICATIONS: 'pm-content-dashboard-notifications',
  IDEAS: 'pm-content-dashboard-ideas',
  REPORTING: 'pm-content-dashboard-reporting',
  CONTENT_PEAKS: 'pm-content-dashboard-content-peaks',
  CONTENT_SERIES: 'pm-content-dashboard-content-series',
  RAPID_RESPONSES: 'pm-content-dashboard-rapid-responses',
  AUDIT: 'pm-content-audit-log',
  DRAFT_ENTRY: 'pm-content-dashboard-draft-entry',
  INFLUENCERS: 'pm-content-dashboard-influencers',
  CUSTOM_NICHES: 'pm-content-dashboard-custom-niches',
  CAMPAIGNS: 'pm-content-dashboard-campaigns',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

/**
 * Normalizes a date value to ISO date string (YYYY-MM-DD)
 * Handles various input formats and returns empty string for invalid dates
 * Validates that the date is real (e.g., rejects 2024-99-99)
 */
export const normalizeDateValue = (raw: unknown): string => {
  if (!raw) return '';
  const trimmed = String(raw).trim();
  if (!trimmed) return '';

  // Parse the date
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return '';

  // Get the ISO date string
  const isoDate = parsed.toISOString().slice(0, 10);

  // For YYYY-MM-DD inputs, verify round-trip to catch invalid dates like 2024-99-99
  // (JavaScript Date normalizes these, e.g., month 99 becomes a different year)
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed) && isoDate !== trimmed) {
    return '';
  }

  return isoDate;
};
