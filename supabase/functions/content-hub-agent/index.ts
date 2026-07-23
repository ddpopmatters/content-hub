import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  handleContentHubAgentRequest,
  type AgentRepository,
  type EntryFilters,
  type ReportFilters,
  type ReportingFilters,
} from '../_shared/contentHubAgent.ts';
import { parseEnabledAgentActions, type AgentActionRecord } from '../_shared/agentActions.ts';
import type { ReportingEntryRow } from '../_shared/agentReporting.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const AGENT_CLIENT_ID = Deno.env.get('CONTENT_HUB_AGENT_CLIENT_ID') ?? '';
const AGENT_SECRET = Deno.env.get('CONTENT_HUB_AGENT_SECRET') ?? '';
const AGENT_ENABLED = Deno.env.get('CONTENT_HUB_AGENT_ENABLED') === 'true';
const AGENT_PROPOSALS_ENABLED = Deno.env.get('CONTENT_HUB_AGENT_PROPOSALS_ENABLED') === 'true';
const AGENT_WRITES_ENABLED = Deno.env.get('CONTENT_HUB_AGENT_WRITES_ENABLED') === 'true';
const AGENT_WRITE_ACTIONS = parseEnabledAgentActions(
  Deno.env.get('CONTENT_HUB_AGENT_WRITE_ACTIONS') ?? '',
);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const recordRows = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];

const mapEntrySummary = (row: Record<string, unknown>): Record<string, unknown> => ({
  id: row.id,
  date: row.date,
  platforms: row.platforms,
  status: row.status,
  workflowStatus: row.workflow_status,
  caption:
    typeof row.caption === 'string' && row.caption.length > 280
      ? `${row.caption.slice(0, 277).trimEnd()}...`
      : row.caption,
  assetType: row.asset_type,
  campaign: row.campaign,
  contentPillar: row.content_pillar,
  priorityTier: row.priority_tier,
  updatedAt: row.updated_at,
  publishedAt: row.published_at,
});

const mapEntryDetail = (row: Record<string, unknown>): Record<string, unknown> => ({
  ...mapEntrySummary(row),
  platformCaptions: row.platform_captions,
  firstComment: row.first_comment,
  assetPreviews: row.asset_previews,
  previewUrl: row.preview_url,
  audienceSegments: row.audience_segments,
  url: row.url,
  contentRevision: row.content_revision,
  approvedRevision: row.approved_revision,
  agentProvenance: row.agent_provenance,
});

const mapReport = (
  row: Record<string, unknown>,
  includeDetails: boolean,
): Record<string, unknown> => ({
  id: row.id,
  reportType: row.report_type,
  periodMonth: row.period_month,
  periodQuarter: row.period_quarter,
  periodYear: row.period_year,
  campaignName: row.campaign_name,
  dateFrom: row.date_from,
  dateTo: row.date_to,
  ...(includeDetails
    ? {
        platformMetrics: row.platform_metrics,
        qualitative: row.qualitative,
        agentEvidence: row.agent_evidence,
      }
    : {}),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  agentProvenance: row.agent_provenance,
});

const mapAgentAction = (row: Record<string, unknown>): AgentActionRecord => ({
  id: String(row.id ?? ''),
  actionType: String(row.action_type ?? '') as AgentActionRecord['actionType'],
  targetId: typeof row.target_id === 'string' ? row.target_id : null,
  payloadHash: String(row.payload_hash ?? ''),
  idempotencyKey: String(row.idempotency_key ?? ''),
  summary: String(row.summary ?? ''),
  status: String(row.status ?? '') as AgentActionRecord['status'],
  expiresAt: String(row.expires_at ?? ''),
  resultClass: typeof row.result_class === 'string' ? row.result_class : null,
  result: isRecord(row.result) ? row.result : null,
  createdAt: String(row.created_at ?? ''),
  appliedAt: typeof row.applied_at === 'string' ? row.applied_at : null,
});

