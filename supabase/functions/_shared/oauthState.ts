import { isSuperAdminEmail } from './adminAccess.ts';

export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const OAUTH_STATE_PREFIX = 'oauth_state:';
const OAUTH_STATE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export const OAUTH_PLATFORMS = ['Instagram', 'Facebook', 'LinkedIn', 'LinkedIn Org'] as const;
export type OAuthPlatform = (typeof OAUTH_PLATFORMS)[number];

interface OAuthStateRecord {
  version: 1;
  platform: OAuthPlatform;
  ownerEmail: string;
  issuedAt: string;
  expiresAt: string;
}

interface IssueOAuthStateOptions {
  platform: OAuthPlatform;
  ownerEmail: string;
  store: (record: { key: string; value: string; updatedAt: string }) => Promise<void>;
  now?: Date;
  randomBytes?: Uint8Array;
}

interface ConsumeOAuthStateOptions {
  take: (key: string) => Promise<string | null>;
  now?: Date;
}

export class OAuthStateError extends Error {
  constructor() {
    super('OAuth state is invalid or expired.');
    this.name = 'OAuthStateError';
  }
}

export const isOAuthPlatform = (value: unknown): value is OAuthPlatform =>
  typeof value === 'string' && OAUTH_PLATFORMS.includes(value as OAuthPlatform);

const base64UrlEncode = (bytes: Uint8Array): string => {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const stateStorageKey = async (token: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return `${OAUTH_STATE_PREFIX}${Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}`;
};

const parseStateRecord = (value: string, now: Date): OAuthStateRecord => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new OAuthStateError();
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new OAuthStateError();
  }

  const record = parsed as Partial<OAuthStateRecord>;
  const issuedAt = typeof record.issuedAt === 'string' ? Date.parse(record.issuedAt) : Number.NaN;
  const expiresAt =
    typeof record.expiresAt === 'string' ? Date.parse(record.expiresAt) : Number.NaN;
  const nowValue = now.getTime();

  if (
    record.version !== 1 ||
    !isOAuthPlatform(record.platform) ||
    !isSuperAdminEmail(record.ownerEmail) ||
    !Number.isFinite(issuedAt) ||
    !Number.isFinite(expiresAt) ||
    issuedAt > nowValue + 60_000 ||
    expiresAt <= nowValue ||
    expiresAt <= issuedAt ||
    expiresAt - issuedAt > OAUTH_STATE_TTL_MS
  ) {
    throw new OAuthStateError();
  }

  return record as OAuthStateRecord;
};

export async function issueOAuthState({
  platform,
  ownerEmail,
  store,
  now = new Date(),
  randomBytes,
}: IssueOAuthStateOptions): Promise<string> {
  if (!isOAuthPlatform(platform) || !isSuperAdminEmail(ownerEmail)) {
    throw new OAuthStateError();
  }

  const bytes = randomBytes ?? crypto.getRandomValues(new Uint8Array(32));
  if (bytes.length !== 32) throw new OAuthStateError();

  const token = base64UrlEncode(bytes);
  const issuedAt = now.toISOString();
  const record: OAuthStateRecord = {
    version: 1,
    platform,
    ownerEmail: ownerEmail.trim().toLowerCase(),
    issuedAt,
    expiresAt: new Date(now.getTime() + OAUTH_STATE_TTL_MS).toISOString(),
  };

  try {
    await store({
      key: await stateStorageKey(token),
      value: JSON.stringify(record),
      updatedAt: issuedAt,
    });
  } catch {
    throw new OAuthStateError();
  }

  return token;
}

export async function consumeOAuthState(
  token: unknown,
  { take, now = new Date() }: ConsumeOAuthStateOptions,
): Promise<OAuthStateRecord> {
  if (typeof token !== 'string' || !OAUTH_STATE_TOKEN_PATTERN.test(token)) {
    throw new OAuthStateError();
  }

  let value: string | null;
  try {
    value = await take(await stateStorageKey(token));
  } catch {
    throw new OAuthStateError();
  }

  if (!value) throw new OAuthStateError();
  return parseStateRecord(value, now);
}

export const oauthStateExpiryCutoff = (now = new Date()): string =>
  new Date(now.getTime() - OAUTH_STATE_TTL_MS).toISOString();

export const oauthStateKeyPattern = (): string => `${OAUTH_STATE_PREFIX}%`;
