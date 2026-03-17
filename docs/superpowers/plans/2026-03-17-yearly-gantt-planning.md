# Yearly Gantt Planning View Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Year" tab to the Calendar screen that displays campaigns and themes as a horizontal Gantt chart across a 12-month timeline, with full add/edit/delete support.

**Architecture:** New `campaigns` Supabase table + RLS → `SUPABASE_API` methods with mapToApp/mapToDb transforms → `useYearPlan` domain hook (optimistic, localStorage-backed) → `YearPlanView` Gantt component + `CampaignModal` → wired into existing `CalendarView` as a new `'year'` tab.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Supabase JS v2, Vitest + @testing-library/react

---

## File Map

| Action | Path                                                | Responsibility                                                     |
| ------ | --------------------------------------------------- | ------------------------------------------------------------------ |
| Create | `supabase/migrations/20260317_create_campaigns.sql` | Table DDL + RLS policies                                           |
| Modify | `src/types/models.ts`                               | Add `Campaign` TypeScript interface                                |
| Modify | `src/lib/utils.ts`                                  | Add `CAMPAIGNS` key to `STORAGE_KEYS`                              |
| Modify | `src/lib/supabase.ts`                               | `CampaignRow` interface, map functions, API methods                |
| Modify | `src/lib/storage.ts`                                | `loadCampaigns` / `saveCampaigns` localStorage helpers             |
| Create | `src/hooks/domain/useYearPlan.ts`                   | Domain hook — state, CRUD, localStorage sync                       |
| Create | `src/hooks/domain/__tests__/useYearPlan.test.ts`    | Unit tests for hook                                                |
| Modify | `src/hooks/domain/index.ts`                         | Re-export `useYearPlan` from barrel (if barrel exists)             |
| Create | `src/features/calendar/CampaignModal.tsx`           | Add/edit modal                                                     |
| Create | `src/features/calendar/YearPlanView.tsx`            | Gantt chart component                                              |
| Modify | `src/features/calendar/CalendarView.tsx`            | Add `'year'` to tab union + render YearPlanView                    |
| Modify | `src/app.jsx`                                       | Instantiate `useYearPlan`, pass campaigns/handlers to CalendarView |

---

## Task 1: Database migration

**Files:**

- Create: `supabase/migrations/20260317_create_campaigns.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Create campaigns table for the yearly Gantt planning view
CREATE TABLE IF NOT EXISTS campaigns (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  type        TEXT        NOT NULL DEFAULT 'campaign',
  start_date  DATE        NOT NULL,
  end_date    DATE        NOT NULL,
  colour      TEXT        NOT NULL DEFAULT '#6366f1',
  notes       TEXT,
  created_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

-- All authenticated team members can read/write all campaigns
CREATE POLICY "campaigns_select" ON campaigns
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "campaigns_insert" ON campaigns
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "campaigns_update" ON campaigns
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "campaigns_delete" ON campaigns
  FOR DELETE TO authenticated USING (true);
```

- [ ] **Step 2: Apply migration**

Per CLAUDE.md conventions, schema changes go through the `apply_migration` MCP tool:

```
Tool: apply_migration
Migration name: 20260317_create_campaigns
SQL: (contents of supabase/migrations/20260317_create_campaigns.sql)
```

Fallback if MCP tool unavailable: Supabase dashboard → SQL Editor → paste file contents.

- [ ] **Step 3: Verify in Supabase dashboard**

Confirm `campaigns` table exists with correct columns. Confirm 4 RLS policies are listed.

---

## Task 2: Supabase types and API methods

**Files:**

- Modify: `src/lib/supabase.ts`

The codebase pattern: add a `Row` interface near other Row interfaces (~line 408), add `mapToApp`/`mapToDb` functions near other map functions (~line 2379), add CRUD methods to `SUPABASE_API` near other entity groups.

`supabase.ts` imports app-layer types from `'../types/models'` — `Campaign` will be available there after Task 3 Step 1. Check the existing import block and add `Campaign` to it.

- [ ] **Step 1: Add `CampaignRow` interface** (after `IdeaRow` ~line 421)

