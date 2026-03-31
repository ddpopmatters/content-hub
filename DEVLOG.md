# Content Hub — Dev Log

## 2026-03-31 — Remove remaining old Supabase project callers

- Tool: Codex
- Branch: main
- Changes:
  - `public/request.html`, `public/review.html`, and `public/approve.html`: moved standalone pages off hardcoded Supabase URLs onto a shared `public/content-hub-config.js` so they follow the active project instead of the retired Content Hub project
  - `tools/public-config.mjs`, `tools/build.mjs`, and `tools/dev-server.mjs`: added generated public Supabase config output and a legacy-project guard so stale local env values cannot reintroduce the retired project URL/key into built assets
  - `.github/workflows/supabase-keepalive.yml` and `tools/test-publish-api.mjs`: switched remaining workflow/script callers to use the current project via secrets or `SUPABASE_URL` instead of the old hardcoded project ref
  - Rebuilt the app and verified `rg -n "dvhjvtxtkmtsqlnurhfg" public src tools .github supabase` only matches the intentional legacy guard constant
- Status: Complete

---

## 2026-03-31 — Restore admin user invites via Edge Function

- Tool: Codex
- Branch: main
- Changes:
  - `supabase/functions/admin-users/index.ts`: added a service-role-backed admin user management function that verifies the caller is an admin, sends real Supabase auth invites, and handles list/update/delete operations against `user_profiles`
  - `src/lib/supabase.ts` and `src/hooks/domain/useAdmin.ts`: moved admin roster actions off the deleted `window.api` browser bridge onto direct Supabase + Edge Function calls, with proper app-user mapping and surfaced backend error messages
  - `src/app.jsx`, `src/types/models.ts`, and `public/index.html`: switched static bootstrap to the mapped admin-user fetch, added `managerEmail` to the app user model, and removed stale `supabaseClient.js` / `copyCheckerClient.js` script tags that the current build no longer outputs
  - `src/hooks/domain/__tests__/useAdmin.test.ts`: added regression coverage for static-mode roster refresh, successful invites, backend invite failures, and non-admin access blocking
  - Verified with `npm test -- src/hooks/domain/__tests__/useAdmin.test.ts src/lib/supabase.test.ts` and `npm run typecheck`
- Status: Complete

---

## 2026-03-31 — Recover migrated auth profiles on login

- Tool: Codex
- Branch: main
- Changes:
  - `src/lib/supabase.ts`: added current-user profile resolution that falls back from `auth_user_id` to the authenticated email, then re-links stale `user_profiles.auth_user_id` values to the current Intel Hub auth UUID during login and session hydration
  - `src/lib/supabase.ts`: updated profile writes to target the resolved row by profile `id`/`email`, so profile edits still work while a migrated account is being repaired
  - `src/lib/supabase.test.ts`: added regression coverage for direct auth matches, migrated-user email recovery, missing-profile null handling, and post-relink profile updates
  - Verified with `npm test -- src/lib/supabase.test.ts` and `npm run typecheck`
- Status: Complete

---

## 2026-03-30 — Add staged deployment lane

**Tool:** Codex | **Branch:** main

**Changes:**

- Switched GitHub Pages production deployment to manual promotion only and added a new Cloudflare Pages staging workflow for pull requests and `main`
- Added `public/healthz.json` for smoke checks and `docs/staging-contract.md` documenting environment separation, rollout gates, rollback, and required secrets
- Kept production hosting untouched while codifying staging-only Supabase, storage, OAuth, and notification expectations in-repo

**Status:** Complete

---

## 2026-03-28 — Migrate to Intel Hub (consolidated Supabase project)

