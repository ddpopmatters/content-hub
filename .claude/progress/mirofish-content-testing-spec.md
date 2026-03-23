# MiroFish "Simulate Audience Reactions" — Implementation Spec

**Feature:** Simulate Audience Reactions + Iterate from Simulation
**Tool:** Content Hub (PM)
**Date drafted:** 2026-03-21
**Status:** Ready for implementation

---

## 1. What this is

MiroFish simulates thousands of AI agents with independent personalities to predict how a piece of content will land with a given audience before it's published. In the Content Hub context, Dan or Fran can trigger a simulation from any content item — blog post, social caption, email, appeal copy — select one or more PM audience segments, and receive a structured report: per-segment reaction summary, terminology risk flags, a reception confidence score, and the top concerns raised by simulated personas.

A second phase (**Iterate**) uses Claude Sonnet to generate a revised version based on the simulation findings, with a tracked diff the user can accept or reject change-by-change.

**Important caveat (display in UI):** MiroFish produces structured, plausible-looking outputs — not validated predictions. Treat results as structured brainstorming and pressure-testing, not forecasting. No published benchmarks compare MiroFish outputs to actual audience reactions.

---

## 2. Architecture

New feature directory: `src/features/audience-sim/` — follows the exact pattern of `src/features/copy-check/` and `src/features/assessment/`.

Entry point: new **"Audience Sim"** tab in `EntryModal.jsx` alongside existing tabs.

**Proxy layer:** Supabase Edge Functions handle all external calls (MiroFish + Anthropic). Keys never reach the browser.

```
Client → supabase.functions.invoke('simulate-audience') → MiroFish service
Client → supabase.functions.invoke('iterate-content')   → Anthropic Claude Sonnet
```

---

## 3. Files to create

```
src/features/audience-sim/
  index.ts                          — barrel exports
  AudienceSimPanel.tsx              — main panel (trigger + results display)
  AudienceSegmentPicker.tsx         — multi-select with descriptions
  SimResultCard.tsx                 — per-segment result card (collapsible)
  IterationPanel.tsx                — diff view + accept/reject UI
  useAudienceSim.ts                 — hook: trigger sim, load history
  useIterate.ts                     — hook: trigger revision, manage diff state
  types.ts                          — all TS types for this feature
  personas.ts                       — 5 PM persona configs (static)
  __tests__/
    AudienceSimPanel.test.tsx
    useAudienceSim.test.ts
    useIterate.test.ts

supabase/functions/simulate-audience/
  index.ts                          — Deno edge function (MiroFish proxy)
  _personas.ts                      — PM persona configs (static copy for Deno)
  _types.ts                         — type mirror for edge function

supabase/functions/iterate-content/
  index.ts                          — Deno edge function (Claude Sonnet revision)

supabase/migrations/
  015_add_audience_simulations.sql  — table + RLS

src/lib/audienceSim.ts              — Supabase CRUD helpers
src/lib/audienceSim.test.ts         — unit tests
```

## 4. Files to modify

```
src/features/entry/EntryModal.jsx   — add "Audience Sim" tab
src/types/models.ts                 — re-export AudienceSimulation types
src/lib/index.ts                    — re-export audienceSim helpers
```

---

## 5. Supabase migration

File: `supabase/migrations/015_add_audience_simulations.sql`