```typescript
interface CampaignRow {
  id: string;
  name: string;
  type: string;
  start_date: string;
  end_date: string;
  colour: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}
```

- [ ] **Step 2: Add map functions** (after `mapIdeaToDb` ~line 2405)

```typescript
mapCampaignToApp: (row: CampaignRow): Campaign => ({
  id: row.id,
  name: row.name,
  type: row.type as Campaign['type'],
  startDate: row.start_date,
  endDate: row.end_date,
  colour: row.colour,
  notes: row.notes ?? undefined,
  createdBy: row.created_by ?? undefined,
  createdAt: row.created_at,
}),

mapCampaignToDb: (campaign: Partial<Campaign>, userEmail: string) => ({
  id: campaign.id || undefined,
  name: campaign.name,
  type: campaign.type || 'campaign',
  start_date: campaign.startDate,
  end_date: campaign.endDate,
  colour: campaign.colour || '#6366f1',
  notes: campaign.notes || null,
  created_by: userEmail || null,
}),
```

- [ ] **Step 3: Add CRUD methods to `SUPABASE_API`** (after `deleteIdea` ~line 1016)

```typescript
// ==========================================
// CAMPAIGNS
// ==========================================

fetchCampaigns: async (): Promise<Campaign[]> => {
  await initSupabase();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .order('start_date', { ascending: true });
    if (error) { Logger.error(error, 'fetchCampaigns'); return []; }
    return ((data as CampaignRow[]) || []).map(SUPABASE_API.mapCampaignToApp);
  } catch (error) {
    Logger.error(error, 'fetchCampaigns');
    return [];
  }
},

saveCampaign: async (campaign: Partial<Campaign>, userEmail: string): Promise<Campaign | null> => {
  await initSupabase();
  if (!supabase) return null;
  try {
    const dbCampaign = SUPABASE_API.mapCampaignToDb(campaign, userEmail);
    const { data, error } = await supabase
      .from('campaigns')
      .upsert(dbCampaign)
      .select()
      .single();
    if (error) { Logger.error(error, 'saveCampaign'); return null; }
    return data ? SUPABASE_API.mapCampaignToApp(data as CampaignRow) : null;
  } catch (error) {
    Logger.error(error, 'saveCampaign');
    return null;
  }
},

deleteCampaign: async (id: string): Promise<boolean> => {
  await initSupabase();
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('campaigns').delete().eq('id', id);
    if (error) { Logger.error(error, 'deleteCampaign'); return false; }
    return true;
  } catch (error) {
    Logger.error(error, 'deleteCampaign');
    return false;
  }
},
```

**Note (Step 4 — CampaignRow export):** `CampaignRow` is only used internally within `supabase.ts`. No other module imports it. Skip this step — no export needed.

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase.ts supabase/migrations/20260317_create_campaigns.sql
git commit -m "feat(campaigns): add DB migration and SUPABASE_API CRUD methods"
```

---

## Task 3: `Campaign` type + localStorage helpers

**Files:**

- Modify: `src/types/models.ts`
- Modify: `src/lib/utils.ts`
- Modify: `src/lib/storage.ts`

`Campaign` must live in `src/types/models.ts` (where `Entry`, `Idea`, etc. live) so it can be imported by both `storage.ts` and `useYearPlan.ts` without creating a circular dependency.

- [ ] **Step 1: Add `Campaign` interface to `src/types/models.ts`**

Read the file first to find a good insertion point (after the `Idea` interface). Add:

```typescript
export interface Campaign {
  id: string;
  name: string;
  type: 'campaign' | 'theme' | 'series';
  startDate: string; // ISO date string — maps to start_date column
  endDate: string; // ISO date string — maps to end_date column
  colour: string; // hex, e.g. '#6366f1'
  notes?: string;
  createdBy?: string;
  createdAt?: string;
}
```

- [ ] **Step 2: Add `CAMPAIGNS` to `STORAGE_KEYS` in `src/lib/utils.ts`**

Read the file and find the `STORAGE_KEYS` object. Add:

```typescript
CAMPAIGNS: 'pm-content-dashboard-campaigns',
```

Use the existing key naming convention (`pm-content-dashboard-*`).

- [ ] **Step 3: Add campaign storage helpers to `src/lib/storage.ts`**

Read the file to find a good insertion point (after `saveIdeas` ~line 168) and check the `storageAvailable` guard pattern. Add:

```typescript
import type { Campaign } from '../types/models';
// (add to existing imports block)