- Tool: Claude Code (claude-sonnet-4-6) | Browser automation
- Branch: main
- Changes:
  - Switched Supabase project from Content Hub (`dvhjvtxtkmtsqlnurhfg`) to Intel Hub (`oepehanwmfelowfumkes`)
  - Updated hardcoded fallback credentials in `src/lib/config.ts`
  - Updated GitHub repo secrets (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) via `gh secret set`
  - Pushed to main → GitHub Actions deploy completed (build 16s, deploy 8s)
  - All 184 rows of Content Hub data previously imported to Intel Hub (184 rows across 12 tables)
  - All 3 user_profiles auth UUIDs remapped to Intel Hub auth.users (daniel, francesca, jameen)
  - Fixed email typo: `jameen.kaur@populationmatters` → `jameen.kaur@populationmatters.org`
- Status: Complete — Content Hub app now live on Intel Hub. Old Supabase project pending decommission (~2 weeks).

## 2026-03-24 — Implement Instagram, Facebook, and LinkedIn publishers

- Tool: Claude Code (claude-sonnet-4-6) + Codex
- Branch: main
- Changes:
  - `supabase/functions/publish-entry/index.ts`: implemented full publish flows for Instagram (user token → page token → IG business account → media container → publish), Facebook (page token + photo or feed post), and LinkedIn (UGC Posts API with optional image upload via registerUpload; post URN from x-restli-id response header)
  - YouTube: improved stub message explaining video file requirement
  - All publishers follow existing try/catch/error pattern from Bluesky
- Status: Complete

## 2026-03-24 — Refine entry category, approach, UTM, and asset inputs

- Tool: Codex
- Branch: main
- Changes:
  - `src/lib/supabase.ts` and new `src/hooks/domain/useCategories.ts`: added distinct category lookup from the `entries.campaign` column so both entry forms can autocomplete existing categories while still accepting free text
  - `src/features/entry/EntryForm.tsx` and new `src/features/entry/formUtils.ts`: replaced Campaign with a Category datalist input, moved response mode to a Proactive/Reactive pill toggle in the main form, added the collapsible UTM builder, and extended preview uploads to support PDF badges alongside image thumbnails
  - `src/features/entry/EntryModal.jsx`: mirrored the Category autocomplete, main-form content-approach toggle, UTM builder, and image-or-PDF asset preview handling; legacy response modes now normalise to `Planned` or `Reactive` on save/update paths
  - Verified with `npm run typecheck` and `npm test`
- Status: Complete

## 2026-03-24 — Fix publishing API: rewire Publish button to Supabase Edge Function

- Tool: Claude Code (claude-sonnet-4-6)
- Branch: main
- Changes:
  - `src/hooks/domain/useEntries.ts`: replaced `triggerPublish` (Zapier no-cors webhook) with direct `fetch` to `functions/v1/publish-entry` Edge Function; uses real per-platform `PlatformResult` to set publishStatus instead of blindly marking all as published
  - `src/types/models.ts`: added `'skipped'` to `PublishStatusState` union
  - `src/features/publishing/publishUtils.ts`: `getAggregatePublishStatus` now treats `skipped` platforms as failed; entries where all platforms were skipped don't get `workflowStatus: 'Published'`
  - `supabase/functions/oauth-callback/index.ts`: fixed fragile string-replace for `FUNCTION_URL`; removed hardcoded Supabase project URL as `APP_URL` fallback
  - `supabase/config.toml`: added `[functions]` section so Edge Functions are served by `supabase start`
  - `.env.example`: documented `APP_URL`, `LINKEDIN_CLIENT_ID`, `GOOGLE_CLIENT_ID`
  - Added `publishUtils.test.ts` + 3 `handlePublishEntry` tests in `useEntries.test.ts` (207 tests total)
- Status: Complete

## 2026-03-24 — Update entry form workflow and asset inputs

- Tool: Codex
- Branch: main
- Changes:
  - `src/features/entry/EntryForm.tsx`: replaced the platform checkbox grid with pill-style toggle buttons to match the modal interaction
  - `src/features/entry/EntryForm.tsx`: removed the visible `First comment` field and replaced the single approval deadline input with a five-field `Workflow dates` section
  - `src/features/entry/EntryForm.tsx`: added `assetPreviews` state and a multi-file preview upload flow with thumbnail removal, while keeping `previewUrl` in sync
  - `src/features/entry/EntryForm.tsx`: disabled automatic approver prefill so new entries start empty and the recommendation is only applied through `Use template`
  - Verified with `npm run typecheck` and `npm test`
