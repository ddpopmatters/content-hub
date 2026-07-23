/**
 * approve-entry — public Edge Function for login-free approvals.
 *
 * GET  ?token=<signed-token>  → validate token + return entry data
 * POST { token }              → validate token + mark entry Approved
 *
 * Token format: base64url(header).base64url(payload).base64url(sig)
 * Payload: { eid: string, rid: string, rev: number, scp: string, iat: number, exp: number }
 *
 * Secret: APPROVAL_TOKEN_SECRET env var (set via `supabase secrets set`)
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  approvalRecipientId,
  type ApprovalTokenScope,
  verifyApprovalToken,
} from '../_shared/approvalToken.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APPROVAL_TOKEN_SECRET = Deno.env.get('APPROVAL_TOKEN_SECRET') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface ProfileRow {
  name: string;
  email: string;
}

const ensurePeople = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) return ensurePeople(parsed);
  } catch {
    // A plain stored name is valid.
  }
  return [value.trim()];
};

async function resolveEmails(names: string[]): Promise<string[]> {
  if (!names.length) return [];
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const directEmails = names.filter((name) => name.includes('@'));
  const namesToLookup = names.filter((name) => !name.includes('@'));
  const resolved: string[] = [...directEmails];
  if (namesToLookup.length) {
    const { data: profileData } = await supabase
      .from('user_profiles')
      .select('name,email')
      .in('name', namesToLookup);
    const found = new Set<string>();
    for (const row of (profileData as ProfileRow[]) ?? []) {
      if (row.email) {
        resolved.push(row.email);
        found.add(row.name);
      }
    }
    const unresolved = namesToLookup.filter((name) => !found.has(name));
    if (unresolved.length) {
      const { data: guidelinesData } = await supabase
        .from('guidelines')
        .select('approver_directory')
        .eq('id', 'default')
        .single();
      const directory =
        (
          guidelinesData as {
            approver_directory?: { name: string; email: string }[];
          } | null
        )?.approver_directory ?? [];
      for (const item of directory) {
        if (unresolved.includes(item.name) && item.email) resolved.push(item.email);
      }
    }
  }
  return [...new Set(resolved.map((email) => email.trim().toLowerCase()).filter(Boolean))];
}

async function tokenRecipientIsCurrentEntryRecipient(
  author: unknown,
  approvers: unknown,
  recipientId: string,
  scope: ApprovalTokenScope,
): Promise<boolean> {
  if (!recipientId) return false;
  const identities =
    scope === 'approve'
      ? ensurePeople(approvers)
      : [...ensurePeople(author), ...ensurePeople(approvers)];
  const emails = await resolveEmails(identities);
  const recipientIds = await Promise.all(
    emails.map((email) => approvalRecipientId(APPROVAL_TOKEN_SECRET, email)),
  );
  return recipientIds.includes(recipientId);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // ── GET: validate token + return entry data ────────────────────────────────
  if (req.method === 'GET') {
    const token = url.searchParams.get('token') ?? '';
    const payload = await verifyApprovalToken(APPROVAL_TOKEN_SECRET, token);
    if (
      !payload ||
      (payload.scp !== 'review' && payload.scp !== 'approve') ||
      !Number.isInteger(payload.rev)
    ) {
      return new Response(JSON.stringify({ error: 'Invalid or expired approval link.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: entry, error } = await supabase
      .from('entries')
      .select(
        'id, caption, asset_type, date, platforms, status, workflow_status, author, campaign, content_pillar, approvers, preview_url, approved_at, content_revision',
      )
      .eq('id', payload.eid)
      .eq('content_revision', payload.rev)
      .is('deleted_at', null)
      .maybeSingle();

    if (error || !entry) {
      return new Response(JSON.stringify({ error: 'Entry not found or review link is stale.' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (
      !(await tokenRecipientIsCurrentEntryRecipient(
        entry.author,
        entry.approvers,
        payload.rid,
        payload.scp,
      ))
    ) {
      return new Response(JSON.stringify({ error: 'This review link is no longer authorised.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        entry: {
          id: entry.id,
          caption: entry.caption,
          assetType: entry.asset_type,
          date: entry.date,
          platforms: entry.platforms,
          status: entry.status,
          workflowStatus: entry.workflow_status,
          author: entry.author,
          campaign: entry.campaign,
          contentPillar: entry.content_pillar,
          approvers: entry.approvers,
          previewUrl: entry.preview_url,
        },
        alreadyApproved: entry.status === 'Approved',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // ── POST: record approval ──────────────────────────────────────────────────
  if (req.method === 'POST') {
    let token = '';
    try {
      const body = await req.json();
      token = body.token ?? '';
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid request body.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = await verifyApprovalToken(APPROVAL_TOKEN_SECRET, token);
    if (
      !payload ||
      payload.scp !== 'approve' ||
      !Number.isInteger(payload.rev) ||
      payload.rev === undefined
    ) {
      return new Response(JSON.stringify({ error: 'Invalid or expired approval link.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: currentEntry, error: currentEntryError } = await supabase
      .from('entries')
      .select('id,approvers,content_revision')
      .eq('id', payload.eid)
      .eq('content_revision', payload.rev)
      .is('deleted_at', null)
      .maybeSingle();
    if (
      currentEntryError ||
      !currentEntry ||
      !(await tokenRecipientIsCurrentEntryRecipient(
        null,
        currentEntry.approvers,
        payload.rid,
        'approve',
      ))
    ) {
      return new Response(
        JSON.stringify({ error: 'This approval link is stale or is no longer authorised.' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const now = new Date().toISOString();
    const { data: approvedEntry, error } = await supabase
      .from('entries')
      .update({
        status: 'Approved',
        workflow_status: 'Approved',
        approved_at: now,
        updated_at: now,
      })
      .eq('id', payload.eid)
      .eq('content_revision', payload.rev)
      .is('deleted_at', null)
      .in('status', ['In Review', 'Pending', 'Draft'])
      .select('id')
      .maybeSingle(); // only advance, never regress

    if (error || !approvedEntry) {
      return new Response(JSON.stringify({ error: 'Failed to record approval.' }), {
        status: error ? 500 : 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, approvedAt: now }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response('Method not allowed', { status: 405, headers: corsHeaders });
});
