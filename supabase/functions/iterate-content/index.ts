import { corsHeaders, handleCors } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const ANTHROPIC_MODEL = 'claude-sonnet-4-6';
const ANTHROPIC_VERSION = '2023-06-01';

interface SegmentResult {
  persona_id: string;
  label: string;
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  score: number;
  key_reactions: string[];
  concerns: string[];
  suggested_improvements: string[];
}

interface DiffChunk {
  type: 'keep' | 'remove' | 'add';
  text: string;
  reason?: string;
}

interface IterationRequest {
  sim_id: string;
  content: string;
  results: SegmentResult[];
}

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

async function updateIteration(simId: string, patch: Record<string, unknown>) {
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

function buildRevisedContent(diff: DiffChunk[]): string {
  return diff
    .filter((chunk) => chunk.type === 'keep' || chunk.type === 'add')
    .map((chunk) => chunk.text)
    .join('');
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
    const body = (await req.json()) as IterationRequest;
    simId = body.sim_id;

    if (!simId || !body.content || !Array.isArray(body.results)) {
      return new Response(JSON.stringify({ error: 'Invalid iteration payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await updateIteration(simId, {
      iteration_status: 'running',
      iteration_error: null,
    });

    const prompt = `Revise the Population Matters content below using the simulation findings.

Priorities:
- Address the strongest concerns from SRHR Advocates and Persuadables.
- Preserve a rights-based framing.
- Do not undermine reproductive rights language.
- Keep the tone practical and publish-ready.

Original content:
${body.content}

Simulation findings:
${JSON.stringify(body.results, null, 2)}

Return only a JSON array of DiffChunk objects in this exact shape:
[
  { "type": "keep" | "remove" | "add", "text": "...", "reason": "optional short reason" }
]

The array should reconstruct the full revised content when keep and add chunks are concatenated in order.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: anthropicHeaders,
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1200,
        system:
          'Return valid JSON only. Do not add markdown, comments, or explanations outside the JSON array.',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Anthropic error ${response.status}: ${errorBody}`);
    }

    const data = (await response.json()) as {
      content?: Array<{ type?: string; text?: string }>;
    };

    const text = data.content?.find((item) => item.type === 'text')?.text ?? '';
    const diff = extractJson<DiffChunk[]>(text).map((chunk) => ({
      type: chunk.type,
      text: chunk.text,
      ...(chunk.reason ? { reason: chunk.reason } : {}),
    }));
    const revised = buildRevisedContent(diff);

    await updateIteration(simId, {
      iteration_original: body.content,
      iteration_revised: revised,
      iteration_diff: diff,
      iteration_status: 'complete',
      iteration_error: null,
    });

    return new Response(JSON.stringify({ diff, revised }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown iteration error';

    if (simId) {
      try {
        await updateIteration(simId, {
          iteration_status: 'failed',
          iteration_error: message,
        });
      } catch (updateError) {
        console.error('[iterate-content] Failed to update error state', updateError);
      }
    }

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
