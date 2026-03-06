/**
 * User normalization utilities extracted from app.jsx
 */
import { DEFAULT_USERS, FEATURE_OPTIONS } from '../constants';

const DEFAULT_FEATURES = FEATURE_OPTIONS.map((option) => option.key);

export const ensureFeaturesList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [...DEFAULT_FEATURES];
  const allowed = new Set(DEFAULT_FEATURES);
  const normalized = Array.from(
    new Set(value.filter((entry) => typeof entry === 'string' && allowed.has(entry))),
  );
  return normalized.length ? normalized : [...DEFAULT_FEATURES];
};

export interface NormalizedUser {
  id: string;
  name: string;
  email: string;
  features: string[];
  status: string;
  invitePending: boolean;
}

export const normalizeUserValue = (value: unknown): NormalizedUser => {
  const base =
    typeof value === 'string'
      ? { name: value, email: '' }
      : (value as Record<string, unknown>) || {};
  const rawName =
    typeof base.name === 'string' && (base.name as string).trim()
      ? (base.name as string).trim()
      : '';
  const rawEmail =
    typeof base.email === 'string' && (base.email as string).trim()
      ? (base.email as string).trim()
      : '';
  const name = rawName || rawEmail || 'Unknown user';
  const id =
    typeof base.id === 'string' && (base.id as string).trim()
      ? (base.id as string).trim()
      : `${name || rawEmail}-${Math.random().toString(36).slice(2, 10)}`;
  return {
    id,
    name,
    email: rawEmail,
    features: ensureFeaturesList(base.features),
    status: (base.status as string) || 'active',
    invitePending: Boolean(base.invitePending),
  };
};

export const DEFAULT_USER_RECORDS = DEFAULT_USERS.map(normalizeUserValue);

export { DEFAULT_FEATURES };
