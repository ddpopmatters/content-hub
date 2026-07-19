import { createClient } from 'jsr:@supabase/supabase-js@2';
import { generateApprovalToken } from '../_shared/approvalToken.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import {
  CONTENT_REVIEW_URL_PLACEHOLDER,
  injectRecipientNotificationLinks,
} from '../_shared/notificationLinks.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const POSTMARK_SERVER_TOKEN = Deno.env.get('POSTMARK_SERVER_TOKEN') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'noreply@populationmatters.org';
const FROM_NAME = Deno.env.get('FROM_NAME') ?? 'Population Matters';
const APPROVAL_TOKEN_SECRET = Deno.env.get('APPROVAL_TOKEN_SECRET') ?? '';
// Public URL where approve.html is served
const APP_URL = Deno.env.get('APP_URL') ?? 'https://ddpopmatters.github.io/content-hub';

interface NotificationPayload {
  toEmails?: string[];
  approvers?: string[];
  to?: string[];
  subject: string;
  text: string;
  html?: string;
  /** When present, a signed "Approve directly" button is injected per recipient */
  entryId?: string;
}

interface ProfileRow {
  name: string;
  email: string;
}

// ── Email helpers ───────────────────────────────────────────────────────────

async function resolveEmails(names: string[]): Promise<string[]> {
  if (!names.length) return [];
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const directEmails = names.filter((n) => n.includes('@'));
  const namesToLookup = names.filter((n) => !n.includes('@'));
  if (!namesToLookup.length) return directEmails;
  const resolved: string[] = [...directEmails];
  const { data: profileData } = await supabase
    .from('user_profiles')
    .select('name, email')
    .in('name', namesToLookup);
  const foundInProfiles = new Set<string>();
  for (const row of (profileData as ProfileRow[]) ?? []) {
    if (row.email) {
      resolved.push(row.email);
      foundInProfiles.add(row.name);
    }
  }
  const stillUnresolved = namesToLookup.filter((n) => !foundInProfiles.has(n));
  if (stillUnresolved.length) {
    const { data: guidelinesData } = await supabase
      .from('guidelines')
      .select('approver_directory')
      .eq('id', 'default')
      .single();
    const directory: { name: string; email: string }[] =
      (guidelinesData as { approver_directory: { name: string; email: string }[] } | null)
        ?.approver_directory ?? [];
    for (const entry of directory) {
      if (stillUnresolved.includes(entry.name) && entry.email) {
        resolved.push(entry.email);
      }
    }
  }
  return [...new Set(resolved)];
}

function buildApproveButton(approveUrl: string): string {
  return (
    '<div style="margin-top:12px; text-align:center;">' +
    '<a href="' +
    approveUrl +
    '"' +
    ' style="display:inline-block; padding:14px 36px; background:#059669; color:#ffffff;' +
    ' text-decoration:none; border-radius:999px; font-weight:600; font-size:15px;">' +
    ' Approve content</a>' +
    '<p style="margin:8px 0 0; font-size:11px; color:#9ca3af;">' +
    'Clicking this link records your approval. The link expires in 7 days.' +
    '</p></div>'
  );
}

async function sendEmail(
  to: string,
  payload: NotificationPayload,
  text: string,
  html?: string,
): Promise<void> {
  if (RESEND_API_KEY) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [to],
        subject: payload.subject,
        text,
        ...(html ? { html } : payload.html ? { html: payload.html } : {}),
      }),
    });
    if (!res.ok) {
      throw new Error(`Resend delivery failed with status ${res.status}.`);
    }
    return;
  }

  if (POSTMARK_SERVER_TOKEN) {
    const res = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'X-Postmark-Server-Token': POSTMARK_SERVER_TOKEN,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        From: FROM_NAME + ' <' + FROM_EMAIL + '>',
        To: to,
        Subject: payload.subject,
        TextBody: text,
        ...(html ? { HtmlBody: html } : payload.html ? { HtmlBody: payload.html } : {}),
      }),
    });
    if (!res.ok) {
      throw new Error(`Postmark delivery failed with status ${res.status}.`);
    }
    return;
  }

  throw new Error('No email provider configured for send-notification');
}

// ── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const payload: NotificationPayload = await req.json();

    const directEmails = (payload.toEmails ?? []).filter(Boolean);
    const allNames = [...(payload.approvers ?? []), ...(payload.to ?? [])].filter(Boolean);
    const resolvedFromNames = allNames.length ? await resolveEmails(allNames) : [];
    const emails = [...new Set([...directEmails, ...resolvedFromNames])];

    if (!emails.length) {
      console.warn('[send-notification] No emails resolved');
      return new Response(
        JSON.stringify({
          ok: false,
          sent: 0,
          failed: 1,
          error: 'No email addresses found for recipients.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const sendTasks = emails.map(async (email) => {
      let perRecipientHtml: string | undefined = payload.html;
      let perRecipientText = payload.text;
      const containsReviewLink =
        perRecipientText.includes(CONTENT_REVIEW_URL_PLACEHOLDER) ||
        Boolean(perRecipientHtml?.includes(CONTENT_REVIEW_URL_PLACEHOLDER));

      if (containsReviewLink && !payload.entryId) {
        throw new Error('Signed review links are unavailable.');
      }

      if (payload.entryId) {
        const token = await generateApprovalToken(APPROVAL_TOKEN_SECRET, payload.entryId, email);
        if (!token) throw new Error('Approval links are unavailable.');
        const links = injectRecipientNotificationLinks(
          perRecipientText,
          perRecipientHtml,
          APP_URL,
          token,
        );
        perRecipientText = links.text;
        perRecipientHtml = links.html;
        if (perRecipientHtml) {
          const approveUrl = links.approveUrl;
          const button = buildApproveButton(approveUrl);
          const insertBefore = '</div>\n  </div>';
          if (perRecipientHtml.includes(insertBefore)) {
            perRecipientHtml = perRecipientHtml.replace(insertBefore, button + '\n' + insertBefore);
          } else {
            perRecipientHtml += '\n' + button;
          }
        }
      }

      return sendEmail(email, payload, perRecipientText, perRecipientHtml);
    });

    const results = await Promise.allSettled(sendTasks);
    const sent = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];

    if (failed.length) {
      console.error(
        '[send-notification] Failed sends:',
        failed.map((r) => r.reason?.message),
      );
    }

    return new Response(
      JSON.stringify({
        ok: failed.length === 0,
        sent,
        failed: failed.length,
        ...(failed.length
          ? {
              error: `Failed to send ${failed.length} notification${failed.length === 1 ? '' : 's'}.`,
            }
          : {}),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch {
    console.error('[send-notification] Unhandled notification error.');
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