- Status: Complete

## 2026-03-24 — Step-by-step wizard approval flow

- Tool: Claude Code (Sonnet 4.6)
- Branch: main
- Changes:
  - `EntryModal.jsx`: `renderApproverContent()` rewritten as a wizard — shows one content item at a time with a progress bar (`N of M`); once all items approved, transitions to a summary view showing every item for final review before Sign off becomes active
  - Removed per-item approve buttons from `renderAssetNotes()` (script, design copy, carousel slides) — approval now lives entirely in the wizard
- Status: Complete

## 2026-03-24 — Per-item approval flow + remove footer bypass

- Tool: Claude Code (Sonnet 4.6)
- Branch: main
- Changes:
  - `ApprovalsView.tsx`: removed Card wrapper — content sits flush on modal; `p-6` padding on outer container; header reduced to `← Back` + waiting count badge
  - `EntryModal.jsx`: per-item approval flow — approver ticks each caption/slide/script/design-copy before "Sign off" is enabled; `approvedItems` Set tracks state locally, resets on modal open; progress counter "N of M items reviewed"
  - `EntryModal.jsx`: removed footer "Mark as approved" bypass — "Sign off" in the body is now the sole approval path, enforcing the per-item gate
- Status: Complete

## 2026-03-24 — Simplify approvals header and content review modal

- Tool: Claude Code (Sonnet 4.6)
- Branch: main
- Changes:
  - `ApprovalsView.tsx`: header stripped from 5 crowded items to `← Back` + waiting count — eliminates "SWITCH USER" clipping; removed unused `PlusIcon` import and calendar/create/switch-user props from render
  - `EntryModal.jsx`: `renderApproverContent()` simplified — removed Strategy context grid (peak, partner, sign-off route, series) and Execution readiness section; added prominent "Mark as approved" banner at top of body with inline advisory text; campaign/pillar/category collapsed to one badge row; `CheckCircleIcon` added to icon imports
- Status: Complete

## 2026-03-23 — Fix approval persistence save path

- Tool: Codex
- Branch: main
- Changes:
  - `src/hooks/domain/useEntries.ts` now passes `currentUserEmail` into all entry save operations, shows an explicit approval failure toast, refreshes server state on failed approval saves, and sequences refresh requests to avoid stale realtime/refresh overwrites
  - `src/lib/supabase.ts` now updates existing `entries` rows in place instead of full-row upserting them, preserves the original `author_email`, merges partial updates with the current DB row, and throws when an entry save returns no row
  - `src/hooks/domain/useSyncQueue.ts` now treats resolved `null` and `false` results as sync failures instead of silent successes
  - Added regression coverage in `src/hooks/domain/__tests__/useEntries.test.ts` and `src/hooks/domain/__tests__/useSyncQueue.test.ts` for approval email persistence, approval failure feedback, and null/false sync results
- Status: Complete

## 2026-03-23 — Fix toggleApprove state-updater antipattern + apply RLS migration

- Tool: Claude Code (Sonnet 4.6)
- Branch: main
- Changes:
  - `toggleApprove` in `useEntries.ts`: `nextStatus` and `nextWorkflowStatus` are now pre-computed from `entryRecord` before the `setEntries` call — eliminates the fragile pattern of setting closure variables as side effects inside a state updater
  - `runSyncTask` now called unconditionally (no `if (nextStatusForServer)` guard) — removes possibility of skipping DB save
  - Test added: `'calls runSyncTask to persist the approval to the database'` asserting `runSyncTask` is called with the approval label and `requiresApi: false`
  - `supabase/migrations/20260323_ensure_entries_rls_open.sql` — idempotent migration confirming `entries_update` policy is `USING (true) WITH CHECK (true)`; applied to production via `supabase db push --include-all`
  - Also applied `20260320_restore_missing_013_columns.sql` (previously local-only, all no-ops — columns already existed)
