# Content Hub — Dev Log

<!-- Current month. Older entries rotate to devlog/YYYY-MM.md -->

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
