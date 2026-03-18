# Yearly Gantt Planning View — Design Spec

**Date:** 2026-03-17
**Branch:** feature/calendar-planning-layer

---

## Overview

A new "Year" tab on the Calendar/Content screen that displays campaigns and themes as a standard horizontal Gantt chart across a 12-month timeline. Users can add, edit, and delete planning items with date ranges and colour labels.

---

## Data Model

### New table: `campaigns`

```sql
CREATE TABLE campaigns (
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
```

**`type` values:** `'campaign'` | `'theme'` | `'series'`

**RLS:** All authenticated users can SELECT, INSERT, UPDATE, DELETE — same open policy as the entries fix applied 2026-03-17.

**Migration file:** `supabase/migrations/20260317_create_campaigns.sql`

---

## Architecture

### TypeScript interface

Define `Campaign` in `src/hooks/domain/useYearPlan.ts`:

```typescript
export interface Campaign {
  id: string;
  name: string;
  type: 'campaign' | 'theme' | 'series';
  startDate: string; // ISO date string (maps to start_date column)
  endDate: string; // ISO date string (maps to end_date column)
  colour: string; // hex, e.g. '#6366f1'
  notes?: string;
  createdBy?: string;
  createdAt?: string;
}
```

### New files

| File                                      | Purpose                                     |
| ----------------------------------------- | ------------------------------------------- |
| `src/features/calendar/YearPlanView.tsx`  | Gantt chart component                       |
| `src/features/calendar/CampaignModal.tsx` | Add / edit modal                            |
| `src/hooks/domain/useYearPlan.ts`         | Domain hook — fetch, create, update, delete |

### Modified files

| File                                     | Change                                                                           |
| ---------------------------------------- | -------------------------------------------------------------------------------- |
| `src/lib/supabase.ts`                    | Add `fetchCampaigns`, `saveCampaign`, `deleteCampaign` methods to `SUPABASE_API` |
| `src/features/calendar/CalendarView.tsx` | Add `'year'` tab; render `<YearPlanView>` when active                            |
| `src/app.jsx`                            | Instantiate `useYearPlan` hook, pass to CalendarView                             |

---

## Components

### YearPlanView

**Layout:**

- Header: year navigation (`← 2025 · 2026 · 2027 →`) + "Add campaign" button (top right)
- Grid: fixed left column (item name labels, ~180px) + scrollable right area (12 month columns)
- Month headers spanning the grid width; a vertical line marks today's date
- One row per campaign, sorted by `start_date`
- Each row renders a coloured bar from `start_date` to `end_date`; the campaign name is displayed inside the bar if space allows, otherwise truncated with tooltip
- Clicking any bar opens `CampaignModal` in edit mode

**Year state:** controlled integer (current year), incremented/decremented by nav buttons. Default: current calendar year.

**Empty state:** "No campaigns yet for {year} — add one to get started."

### CampaignModal

Shared modal for create and edit. Fields:

- **Name** — text input, required
- **Type** — select: Campaign / Theme / Series
- **Start date** — date picker
- **End date** — date picker (must be ≥ start date)
- **Colour** — preset swatch picker (8 colours: blue, pink, amber, green, purple, red, teal, slate)
- **Notes** — textarea, optional

Actions:

- **Save** — creates or updates; closes modal on success
- **Delete** (edit mode only) — removes item; closes modal
- **Cancel** — closes without saving

---

## Data Flow

`useYearPlan` follows the existing domain hook pattern (`useIdeas`, `useEntries`):

1. **Mount:** initialise state from localStorage (`loadCampaigns` / `saveCampaigns`)
2. **Login:** hydrate from Supabase via `SUPABASE_API.fetchCampaigns()`
3. **Mutations:** optimistic — update local state immediately, then sync via `runSyncTask`
4. **Sync failures:** surface via existing sync toast system (`pushSyncToast`); no new error UI

### `SUPABASE_API` methods

```typescript
fetchCampaigns(): Promise<Campaign[]>
saveCampaign(campaign: Partial<Campaign>, createdBy: string): Promise<Campaign | null>
deleteCampaign(id: string): Promise<boolean>
```

`saveCampaign` uses `.upsert()` — handles both create and update.

---

## Error Handling

- **Date validation:** `end_date` must be ≥ `start_date` — enforced in CampaignModal before save
- **Empty name:** save button disabled if name is blank
- **Sync failures:** handled by `runSyncTask` with the existing toast pattern — no additional handling needed
- **Zero items:** empty state message in YearPlanView

---

## Testing

Unit tests in `src/hooks/domain/__tests__/useYearPlan.test.ts`:

- `addCampaign` creates item optimistically
- `deleteCampaign` removes item optimistically
- `updateCampaign` updates item in state
- `fetchCampaigns` hydrates state from API response

No unit tests for the Gantt rendering (pure layout from dates). Browser verification covers visual correctness.

---

## Scope

**In scope:**

- New `campaigns` table + RLS
- `useYearPlan` hook + SUPABASE_API methods
- `YearPlanView` Gantt component
- `CampaignModal` add/edit modal
- "Year" tab in `CalendarView`
- Hook wired into `app.jsx`

**Out of scope (not in this spec):**

- Linking campaigns to content entries
- Drag-to-resize bars
- Exporting the Gantt
- Per-campaign notifications or reminders
