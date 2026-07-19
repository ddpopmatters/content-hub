/**
 * approve-entry — public Edge Function for login-free approvals.
 *
 * GET  ?token=<signed-token>  → validate token + return entry data
 * POST { token }              → validate token + mark entry Approved
 *
 * Token format: base64url(header).base64url(payload).base64url(sig)
 * Payload: { eid: string, rid: string, iat: number, exp: number }
 *
 * Secret: APPROVAL_TOKEN_SECRET env var (set via `supabase secrets set`)
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { verifyApprovalToken } from '../_shared/approvalToken.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APPROVAL_TOKEN_SECRET = Deno.env.get('APPROVAL_TOKEN_SECRET') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // ── GET: validate token + return entry data ────────────────────────────────
  if (req.method === 'GET') {
    const token = url.searchParams.get('token') ?? '';
    const payload = await verifyApprovalToken(APPROVAL_TOKEN_SECRET, token);
    if (!payload) {
      return new Response(JSON.stringify({ error: 'Invalid or expired approval link.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: entry, error } = await supabase
      .from('entries')
      .select(
        'id, caption, asset_type, date, platforms, status, workflow_status, author, campaign, content_pillar, approvers, preview_url, approved_at',
      )
      .eq('id', payload.eid)
      .is('deleted_at', null)
      .single();

    if (error || !entry) {
      return new Response(JSON.stringify({ error: 'Entry not found.' }), {
        status: 404,
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
    if (!payload) {
      return new Response(JSON.stringify({ error: 'Invalid or expired approval link.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('entries')
      .update({
        status: 'Approved',
        workflow_status: 'Approved',
        approved_at: now,
        updated_at: now,
      })
      .eq('id', payload.eid)
      .is('deleted_at', null)
      .in('status', ['In Review', 'Pending', 'Draft']); // only advance, never regress

    if (error) {
      return new Response(JSON.stringify({ error: 'Failed to record approval.' }), {
        status: 500,
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