- Status: Complete

## 2026-03-23 — Fix approval persistence + final advisory copy

- Tool: Claude Code (Sonnet 4.6)
- Branch: main
- Changes:
  - `EntryModal`: "Approval is blocked until..." → "Heads up — these items are incomplete:" (last remaining hard-block copy)
  - `mapEntryToDb`: add `approved_at` field so approval timestamp persists to DB on save
- Status: Complete

## 2026-03-23 — Soft-block approval flow — missing fields are advisory only

- Tool: Claude Code (Sonnet 4.6)
- Branch: main
- Changes:
  - `determineWorkflowStatus` no longer returns 'Draft' when execution fields (sourceVerified, ctaType, alt text, UTM, etc.) are incomplete — only requires approvers to be set
  - `ApprovalsView` 'Mark approved' button always enabled; blockers displayed as 'Heads up' advisory panel instead of hard gate
  - `toggleApprove` in useEntries: removed early return on blockers — approval now proceeds to DB save
  - Tests updated across sanitizers, useEntries
- Status: Complete

<!-- Current month. Older entries rotate to devlog/YYYY-MM.md -->

## 2026-03-20 — Quiet Supabase startup failures on static deploys

- Tool: Codex
- Branch: main
- Changes:
  - Removed the bundled app's hardcoded Supabase fallback so direct client mode only activates when build-time credentials are actually provided
  - Added a one-shot Supabase reachability probe plus session circuit breaker in both `src/lib/supabase.ts` and `public/js/supabaseClient.js` to stop repeated auth refresh and table fetch storms after DNS/CORS failures
  - Switched guideline, current-user-profile, and custom-niche lookups to `maybeSingle()` so missing default rows no longer surface as noisy 406-style errors
  - Updated `LoginScreen.tsx` to surface backend-unavailable state instead of waiting forever for `window.api.enabled`
- Status: Complete

## 2026-03-20 — Restore bundled Supabase credentials

- Tool: Codex
- Branch: main
- Changes:
  - Reinserted the provided Supabase URL and anon key as the fallback bundled config in `src/lib/config.ts`
  - Kept the session-level startup guard in place so unreachable/CORS-blocked Supabase does not trigger repeated request storms
- Status: Complete

## 2026-03-20 — Avoid `/api` fallback on static host boot

- Tool: Codex
- Branch: main
- Changes:
  - Updated `useAuth.ts` to wait for the static `window.api` bridge before attempting auth hydration instead of calling `/api/user` on GitHub Pages
  - Updated `useApprovals.ts` to wait for `pm-api-ready` and avoid `/api/approvers` fallback when the static Supabase bridge script is present
- Status: Complete

## 2026-03-20 — Clear deploy audit gate and DraftPost lint error

- Tool: Codex
- Branch: main
- Changes:
  - Removed the invalid `react-hooks/exhaustive-deps` suppression in `DraftPostModal.tsx` by making the reset effect dependency-safe
  - Refreshed `package-lock.json` via `npm audit fix --package-lock-only`, upgrading `jspdf` to `4.2.1`, `dompurify` to `3.3.3`, and `flatted` to `3.4.2`
  - Verified `npm audit --audit-level=critical` now returns 0 vulnerabilities
  - Re-ran lint, typecheck, and tests after the lockfile update
- Status: Complete

## 2026-03-20 — Align calendar files with Prettier for CI

- Tool: Codex
- Branch: main
- Changes:
  - Reformatted `CampaignModal.tsx`, `GanttTooltip.tsx`, `OrgEventModal.tsx`, `YearPlanView.tsx`, `useOrgEvents.ts`, and `models.ts`
  - Verified the exact Prettier check reported by CI now passes on those six files
- Status: Complete

## 2026-03-20 — Stop static sync queue from treating Supabase writes as offline

- Tool: Codex
- Branch: main
- Changes:
  - Marked `useEntries.ts` sync tasks as `requiresApi: false` so GitHub Pages entry saves, updates, restores, and deletes go straight to `SUPABASE_API` instead of being queued behind `window.api.enabled`
  - Applied the same direct-Supabase sync flag to `useIdeas.ts`, `useGuidelines.ts`, and `useYearPlan.ts` for consistency on the static host
