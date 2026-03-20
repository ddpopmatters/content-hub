# Content Hub — Dev Log

<!-- Current month. Older entries rotate to devlog/YYYY-MM.md -->

## 2026-03-20 — Fix disappearing entries + Supabase keep-alive

- Tool: Claude Code (Sonnet 4.6)
- Branch: main
- Changes:
  - Fixed bug: entries disappeared immediately after creation — `saveEntry` returned `null` on DB error instead of throwing, so `runSyncTask` always called `refreshEntries()` and wiped the optimistic entry; fixed by throwing instead
  - Added GitHub Actions keep-alive cron (daily 08:00 UTC) to prevent Supabase free-tier auto-pause
  - Schema recovery migration for missing migration 013 columns (content_category, series_name, etc.)
  - Fixed 3 conflicting migration version keys and `CREATE POLICY IF NOT EXISTS` syntax error
  - Added `20260320_seed_guidelines_default.sql` — upserts default guidelines row (prevents 406 on fresh project); apply via Supabase SQL editor
- Status: Complete (seed migration needs applying to production)

## 2026-03-18 — Draft post cards on monthly planning calendar

- Tool: Claude Code (Sonnet 4.6)
- Branch: feature/planning-draft-posts
- Changes:
  - New `planning_draft_posts` table (date, platform, topic, asset_type, notes) + RLS
  - `SUPABASE_API.fetchDraftPosts/saveDraftPost/deleteDraftPost` in supabase.ts
  - `DraftPostModal.tsx` — platform select, topic, asset type, notes; edit + delete
  - `PlanningGrid.tsx` — colour-coded draft chips per day, `+ Draft` button per cell
- Status: Complete

## 2026-03-17 — Yearly Gantt Planning View

**Tool:** Claude Code (Sonnet 4.6) + Codex (quality reviewer)
**Branch:** feature/calendar-planning-layer
**Changes:**

- New `campaigns` Supabase table with RLS, date-range constraint, start/end indexes
- `PlanningCampaign` type + localStorage helpers + full SUPABASE_API CRUD
- `useYearPlan` hook — optimistic CRUD, localStorage sync, auth-ready hydration, sign-out reset, 9 unit tests
- `CampaignModal` — create/edit modal with 8-colour swatches, date validation, shared Modal primitive, full a11y
- `YearPlanView` — Gantt chart with DST-safe date math, real month-width alignment, today line, year nav
- "Year" tab wired into CalendarView; hook wired into app.jsx
  **Status:** Complete (132 tests passing, 0 TS errors, build clean)

## 2026-03-17 — Apply RLS fix migration

**Tool:** Claude Code (Sonnet 4.6)
**Branch:** feature/calendar-planning-layer
**Changes:**

- Applied `20260317_fix_entries_rls.sql` to production Supabase
- `entries_select`: now `USING (true)` — trash view can see soft-deleted rows
- `entries_update`: now open to all authenticated users — fixes 403 on non-author edits
- `entries_delete`: open to all authenticated users
- `ideas_update/delete`: open to all authenticated users
- `guidelines_modify`: replaces admin-only `guidelines_admin_modify` — any team member can save
  **Status:** Complete

## 2026-03-17 — Fix all window.api routing across domain hooks

**Tool:** Claude Code (Sonnet 4.6)
**Branch:** feature/calendar-planning-layer
**Changes:**

- Root cause: `supabaseClient.js` sets `window.api.enabled = true` unconditionally, so all `windowApi?.enabled` ternaries in domain hooks routed to the legacy thin client — SUPABASE_API fallbacks were never reached
- Fixed `useEntries.ts`: removed all `windowApi?.enabled` ternaries across 11 operations (refreshEntries, addEntry, upsert, toggleApprove, handlePublishEntry, handleToggleEvergreen, handleEntryDateChange, handleBulkDateShift, updateWorkflowStatus, softDelete, restore, hardDelete) — all now call SUPABASE_API directly
- Fixed `useIdeas.ts`: replaced `window.api.createIdea/deleteIdea/updateIdea/listIdeas` with `SUPABASE_API.saveIdea/deleteIdea/fetchIdeas`
- Fixed `useGuidelines.ts`: replaced `window.api.saveGuidelines` existence gate with unconditional `SUPABASE_API.saveGuidelines`
- Added `SUPABASE_API.hardDeleteEntry(id)` — true `DELETE FROM entries` (previously hardDelete fell back to soft-delete)
  **Status:** Complete — 123 tests passing, 0 TS errors

