export type ContentType = 'social_caption' | 'blog_post' | 'email' | 'appeal' | 'script' | 'other';

export type SimStatus = 'pending' | 'running' | 'complete' | 'failed';

export type IterStatus = 'pending' | 'running' | 'complete' | 'failed';

export interface PersonaConfig {
  id: string;
  label: string;
  description: string;
}

export interface DiffChunk {
  type: 'keep' | 'remove' | 'add';
  text: string;
  reason?: string;
}

export interface SegmentResult {
  persona_id: string;
  label: string;
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  score: number;
  key_reactions: string[];
  concerns: string[];
  suggested_improvements: string[];
}

export interface AudienceSim {
  id: string;
  entry_id: string | null;
  idea_id: string | null;
  content_text: string;
  content_type: ContentType;
  segments: string[];
  status: SimStatus;
  error_message: string | null;
  results: { segment_results: SegmentResult[]; overall_summary: string } | null;
  iteration_original: string | null;
  iteration_revised: string | null;
  iteration_diff: DiffChunk[] | null;
  iteration_status: IterStatus | null;
  iteration_error: string | null;
  run_by: string;
  run_by_name: string | null;
  created_at: string;
  completed_at: string | null;
}
