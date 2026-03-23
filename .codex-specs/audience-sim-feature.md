## Task

Implement the MiroFish audience simulation + Claude content iteration feature for Content Hub. This is a new "Audience Sim" tab inside EntryModal.jsx.

## Context

- Files to read: src/features/assessment/FullAssessment.tsx (existing feature component pattern), src/features/entry/EntryModal.jsx (tab + modal structure), src/lib/supabase.ts (Supabase client pattern), src/hooks/useApi.ts (data fetching pattern)
- Do not modify: supabase/migrations/, node_modules/
- Design tokens: use ocean-600/ocean-400, rounded-xl buttons, rounded-3xl panels, shadow-sm cards (from CLAUDE.md)

## Database

Table `audience_simulations` already exists (migration 015 created it). Key fields:

- entry_id / idea_id (nullable UUIDs)
- content_text, content_type (one of: social_caption, blog_post, email, appeal, script, other)
- segments JSONB (array of selected persona ids)
- status: pending → running → complete → failed
- results JSONB (MiroFish output)
- iteration_original, iteration_revised, iteration_diff JSONB
- run_by TEXT (user email), run_by_name TEXT

## Requirements

### 1. src/features/audience-sim/types.ts (NEW)

```typescript
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
  score: number; // 0–100
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
```

### 2. src/features/audience-sim/personas.ts (NEW)

5 PM audience personas — static config:

```typescript
import type { PersonaConfig } from './types';

export const PM_PERSONAS: PersonaConfig[] = [
  {
    id: 'guardians',
    label: 'The Guardians',
    description:
      'UK donors who care about nature and future generations. Values-led, emotional, responsive to individual stories.',
  },
  {
    id: 'catalysts',
    label: 'The Catalysts',
    description:
      'International development partners. Rights-based framework, SDG alignment, technical credibility.',
  },
  {
    id: 'deciders',
    label: 'The Deciders',
    description:
      'Government/parliamentary audience. Evidence-based, policy implications, UK and global framing.',
  },
  {
    id: 'srhr',
    label: 'The SRHR Advocates',
    description:
      'Reproductive health and rights advocates. Intersectional lens, strong rights language, suspicious of population framing.',
  },
  {
    id: 'persuadables',
    label: 'The Persuadables',
    description:
      'Sympathetic public open to the PM message. Respond to counterintuitive data and empowerment framing.',
  },
];
```

### 3. src/features/audience-sim/lib.ts (NEW)

Supabase helpers — follow the exact pattern from src/lib/supabase.ts (use the global `supabase` client, not a new instance):

```typescript
// createSim: INSERT into audience_simulations, return the row
// getSim: SELECT * WHERE id = simId
// listSims: SELECT * WHERE entry_id = entryId OR idea_id = ideaId, ORDER BY created_at DESC, LIMIT 10
// All functions are async, throw on error
```

### 4. src/features/audience-sim/useAudienceSim.ts (NEW)

```typescript
// State: simId, sim (AudienceSim | null), status, loading, error
// Actions:
//   runSim(params: { contentText, contentType, entryId?, ideaId?, segments, user }) → calls supabase.functions.invoke('simulate-audience', { body: payload }), polls every 3s until status complete/failed
//   loadHistory(entryId) → calls listSims()
// Returns: { sim, history, loading, error, runSim, polling }
```

### 5. src/features/audience-sim/useIterate.ts (NEW)

```typescript
// State: diff (DiffChunk[] | null), revised (string | null), iterating, error
// Actions:
//   iterate(simId, contentText, segmentResults) → calls supabase.functions.invoke('iterate-content', { body: { sim_id: simId, content: contentText, results: segmentResults } })
//   accept() → update audience_simulations SET iteration_status='complete', return revised text
//   reject() → clear diff state
// Returns: { diff, revised, iterating, error, iterate, accept, reject }
```

### 6. src/features/audience-sim/AudienceSegmentPicker.tsx (NEW)

Checkbox grid. Props: `selectedIds: string[], onChange: (ids: string[]) => void`.
Show all 5 personas as cards with label + description. ocean-600 checked state. rounded-xl cards.

### 7. src/features/audience-sim/SimResultCard.tsx (NEW)

Collapsible card for one SegmentResult. Shows: persona label, sentiment badge (positive=emerald, negative=rose, mixed=amber, neutral=sky), score as progress bar (ocean-400), key_reactions as bullet list. Collapsed by default.

