import { getSupabase, initSupabase } from '../../lib/supabase';
import type { AudienceSim, ContentType, DiffChunk } from './types';

interface CreateSimInput {
  entry_id?: string | null;
  idea_id?: string | null;
  content_text: string;
  content_type: ContentType;
  segments: string[];
  status: AudienceSim['status'];
  run_by: string;
  run_by_name?: string | null;
}

const ensureStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const ensureDiffChunks = (value: unknown): DiffChunk[] | null =>
  Array.isArray(value)
    ? value
        .filter(
          (item): item is DiffChunk =>
            typeof item === 'object' &&
            item !== null &&
            'type' in item &&
            'text' in item &&
            (item.type === 'keep' || item.type === 'remove' || item.type === 'add') &&
            typeof item.text === 'string',
        )
        .map((item) => ({
          type: item.type,
          text: item.text,
          ...(typeof item.reason === 'string' && item.reason ? { reason: item.reason } : {}),
        }))
    : null;

const normalizeAudienceSim = (value: unknown): AudienceSim => {
  if (!value || typeof value !== 'object') {
    throw new Error('Audience simulation payload was invalid');
  }

  const row = value as Record<string, unknown>;

  return {
    id: String(row.id || ''),
    entry_id: typeof row.entry_id === 'string' ? row.entry_id : null,
    idea_id: typeof row.idea_id === 'string' ? row.idea_id : null,
    content_text: typeof row.content_text === 'string' ? row.content_text : '',
    content_type: (row.content_type as AudienceSim['content_type']) || 'other',
    segments: ensureStringArray(row.segments),
    status: (row.status as AudienceSim['status']) || 'pending',
    error_message: typeof row.error_message === 'string' ? row.error_message : null,
    results:
      row.results && typeof row.results === 'object'
        ? (row.results as AudienceSim['results'])
        : null,
    iteration_original: typeof row.iteration_original === 'string' ? row.iteration_original : null,
    iteration_revised: typeof row.iteration_revised === 'string' ? row.iteration_revised : null,
    iteration_diff: ensureDiffChunks(row.iteration_diff),
    iteration_status: (row.iteration_status as AudienceSim['iteration_status']) || null,
    iteration_error: typeof row.iteration_error === 'string' ? row.iteration_error : null,
    run_by: typeof row.run_by === 'string' ? row.run_by : '',
    run_by_name: typeof row.run_by_name === 'string' ? row.run_by_name : null,
    created_at: typeof row.created_at === 'string' ? row.created_at : '',
    completed_at: typeof row.completed_at === 'string' ? row.completed_at : null,
  };
};

const getClient = async () => {
  await initSupabase();
  const client = getSupabase();
  if (!client) {
    throw new Error('Supabase is unavailable');
  }
  return client;
};

export async function createSim(input: CreateSimInput): Promise<AudienceSim> {
  const client = await getClient();
  const { data, error } = await client.from('audience_simulations').insert(input).select().single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create audience simulation');
  }

  return normalizeAudienceSim(data);
}

export async function getSim(simId: string): Promise<AudienceSim> {
  const client = await getClient();
  const { data, error } = await client
    .from('audience_simulations')
    .select('*')
    .eq('id', simId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || 'Failed to load audience simulation');
  }

  if (!data) {
    throw new Error('Audience simulation not found');
  }

  return normalizeAudienceSim(data);
}

export async function listSims(entryId?: string, ideaId?: string): Promise<AudienceSim[]> {
  const client = await getClient();

  let query = client
    .from('audience_simulations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (entryId && ideaId) {
    query = query.or(`entry_id.eq.${entryId},idea_id.eq.${ideaId}`);
  } else if (entryId) {
    query = query.eq('entry_id', entryId);
  } else if (ideaId) {
    query = query.eq('idea_id', ideaId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || 'Failed to load audience simulation history');
  }

  return (data || []).map(normalizeAudienceSim);
}
