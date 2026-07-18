export interface PublishPayload {
  entryId: string;
  platforms: string[];
  caption: string;
  platformCaptions: Record<string, string>;
  assetType: string;
  mediaUrls: string[];
  previewUrl: string | null;
  firstComment: string;
}

const isStringRecord = (value: unknown): value is Record<string, string> =>
  Boolean(value) &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.values(value as Record<string, unknown>).every((item) => typeof item === 'string');

export const isPublishPayload = (value: unknown): value is PublishPayload => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;
  return (
    typeof payload.entryId === 'string' &&
    Array.isArray(payload.platforms) &&
    payload.platforms.length > 0 &&
    payload.platforms.every((platform) => typeof platform === 'string') &&
    typeof payload.caption === 'string' &&
    isStringRecord(payload.platformCaptions) &&
    typeof payload.assetType === 'string' &&
    Array.isArray(payload.mediaUrls) &&
    payload.mediaUrls.every((url) => typeof url === 'string') &&
    (typeof payload.previewUrl === 'string' || payload.previewUrl === null) &&
    typeof payload.firstComment === 'string'
  );
};

export interface PlatformResult {
  status: 'published' | 'failed' | 'skipped';
  url: string | null;
  postId: string | null;
  error: string | null;
  timestamp: string;
}

export interface PublishResult {
  success: boolean;
  results: Record<string, PlatformResult>;
  error?: string;
}

export type PublicationTriggerType = 'manual' | 'scheduled';

export type PublicationJobStatus =
  | 'queued'
  | 'publishing'
  | 'partial'
  | 'published'
  | 'failed'
  | 'unknown'
  | 'cancelled';

export type PublicationResultStatus =
  | 'pending'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'skipped'
  | 'unknown';

export interface DurablePublicationResult {
  id: string;
  platform: string;
  status: PublicationResultStatus;
  url: string | null;
  error: string | null;
  attemptCount: number;
  claimedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DurablePublicationJob {
  id: string;
  entryId: string;
  entryRevision: number;
  triggerType: PublicationTriggerType;
  requestKey: string;
  status: PublicationJobStatus;
  claimedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  results: DurablePublicationResult[];
}

export interface PlatformConnection {
  id: string;
  platform: string;
  account_id: string;
  account_name: string;
  access_token: string | null;
  refresh_token: string | null;
  token_secret: string | null;
  expires_at: string | null;
  scope: string | null;
  org_account_id?: string | null;
}