## 2026-03-17 — Fix content saving to Supabase + planning notes

**Tool:** Claude Code (Sonnet 4.6)
**Branch:** feature/calendar-planning-layer
**Changes:**

- Fixed entries not saving: `useSyncQueue` was treating absent `window.api` as "API offline" — changed gate from `!window.api || !window.api.enabled` to `window.api && !window.api.enabled`
- Fixed `invalid input syntax for type date: ""` — added `dateOrNull()` helper to `public/js/supabaseClient.js` (was sending literal `""` to Postgres DATE column)
- Fixed all remaining `window.api`-only mutations in `useEntries.ts` (toggleApprove, updateWorkflowStatus, softDelete, restore, hardDelete, toggleEvergreen, handleEntryDateChange, handleBulkDateShift) to fall back to `SUPABASE_API` when running on GitHub Pages
- Added `SUPABASE_API.restoreEntry(id)` for clearing `deleted_at` via Supabase
- Added localStorage → Supabase migration on login (one-time, flagged to prevent repeat)
- Added shared `planning_notes` table (migration 20260317) — planning grid notes now persist to Supabase and are visible to all team members
  **Status:** Complete — 123 tests passing, 0 TS errors

## 2026-03-13 — Project config scaffold

**Tool:** Claude Code (Opus)
**Branch:** main
**Changes:**

- Added CLAUDE.md with project-specific context
- Added AGENTS.md with Codex-specific context
- Created DEVLOG.md for cross-tool work record
  **Status:** Complete

## 2026-03-18 — Show confirmed calendar themes in planning view

**Tool:** Claude Code (Sonnet 4.6)
**Branch:** feature/planning-themes → PR #22
**Changes:**

- `PlanningGrid.tsx`: reads `content-hub-calendar-themes` localStorage key (shared with `MonthGrid`)
- Month theme displayed as teal banner above the day-of-week headers
- Week themes displayed as a subtle label above each week row
- Both re-sync when navigating months; hidden when empty
  **Status:** Complete

---

## 2026-03-19: Add test suite — filters, utils, Button, terminology

**Tool:** Claude Code (claude-sonnet-4-6)
**Branch:** `feature/test-suite`

**Changes:**

- `src/lib/filters.test.ts` — 14 tests for `isApprovalOverdue` and `matchesSearch` (all 24 Entry fields incl. contentPillar, firstComment)
- `src/lib/utils.test.ts` — 28 tests for cx, date helpers, uuid, ensureArray, ensurePeopleArray
- `src/components/ui/__tests__/Button.test.tsx` — 7 smoke tests (render, type, onClick, disabled, aria, className merge, all 6 variants)
- `src/lib/terminology.test.ts` — 16 tests locking in PM messaging compliance gate (checkTerminology, hasTerminologyIssues, all 5 banned terms, index/length accuracy)

**Test count:** 81 → 197

**Status:** Complete

---

## 2026-03-20: Fix realtime sync + repair production schema

**Tool:** Claude Code (claude-sonnet-4-6)
**Branch:** `main`

**Changes:**

- `src/hooks/domain/useEntries.ts` — Added realtime subscription via `SUPABASE_API.subscribeToEntries` so all team members see each other's entries live without manual refresh
- `src/features/calendar/CalendarView.tsx` — Added Refresh button to calendar toolbar
- `src/app.jsx` — Wired `onRefresh={refreshEntries}` to CalendarView
- `supabase/migrations/20260320_restore_missing_013_columns.sql` — Restored 15 missing columns from migration 013 (content_category, partner_org, alt_text_status, utm_status, cta_type, etc.) that were absent from production despite being recorded as applied — caused all entry saves to fail with 400
- Renamed 3 migration files that shared timestamp prefixes with already-applied migrations (causing `duplicate key` errors on push); fixed `CREATE POLICY IF NOT EXISTS` syntax errors in two migration files

**Status:** Complete
