import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'noreply@populationmatters.org';
const FROM_NAME = Deno.env.get('FROM_NAME') ?? 'Population Matters';

interface NotificationPayload {
  /** Pre-resolved email addresses — used directly, no lookup needed */
  toEmails?: string[];
  /** Approver/author names — resolved via user_profiles or approver_directory */
  approvers?: string[];
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

  // Direct emails — pass through immediately
  const directEmails = names.filter((n) => n.includes('@'));
  const namesToLookup = names.filter((n) => !n.includes('@'));

  if (!namesToLookup.length) return directEmails;

  const resolved: string[] = [...directEmails];

  // 1. Look up in user_profiles (authenticated users)
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

  // 2. Look up remaining names in guidelines.approver_directory
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

    // Collect all destination emails:
    // 1. Pre-resolved toEmails (used directly)
    // 2. Names in approvers/to (resolved via user_profiles + approver_directory)
    const directEmails = (payload.toEmails ?? []).filter(Boolean);
    const allNames = [...(payload.approvers ?? []), ...(payload.to ?? [])].filter(Boolean);

    const resolvedFromNames = allNames.length ? await resolveEmails(allNames) : [];
    const emails = [...new Set([...directEmails, ...resolvedFromNames])];

    if (!emails.length) {
      console.warn('[send-notification] No emails resolved for payload:', {
        toEmails: payload.toEmails,
        names: allNames,
      });
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