```sql
CREATE TABLE IF NOT EXISTS audience_simulations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id        UUID REFERENCES entries(id) ON DELETE SET NULL,
  idea_id         UUID REFERENCES ideas(id) ON DELETE SET NULL,
  content_text    TEXT NOT NULL,
  content_type    TEXT NOT NULL CHECK (content_type IN (
                    'social_caption', 'blog_post', 'email', 'appeal', 'script', 'other'
                  )),
  segments        JSONB NOT NULL DEFAULT '[]'::jsonb,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'running', 'complete', 'failed')),
  error_message   TEXT,
  mirofish_job_id TEXT,
  results         JSONB,
  -- Iteration results (phase 2)
  iteration_original   TEXT,
  iteration_revised    TEXT,
  iteration_diff       JSONB,  -- array of {type:'keep'|'remove'|'add', text, reason?}
  iteration_status     TEXT CHECK (iteration_status IN ('pending','running','complete','failed')),
  iteration_error      TEXT,
  run_by          TEXT NOT NULL,
  run_by_name     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_audience_simulations_entry_id
  ON audience_simulations(entry_id) WHERE entry_id IS NOT NULL;
CREATE INDEX idx_audience_simulations_idea_id
  ON audience_simulations(idea_id) WHERE idea_id IS NOT NULL;
CREATE INDEX idx_audience_simulations_created_at
  ON audience_simulations(created_at DESC);

ALTER TABLE audience_simulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audience_simulations_select" ON audience_simulations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "audience_simulations_insert" ON audience_simulations
  FOR INSERT TO authenticated
  WITH CHECK (run_by = current_user_email());

CREATE POLICY "audience_simulations_update_own" ON audience_simulations
  FOR UPDATE TO authenticated
  USING (run_by = current_user_email() OR is_admin());
```

Run `/rls-check audience_simulations` after applying.

---

## 6. TypeScript types

File: `src/features/audience-sim/types.ts`

```typescript
export type SimulationStatus = 'pending' | 'running' | 'complete' | 'failed';
export type SimContentType =
  | 'social_caption'
  | 'blog_post'
  | 'email'
  | 'appeal'
  | 'script'
  | 'other';

export interface TerminologyRisk {
  phrase: string;
  reason: string;
  severity: 'high' | 'medium' | 'low';
  suggestion?: string;
}

export interface SimConcern {
  theme: string;
  prevalence: number; // 0–1 fraction of agents
  representative_quote: string;
}

export interface SegmentResult {
  segment: string;
  reception_score: number; // 0–100
  summary: string;
  dominant_tone: 'positive' | 'neutral' | 'mixed' | 'concerned' | 'hostile';
  top_concerns: SimConcern[];
  terminology_risks: TerminologyRisk[];
  positive_signals: string[];
  sample_reaction: string;
}

export interface SimulationResults {
  overall_score: number;
  overall_verdict: string;
  segment_results: SegmentResult[];
  cross_segment_risks: TerminologyRisk[];
  recommended_edits: string[];
  agent_count: number;
  simulated_at: string;
}

export interface DiffChunk {
  type: 'keep' | 'remove' | 'add';
  text: string;
  reason?: string; // present on 'remove' and 'add' — the simulation finding that drove it
}

export interface AudienceSimulation {
  id: string;
  entry_id: string | null;
  idea_id: string | null;
  content_text: string;
  content_type: SimContentType;
  segments: string[];
  status: SimulationStatus;
  error_message: string | null;
  mirofish_job_id: string | null;
  results: SimulationResults | null;
  iteration_original: string | null;
  iteration_revised: string | null;
  iteration_diff: DiffChunk[] | null;
  iteration_status: SimulationStatus | null;
  iteration_error: string | null;
  run_by: string;
  run_by_name: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface SimulateRequest {
  content_text: string;
  content_type: SimContentType;
  segments: string[];
  entry_id?: string;
  idea_id?: string;
}

export interface IterateRequest {
  simulation_id: string;
}
```

---

## 7. PM audience persona configs

Five predefined personas. Static file — `src/features/audience-sim/personas.ts` (client) and `supabase/functions/simulate-audience/_personas.ts` (edge function).

