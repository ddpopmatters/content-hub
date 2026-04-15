/**
 * Email template utilities for entry approval notifications
 */
import { escapeHtml, ensureArray } from './utils';
import { getPlatformCaption } from './sanitizers';
import type { Entry } from '../types/models';

export interface EmailAttachment {
  name: string;
  url: string;
}

export interface PlatformSection {
  platform: string;
  caption: string;
}

export interface EntryEmailContext {
  descriptor: string;
  dateLabel: string;
  platformsLabel: string;
  campaign: string;
  contentPillar: string;
  assetType: string;
  author: string;
  captionPreview: string;
  platformSections: PlatformSection[];
  previewUrl: string;
  attachments: EmailAttachment[];
  firstComment: string;
  deadline: string;
  link: string;
}

export interface EntryEmailPayload {
  subject: string;
  text: string;
  html: string;
}

const getAppBaseUrl = (): string => {
  if (typeof window === 'undefined') return '';

  try {
    const url = new URL(window.location.href);
    url.hash = '';
    url.search = '';

    if (url.hostname === 'ddpopmatters.github.io') {
      url.pathname = '/content-hub/';
      return url.toString();
    }

    if (!url.pathname.endsWith('/')) {
      url.pathname = url.pathname.replace(/[^/]*$/, '');
    }

    return url.toString();
  } catch {
    return window.location.href.split('#')[0].replace(/[^/]*$/, '');
  }
};

/**
 * Returns a human-readable description of an entry
 */
export const entryDescriptor = (entry: Partial<Entry> | null | undefined): string => {
  if (!entry) return 'this entry';
  if (entry.caption && entry.caption.trim().length) return entry.caption.trim();
  const dateValue = entry.date ? new Date(entry.date) : null;
  const dateLabel =
    dateValue && !Number.isNaN(dateValue.getTime())
      ? dateValue.toLocaleDateString()
      : entry.date || 'an unscheduled date';
  const asset = entry.assetType || 'Asset';
  return `${asset} on ${dateLabel}`;
};

/**
 * Returns the review link URL for an entry
 */
export const entryReviewLink = (entry: Partial<Entry> | null | undefined): string => {
  if (typeof window === 'undefined' || !entry) return '';
  try {
    return `${getAppBaseUrl()}review.html?id=${encodeURIComponent(entry.id || '')}`;
  } catch {
    return '';
  }
};

/**
 * Builds the context object for email templates
 */
export const buildEntryEmailContext = (
  entry: Partial<Entry> | null | undefined,
): EntryEmailContext | null => {
  if (!entry) return null;
  const dateLabel = entry.date
    ? new Date(entry.date).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Not scheduled';
  const platformsArray = ensureArray(entry.platforms || []);
  const platformsLabel = platformsArray.length ? platformsArray.join(', ') : 'Not set';
  const descriptor =
    entry.caption && entry.caption.trim().length
      ? entry.caption.trim().slice(0, 120) + (entry.caption.length > 120 ? '…' : '')
      : `${entry.assetType || 'Asset'} on ${dateLabel}`;
  const captionPreview =
    entry.caption && entry.caption.trim().length ? entry.caption.trim() : 'No caption provided.';
  // Use entryReviewLink which has proper window guard for SSR/test safety
  const link = entryReviewLink(entry);
  const platformSections = (platformsArray.length ? platformsArray : ['Main']).map((platform) => {
    const caption =
      getPlatformCaption(entry.caption || '', entry.platformCaptions || {}, platform) ||
      captionPreview;
    return { platform, caption };
  });
  const attachments: EmailAttachment[] = Array.isArray(entry.attachments)
    ? (entry.attachments
        .map((file) => {
          if (!file || typeof file !== 'object') return null;
          const name = typeof file.name === 'string' ? file.name : 'Attachment';
          // Prefer url for external links, fall back to dataUrl for inline
          const url = file.url || file.dataUrl || '';
          return url ? { name, url } : null;
        })
        .filter(Boolean) as EmailAttachment[])
    : [];
  return {
    descriptor,
    dateLabel,
    platformsLabel,
    campaign: entry.campaign || 'Not set',
    contentPillar: entry.contentPillar || 'Not set',
    assetType: entry.assetType || 'Asset',
    author: entry.author || 'Unknown',
    captionPreview,
    platformSections,
    previewUrl: entry.previewUrl || '',
    attachments,
    firstComment: entry.firstComment || '',
    deadline: entry.approvalDeadline || '',
    link,
  };
};

/**
 * Builds HTML email content for approval requests
 */
