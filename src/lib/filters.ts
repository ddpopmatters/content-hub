import type { Entry } from '../types/models';

export function isApprovalOverdue(entry: Entry): boolean {
  if (!entry?.approvalDeadline) return false;
  const parsed = new Date(entry.approvalDeadline);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() < Date.now() && entry.status !== 'Approved';
}

export function matchesSearch(entry: Entry, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  const caption = entry.caption || '';
  const platformCaptions =
    entry.platformCaptions && typeof entry.platformCaptions === 'object'
      ? Object.values(entry.platformCaptions).join(' ')
      : '';
  const platforms = Array.isArray(entry.platforms) ? entry.platforms.join(' ') : '';
  const extra = [
    entry.author,
    entry.campaign,
    entry.contentPillar,
    entry.statusDetail,
    entry.workflowStatus,
    entry.status,
    entry.assetType,
    entry.previewUrl,
    entry.firstComment,
  ]
    .filter(Boolean)
    .join(' ');
  const haystack = `${caption} ${platformCaptions} ${platforms} ${extra}`.toLowerCase();
  return haystack.includes(normalized);
}