export const loadCampaigns = (): Campaign[] => {
  if (!storageAvailable) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CAMPAIGNS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Campaign[]) : [];
  } catch {
    return [];
  }
};

export const saveCampaigns = (campaigns: Campaign[]): void => {
  if (!storageAvailable) return;
  try {
    localStorage.setItem(STORAGE_KEYS.CAMPAIGNS, JSON.stringify(campaigns));
  } catch {
    // localStorage unavailable — silent fail
  }
};
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/types/models.ts src/lib/utils.ts src/lib/storage.ts
git commit -m "feat(campaigns): add Campaign type and localStorage helpers"
```

---

## Task 4: `useYearPlan` hook + tests (TDD)

**Files:**

- Create: `src/hooks/domain/__tests__/useYearPlan.test.ts`
- Create: `src/hooks/domain/useYearPlan.ts`

Write tests first, then implement. Follow the `useApprovals.test.ts` pattern: `renderHook` + `act` for mutations.

- [ ] **Step 1: Write failing tests**

```typescript
// src/hooks/domain/__tests__/useYearPlan.test.ts
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useYearPlan } from '../useYearPlan';

// Mock SUPABASE_API
vi.mock('../../../lib/supabase', () => ({
  SUPABASE_API: {
    fetchCampaigns: vi.fn().mockResolvedValue([]),
    saveCampaign: vi.fn().mockResolvedValue({
      id: 'c1',
      name: 'Test',
      type: 'campaign',
      startDate: '2026-01-01',
      endDate: '2026-03-31',
      colour: '#6366f1',
    }),
    deleteCampaign: vi.fn().mockResolvedValue(true),
  },
}));

// Mock storage
vi.mock('../../../lib/storage', () => ({
  loadCampaigns: vi.fn().mockReturnValue([]),
  saveCampaigns: vi.fn(),
}));