```json
[
  {
    "id": "the_guardians",
    "label": "The Guardians",
    "population_weight": 0.22,
    "personality": "Long-term Population Matters supporter, predominantly aged 55+. Has backed PM for years through membership and legacy pledges. Believes population dynamics are genuinely connected to environmental collapse. Slightly disoriented by PM's rights-based pivot. Wants to know their donation still funds work they recognise. Warm but cautious — quick to feel their views are being dismissed.",
    "values": [
      "Environmental sustainability",
      "Honest evidence-based communication",
      "Feeling respected as a long-term supporter",
      "Clear outcome connection"
    ],
    "red_flags": [
      "Apologising for caring about population",
      "Dismissing population as a concern",
      "Jargon-heavy SRHR language without grounding",
      "Tone talking over them to a younger audience"
    ],
    "positive_triggers": [
      "Concrete evidence PM's work reaches women who want family planning",
      "Honest acknowledgment of population-environment connection",
      "Personal impact stories",
      "Direct language — not corporate-speak"
    ]
  },
  {
    "id": "the_catalysts",
    "label": "The Catalysts",
    "population_weight": 0.18,
    "personality": "Gen Z or Millennial (18-35) intersectional feminist and climate justice activist. Fluent in social justice language, fiercely alert to co-optation and instrumentalisation of women's bodies. Potentially PM's most powerful ally but also most likely to screenshot problematic copy with a critical caption.",
    "values": [
      "Reproductive autonomy as an unconditional right",
      "Intersectional analysis",
      "Women and girls as agents not variables",
      "Climate justice as social justice"
    ],
    "red_flags": [
      "Instrumentalising women's choices for environmental ends",
      "Any population control or adjacent language",
      "Statistics about birth rates without rights framing",
      "Treating population as a solution to climate change"
    ],
    "positive_triggers": [
      "Centering women's autonomy explicitly",
      "Naming structural barriers: education, healthcare, gender inequality",
      "Solidarity framing, not charity framing",
      "PM acknowledging past problematic framing"
    ]
  },
  {
    "id": "the_deciders",
    "label": "The Deciders",
    "population_weight": 0.15,
    "personality": "Policy professional — minister's adviser, UN official, senior civil servant. Evidence-driven and politically risk-averse. Needs material usable without backlash in a committee hearing. Reads quickly, wants clear conclusions. Turned off by anything that sounds partisan or activist.",
    "values": [
      "Credibility — evidence, citations, institutional legitimacy",
      "Political safety",
      "Clear policy implication",
      "SDG and ICPD framework alignment"
    ],
    "red_flags": [
      "Activist or campaign tone",
      "Contested claims presented as settled",
      "Emotional appeals",
      "Long copy without executive summary"
    ],
    "positive_triggers": [
      "SDG/ICPD references",
      "Data with named sources",
      "Clear ask",
      "UK aid effectiveness angle",
      "Balanced framing acknowledging complexity"
    ]
  },
  {
    "id": "the_srhr_advocates",
    "label": "The SRHR Advocates",
    "population_weight": 0.12,
    "personality": "Works at a reproductive rights or gender equality organisation. Deeply field-literate. Rightly wary of PM due to the sector's historical coercive narratives. Watching whether PM's rights-based framing is genuine transformation or superficial rebrand. Most likely to call out co-optation publicly.",
    "values": [
      "Bodily autonomy as absolute — not instrumentalised",
      "Women's agency and self-determination",
      "Historical accountability",
      "Genuine partnership over extractive relationships"
    ],
    "red_flags": [
      "Any implication reducing birth rates is a goal",
      "Women positioned as vectors of environmental change",
      "Environmental benefits mentioned before rights",
      "Failure to acknowledge ICPD as foundational",
      "Claims that sound like counting avoided births"
    ],
    "positive_triggers": [
      "Explicit commitment to ICPD principles — voluntarism, no targets",
      "Environmental connection made clearly secondary to rights",
      "Acknowledging the sector's historical failures",
      "Collaboration not leadership language"
    ]
  },
  {
    "id": "the_persuadables",
    "label": "The Persuadables",
    "population_weight": 0.2,
    "personality": "Cares deeply about climate, global health, or gender equality but hasn't yet connected those concerns to population dynamics. Open to new information but not a specialist. Disengages quickly with jargon, preachiness, or ideological demands. Drawn in by a compelling hook and a clear human story.",
    "values": [
      "Practicality — what actually works",
      "Fairness and global justice",
      "Accessible evidence",
      "Optimism — solvable problems",
      "Relatable real people, not abstract statistics"
    ],
    "red_flags": [
      "Dense jargon — SRHR, ICPD, instrumentalisation — without plain-language explanation",
      "Preachy or moralistic tone",
      "Abstract statistics without human stories",
      "Doom without hope or action"
    ],
    "positive_triggers": [
      "Specific relatable stories of individual women",
      "Clear surprising insight",
      "Primary-school-reading-level hooks",
      "Obvious low-barrier action",
      "Connecting to something they already care about"
    ]
  }
]
```

