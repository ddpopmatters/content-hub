import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

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

// ── Token generation ────────────────────────────────────────────────────────

function b64urlEncode(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/[+]/g, '-')
    .replace(/[/]/g, '_')
    .replace(/=/g, '');
}

function b64urlEncodeStr(s: string): string {
  return btoa(unescape(encodeURIComponent(s)))
    .replace(/[+]/g, '-')
    .replace(/[/]/g, '_')
    .replace(/=/g, '');
}

async function generateApprovalToken(entryId: string, email: string): Promise<string | null> {
  if (!APPROVAL_TOKEN_SECRET) return null;
  const now = Math.floor(Date.now() / 1000);
  const header = b64urlEncodeStr(JSON.stringify({ alg: 'HS256', typ: 'APT' }));
  const body = b64urlEncodeStr(
    JSON.stringify({ eid: entryId, eml: email, iat: now, exp: now + 7 * 24 * 3600 }),
  );
  const message = header + '.' + body;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(APPROVAL_TOKEN_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return message + '.' + b64urlEncode(sig);
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

async function sendEmail(to: string, payload: NotificationPayload, html?: string): Promise<void> {
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
        text: payload.text,
        ...(html ? { html } : payload.html ? { html: payload.html } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error('Resend error ' + res.status + ': ' + body);
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
        TextBody: payload.text,
        ...(html ? { HtmlBody: html } : payload.html ? { HtmlBody: payload.html } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error('Postmark error ' + res.status + ': ' + body);
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

      if (payload.entryId && payload.html && APPROVAL_TOKEN_SECRET) {
        const token = await generateApprovalToken(payload.entryId, email);
        if (token) {
          const approveUrl = APP_URL + '/approve.html?token=' + encodeURIComponent(token);
          const button = buildApproveButton(approveUrl);
          const insertBefore = '</div>\n  </div>';
          if (perRecipientHtml && perRecipientHtml.includes(insertBefore)) {
            perRecipientHtml = perRecipientHtml.replace(insertBefore, button + '\n' + insertBefore);
          } else {
            perRecipientHtml = (perRecipientHtml ?? '') + '\n' + button;
          }
        }
      }

      return sendEmail(email, payload, perRecipientHtml);
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
  } catch (err) {
    console.error('[send-notification] Unhandled error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
