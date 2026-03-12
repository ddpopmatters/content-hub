# Task

Migrate ContentPeaks, ContentSeries, and RapidResponses from localStorage to Supabase.

## Context

- Files to read:
  - `src/types/models.ts` — ContentPeak, ContentSeries, RapidResponse interfaces
  - `src/lib/supabase.ts` — SUPABASE_API pattern (mappers, fetchX, createX, updateX, deleteX)
  - `src/hooks/domain/useOpportunities.ts` — Supabase hook pattern to follow exactly
  - `src/hooks/domain/useContentPeaks.ts` — current localStorage hook
  - `src/hooks/domain/useContentSeries.ts` — current localStorage hook
  - `src/hooks/domain/useRapidResponses.ts` — current localStorage hook
  - `supabase/migrations/010_add_opportunities.sql` — migration pattern to follow
  - `src/app.jsx` — call sites for all three hooks (shows what runSyncTask/pushSyncToast look like)
- Do not modify: `src/types/models.ts`, `src/app.jsx`, `src/features/peaks/`, `src/features/series/`, `src/features/responses/`

## Requirements

### 1. Migration file: `supabase/migrations/014_add_content_planning_tables.sql`

Create three tables following the exact style of `010_add_opportunities.sql`:

**content_peaks**

- id UUID PK default uuid_generate_v4()
- title TEXT NOT NULL
- start_date DATE NOT NULL
- end_date DATE NOT NULL
- priority_tier TEXT DEFAULT 'High'
- owner TEXT
- campaign TEXT
- content_pillar TEXT
- response_mode TEXT
- required_platforms JSONB DEFAULT '[]'
- required_asset_types JSONB DEFAULT '[]'
- linked_entry_ids JSONB DEFAULT '[]'
- description TEXT
- notes TEXT
- created_at TIMESTAMPTZ DEFAULT NOW()
- updated_at TIMESTAMPTZ DEFAULT NOW()
- RLS: authenticated users can SELECT/INSERT/UPDATE/DELETE (SELECT open to all authenticated, INSERT/UPDATE/DELETE use `owner = auth.jwt()->>'email'`)

**content_series**

- id UUID PK default uuid_generate_v4()
- title TEXT NOT NULL
- owner TEXT
- status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Paused', 'Completed'))
- target_platforms JSONB DEFAULT '[]'
- target_episode_count INTEGER
- review_checkpoint INTEGER DEFAULT 3
- campaign TEXT
- content_pillar TEXT
- response_mode TEXT
- linked_entry_ids JSONB DEFAULT '[]'
- description TEXT
- notes TEXT
- created_at TIMESTAMPTZ DEFAULT NOW()
- updated_at TIMESTAMPTZ DEFAULT NOW()
- RLS: same pattern as content_peaks

**rapid_responses**

- id UUID PK default uuid_generate_v4()
- title TEXT NOT NULL
- owner TEXT
- status TEXT DEFAULT 'New' CHECK (status IN ('New', 'Drafting', 'In Review', 'Ready to Publish', 'Closed'))
- response_mode TEXT
- trigger_date DATE
- due_at TIMESTAMPTZ
- sign_off_route TEXT
- source_opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL
- linked_entry_id UUID REFERENCES entries(id) ON DELETE SET NULL
- campaign TEXT
- content_pillar TEXT
- target_platforms JSONB DEFAULT '[]'
- notes TEXT
- created_at TIMESTAMPTZ DEFAULT NOW()
- updated_at TIMESTAMPTZ DEFAULT NOW()
- RLS: same pattern as content_peaks

Add indexes on owner, status, and date columns where relevant.

### 2. Add to `src/lib/supabase.ts`

Following the exact SUPABASE_API pattern used for opportunities and content requests, add:

**Row type interfaces** (alongside existing OpportunityRow, ContentRequestRow):

- `ContentPeakRow`, `ContentSeriesRow`, `RapidResponseRow`

**Mapper functions** (camelCase app model <-> snake_case DB):

- `mapContentPeakToApp(row: ContentPeakRow): ContentPeak`
- `mapContentPeakToDb(peak: Partial<ContentPeak>): object`
- `mapContentSeriesToApp(row: ContentSeriesRow): ContentSeries`
- `mapContentSeriesToDb(series: Partial<ContentSeries>): object`
- `mapRapidResponseToApp(row: RapidResponseRow): RapidResponse`
- `mapRapidResponseToDb(response: Partial<RapidResponse>): object`

**SUPABASE_API methods**:

- `fetchContentPeaks(): Promise<ContentPeak[]>`
- `createContentPeak(peak: Omit<ContentPeak, 'id' | 'createdAt' | 'updatedAt'>): Promise<ContentPeak | null>`
- `updateContentPeak(id: string, updates: Partial<ContentPeak>): Promise<ContentPeak | null>`
- `deleteContentPeak(id: string): Promise<boolean>`
- Same four methods for ContentSeries and RapidResponse (12 methods total)

### 3. Update `src/hooks/domain/useContentPeaks.ts`

Replace localStorage pattern with Supabase pattern from `useOpportunities.ts`:

- Accept `runSyncTask` and `pushSyncToast` as deps (same signatures as in useOpportunities)
- On mount: fetch via `SUPABASE_API.fetchContentPeaks()` to populate state
- On add: optimistic update + `runSyncTask('Adding peak', () => SUPABASE_API.createContentPeak(...))`
- On update: optimistic update + `runSyncTask('Updating peak', () => SUPABASE_API.updateContentPeak(...))`
- On delete: optimistic update + `runSyncTask('Deleting peak', () => SUPABASE_API.deleteContentPeak(...))`
- Keep `upcomingPeaks` derived memo and all audit calls
- Remove all imports from `../../lib/storage`

### 4. Update `src/hooks/domain/useContentSeries.ts`

Same Supabase migration pattern. Accept `runSyncTask` and `pushSyncToast`. Keep `activeSeries` memo and audit calls. Remove localStorage imports.

### 5. Update `src/hooks/domain/useRapidResponses.ts`

Same Supabase migration pattern. Keep `createRapidResponseFromOpportunity` helper and `urgentResponseCount` memo. Remove localStorage imports.

## Acceptance criteria

- `supabase/migrations/014_add_content_planning_tables.sql` exists with all three tables and RLS policies
- `src/lib/supabase.ts` has SUPABASE_API methods for all three entities
- None of the three hooks import from `../../lib/storage`
- All three hooks accept `runSyncTask` and `pushSyncToast` as parameters
- `npx tsc --noEmit` passes with no errors
- `npm test -- --run` passes
- `npm run build` succeeds