export const buildEntryEmailHtml = (context: EntryEmailContext | null): string => {
  if (!context) return '';
  return `
  <div style="font-family:'Helvetica Neue',Arial,sans-serif; max-width:640px; margin:0 auto; color:#0f172a;">
    <div style="padding:32px; background:#f7fbff; border:1px solid #dbeafe; border-radius:24px;">
<div style="text-align:center; margin-bottom:24px;">
  <p style="margin:0; font-size:12px; letter-spacing:0.2em; color:#94a3b8;">PM DASHBOARD</p>
  <h1 style="margin:12px 0 0; font-size:24px; color:#0f172a;">${escapeHtml(context.author)} has asked you to approve social media content</h1>
</div>
<p style="margin:0 0 16px; font-size:15px; line-height:1.6;">${escapeHtml(context.author)} has asked you to take a look at some content for social media.${context.deadline ? ` Please approve it by <span style="font-weight:600;">${escapeHtml(context.deadline)}</span>.` : ''} See the content below.</p>
<table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
  <tbody>
    <tr>
      <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Scheduled</td>
      <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${escapeHtml(context.dateLabel)}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Platforms</td>
      <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${escapeHtml(context.platformsLabel)}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Author</td>
      <td style="padding: 8px 0; color: #111827; font-size: 14px;">${escapeHtml(context.author)}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Campaign</td>
      <td style="padding: 8px 0; color: #111827; font-size: 14px;">${escapeHtml(context.campaign)}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Content pillar</td>
      <td style="padding: 8px 0; color: #111827; font-size: 14px;">${escapeHtml(context.contentPillar)}</td>
    </tr>
  </tbody>
</table>
<div style="display: flex; flex-direction: column; gap: 12px;">
  ${context.platformSections
    .map(
      (section) => `
    <div style="padding: 16px; background: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0;">
      <div style="display:flex; align-items:center; justify-content:space-between;">
        <p style="margin: 0; color: #0A66C2; font-size: 13px; letter-spacing: 0.2em;">${escapeHtml(section.platform)}</p>
        <span style="color:#94a3b8; font-size:12px;">Caption</span>
      </div>
      <p style="margin: 8px 0 0; color: #111827; font-size: 14px; line-height:1.5;">${escapeHtml(section.caption)}</p>
    </div>`,
    )
    .join('')}
</div>
${
  context.previewUrl
    ? `
<div style="margin-top:16px;">
  <p style="margin:0 0 8px; color:#6b7280; font-size:13px;">Preview asset</p>
  <img src="${escapeHtml(context.previewUrl)}" alt="Preview asset" style="width:100%; border-radius:12px; border:1px solid #e5e7eb; object-fit:cover;" />
</div>`
    : ''
}
${
  context.attachments && context.attachments.length
    ? `
<div style="margin-top:16px;">
  <p style="margin:0 0 8px; color:#6b7280; font-size:13px;">Attachments</p>
  <ul style="margin:0; padding-left:18px; color:#0f172a; font-size:14px;">
    ${context.attachments
      .map(
        (file) =>
          `<li><a href="${escapeHtml(file.url)}" style="color:#0A66C2; text-decoration:none;">${escapeHtml(file.name)}</a></li>`,
      )
      .join('')}
  </ul>
</div>`
    : ''
}
${
  context.firstComment
    ? `
<div style="margin-top:16px; padding:16px; background:#fff7ed; border-radius:12px; border:1px solid #fed7aa;">
  <p style="margin:0 0 6px; color:#9a3412; font-size:13px;">First comment</p>
  <p style="margin:0; color:#7c2d12; font-size:14px;">${escapeHtml(context.firstComment)}</p>
</div>`
    : ''
}
<div style="margin-top: 24px; text-align: center;">
  <a href="${escapeHtml(context.link)}" style="display: inline-block; padding: 14px 36px; background: #0A66C2; color: #ffffff; text-decoration: none; border-radius: 999px; font-weight: 600;">Review in PM Dashboard</a>
</div>
    </div>
  </div>
  `.trim();
};

/**
 * Builds plain text email content for approval requests
 */
export const buildEntryEmailText = (context: EntryEmailContext | null): string => {
  if (!context) return '';
  return [
    `${context.author} has asked you to approve social media content`,
    `Scheduled: ${context.dateLabel}`,
    `Platforms: ${context.platformsLabel}`,
    `Author: ${context.author}`,
    `Campaign: ${context.campaign}`,
    `Content pillar: ${context.contentPillar}`,
    context.deadline ? `Approval deadline: ${context.deadline}` : null,
    ...context.platformSections.map((section) => `${section.platform} caption: ${section.caption}`),
    context.firstComment ? `First comment: ${context.firstComment}` : null,
    context.attachments && context.attachments.length
      ? `Attachments: ${context.attachments.map((file) => file.url).join(', ')}`
      : null,
    `Open: ${context.link}`,
  ]
    .filter(Boolean)
    .join('\n');
};

/**
 * Builds the complete email payload for approval requests
 */
export const buildEntryEmailPayload = (
  entry: Partial<Entry> | null | undefined,
  opts: { subjectOverride?: string } = {},
): EntryEmailPayload | null => {
  const { subjectOverride } = opts || {};
  const context = buildEntryEmailContext(entry);
  if (!context) return null;
  const subject =
    subjectOverride || `${context.author} has asked you to approve social media content`;
  return {
    subject,
    text: buildEntryEmailText(context),
    html: buildEntryEmailHtml(context),
  };
};