---

## 8. MiroFish request payload

Sent to `POST ${MIROFISH_URL}/v1/simulate`:

```json
{
  "job_id": "<simulation uuid>",
  "content": {
    "text": "...content being tested...",
    "type": "social_caption",
    "metadata": {
      "organisation": "Population Matters",
      "sector": "reproductive_rights_environment",
      "language": "en-GB"
    }
  },
  "personas": ["...filtered subset of the 5 configs above..."],
  "simulation_config": {
    "agents_per_persona": 200,
    "reaction_depth": "detailed",
    "output_format": "structured_json",
    "terminology_scan": true,
    "concern_extraction": true,
    "positive_signal_extraction": true,
    "sample_verbatim_count": 1
  }
}
```

---

## 9. Edge Function: simulate-audience

`supabase/functions/simulate-audience/index.ts`

Pattern: identical auth flow to `publish-entry` — `supabase.auth.getUser(token)` before any data access.

1. Validate auth header + extract user
2. Parse + validate request body
3. Insert `audience_simulations` row with `status: 'running'`
4. Filter PM_PERSONAS to requested segments
5. POST to `${MIROFISH_URL}/v1/simulate`
6. On success: update row to `complete` with full `results` JSONB
7. On error: update row to `failed` with `error_message`
8. Return `{ simulation_id, status, results }`

Secrets: `MIROFISH_URL`, `MIROFISH_API_KEY` (set via `supabase secrets set`).

---

## 10. Edge Function: iterate-content

`supabase/functions/iterate-content/index.ts`

1. Validate auth + fetch simulation row (must be `complete`)
2. Build Claude prompt:
   - System: "You are a Population Matters communications editor specialising in reproductive rights framing. Revise the content to address the issues raised by the audience simulation. Return ONLY a JSON array of diff chunks."
   - User: original content + `results.cross_segment_risks` + per-segment `terminology_risks` + `recommended_edits`
3. Call `https://api.anthropic.com/v1/messages` with `claude-sonnet-4-6`
4. Parse response as `DiffChunk[]` — validate structure
5. Reconstruct revised text from diff (join all `keep` + `add` chunks)
6. Update `iteration_*` fields in `audience_simulations`
7. Return `{ simulation_id, diff, revised_text }`

Secrets: `ANTHROPIC_API_KEY`.

---

## 11. React components

### AudienceSimPanel.tsx (main panel)

```
Props:
  contentText: string
  contentType: SimContentType
  entryId?: string
  ideaId?: string

Layout:
  1. Editable Textarea — content preview, allows variation testing without saving entry
  2. Content type pills
  3. AudienceSegmentPicker
  4. Agent count preview: "200 agents × N segments = X total"
  5. "Simulate reactions" Button — disabled when no segments; tooltip: "Select at least one segment"
  6. Loading: pulse skeleton over 3 SimResultCard outlines
     Stage labels: "Initialising personas…" / "Running simulation…" / "Analysing results…"
  7. Simulation caveat: amber info banner — "Results are structured brainstorming, not predictions"
  8. Results (when complete):
     a. Overall score banner — large number + colour bar + overall_verdict
     b. Cross-segment risks warning (amber, dismissible)
     c. Recommended edits list
     d. SimResultCard per segment
     e. "Improve Content" button (only if results present)
  9. IterationPanel (when iteration triggered)
  10. Error state: rose-50 banner + retry
  11. History strip: last 3 simulations for this entry (date + segment count + score)
```

### SimResultCard.tsx (per-segment, collapsible)

```
Collapsed: segment name + description | reception score + colour bar | tone badge | summary
Expanded:  top 3 concerns (theme + prevalence bar + verbatim quote)
           terminology risks (flagged phrase + severity badge + suggestion)
           positive signals (bulleted)
           sample verbatim reaction (blockquote)

Score colours: emerald-500 (>=70), amber-500 (40-69), rose-500 (<40)
Tone badges:  positive=emerald, neutral=slate, mixed=amber, concerned=orange, hostile=rose
```

### IterationPanel.tsx (diff view)

