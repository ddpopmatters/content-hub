import { corsHeaders } from './cors.ts';
import { getApprovalFreshnessIssue } from './approvalFreshness.ts';
import { getPublishCapabilityIssue } from './publishCapabilities.ts';
import type { PublishPayload } from './types.ts';

export interface PublishableEntryRow {
  id: string;
  platforms: unknown;
  asset_type: string | null;
  caption: string | null;
  platform_captions: unknown;
  first_comment: string | null;
  asset_previews: unknown;
  preview_url: string | null;
  workflow_status: string | null;
  approved_at: string | null;
  content_revision: number | null;
  approved_revision: number | null;
  deleted_at: string | null;
}

interface EntryLookupResult {
  data: PublishableEntryRow | null;
  error: unknown | null;
}

export type EntryLookup = (entryId: string) => Promise<EntryLookupResult>;

export interface PublishableEntry {
  payload: PublishPayload;
  entryRevision: number;
}

const errorResponse = (error: string, status: number): Response =>
  new Response(JSON.stringify({ success: false, error }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const stringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? Array.from(
        new Set(
          value
            .filter((item): item is string => typeof item === 'string')
            .map((item) => item.trim())
            .filter(Boolean),
        ),
      )
    : [];

const stringRecord = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      .map(([key, caption]) => [key, caption.trim()])
      .filter(([key, caption]) => Boolean(key && caption)),
  );
};

const requireFreshApproval = (entry: PublishableEntryRow): void => {
  const issue = getApprovalFreshnessIssue({
    approvedAt: entry.approved_at,
    contentRevision: entry.content_revision,
    approvedRevision: entry.approved_revision,
  });
  if (issue) throw errorResponse(issue.message, 409);
};

/**
 * Resolve the publication payload from the authoritative database row.
 * Browser-supplied content, platforms, media and callback destinations are ignored.
 */
export async function requirePublishableEntry(
  entryIdValue: unknown,
  lookupEntry: EntryLookup,
): Promise<PublishableEntry> {
  const entryId = typeof entryIdValue === 'string' ? entryIdValue.trim() : '';
  if (!entryId) {
    throw errorResponse('A valid entry ID is required.', 400);
  }

  let result: EntryLookupResult;
  try {
    result = await lookupEntry(entryId);
  } catch {
    throw errorResponse('Unable to load the entry.', 500);
  }

  if (result.error) {
    throw errorResponse('Unable to load the entry.', 500);
  }

  const entry = result.data;
  if (!entry || entry.deleted_at) {
    throw errorResponse('Entry not found.', 404);
  }

  if (entry.workflow_status !== 'Approved') {
    throw errorResponse('Only currently approved entries can be published.', 409);
  }

  requireFreshApproval(entry);

  const platforms = stringArray(entry.platforms);
  if (platforms.length === 0) {
    throw errorResponse('The approved entry has no valid publishing platforms.', 422);
  }

  const assetType = entry.asset_type?.trim() ?? '';
  const payload: PublishPayload = {
    entryId: entry.id,
    platforms,
    caption: entry.caption ?? '',
    platformCaptions: stringRecord(entry.platform_captions),
    assetType,
    mediaUrls: assetType === 'Carousel' ? stringArray(entry.asset_previews) : [],
    previewUrl: assetType === 'Design' ? entry.preview_url?.trim() || null : null,
    firstComment: entry.first_comment ?? '',
  };

  const capabilityIssue = getPublishCapabilityIssue(payload);
  if (capabilityIssue) {
    throw errorResponse(capabilityIssue.message, 422);
  }

  return { payload, entryRevision: entry.content_revision as number };
}
