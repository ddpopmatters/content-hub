import { corsHeaders, handleCors } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const ANTHROPIC_MODEL = 'claude-sonnet-4-6';
const ANTHROPIC_VERSION = '2023-06-01';

interface SimulationRequest {
  sim_id: string;
  content_text: string;
  content_type: string;
  segments: string[];
  entry_id?: string;
  idea_id?: string;
}

interface SegmentResult {
  persona_id: string;
  label: string;
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  score: number;
  key_reactions: string[];
  concerns: string[];
  suggested_improvements: string[];
}

const PERSONAS: Record<string, { label: string; description: string }> = {
  guardians: {
    label: 'The Guardians',
    description:
      'UK donors who care about nature and future generations. Values-led, emotional, responsive to individual stories.',
  },
  catalysts: {
    label: 'The Catalysts',
    description:
      'International development partners. Rights-based framework, SDG alignment, technical credibility.',
  },
  deciders: {
    label: 'The Deciders',
    description:
      'Government/parliamentary audience. Evidence-based, policy implications, UK and global framing.',
  },
  srhr: {
    label: 'The SRHR Advocates',
    description:
      'Reproductive health and rights advocates. Intersectional lens, strong rights language, suspicious of population framing.',
  },
  persuadables: {
    label: 'The Persuadables',
    description:
      'Sympathetic public open to the PM message. Respond to counterintuitive data and empowerment framing.',
  },
};

const supabaseHeaders = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

const anthropicHeaders = {
  'Content-Type': 'application/json',
  'x-api-key': ANTHROPIC_API_KEY,
  'anthropic-version': ANTHROPIC_VERSION,
};

function extractJson<T>(value: string): T {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error('Anthropic response was empty');
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() || trimmed;
  const firstBrace = candidate.search(/[\[{]/);
  const lastBrace = Math.max(candidate.lastIndexOf('}'), candidate.lastIndexOf(']'));
  const jsonText =
    firstBrace >= 0 && lastBrace >= firstBrace
      ? candidate.slice(firstBrace, lastBrace + 1)
      : candidate;

  return JSON.parse(jsonText) as T;
}

function createOverallSummary(segmentResults: SegmentResult[]): string {
  if (segmentResults.length === 0) {
    return 'No segment reactions were generated.';
  }

  const averageScore = Math.round(
    segmentResults.reduce((sum, result) => sum + result.score, 0) / segmentResults.length,
  );
  const strongestSegment = [...segmentResults].sort((a, b) => b.score - a.score)[0];
  const weakestSegment = [...segmentResults].sort((a, b) => a.score - b.score)[0];
  const commonConcern = segmentResults
    .flatMap((result) => result.concerns)
    .filter(Boolean)
    .slice(0, 2)
    .join(' ');

  return `Average fit score ${averageScore}/100. Strongest response from ${strongestSegment.label}; weakest from ${weakestSegment.label}.${commonConcern ? ` Key concern: ${commonConcern}` : ''}`;
}

async function updateSimulation(simId: string, patch: Record<string, unknown>) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/audience_simulations?id=eq.${encodeURIComponent(simId)}`,
    {
      method: 'PATCH',
      headers: supabaseHeaders,
      body: JSON.stringify(patch),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase update failed: ${response.status} ${body}`);
  }
}

async function simulatePersonaReaction(
  personaId: string,
  contentText: string,
  contentType: string,
): Promise<SegmentResult> {
  const persona = PERSONAS[personaId];
  if (!persona) {
    throw new Error(`Unknown persona: ${personaId}`);
  }

  const prompt = `You are simulating an audience response for Population Matters.

Persona:
- id: ${personaId}
- label: ${persona.label}
- description: ${persona.description}

Content type: ${contentType}
Content:
${contentText}

Return only JSON with this exact shape:
{
  "persona_id": "${personaId}",
  "label": "${persona.label}",
  "sentiment": "positive" | "neutral" | "negative" | "mixed",
  "score": number,
  "key_reactions": ["..."],
  "concerns": ["..."],
  "suggested_improvements": ["..."]
}

Make the response realistic, concise, and specific to this persona.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: anthropicHeaders,
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 900,
      system:
        'Return valid JSON only. Do not add markdown, commentary, or prose outside the JSON payload.',
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };

  const text = data.content?.find((item) => item.type === 'text')?.text ?? '';
  const parsed = extractJson<SegmentResult>(text);

  return {
    persona_id: parsed.persona_id || personaId,
    label: parsed.label || persona.label,
    sentiment: parsed.sentiment || 'neutral',
    score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
    key_reactions: Array.isArray(parsed.key_reactions) ? parsed.key_reactions : [],
    concerns: Array.isArray(parsed.concerns) ? parsed.concerns : [],
    suggested_improvements: Array.isArray(parsed.suggested_improvements)
      ? parsed.suggested_improvements
      : [],
  };
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let simId = '';

  try {
    const body = (await req.json()) as SimulationRequest;
    simId = body.sim_id;

    if (
      !simId ||
      !body.content_text ||
      !Array.isArray(body.segments) ||
      body.segments.length === 0
    ) {
      return new Response(JSON.stringify({ error: 'Invalid simulation payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await updateSimulation(simId, {
      status: 'running',
      error_message: null,
    });

    const segmentResults: SegmentResult[] = [];
    for (const segmentId of body.segments) {
      const result = await simulatePersonaReaction(segmentId, body.content_text, body.content_type);
      segmentResults.push(result);
    }

    const results = {
      segment_results: segmentResults,
      overall_summary: createOverallSummary(segmentResults),
    };

    await updateSimulation(simId, {
      status: 'complete',
      results,
      completed_at: new Date().toISOString(),
      error_message: null,
    });

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown simulation error';

    if (simId) {
      try {
        await updateSimulation(simId, {
          status: 'failed',
          error_message: message,
        });
      } catch (updateError) {
        console.error('[simulate-audience] Failed to update error state', updateError);
      }
    }

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
