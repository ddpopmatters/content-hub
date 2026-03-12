import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'noreply@populationmatters.org';
const FROM_NAME = Deno.env.get('FROM_NAME') ?? 'Population Matters';

interface NotificationPayload {
  /** Approver names — looked up in user_profiles to resolve emails */
  approvers?: string[];
  /** Author/requestor names — looked up to resolve emails */
  to?: string[];
  subject: string;
  text: string;
  html?: string;
}

interface ProfileRow {
  name: string;
  email: string;
}

async function resolveEmails(names: string[]): Promise<string[]> {
  if (!names.length) return [];

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabase
    .from('user_profiles')
    .select('name, email')
    .in('name', names);

  if (error) {
    console.error('[send-notification] DB lookup error:', error.message);
    return [];
  }

  const fromProfiles = ((data as ProfileRow[]) ?? []).map((p) => p.email).filter(Boolean);

  // Also pass through any entries that already look like email addresses
  const directEmails = names.filter((n) => n.includes('@'));

  return [...new Set([...fromProfiles, ...directEmails])];
}

async function sendEmail(to: string, payload: NotificationPayload): Promise<void> {
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
      ...(payload.html ? { html: payload.html } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error ${res.status}: ${body}`);
  }
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const payload: NotificationPayload = await req.json();

    const allNames = [...(payload.approvers ?? []), ...(payload.to ?? [])].filter(Boolean);

    if (!allNames.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0, note: 'No recipients specified' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const emails = await resolveEmails(allNames);

    if (!emails.length) {
      console.warn('[send-notification] No emails resolved for names:', allNames);
      return new Response(
        JSON.stringify({ ok: true, sent: 0, note: 'No email addresses found for recipients' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const results = await Promise.allSettled(emails.map((email) => sendEmail(email, payload)));

    const sent = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];

    if (failed.length) {
      console.error(
        '[send-notification] Failed sends:',
        failed.map((r) => r.reason?.message),
      );
    }

    return new Response(JSON.stringify({ ok: true, sent, failed: failed.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[send-notification] Unhandled error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