### 8. src/features/audience-sim/IterationPanel.tsx (NEW)

Shows the diff between original and revised content. Props: `diff: DiffChunk[], onAccept: () => void, onReject: () => void`.

- DiffChunk rendering: `keep` = plain text, `remove` = red strikethrough, `add` = green underline
- `reason` shown as tooltip or small italic note below the chunk
- Accept button (ocean-600) + Reject button (outline)

### 9. src/features/audience-sim/AudienceSimPanel.tsx (NEW)

Main panel component. Props: `entry: Entry | null, ideaId?: string`.
Layout:

1. **Top section**: AudienceSegmentPicker (select which personas to test against), content type selector (dropdown), Run button
2. **Results section** (shown after sim completes): grid of SimResultCard, one per selected segment, plus overall_summary paragraph
3. **Iteration section** (button "Iterate with Claude" → calls useIterate.iterate → shows IterationPanel)
4. **History** (accordion at bottom): past sims for this entry, collapsible list

Loading state: spinner + "Simulating audience reactions…"
Error state: rose alert with error_message

### 10. src/features/audience-sim/index.ts (NEW)

Barrel export: export { AudienceSimPanel } from './AudienceSimPanel';

### 11. supabase/functions/simulate-audience/index.ts (NEW)

Deno edge function. CORS headers. Reads request JSON body: `{ sim_id, content_text, content_type, segments, entry_id?, idea_id? }`.

Steps:

1. Update audience_simulations SET status='running' WHERE id = sim_id (use SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY env vars to make a direct REST call)
2. For each segment in segments array: call the Anthropic API (ANTHROPIC_API_KEY env) with claude-sonnet-4-6, asking it to simulate how this persona reacts to the content. Return `SegmentResult` JSON.
3. Build results = `{ segment_results: [...], overall_summary: '...' }`
4. UPDATE audience_simulations SET status='complete', results=..., completed_at=NOW() WHERE id=sim_id
5. Return `{ success: true, results }`
   On error: UPDATE status='failed', error_message=..., return `{ error: message }`

Use fetch() directly — no npm imports. Anthropic API endpoint: `https://api.anthropic.com/v1/messages`.

### 12. supabase/functions/iterate-content/index.ts (NEW)

Deno edge function. Reads: `{ sim_id, content, results: SegmentResult[] }`.

Steps:

1. Build prompt asking Claude to revise the content based on simulation findings. Instruction: return a JSON array of DiffChunk `{ type: 'keep'|'remove'|'add', text: string, reason?: string }`. The revised text must address key concerns from SRHR Advocates and Persuadables without undermining rights framing.
2. Call claude-sonnet-4-6 with that prompt
3. Parse the DiffChunk[] from response
4. Build revised string by concatenating add/keep chunks
5. UPDATE audience_simulations SET iteration_original=content, iteration_revised=revised, iteration_diff=diff, iteration_status='complete' WHERE id=sim_id
6. Return `{ diff: DiffChunk[], revised: string }`

### 13. src/features/entry/EntryModal.jsx (EDIT — minimal)

Add a new top-level tab "Audience Sim" alongside the existing tabs. When active, render `<AudienceSimPanel entry={entry} />`. Import AudienceSimPanel from `../../features/audience-sim`.

Pattern for tabs: follow the existing `activeCaptionTab` / tab button pattern already in the file. Add `activeMainTab` state (or similar) at the top — check what the existing modal-level tab state looks like first.

### 14. src/types/models.ts (EDIT — append)

Re-export `AudienceSim, DiffChunk, SegmentResult, ContentType, SimStatus` from `../features/audience-sim/types`.

### 15. Tests in src/features/audience-sim/**tests**/

Create three test files using vitest + testing-library (follow pattern from src/features/assessment/**tests**/ if it exists):

- `useAudienceSim.test.ts` — mock supabase.functions.invoke, verify runSim creates sim and polls
- `useIterate.test.ts` — mock invoke, verify diff state management and accept/reject
- `AudienceSimPanel.test.tsx` — render with mock entry, verify segment picker renders, run button present

## Acceptance criteria

- `npm run typecheck` passes (or `npx tsc --noEmit`)
- `npm run lint` passes
- `npm test` passes (new tests green, existing 81 tests unchanged)
- EntryModal renders "Audience Sim" tab without errors
- AudienceSimPanel renders segment picker + run button for a sample entry
- Edge function files exist at supabase/functions/simulate-audience/index.ts and supabase/functions/iterate-content/index.ts