```
Props:
  simulationId: string
  originalText: string
  onAccept: (revisedText: string) => void

States:
  idle      — "Improve Content" button only
  loading   — generating revision…
  complete  — diff view
  error     — error message + retry

Diff view layout:
  Two columns: Original (left, slate-50 bg) | Revised (right, emerald-50 bg)
  Each diff chunk annotated below with the simulation finding that drove the change
  remove chunks: red-100 bg + strikethrough
  add chunks: green-100 bg
  keep chunks: no highlight

Actions:
  "Accept All" — calls onAccept(revisedText)
  "Copy to clipboard" — copies revised text
  "Discard" — closes panel
```

### useIterate.ts

```typescript
interface UseIterateReturn {
  isRunning: boolean;
  diff: DiffChunk[] | null;
  revisedText: string | null;
  error: string | null;
  run: (simulationId: string) => Promise<void>;
  reset: () => void;
}
```

Internally: calls `supabase.functions.invoke('iterate-content', { body: { simulation_id } })`.

---

## 12. Wiring into EntryModal.jsx

Add `'Audience Sim'` to the existing tab array. Tab panel renders:

```jsx
<AudienceSimPanel
  contentText={getPlatformCaption(entry, activePlatform) || entry.caption}
  contentType={deriveContentType(entry.assetType)}
  entryId={entry.id}
/>
```

`deriveContentType`: `Video`/`Carousel`/`Design` → `social_caption`; `No asset` → `blog_post`.

Show badge count on tab label if `history.length > 0`: "Audience Sim 3".

---

## 13. Environment variables

```bash
supabase secrets set MIROFISH_URL=https://your-mirofish-service.railway.app
supabase secrets set MIROFISH_API_KEY=your-mirofish-key
supabase secrets set ANTHROPIC_API_KEY=your-anthropic-key
```

If `MIROFISH_URL` is unset, the edge function returns `503 { error: 'Simulation service not configured' }`. The Simulate button shows as disabled with tooltip "Simulation service not available".

---

## 14. Implementation order

1. Migration: `015_add_audience_simulations.sql` → `apply_migration`
2. Types: `src/features/audience-sim/types.ts`
3. Lib helpers: `src/lib/audienceSim.ts` + tests
4. Edge function: `simulate-audience/`
5. Edge function: `iterate-content/`
6. Hook: `useAudienceSim.ts` + tests
7. Hook: `useIterate.ts` + tests
8. Components: `AudienceSegmentPicker` → `SimResultCard` → `IterationPanel` → `AudienceSimPanel`
9. Wire into `EntryModal.jsx`
10. Barrel + type re-exports
11. QA: typecheck + lint + tests; smoke test against mock MiroFish endpoint

---

## 15. Implementer notes

- Follow `CopyCheckSection.tsx` for panel structure — same prop drilling, same button/loading/result hierarchy
- Follow `publish-entry` edge function for auth pattern
- `AUDIENCE_SEGMENTS` and `AUDIENCE_SEGMENT_DESCRIPTIONS` already exported from `src/constants.ts` — import directly, do not duplicate
- Personas are static files — never fetched at runtime
- Do not add a charting library for score bars — Tailwind utilities only
- Feature flag hook if needed: gate behind `user.features.includes('audience-sim')` using existing `features` JSONB on `user_profiles`

---

## 16. Research notes: offline/free path

**nikmcfly/MiroFish-Offline** replaces Zep Cloud with local Neo4j and the cloud LLM with Ollama. Zero API costs, all data local.

**Hardware requirements:**

- MacBook Pro M2/M3 Pro 36GB+ — comfortable with qwen2.5:32b (best quality)
- MacBook Pro M-series 24GB — comfortable with qwen2.5:14b
- MacBook Pro M-series 16GB — marginal; 7b model only, close other apps
- Cheap VPS (no GPU) — not practical for regular use

**amadad fork** (KuzuDB — no separate graph server) even simpler for minimal infrastructure.

**Recommendation:** Start with mirofish-offline + Ollama for local testing at zero cost. Upgrade to main MiroFish + Claude/GPT API for production quality when ready to deploy.

**Critical caveat (repeat):** No published accuracy benchmarks exist. Validated use case: structured pressure-testing of messaging. Not validated use case: predicting actual audience behaviour.