const deps = {
  currentUser: 'dan@example.org',
  runSyncTask: vi
    .fn()
    .mockImplementation((_label: string, action: () => Promise<unknown>) =>
      action().then(() => true),
    ),
  pushSyncToast: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useYearPlan', () => {
  it('initialises with empty campaigns from localStorage', () => {
    const { result } = renderHook(() => useYearPlan(deps));
    expect(result.current.campaigns).toEqual([]);
  });

  it('addCampaign adds item optimistically', () => {
    const { result } = renderHook(() => useYearPlan(deps));
    const newCampaign = {
      name: 'World Pop Day',
      type: 'campaign' as const,
      startDate: '2026-06-01',
      endDate: '2026-07-15',
      colour: '#0ea5e9',
    };
    act(() => {
      result.current.addCampaign(newCampaign);
    });
    expect(result.current.campaigns).toHaveLength(1);
    expect(result.current.campaigns[0].name).toBe('World Pop Day');
  });

  it('deleteCampaign removes item optimistically', () => {
    const { result } = renderHook(() => useYearPlan(deps));
    act(() => {
      result.current.addCampaign({
        name: 'Test',
        type: 'campaign',
        startDate: '2026-01-01',
        endDate: '2026-02-28',
        colour: '#6366f1',
      });
    });
    const id = result.current.campaigns[0].id;
    act(() => {
      result.current.deleteCampaign(id);
    });
    expect(result.current.campaigns).toHaveLength(0);
  });

  it('updateCampaign updates item in state', () => {
    const { result } = renderHook(() => useYearPlan(deps));
    act(() => {
      result.current.addCampaign({
        name: 'Original',
        type: 'theme',
        startDate: '2026-03-01',
        endDate: '2026-05-31',
        colour: '#ec4899',
      });
    });
    const id = result.current.campaigns[0].id;
    act(() => {
      result.current.updateCampaign(id, { name: 'Updated' });
    });
    expect(result.current.campaigns[0].name).toBe('Updated');
  });

  it('refreshCampaigns calls fetchCampaigns and updates state', async () => {
    const { SUPABASE_API } = await import('../../../lib/supabase');
    (SUPABASE_API.fetchCampaigns as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        id: 'server-1',
        name: 'From server',
        type: 'campaign',
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        colour: '#22c55e',
      },
    ]);
    const { result } = renderHook(() => useYearPlan(deps));
    await act(async () => {
      result.current.refreshCampaigns();
    });
    expect(result.current.campaigns[0].name).toBe('From server');
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
npm test -- useYearPlan --reporter=verbose
```

Expected: FAIL — `useYearPlan` not found.

- [ ] **Step 3: Implement `useYearPlan`**

```typescript
// src/hooks/domain/useYearPlan.ts
import { useState, useCallback, useEffect } from 'react';
import type { Campaign } from '../../types/models';
import { loadCampaigns, saveCampaigns } from '../../lib/storage';
import { SUPABASE_API } from '../../lib/supabase';

export type { Campaign }; // re-export so consumers can import from this hook file

interface UseYearPlanDeps {
  currentUser: string;
  runSyncTask: (label: string, action: () => Promise<unknown>) => Promise<boolean>;
  pushSyncToast: (message: string, variant?: string) => void;
}

export function useYearPlan({ currentUser, runSyncTask, pushSyncToast }: UseYearPlanDeps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => loadCampaigns());

  useEffect(() => {
    saveCampaigns(campaigns);
  }, [campaigns]);

  const refreshCampaigns = useCallback(() => {
    SUPABASE_API.fetchCampaigns()
      .then((data) => Array.isArray(data) && setCampaigns(data))
      .catch(() => pushSyncToast('Unable to refresh campaigns from the server.', 'warning'));
  }, [pushSyncToast]);

  const addCampaign = useCallback(
    (campaign: Omit<Campaign, 'id' | 'createdAt' | 'createdBy'>) => {
      const newCampaign: Campaign = {
        ...campaign,
        id: crypto.randomUUID(),
        createdBy: currentUser,
        createdAt: new Date().toISOString(),
      };
      setCampaigns((prev) =>
        [...prev, newCampaign].sort((a, b) => a.startDate.localeCompare(b.startDate)),
      );
      runSyncTask(`Create campaign (${newCampaign.id})`, () =>
        SUPABASE_API.saveCampaign(newCampaign, currentUser),
      ).then((ok) => {
        if (ok) refreshCampaigns();
      });
    },
    [currentUser, runSyncTask, refreshCampaigns],
  );

  const updateCampaign = useCallback(
    (id: string, updates: Partial<Campaign>) => {
      setCampaigns((prev) =>
        prev
          .map((c) => (c.id === id ? { ...c, ...updates } : c))
          .sort((a, b) => a.startDate.localeCompare(b.startDate)),
      );
      const updated = { ...campaigns.find((c) => c.id === id), ...updates, id };
      runSyncTask(`Update campaign (${id})`, () =>
        SUPABASE_API.saveCampaign(updated, currentUser),
      ).then((ok) => {
        if (ok) refreshCampaigns();
      });
    },
    [campaigns, currentUser, runSyncTask, refreshCampaigns],
  );

  const deleteCampaign = useCallback(
    (id: string) => {
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
      runSyncTask(`Delete campaign (${id})`, () => SUPABASE_API.deleteCampaign(id)).then((ok) => {
        if (ok) refreshCampaigns();
      });
    },
    [runSyncTask, refreshCampaigns],
  );

  const reset = useCallback(() => {
    setCampaigns(loadCampaigns());
  }, []);

  return { campaigns, addCampaign, updateCampaign, deleteCampaign, refreshCampaigns, reset };
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
npm test -- useYearPlan --reporter=verbose
```

Expected: 5 passing.

- [ ] **Step 5: Run full suite to check no regressions**

```bash
npm test
```

Expected: all tests passing.

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 7: Commit**

```bash
git add src/hooks/domain/useYearPlan.ts src/hooks/domain/__tests__/useYearPlan.test.ts
git commit -m "feat(campaigns): add useYearPlan hook with tests"
```

---

## Task 5: `CampaignModal` component

**Files:**

- Create: `src/features/calendar/CampaignModal.tsx`

Modal pattern in this codebase: component receives `onClose: () => void`, parent controls whether it's rendered. No `isOpen` prop — the parent conditionally renders the modal.

- [ ] **Step 1: Create `CampaignModal.tsx`**

```typescript
// src/features/calendar/CampaignModal.tsx
import React, { useState } from 'react';
import { Button, Input, Label } from '../../components/ui';
import type { Campaign } from '../../hooks/domain/useYearPlan';

const COLOUR_SWATCHES = [
  { label: 'Blue',   value: '#0ea5e9' },
  { label: 'Pink',   value: '#ec4899' },
  { label: 'Amber',  value: '#f59e0b' },
  { label: 'Green',  value: '#22c55e' },
  { label: 'Purple', value: '#8b5cf6' },
  { label: 'Red',    value: '#ef4444' },
  { label: 'Teal',   value: '#14b8a6' },
  { label: 'Slate',  value: '#64748b' },
];

const CAMPAIGN_TYPES = ['campaign', 'theme', 'series'] as const;

interface CampaignModalProps {
  campaign?: Campaign;       // undefined = create mode, defined = edit mode
  onSave: (data: Omit<Campaign, 'id' | 'createdAt' | 'createdBy'>) => void;
  onUpdate?: (id: string, updates: Partial<Campaign>) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

export function CampaignModal({ campaign, onSave, onUpdate, onDelete, onClose }: CampaignModalProps) {
  const [name, setName] = useState(campaign?.name ?? '');
  const [type, setType] = useState<Campaign['type']>(campaign?.type ?? 'campaign');
  const [startDate, setStartDate] = useState(campaign?.startDate ?? '');
  const [endDate, setEndDate] = useState(campaign?.endDate ?? '');
  const [colour, setColour] = useState(campaign?.colour ?? '#0ea5e9');
  const [notes, setNotes] = useState(campaign?.notes ?? '');

  const isEdit = !!campaign;
  const isValid = name.trim() && startDate && endDate && endDate >= startDate;

  function handleSave() {
    if (!isValid) return;
    if (isEdit && onUpdate) {
      onUpdate(campaign.id, { name: name.trim(), type, startDate, endDate, colour, notes: notes || undefined });
    } else {
      onSave({ name: name.trim(), type, startDate, endDate, colour, notes: notes || undefined });
    }
    onClose();
  }

  function handleDelete() {
    if (isEdit && onDelete) { onDelete(campaign.id); onClose(); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-graystone-900 mb-4">
          {isEdit ? 'Edit campaign' : 'Add campaign'}
        </h2>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <Label htmlFor="campaign-name">Name</Label>
            <Input id="campaign-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. World Population Day" />
          </div>

          {/* Type */}
          <div>
            <Label htmlFor="campaign-type">Type</Label>
            <select
              id="campaign-type"
              value={type}
              onChange={(e) => setType(e.target.value as Campaign['type'])}
              className="w-full rounded-lg border border-graystone-300 px-3 py-2 text-sm text-graystone-700"
            >
              {CAMPAIGN_TYPES.map((t) => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="campaign-start">Start date</Label>
              <Input id="campaign-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="campaign-end">End date</Label>
              <Input id="campaign-end" type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          {endDate && startDate && endDate < startDate && (
            <p className="text-xs text-red-600">End date must be on or after start date.</p>
          )}

          {/* Colour */}
          <div>
            <Label>Colour</Label>
            <div className="flex gap-2 mt-1 flex-wrap">
              {COLOUR_SWATCHES.map((swatch) => (
                <button
                  key={swatch.value}
                  type="button"
                  title={swatch.label}
                  onClick={() => setColour(swatch.value)}
                  className={`h-7 w-7 rounded-full border-2 transition ${colour === swatch.value ? 'border-graystone-700 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: swatch.value }}
                />
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="campaign-notes">Notes (optional)</Label>
            <textarea
              id="campaign-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-graystone-300 px-3 py-2 text-sm text-graystone-700 resize-none"
              placeholder="Any context or goals for this campaign…"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mt-6">
          <div>
            {isEdit && onDelete && (
              <Button variant="ghost" size="sm" onClick={handleDelete} className="text-red-600 hover:text-red-700">
                Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={!isValid}>Save</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/features/calendar/CampaignModal.tsx
git commit -m "feat(campaigns): add CampaignModal component"
```

---

## Task 6: `YearPlanView` Gantt component

**Files:**

- Create: `src/features/calendar/YearPlanView.tsx`

The Gantt positions bars using CSS `left` and `width` percentages relative to the year. The formula: `leftPct = (dayOfYear(start) - 1) / daysInYear * 100`, `widthPct = (dayOfYear(end) - dayOfYear(start) + 1) / daysInYear * 100`.

- [ ] **Step 1: Create `YearPlanView.tsx`**

```typescript
// src/features/calendar/YearPlanView.tsx
import React, { useState } from 'react';
import { Button } from '../../components/ui';
import { cx } from '../../lib/utils';
import type { Campaign } from '../../hooks/domain/useYearPlan';
import { CampaignModal } from './CampaignModal';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInYear(year: number) {
  return isLeapYear(year) ? 366 : 365;
}

function dayOfYear(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00');
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d.getTime() - start.getTime();
  return Math.floor(diff / 86400000);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function barPosition(campaign: Campaign, year: number): { left: string; width: string } | null {
  const total = daysInYear(year);
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  // Clamp to the visible year
  const start = campaign.startDate > yearEnd || campaign.endDate < yearStart ? null : campaign.startDate;
  if (!start) return null;

  const clampedStart = campaign.startDate < yearStart ? yearStart : campaign.startDate;
  const clampedEnd = campaign.endDate > yearEnd ? yearEnd : campaign.endDate;

  const startDay = dayOfYear(clampedStart);
  const endDay = dayOfYear(clampedEnd);
  const leftPct = clamp(((startDay - 1) / total) * 100, 0, 100);
  const widthPct = clamp(((endDay - startDay + 1) / total) * 100, 0.5, 100 - leftPct);

  return { left: `${leftPct.toFixed(2)}%`, width: `${widthPct.toFixed(2)}%` };
}

interface YearPlanViewProps {
  campaigns: Campaign[];
  onAdd: (data: Omit<Campaign, 'id' | 'createdAt' | 'createdBy'>) => void;
  onUpdate: (id: string, updates: Partial<Campaign>) => void;
  onDelete: (id: string) => void;
}

export function YearPlanView({ campaigns, onAdd, onUpdate, onDelete }: YearPlanViewProps) {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [addOpen, setAddOpen] = useState(false);
  const [editCampaign, setEditCampaign] = useState<Campaign | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const todayPosition = today >= `${year}-01-01` && today <= `${year}-12-31`
    ? `${(((dayOfYear(today) - 1) / daysInYear(year)) * 100).toFixed(2)}%`
    : null;

  const visible = campaigns.filter(
    (c) => c.startDate <= `${year}-12-31` && c.endDate >= `${year}-01-01`,
  );

  return (
    <div className="rounded-2xl border border-graystone-200 bg-white p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setYear((y) => y - 1)}
            className="rounded-md border border-graystone-200 px-2 py-1 text-sm text-graystone-600 hover:bg-graystone-50"
          >
            ←
          </button>
          <span className="text-base font-semibold text-graystone-900 min-w-[3rem] text-center">{year}</span>
          <button
            type="button"
            onClick={() => setYear((y) => y + 1)}
            className="rounded-md border border-graystone-200 px-2 py-1 text-sm text-graystone-600 hover:bg-graystone-50"
          >
            →
          </button>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>+ Add campaign</Button>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: '600px' }}>
          {/* Month headers */}
          <div className="flex mb-1 ml-[180px]">
            {MONTHS.map((m) => (
              <div key={m} className="flex-1 text-center text-xs text-graystone-400 font-medium">{m}</div>
            ))}
          </div>

          {/* Timeline area with today line */}
          <div className="relative">
            {/* Month column dividers */}
            <div className="absolute inset-0 ml-[180px] flex pointer-events-none">
              {MONTHS.map((m, i) => (
                <div key={m} className={cx('flex-1 border-l border-graystone-100', i === 0 && 'border-l-0')} />
              ))}
            </div>

            {/* Today line */}
            {todayPosition && (
              <div
                className="absolute top-0 bottom-0 w-px bg-ocean-400 z-10 pointer-events-none"
                style={{ left: `calc(180px + ${todayPosition} * (100% - 180px) / 100)` }}
              />
            )}

            {/* Campaign rows */}
            {visible.length === 0 ? (
              <div className="py-12 text-center text-sm text-graystone-400 ml-[180px]">
                No campaigns yet for {year} — add one to get started.
              </div>
            ) : (
              visible.map((campaign) => {
                const pos = barPosition(campaign, year);
                return (
                  <div key={campaign.id} className="flex items-center py-1 group">
                    {/* Label */}
                    <div className="w-[180px] shrink-0 pr-3 text-sm text-graystone-700 font-medium truncate" title={campaign.name}>
                      {campaign.name}
                      <span className="ml-1 text-xs text-graystone-400 capitalize">{campaign.type}</span>
                    </div>
                    {/* Bar track */}
                    <div className="flex-1 relative h-7">
                      {pos && (
                        <button
                          type="button"
                          title={`${campaign.name} — click to edit`}
                          onClick={() => setEditCampaign(campaign)}
                          className="absolute top-0.5 h-6 rounded-md text-white text-xs font-medium px-2 truncate hover:brightness-90 transition-all"
                          style={{ left: pos.left, width: pos.width, backgroundColor: campaign.colour }}
                        >
                          {campaign.name}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {addOpen && (
        <CampaignModal
          onSave={onAdd}
          onClose={() => setAddOpen(false)}
        />
      )}
      {editCampaign && (
        <CampaignModal
          campaign={editCampaign}
          onSave={onAdd}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onClose={() => setEditCampaign(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/features/calendar/YearPlanView.tsx
git commit -m "feat(campaigns): add YearPlanView Gantt component"
```

---

## Task 7: Wire into `CalendarView`

**Files:**

- Modify: `src/features/calendar/CalendarView.tsx`

Three changes: (1) extend the `CalendarViewMode` union, (2) add 'year' to the tab array, (3) render `<YearPlanView>` when active.

- [ ] **Step 1: Read CalendarView interface props** to see where campaigns/handlers should be added (search for the `CalendarViewProps` interface)

```bash
grep -n 'interface CalendarViewProps\|entries:\|campaigns:\|onAdd' "src/features/calendar/CalendarView.tsx" | head -20
```

- [ ] **Step 2: Add campaigns props to the interface**

Find `interface CalendarViewProps` and add:

```typescript
campaigns: Campaign[];
onAddCampaign: (data: Omit<Campaign, 'id' | 'createdAt' | 'createdBy'>) => void;
onUpdateCampaign: (id: string, updates: Partial<Campaign>) => void;
onDeleteCampaign: (id: string) => void;
```

Also add the import at the top:

```typescript
import type { Campaign } from '../../hooks/domain/useYearPlan';
import { YearPlanView } from './YearPlanView';
```

- [ ] **Step 3: Extend `CalendarViewMode` type** (line ~20)

Change:

```typescript
type CalendarViewMode = 'month' | 'week' | 'board' | 'glance';
```

To:

```typescript
type CalendarViewMode = 'month' | 'week' | 'board' | 'glance' | 'year';
```

- [ ] **Step 4: Add 'year' to the tab render array** (line ~501)

Change:

```typescript
{(['month', 'week', 'board', 'glance'] as const).map((mode) => (
```

To:

```typescript
{(['month', 'week', 'board', 'glance', 'year'] as const).map((mode) => (
```

- [ ] **Step 5: Add YearPlanView render block** — after the last `{viewMode === 'glance' && ...}` block, add:

```typescript
{viewMode === 'year' && (
  <YearPlanView
    campaigns={campaigns}
    onAdd={onAddCampaign}
    onUpdate={onUpdateCampaign}
    onDelete={onDeleteCampaign}
  />
)}
```

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck
```

Fix any prop errors — CalendarView's parent (app.jsx) will show errors until Task 8.

- [ ] **Step 7: Commit**

```bash
git add src/features/calendar/CalendarView.tsx
git commit -m "feat(campaigns): add year tab to CalendarView"
```

---

## Task 8: Wire into `app.jsx`

**Files:**

- Modify: `src/app.jsx`

`app.jsx` instantiates all domain hooks and passes their return values to feature components. Find where `useIdeas` is called and add `useYearPlan` alongside it.

- [ ] **Step 1: Locate the hook instantiation pattern in app.jsx**

```bash
grep -n 'useIdeas\|useGuidelines\|useYearPlan\|const.*=.*use' src/app.jsx | head -20
```

- [ ] **Step 2: Update barrel export (if barrel index exists)**

Check whether `src/hooks/domain/index.ts` exports other hooks:

```bash
grep -n 'useIdeas\|export' src/hooks/domain/index.ts 2>/dev/null | head -10
```

If the file exists and exports other domain hooks, add:

```typescript
export { useYearPlan } from './useYearPlan';
```

If no barrel exists, `app.jsx` imports directly from the file path — that's fine, use the direct path below.

- [ ] **Step 3: Add the import to `app.jsx`**

```javascript
import { useYearPlan } from './hooks/domain/useYearPlan';
```

(If a barrel index exists and you added the re-export above, you may also use `'./hooks/domain'`.)

- [ ] **Step 4: Instantiate the hook** (alongside useIdeas)

```javascript
const { campaigns, addCampaign, updateCampaign, deleteCampaign, refreshCampaigns } = useYearPlan({
  currentUser,
  runSyncTask,
  pushSyncToast,
});
```

- [ ] **Step 5: Pass props to CalendarView**

Find the `<CalendarView` JSX block and add:

```javascript
campaigns = { campaigns };
onAddCampaign = { addCampaign };
onUpdateCampaign = { updateCampaign };
onDeleteCampaign = { deleteCampaign };
```

- [ ] **Step 6: Run full typecheck and tests**

```bash
npm run typecheck && npm test
```

Expected: 0 TS errors, all tests passing.

- [ ] **Step 7: Run dev server and verify visually**

```bash
npm run dev
```

Open the app → Calendar → click the new "Year" tab → confirm Gantt renders with empty state. Click "Add campaign" → fill in the form → save → confirm bar appears.

- [ ] **Step 8: Commit**

```bash
git add src/app.jsx
git commit -m "feat(campaigns): wire useYearPlan into app and CalendarView"
```

---

## Task 9: Final verification

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: all existing tests pass + 5 new `useYearPlan` tests pass.

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: clean build, no bundle regressions.

- [ ] **Step 4: Smoke test in browser**

- Add a campaign spanning Jan–Mar, one spanning Jun–Jul, one spanning all year
- Verify bars are correctly positioned and labelled
- Edit a campaign — change name and end date — verify bar updates
- Delete a campaign — verify row disappears
- Switch year forward and back — verify bars appear/disappear correctly
- Check today-line appears correctly on current year, absent on other years

- [ ] **Step 5: Final commit**

```bash
SKIP_AUDIT=1 git commit --allow-empty -m "chore: yearly Gantt planning view complete"
```

(Or just confirm the previous commits cover everything — no extra commit needed if no files are dirty.)

---

## Reference

- **Spec:** `docs/superpowers/specs/2026-03-17-yearly-gantt-planning-design.md`
- **Pattern files to read before editing:**
  - `src/hooks/domain/useIdeas.ts` — hook pattern
  - `src/lib/supabase.ts` lines 953–1016 — SUPABASE_API CRUD pattern
  - `src/lib/storage.ts` lines 148–168 — localStorage helper pattern
  - `src/features/calendar/CalendarView.tsx` lines 500–520 — tab render pattern
  - `src/hooks/domain/__tests__/useApprovals.test.ts` — test pattern