function createRepository(): AgentRepository {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    async claimRequest(input) {
      const { data, error } = await supabase.rpc('claim_agent_request', {
        p_client_id: input.clientId,
        p_nonce: input.nonce,
        p_capability: input.capability,
        p_payload_hash: input.payloadHash,
        p_per_minute_limit: 60,
      });
      if (error) throw new Error('request ledger unavailable');
      const row = recordRows(data)[0];
      const decision = row?.decision;
      if (decision !== 'claimed' && decision !== 'replayed' && decision !== 'rate_limited') {
        throw new Error('invalid request ledger response');
      }
      return {
        decision,
        requestId: typeof row.request_id === 'string' ? row.request_id : null,
      };
    },

    async completeRequest(requestId, resultClass) {
      const { error } = await supabase
        .from('agent_requests')
        .update({ result_class: resultClass, completed_at: new Date().toISOString() })
        .eq('id', requestId);
      if (error) throw new Error('request ledger completion unavailable');
    },

    async createAction(input) {
      const { data, error } = await supabase.rpc('create_agent_action', {
        p_client_id: input.clientId,
        p_action_type: input.actionType,
        p_target_id: input.targetId,
        p_payload: input.payload,
        p_payload_hash: input.payloadHash,
        p_idempotency_key: input.idempotencyKey,
        p_summary: input.summary,
        p_expires_at: input.expiresAt,
      });
      if (error || !isRecord(data)) throw new Error('action proposal unavailable');
      return mapAgentAction(data);
    },

    async getAction(actionId) {
      const { data, error } = await supabase
        .from('agent_actions')
        .select(
          'id,action_type,target_id,payload_hash,idempotency_key,summary,status,expires_at,result_class,result,created_at,applied_at',
        )
        .eq('id', actionId)
        .maybeSingle();
      if (error) throw new Error('action unavailable');
      return isRecord(data) ? mapAgentAction(data) : null;
    },

    async executeAction(input) {
      const { data, error } = await supabase.rpc('apply_agent_action', {
        p_action_id: input.actionId,
        p_client_id: input.clientId,
        p_payload_hash: input.payloadHash,
        p_idempotency_key: input.idempotencyKey,
        p_approval_reference: input.approvalReference,
        p_approved_by: input.approvedBy,
      });
      if (error || !isRecord(data) || !isRecord(data.action)) {
        throw new Error('action execution unavailable');
      }
      const decision = data.decision;
      if (
        decision !== 'applied' &&
        decision !== 'idempotent_replay' &&
        decision !== 'expired' &&
        decision !== 'conflict' &&
        decision !== 'rejected' &&
        decision !== 'failed'
      ) {
        throw new Error('invalid action execution response');
      }
      return { decision, action: mapAgentAction(data.action) };
    },

    async listEntries(filters: EntryFilters) {
      let query = supabase
        .from('entries')
        .select(
          'id,date,platforms,status,workflow_status,caption,asset_type,campaign,content_pillar,priority_tier,updated_at,published_at,deleted_at',
        )
        .is('deleted_at', null)
        .order('date', { ascending: true })
        .limit(filters.limit);
      if (filters.startDate) query = query.gte('date', filters.startDate);
      if (filters.endDate) query = query.lte('date', filters.endDate);
      if (filters.platform) query = query.contains('platforms', [filters.platform]);
      if (filters.workflowStatus) query = query.eq('workflow_status', filters.workflowStatus);
      if (filters.campaign) query = query.eq('campaign', filters.campaign);
      const { data, error } = await query;
      if (error) throw new Error('entries unavailable');
      return recordRows(data).map(mapEntrySummary);
    },

    async getEntry(entryId: string) {
      const { data, error } = await supabase
        .from('entries')
        .select(
          'id,date,platforms,status,workflow_status,caption,platform_captions,first_comment,asset_type,asset_previews,preview_url,campaign,content_pillar,priority_tier,audience_segments,url,content_revision,approved_revision,agent_provenance,updated_at,published_at,deleted_at',
        )
        .eq('id', entryId)
        .is('deleted_at', null)
        .maybeSingle();
      if (error) throw new Error('entry unavailable');
      return isRecord(data) ? mapEntryDetail(data) : null;
    },

    async getReportingEntries(filters: ReportingFilters) {
      let query = supabase
        .from('entries')
        .select(
          'id,date,platforms,analytics,status,workflow_status,caption,content_pillar,campaign,url,published_at,updated_at,deleted_at',
        )
        .is('deleted_at', null)
        .gte('date', filters.startDate)
        .lte('date', filters.endDate)
        .order('date', { ascending: false })
        .limit(filters.limit + 1);
      if (filters.platform) query = query.contains('platforms', [filters.platform]);
      if (filters.campaign) query = query.eq('campaign', filters.campaign);
      if (filters.contentPillar) query = query.eq('content_pillar', filters.contentPillar);
      if (filters.assetType) query = query.eq('asset_type', filters.assetType);
      const { data, error } = await query;
      if (error) throw new Error('reporting entries unavailable');
      const rows = recordRows(data);
      return {
        rows: rows.slice(0, filters.limit) as ReportingEntryRow[],
        truncated: rows.length > filters.limit,
      };
    },

    async listReports(filters: ReportFilters) {
      let query = supabase
        .from('monthly_reports')
        .select(
          'id,report_type,period_month,period_quarter,period_year,campaign_name,date_from,date_to,created_at,updated_at',
        )
        .order('period_year', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(filters.limit);
      if (filters.reportType) query = query.eq('report_type', filters.reportType);
      if (filters.year) query = query.eq('period_year', filters.year);
      const { data, error } = await query;
      if (error) throw new Error('reports unavailable');
      return recordRows(data).map((row) => mapReport(row, false));
    },

    async getReport(reportId: string) {
      const { data, error } = await supabase
        .from('monthly_reports')
        .select(
          'id,report_type,period_month,period_quarter,period_year,campaign_name,date_from,date_to,platform_metrics,qualitative,agent_provenance,agent_evidence,created_at,updated_at',
        )
        .eq('id', reportId)
        .maybeSingle();
      if (error) throw new Error('report unavailable');
      return isRecord(data) ? mapReport(data, true) : null;
    },

    async getPublicationStatus(entryId: string) {
      const { data: jobData, error: jobError } = await supabase
        .from('publication_jobs')
        .select('id,entry_revision,trigger_type,status,created_at,updated_at,completed_at')
        .eq('entry_id', entryId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (jobError) throw new Error('publication status unavailable');
      if (!isRecord(jobData)) return null;
      const { data: resultData, error: resultError } = await supabase
        .from('publication_results')
        .select('platform,status,error_code,attempt_count,updated_at')
        .eq('job_id', jobData.id)
        .order('platform');
      if (resultError) throw new Error('publication results unavailable');
      return {
        id: jobData.id,
        entryRevision: jobData.entry_revision,
        triggerType: jobData.trigger_type,
        status: jobData.status,
        createdAt: jobData.created_at,
        updatedAt: jobData.updated_at,
        completedAt: jobData.completed_at,
        results: recordRows(resultData).map((row) => ({
          platform: row.platform,
          status: row.status,
          errorCode: row.error_code,
          attemptCount: row.attempt_count,
          updatedAt: row.updated_at,
        })),
      };
    },
  };
}

Deno.serve((request) =>
  handleContentHubAgentRequest(request, {
    auth: {
      enabled: AGENT_ENABLED,
      clientId: AGENT_CLIENT_ID,
      secret: AGENT_SECRET,
    },
    repository: createRepository(),
    writePolicy: {
      proposalsEnabled: AGENT_PROPOSALS_ENABLED,
      executionEnabled: AGENT_WRITES_ENABLED,
      enabledActions: AGENT_WRITE_ACTIONS,
    },
  }),
);
