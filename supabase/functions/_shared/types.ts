export interface PublishPayload {
  entryId: string;
  platforms: string[];
  caption: string;
  platformCaptions: Record<string, string>;
  assetType: string;
  mediaUrls: string[];
  previewUrl: string | null;
  scheduledDate: string;
  firstComment: string;
  campaign: string;
  contentPillar: string;
  links: unknown[];
  callbackUrl: string | null;
  webhookSecret?: string;
}

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