- Status: Complete

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

## 2026-03-21 — Add audience simulation and Claude iteration workflow

- Tool: Codex
- Branch: main
- Changes:
  - Added the new `src/features/audience-sim/` module with typed simulation models, PM persona config, Supabase helpers, `useAudienceSim`, `useIterate`, UI panels, and three Vitest coverage files
  - Added `supabase/functions/simulate-audience/index.ts` and `supabase/functions/iterate-content/index.ts` to run persona simulation and Claude-guided revision flows against `audience_simulations`
  - Wired a new `Audience Sim` tab into `src/features/entry/EntryModal.jsx` and passed the current draft entry into the panel so simulations run against in-modal copy
  - Re-exported the audience simulation types from `src/types/models.ts` and verified the feature with lint, typecheck, and the full test suite
- Status: Complete

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

---

## 2026-03-20: Tolerate legacy entries schema in production

**Tool:** Codex
**Branch:** `main`

**Changes:**

- `src/lib/supabase.ts` — added `entries` upsert retry logic that detects PostgREST `PGRST204` missing-column errors, caches unsupported columns, and retries the save without those fields
- `src/lib/supabase.ts` — hardened `saveEntry` so static deployments can keep writing to older production schemas instead of leaving creates stuck in the sync queue
- Verified the change with `npm run typecheck`

**Status:** Complete

---

## 2026-03-24 — Form improvements: influencer create, sign-off route removal, validation simplification

**Tool:** Claude Code (claude-sonnet-4-6)
**Branch:** main

**Changes:**

- `InfluencerPicker.tsx` — new `onCreateNew` prop; "+ New influencer" button in label row
- `EntryForm.tsx` — quick-create modal for influencers (name + platform), saved via `SUPABASE_API.saveInfluencer`, auto-selected on creation; local influencer list merged with prop list
- `EntryForm.tsx` — sign-off route dropdown removed from Advanced section (state preserved for submission backward compat)
- `EntryForm.tsx` — validation simplified: only platforms + caption + asset-type copy required; date and asset type no longer block submission

**Documented:** Login-free approval flow — recommended approach is HMAC-signed token in approval email URL, validated by public Edge Function, no Supabase account needed.

**Status:** Complete

## 2026-03-27 — Implement Layer 1 full publishing plumbing

- Tool: Codex
- Branch: main
- Changes:
  - `supabase/functions/_shared/types.ts` and `src/features/publishing/publishUtils.ts`: added `assetType` to the publish payload contract and switched `mediaUrls` to filtered `assetPreviews` public URLs instead of attachment/base64 data
  - `src/features/publishing/__tests__/publishUtils.test.ts`: replaced the file with payload coverage for `assetType`, `assetPreviews` mapping, base64 filtering, and retained aggregate skipped-status coverage
  - `src/features/entry/EntryForm.tsx`: changed the preview asset picker to accept images, video, and PDFs up to 500MB, upload selected files to the `content-media` Supabase Storage bucket via `getSupabase()`, and persist returned public URLs in `assetPreviews`
  - Verified with `npm run typecheck` and `npm test`
- Status: Complete

## 2026-03-27 — Implement Layer 2 carousel publishing

- Tool: Codex
- Branch: main
- Changes:
  - `supabase/functions/publish-entry/index.ts`: extracted shared Instagram and Facebook credential helpers and added native carousel routing when `assetType === 'Carousel'` with at least two `mediaUrls`
  - Instagram now publishes carousels through the multi-container Graph API flow, Facebook stages up to 20 photos and publishes a multi-photo feed post via `attached_media`
  - LinkedIn now falls back to the first carousel image and returns a limitation note in `error`, while Bluesky uploads up to four blobs and publishes them through `app.bsky.embed.images`
  - Verified with `npm run typecheck` after each task and a final `npm test` pass
- Status: Complete
