# Content Hub — Dev Log

## 2026-07-01 - Add Excel backup workflow to standalone Gantt planner

- Tool: Codex
- Branch: main
- Changes:
  - Added Excel backup controls to `public/gantt-planner.html`, including an Excel-readable `.xls` export, matching import path, and a downloadable workbook template link.
  - Added `public/gantt-planner-storage.xlsx` as a usable Excel planning workbook with editable `Campaigns` and `Organisation` source sheets, type dropdowns, human-readable dates, a formula-driven `Timeline` sheet, and concise instructions.
  - Kept JSON/CSV import and export unchanged while making the Excel backup round trip restore campaign and organisation rows from the standalone tool.
- Verification:
  - Expected-failing static contract check before implementation
  - `npx prettier --check public/gantt-planner.html`
  - Static Node contract check for Excel controls and workbook template
  - Artifact-tool workbook import, rendered previews for all sheets, compact timeline formula check, and date-format visual check
  - Playwright browser check for Excel export, clear, import, template link, and mobile no-overflow layout
  - `npm run build`
- Status: Complete

## 2026-07-01 - Extract standalone Gantt planner HTML

- Tool: Codex
- Branch: main
- Changes:
  - Added `public/gantt-planner.html` as a self-contained yearly Gantt planning tool that can be opened directly or served as a static file without the Content Hub React app, Supabase, or external CDNs.
  - Mirrored the Content Hub year-planning surface with separate `Comms campaigns` and `Organisation` lanes, month headers, fixed row labels, date-spanning colour bars, year navigation, add/edit/delete modals, and hover details.
  - Removed the mistakenly extracted `public/kanban-planner.html` artifact and kept the standalone Gantt data in its own localStorage key, with JSON/CSV import/export.
- Verification:
  - `npx prettier --check public/gantt-planner.html`
  - Static Node HTML contract check for heading, campaign/event controls, lanes, persistence marker, and removal of the mistaken Kanban file
  - JSDOM workflow check for rendering both lanes, month headers, adding a campaign, and localStorage persistence
  - Chrome browser workflow check using local Google Chrome at desktop and mobile widths, including add and edit flows
  - `npm run build`
- Status: Complete

## 2026-07-16 - Audit scheduled-publishing integrity

- Tool: Codex
- Branch: `feature/social-docs-2026-refresh`
- Changes:
  - Added `COMPREHENSIVE_APP_REVIEW.md` as the first bounded checkpoint of the requested whole-application audit, covering the scheduled-publishing path and duplicate/missed-publication risk.
  - Documented 10 evidence-backed findings: 1 Critical, 7 High, and 2 Medium, including the unauthenticated privileged publish boundary, absent scheduler, non-idempotent external side effects, misleading partial-success state, OAuth state weakness, and media/platform contract gaps.
  - Performed read-only hosted Supabase checks. The initial standalone Content Hub project check was later superseded by the runtime shared Intel Hub project check recorded below; no hosted data or configuration was changed.
  - Made no application code, dependency, migration, deployment configuration, secret, or production-data changes.
- Verification:
  - `npm run typecheck`
  - Targeted ESLint for the publishing path and `useEntries.ts`
  - `npm test -- src/features/publishing/__tests__/publishUtils.test.ts src/hooks/domain/__tests__/useEntries.test.ts` (2 files, 28 tests passed)
  - `npm run build`
  - `deno check --node-modules-dir=auto` for `publish-entry`, `oauth-callback`, and `platform-connections`
  - `npm audit --omit=dev --json` (one moderate transitive `dompurify` advisory group)
  - `npx supabase db lint --local` (environment-blocked because local Postgres was not running)
  - Hosted SQL schema/RLS check (environment-blocked because the initially inspected database was inactive)
- Status: Complete

## 2026-07-16 - Plan publishing-integrity remediation

- Tool: Codex
- Branch: `feature/social-docs-2026-refresh`
- Changes:
  - Added `plans/publishing-integrity-remediation.md`, turning the bounded publishing audit into four larger tracer-bullet implementation phases approved by Dan.
  - Defined durable decisions for owner authorisation, server-derived approved content, publication jobs/results, idempotency, UTC scheduling, Storage-backed media, OAuth state, provider resilience and future ownership boundaries.
  - Included pre-implementation production gates, 68 acceptance/readiness checks, validation and rollback requirements, suggested commit boundaries, indicative effort, and traceability for PUB-001 through PUB-010.
  - Kept immediate containment of the Critical publication boundary as the first Phase 1 checkpoint and made durable idempotency a prerequisite for scheduled execution.
- Verification:
  - `npx prettier --write plans/publishing-integrity-remediation.md`
  - Confirmed all four phase headings are present
  - Confirmed PUB-001 through PUB-010 are represented in plan traceability
- Status: Complete

## 2026-07-16 - Contain unauthenticated social publishing

- Tool: Codex
- Branch: `feature/social-docs-2026-refresh`
- Changes:
  - Implemented the first Phase 1 containment checkpoint for PUB-001 without deploying or changing production data.
  - Added a fail-closed Edge authorisation helper that validates the Supabase bearer token with Auth and permits only the canonical Content Hub owner before any service-role or social-platform access.
  - Updated `publish-entry` to require that owner check, removed its optional browser-supplied webhook-secret gate, and enabled gateway JWT verification in repository configuration as defence in depth.
  - Updated the browser publication request to send the current Supabase access token and publishable key; signed-out publication now fails before calling the Edge Function.
  - Added five Edge authorisation tests and a browser-hook regression test for authenticated and signed-out requests.
  - Corrected the review/plan deployment target: runtime configuration uses the shared Intel Hub Supabase project. A read-only check confirmed its deployed `publish-entry` v1 remains active with `verify_jwt=false` and no user check; deployment of this fix is still pending.
- Verification:
  - `npm run typecheck`
  - `npx eslint src/hooks/domain/useEntries.ts src/hooks/domain/__tests__/useEntries.test.ts src/lib/supabase.ts`
  - `npm test -- src/hooks/domain/__tests__/useEntries.test.ts src/features/publishing/__tests__/publishUtils.test.ts` (2 files, 29 tests passed)
  - `deno test supabase/functions/_shared/ownerAuth.test.ts` (5 tests passed)
  - `deno lint supabase/functions/_shared/ownerAuth.ts supabase/functions/_shared/ownerAuth.test.ts`
  - `deno check --node-modules-dir=auto supabase/functions/publish-entry/index.ts`
  - `npm run build`
  - Full `npm test`: 257 passed, 1 unrelated date-sensitive `UpcomingPeaksWidget` test failed because its fixed peak ended on 14 July 2026
  - Full publisher Deno lint remains blocked by pre-existing inline-import, unused-variable and `require-await` findings outside this checkpoint
- Status: Local implementation complete; production deployment pending review

## 2026-07-16 - Source publication content from approved database entries

- Tool: Codex
- Branch: `feature/social-docs-2026-refresh`
- Changes:
  - Implemented the next bounded Phase 1 publishing-integrity checkpoint without deploying or changing production data.
  - Reduced the authenticated browser request to an entry ID; caption, platforms, media and other publication fields are no longer accepted from the browser.
  - Added a server-side authoritative entry lookup which rejects missing, soft-deleted, unapproved and platform-less entries before platform credentials or provider adapters are accessed.
  - Added a tested database-to-publisher mapper, filtered inline data URLs, hid database lookup details from clients and removed the browser-controlled callback contract and outbound callback side effect.
  - Recorded that exact-revision approval, idempotent durable jobs, provider capability validation, OAuth state hardening and production deployment remain future checkpoints.
- Verification:
  - `deno test supabase/functions/_shared/publishableEntry.test.ts supabase/functions/_shared/ownerAuth.test.ts` (11 tests passed)
  - `deno lint supabase/functions/_shared/publishableEntry.ts supabase/functions/_shared/publishableEntry.test.ts supabase/functions/_shared/ownerAuth.ts supabase/functions/_shared/ownerAuth.test.ts`
  - `deno check --node-modules-dir=auto supabase/functions/publish-entry/index.ts`
  - `npm run typecheck`
  - `npx eslint src/hooks/domain/useEntries.ts src/hooks/domain/__tests__/useEntries.test.ts src/lib/supabase.ts`
  - `npm test -- src/hooks/domain/__tests__/useEntries.test.ts src/features/publishing/__tests__/publishUtils.test.ts` (2 files, 29 tests passed)
  - `npm run build`
  - `git diff --check`
- Status: Local implementation complete; production deployment pending review and database reactivation

## 2026-07-16 - Enforce truthful publication capabilities

- Tool: Codex
- Branch: `feature/social-docs-2026-refresh`
- Changes:
  - Implemented the next bounded Phase 1 publishing-integrity checkpoint without deploying or changing production data.
  - Added a single capability matrix shared by the React publishing controls and Edge validation, while retaining the server as the authoritative enforcement point.
  - Allowed only implemented text, design and carousel paths across BlueSky, Instagram, Facebook and LinkedIn; blocked Video, YouTube, LinkedIn carousel downgrades and text-only Instagram publication.
  - Required HTTPS media, at least two distinct carousel images and exact platform limits of four BlueSky, ten Instagram and twenty Facebook images before platform credentials or provider adapters are accessed.
  - Removed the YouTube publisher stub, made BlueSky design publishing fail before posting when image loading/upload fails, and added a defensive LinkedIn carousel rejection.
  - Updated the UI to hide Publish and Retry for unsupported approved entries and explain why direct publication is unavailable.
  - Left MIME, size, public-fetchability, private-network protection, exact-revision approval and durable idempotent jobs for later gated checkpoints.
- Verification:
  - `npm run typecheck`
  - Targeted ESLint for publishing actions, utilities, hook and tests
  - `npm test -- src/features/publishing/__tests__/PublishActions.test.tsx src/features/publishing/__tests__/publishUtils.test.ts src/hooks/domain/__tests__/useEntries.test.ts` (3 files, 36 tests passed)
  - `deno test supabase/functions/_shared/publishCapabilities.test.ts supabase/functions/_shared/publishableEntry.test.ts supabase/functions/_shared/ownerAuth.test.ts` (18 tests passed)
  - Targeted Deno lint for the three shared publishing contracts and tests
  - `deno check --node-modules-dir=auto supabase/functions/publish-entry/index.ts`
  - `npm run build`
  - `git diff --check`
- Status: Local implementation complete; production deployment pending review and database reactivation

## 2026-07-16 - Make planning dates and publishing controls truthful

- Tool: Codex
- Branch: `feature/social-docs-2026-refresh`
- Changes:
  - Implemented the next bounded Phase 1 publishing-integrity checkpoint without deploying or changing production data.
  - Removed the dormant Zapier publishing panel, Auto-publish toggle, optional browser-secret field, `no-cors` webhook sender, payload builder, settings type, unused hook dependency and exports.
  - Added a one-time cleanup which removes previously persisted `pm-publish-settings` browser data, including any obsolete webhook secret.
  - Changed user-facing calendar-date language from scheduled to planned across entry creation/editing, calendar summaries, previews, pipeline labels, approval pages, notifications and approval emails.
  - Removed the unused `scheduledDate`, campaign, content-pillar and links fields from the internal Edge publisher payload so a planning date cannot be mistaken for an executable schedule.
  - Retained the platform-connections interface because it backs the authenticated, server-authoritative manual publishing path.
  - Applied the existing internal Content Hub design context: direct, calm wording for a small expert team, without adding replacement settings or decorative UI.
- Verification:
  - `npm run typecheck`
  - Targeted ESLint across the changed publishing, entry, calendar, email, hook and model files
  - `npm test -- src/hooks/domain/__tests__/usePublishing.test.ts src/hooks/domain/__tests__/useEntries.test.ts src/features/publishing/__tests__/publishUtils.test.ts src/features/publishing/__tests__/PublishActions.test.tsx src/lib/email.test.ts src/lib/sanitizers.test.ts src/lib/performance.test.ts src/constants.test.ts` (8 files, 44 tests passed)
  - `deno test supabase/functions/_shared/publishCapabilities.test.ts supabase/functions/_shared/publishableEntry.test.ts supabase/functions/_shared/ownerAuth.test.ts` (18 tests passed)
  - Targeted Deno lint for shared publication contracts and tests
  - `deno check --node-modules-dir=auto supabase/functions/publish-entry/index.ts`
  - `npm run build`
  - `git diff --check`
- Status: Local implementation complete; production deployment pending review and database reactivation

## 2026-07-17 - Contain publication after stale approval

- Tool: Codex
- Branch: `feature/social-docs-2026-refresh`
- Changes:
  - Implemented the next bounded Phase 1 publishing-integrity checkpoint without deploying, changing production data or editing migrations.
  - Added a shared browser/Edge approval-freshness contract. Missing or invalid approval timestamps and entries updated materially after approval now fail closed before platform connections or provider adapters are accessed.
  - Allowed a five-second timestamp window for the existing database `updated_at` trigger to follow the approval write; documented that a monotonic content revision remains the durable exact-binding solution.
  - Added publication-field change detection for platforms, asset type, captions and media. Editing those fields now clears `approvedAt`, returns the entry to Ready for Review and persists the revocation alongside the edit.
  - Hid Publish and Retry for stale approvals and gave the owner an explicit re-approval message using the same freshness contract as the Edge boundary.
  - Preserved functional local-state merging and added a regression test for rapid successive partial edits after the implementation review caught a possible lost-update regression.
- Verification:
  - `npm run typecheck`
  - `npm run lint`
  - Targeted frontend tests for publishing actions, publishing utilities, entry updates and sanitizers (4 files, 41 tests passed)
  - Shared Edge contract tests for approval freshness, authoritative entries, capabilities and owner authentication (21 tests passed)
  - Targeted Deno lint and `deno check --node-modules-dir=auto supabase/functions/publish-entry/index.ts`
  - `npm run build`
  - `git diff --check`
  - Full frontend test suite: 268 passed; one pre-existing date-sensitive `UpcomingPeaksWidget` fixture failed because its fixed July 2026 peak is no longer upcoming
- Status: Local containment complete; exact revision binding and production deployment remain pending the approved database/rollout flow

## 2026-07-17 - Secure OAuth connection state and redirects

- Tool: Codex
- Branch: `feature/social-docs-2026-refresh`
- Changes:
  - Implemented the remaining local Phase 1 OAuth integrity checkpoint without deploying, changing production data or editing migrations.
  - Replaced browser-generated base64 identity/platform/redirect state with an owner-authenticated `begin-oauth` server action and enabled repository gateway JWT verification for `platform-connections`.
  - Added a ten-minute, 256-bit opaque state contract stored under a SHA-256-derived key in the existing service-only `app_secrets` table. The callback atomically deletes the state before provider token exchange, making replay fail closed.
  - Bound state to the canonical owner and selected platform, fixed callback and success URLs from server configuration, rejected tampered/expired/wrong-owner state and removed the unsupported YouTube callback path.
  - Restricted browser navigation to exact Meta and LinkedIn HTTPS authorisation endpoints; success messages now require the exact same-origin popup source instead of wildcard `postMessage`.
  - Removed unused OAuth identifiers and URL construction from the frontend build and sanitised callback, provider and database failures so credentials, codes and upstream response bodies are not returned.
  - Removed the inherited Meta configuration-ID fallback so every OAuth provider now fails closed when its server-side public configuration is incomplete.
  - Updated platform documentation and the publishing-integrity plan with the local acceptance evidence and deployment prerequisites.
- Verification:
  - `npm run typecheck`
  - `npm run lint`
  - Targeted frontend publishing tests (5 files, 44 tests passed)
  - Shared OAuth, owner, approval and capability Edge contract tests (29 tests passed)
  - Targeted ESLint and Deno lint
  - Deno checks for `platform-connections`, `oauth-callback` and `publish-entry`
  - `npm run build`
  - `git diff --check`
  - Full frontend test suite: 265 passed; one pre-existing date-sensitive `UpcomingPeaksWidget` fixture failed because its fixed July 2026 peak is no longer upcoming
- Status: Local implementation complete; coordinated deployment and test-account smoke testing remain pending

## 2026-07-17 - Secure and clarify manual publication results

- Tool: Codex
- Branch: `feature/social-docs-2026-refresh`
- Changes:
  - Implemented the next bounded Phase 1 publishing-integrity checkpoint without deploying, changing production data or editing migrations.
  - Added a shared result boundary which replaces provider bodies and exception text with fixed public errors before storage or return, restricts published links to exact provider locations and omits provider post IDs from browser responses.
  - Removed raw response-body handling from the browser and mapped transport failures to fixed status-based copy, including an actionable sign-in message for expired sessions.
  - Required a confirmed platform publication before the Edge response reports success and moved an entry to Published only when every selected platform confirms publication.
  - Made partial results explicit, automatically displayed per-platform details and blocked another direct attempt which could duplicate an already successful post.
  - Added truthful complete, partial and failed messaging which distinguishes the current entry-level record from a durable publication job.
- Verification:
  - Targeted frontend publication tests (3 files, 44 tests passed)
  - All shared OAuth, publication-result, capability, authoritative-entry and owner Edge contract tests (33 tests passed)
  - `npm run typecheck`
  - `npm run lint`
  - `deno check --node-modules-dir=auto supabase/functions/publish-entry/index.ts`
  - Targeted Deno lint, Prettier check and `git diff --check`
  - `npm run build`
  - Full frontend test suite: 273 passed; one pre-existing date-sensitive `UpcomingPeaksWidget` fixture failed because its fixed July 2026 peak is no longer upcoming
- Status: Local result-integrity containment complete; durable jobs, unknown outcomes and production smoke testing remain pending

## 2026-07-17 - Bind approval to exact content revisions

- Tool: Codex
- Branch: `feature/social-docs-2026-refresh`
- Changes:
  - Implemented the remaining local Phase 1 approval-integrity checkpoint without contacting or changing the hosted Supabase project.
  - Generated a migration through the Supabase CLI which adds database-owned `content_revision` and `approved_revision` columns, constraints and a trigger for the provider-facing entry fields.
  - Made content edits increment once, ignore client revision values, clear approval and return previously Approved, Scheduled or Published entries to review.
  - Bound only real approval transitions or new approval timestamps, preserved the approved revision after publication and deliberately left legacy approvals unbound until re-approval.
  - Replaced the timestamp-skew heuristic in the shared browser/Edge publication guard with exact revision equality and wired the fields through application types, mapping, sanitisation and optimistic state.
  - Added reusable SQL invariants covering legacy approval, re-approval, hostile revision values, content-edit revocation, insertion and publication retention.
  - Rotated the 76 March–June dev-log entries into monthly archives while retaining the 12 July entries in the project log.
- Verification:
  - `npm run typecheck`
  - `npm run lint`
  - Targeted frontend approval and publishing tests (4 files, 51 tests passed)
  - Full frontend test suite: 275 passed; one pre-existing date-sensitive `UpcomingPeaksWidget` fixture failed because its fixed July 2026 peak is no longer upcoming
  - All shared Edge contract tests (33 tests passed), including 10 authoritative-entry and revision tests
  - Deno checks for `publish-entry` and `approve-entry`, plus targeted Deno lint
  - Migration and trigger invariant SQL passed on clean disposable Postgres 17
  - Full local Supabase replay progressed through earlier migrations but remains blocked before this migration by the pre-existing invalid `CREATE POLICY IF NOT EXISTS` syntax in `20260318_org_events.sql`
  - Prettier check and `git diff --check`
  - `npm run build`
  - Dev-log rotation count: 88 entries before and after rotation
- Status: Local exact revision binding complete; hosted schema reconciliation, coordinated deployment and legacy-entry re-approval remain pending

## 2026-07-17 - Add durable publication schema primitives

- Tool: Codex
- Branch: `feature/social-docs-2026-refresh`
- Changes:
  - Implemented the first larger Phase 2 publishing-integrity checkpoint locally without changing the hosted Supabase project or switching real provider calls onto the new path.
  - Generated an additive migration through the Supabase CLI for durable publication jobs and per-platform results, including lifecycle and outcome constraints, request-key idempotency, indexes and exact approved-entry revision validation.
  - Added service-only database functions which atomically create or replay an intent, claim each platform once and complete only claimed results while deriving failed, partial, published or unknown aggregate state.
  - Added owner-only RLS and column-level browser grants. Approved payload snapshots, requester email and provider post IDs remain server-only, while browser roles cannot mutate durable state or execute orchestration functions.
  - Removed arbitrary stored error text from the completion contract; the database now derives fixed messages from allowlisted error classifications.
  - Added shared durable publication TypeScript contracts and a focused four-entity publication data reference after the configured data-reference analyser was unavailable.
  - Documented that these are additive schema primitives only. The current provider path remains unchanged until hosted reconciliation, generated-type validation, Storage-backed media preflight and Edge fault tests are complete.
- Verification:
  - Durable revision/job migrations and reusable publication invariants passed together on clean Postgres 17
  - Two simultaneous database sessions raced for one pending platform result: one claim succeeded and one was rejected
  - Invariants cover idempotent replay, conflicting keys, mismatched payload platforms, result matrices, unknown outcomes, fixed stored errors, RLS visibility and service-only mutation privileges
  - `npm run typecheck`
  - `npm run lint`
  - All shared Edge contract tests (33 tests passed)
  - Deno check and targeted Deno lint
  - `npm run build`
  - Prettier check and `git diff --check`
  - Full frontend test suite: 275 passed; one pre-existing date-sensitive `UpcomingPeaksWidget` fixture failed because its fixed July 2026 peak is no longer upcoming
- Status: Local durable schema primitives complete; Edge integration, generated database types, durable media preflight and hosted rollout remain pending

## 2026-07-17 - Add publication media preflight and orchestration kernel

- Tool: Codex
- Branch: `feature/social-docs-2026-refresh`
- Changes:
  - Implemented the next local Phase 2 prerequisite checkpoint without changing the hosted schema, credentials or provider accounts and without switching the runtime handler to durable job execution.
  - Removed new persisted base64 fallback from the shared create/edit preview uploader, derived object extensions from allowlisted MIME types and added explicit image, planning-video and PDF size limits.
  - Added browser truthfulness checks which require direct-publication images to use the exact public `content-media` origin and reject external hosts, credentials, signed query strings, fragments and malformed object paths.
  - Added Edge media preflight before platform-credential lookup with exact Storage origin/path checks, manual redirect handling, bounded byte-range reads, a 10 MB maximum, image MIME allowlisting, magic-byte validation and a five-second timeout.
  - Added a dependency-injected durable orchestration kernel which preflights before job creation, claims before provider execution, applies platform captions and uses both an abort signal and a hard provider timeout.
  - Made post-claim timeouts, ignored aborts and unexpected adapter exceptions conservative Unknown results; database failures before a claim reach no provider, while completion persistence failure cannot report false durable success.
  - Kept the kernel staged rather than dead-switching the current providers before their repository and abort-aware adapter integration is complete.
- Verification:
  - New media preflight and orchestration suites: 14 tests passed
  - Targeted upload and publishing UI suites: 22 tests passed
  - All shared Edge contract tests: 47 tests passed
  - `npm run typecheck`
  - `npm run lint`
  - Deno check and targeted Deno lint
  - `npm run build`
  - Prettier and `git diff --check`
  - Full frontend test suite: 279 passed; one pre-existing date-sensitive `UpcomingPeaksWidget` fixture failed because its fixed July 2026 peak is no longer upcoming
- Status: Local media safety and orchestration prerequisites complete; RPC/provider integration, stale-claim recovery, durable browser reads and hosted rollout remain pending

## 2026-07-17 - Complete durable publication runtime and recovery

- Tool: Codex
- Branch: `feature/social-docs-2026-refresh`
- Changes:
  - Switched the local `publish-entry` runtime to the service-only durable repository and orchestration kernel without changing the hosted schema, credentials or provider accounts.
  - Resolved owner/request-key replays before mutable approval and media validation, added one guarded intent per owner/entry/revision and serialised claim, completion and recovery with a parent-before-child lock order.
  - Added service-only stale recovery, fixed Unknown outcomes for ambiguous provider mutations and browser transport failures, and owner-scoped durable hydration with same-key reconciliation after reload.
  - Kept local-storage projections fail closed until authenticated durable hydration, and blocked blind retry after Partial, Published or Unknown outcomes while allowing a corrected retry after a completely Failed job.
  - Removed silent caption truncation, rejected first comments until they can be tracked durably, pinned Meta calls to Graph API `v24.0` and moved LinkedIn to the versioned `202607` Images and Posts APIs with exact upload-host validation.
  - Added a repeatable multi-session PostgreSQL race test for guarded creation, duplicate claim, sibling completion and completion-versus-recovery; the expected losing creation session must report the guarded-intent constraint by name.
  - Completed four fresh adversarial-review rounds. All 14 material findings were addressed across concurrency, recovery triggering, provider failure classification, transport ambiguity, omitted content, replay identity, hydration and test precision.
- Verification:
  - Approval-revision, durable-job and stale-recovery SQL invariants passed on disposable PostgreSQL 17.
  - Multi-session PostgreSQL concurrency suite passed with actual overlapping transactions.
  - All shared Edge contract tests passed (57 tests), plus Deno checks and lint for the publication and OAuth boundaries.
  - Targeted durable publishing/browser tests passed, including rejected transport, malformed JSON, replay identity, pre-hydration fail-closed state and durable Unknown recovery.
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
  - `git diff --check`
  - Full frontend suite: 294 passed; one pre-existing date-sensitive `UpcomingPeaksWidget` fixture failed because its fixed July 2026 peak is no longer upcoming.
- Status: Local durable manual-publication checkpoint complete; hosted schema reconciliation, generated database types, coordinated deployment, provider test-account smoke tests and targeted per-platform retry remain pending

## 2026-07-17 - Add safe targeted publication retry

- Tool: Codex
- Branch: `feature/social-docs-2026-refresh`
- Changes:
  - Added a service-only database transition for retrying one definitive Failed platform on its existing Partial manual-publication job; Published, Skipped and Unknown siblings are never reset.
  - Bound the retry claim to the authenticated owner, immutable approved payload snapshot and exact current approved entry revision in one database transaction.
  - Retained every durable per-attempt request key so in-flight, definitively failed, published and very-late HTTP replays return the existing job without another provider call; a later deliberate retry of a definitive failure receives a new key.
  - Added an owner-authenticated `retry_failed` Edge action which returns a confirmed replay without another provider call and rejects unsafe, stale or uncertain outcomes with fixed public copy.
  - Integrated the durable publication panel into the entry modal and exposed Retry only beside an eligible failed platform. Confirmed siblings remain visible and are not reposted.
  - Made browser recovery fail closed: if a dispatched retry cannot be reconciled to the same job and revision, only the selected platform becomes Unknown and further retry is disabled.
  - Kept retry state as a projection of durable job rows and removed entry-table writes from retry reconciliation, preventing an older browser snapshot from overwriting concurrent content edits.
  - Updated the focused data reference, platform documentation and publishing-integrity plan. The configured data-reference analyser was unavailable, so the schema, migrations, shared types, runtime repository and documentation were cross-checked manually.
- Verification:
  - Targeted publishing UI, utility and hook suites passed (62 tests), including preservation of an in-flight concurrent content edit.
  - All shared Edge contract tests passed (60 tests), including current and historical retry-key replay and Unknown refusal.
  - Deno checks passed for the publication Edge boundary, orchestration and repository.
  - Targeted retry SQL invariants passed on disposable PostgreSQL 17, covering atomic claim, preserved Published siblings, current and delayed historical replay, wrong-owner rejection, stale approval and Unknown refusal.
  - `npm run typecheck`
  - Targeted ESLint, Deno lint, Prettier and `git diff --check`
  - `npm run build`
  - Full frontend suite: 300 passed; one pre-existing date-sensitive `UpcomingPeaksWidget` fixture failed because its fixed July 2026 peak is no longer upcoming.
  - Three fresh adversarial-review rounds completed. The first found and prompted fixes for a split approval/claim race, stale entry writes and missing retry-intent idempotency; both subsequent rounds returned nitpicks-only with no material findings.
- Status: Local targeted retry complete; hosted schema reconciliation, generated database types, coordinated deployment and provider test-account smoke tests remain pending

## 2026-07-18 - Add fail-closed publication rollout gate

- Tool: Codex
- Branch: `feature/social-docs-2026-refresh`
- Changes:
  - Added a service-only `durable-manual-v1` database marker and an authenticated `publish-entry` readiness response which returns unavailable until the matching schema is present.
  - Added `npm run check:publication-backend` and wired it into the production Pages workflow so the frontend cannot deploy against a missing, legacy or mismatched publication backend.
  - Made the gate use the same public Supabase configuration resolver as the build. This fixed a review finding where checking the unnormalised deployment secret could approve the standalone project while the built application targeted the shared project. A security-best-practices pass then pinned the canonical production origin and required the exact two-field readiness response.
  - Removed the obsolete direct-post script, which used the legacy browser-authored payload and could reach real providers outside the durable test-account flow.
  - Added an attended rollout and rollback runbook and refreshed the focused platform and data references. The configured documentation analysers were unavailable, so the runtime target, hosted Edge metadata, migrations, application contracts and workflow were cross-checked manually.
  - Reconfirmed read-only that the configured shared Intel Hub project is inactive and retains unauthenticated legacy `publish-entry` version 1. The separate standalone Content Hub project is also inactive with legacy version 13 and is not the runtime target. No hosted state or provider account was changed.
- Verification:
  - Publication backend gate tests passed (6 tests), including canonical-target enforcement, exact contract matching, unavailable/malformed responses and build-target resolution.
  - Publication SQL invariants passed on disposable PostgreSQL 17, including the service-only contract marker and targeted-retry constraints.
  - All shared Edge contract tests passed (60 tests); Deno check and targeted Deno lint passed for `publish-entry`.
  - `npm run typecheck`, `npm run lint`, `npm run build` and `git diff --check` passed.
  - Full frontend suite: 306 passed; one pre-existing date-sensitive `UpcomingPeaksWidget` fixture failed because its fixed July 2026 peak is no longer upcoming.
  - `npm audit --audit-level=critical` exited successfully but reported one high-severity Vite advisory and four moderate advisories; dependency remediation remains outside this publication version-skew checkpoint.
- Status: Local rollout gate complete and production frontend deployment intentionally blocked; attended shared-project restore, hosted schema reconciliation, secured Edge deployment, generated types and test-account smoke tests remain pending

## 2026-07-18 - Stabilise the upcoming-peaks widget test clock

- Tool: Codex
- Branch: `feature/social-docs-2026-refresh`
- Changes:
  - Froze the `UpcomingPeaksWidget` test clock within its suite so the July 2026 fixture exercises live/upcoming filtering consistently instead of expiring as wall-clock time advances.
  - Restored real timers after each test and left production date filtering unchanged.
- Verification:
  - Focused `UpcomingPeaksWidget` suite passed (1 test).
  - Full frontend suite passed (40 files, 307 tests).
  - `npm run typecheck`
  - `npm run lint`
  - Targeted ESLint and Prettier checks passed.
  - `git diff --check`
- Status: The date-sensitive release-verification failure is resolved; the frontend suite is fully green

## 2026-07-18 - Patch the high-severity Vite advisory

- Tool: Codex
- Branch: `feature/social-docs-2026-refresh`
- Changes:
  - Updated the existing Vite override from 7.3.2 to the patched 7.3.6 release without changing the Vitest major line or unrelated application dependencies.
  - Refreshed only the matching Vite lockfile record and verified a clean npm install resolves both Vitest and `@vitest/mocker` to Vite 7.3.6.
  - Kept this checkpoint limited to the high-severity Windows development-server path advisory; the two remaining moderate transitive package findings are recorded for a separate review.
- Verification:
  - `npm ci --ignore-scripts`
  - `npm ls vite --all` resolves one overridden Vite 7.3.6 installation.
  - `npm audit --audit-level=high` passed with zero high or critical findings; two moderate transitive findings remain.
  - Full frontend suite passed (40 files, 307 tests) under Vitest 4.1.8.
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
  - `git diff --check`
- Status: The high-severity build-tool advisory is resolved; DOMPurify and JS-YAML moderate advisories remain for separate bounded checkpoints

## 2026-07-18 - Patch the DOMPurify advisory in the PDF stack

- Tool: Codex
- Branch: `feature/social-docs-2026-refresh`
- Changes:
  - Added an exact DOMPurify 3.4.12 override for the jsPDF dependency, replacing vulnerable 3.4.7 without changing the jsPDF or reporting APIs.
  - Refreshed only the matching DOMPurify lockfile record and verified the production bundle uses the patched sanitiser chunk.
  - Kept the checkpoint limited to the DOMPurify configuration-pollution and sanitisation-bypass advisories; JS-YAML remains a separate build-tool concern.
- Verification:
  - `npm ci --ignore-scripts`
  - `npm ls dompurify --all` resolves jsPDF to overridden DOMPurify 3.4.12.
  - DOMPurify is absent from `npm audit`; one moderate JS-YAML advisory remains.
  - Reporting and sanitisation suites passed (4 files, 12 tests).
  - Full frontend suite passed (40 files, 307 tests).
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
  - `git diff --check`
- Status: The bundled DOMPurify advisory is resolved; the moderate JS-YAML advisory remains for its own bounded checkpoint

## 2026-07-18 - Patch the JS-YAML build-tool advisory

- Tool: Codex
- Branch: `feature/social-docs-2026-refresh`
- Changes:
  - Added an exact JS-YAML 4.2.0 override for ESLint's configuration dependency, replacing vulnerable 4.1.1 while remaining within the existing supported 4.x range.
  - Refreshed only the matching JS-YAML lockfile record and retained the existing Vite and DOMPurify security overrides.
  - Kept the dependency build-time only; application runtime behaviour and public bundle inputs were unchanged.
- Verification:
  - `npm ci --ignore-scripts`
  - `npm ls js-yaml --all` resolves ESLint to overridden JS-YAML 4.2.0.
  - `npm audit` reports zero vulnerabilities across 469 audited packages.
  - Full frontend suite passed (40 files, 307 tests).
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
  - Targeted Prettier and `git diff --check` passed.
- Status: All npm audit findings identified by the deployment checklist are resolved

## 2026-07-18 - Consolidate branches for the live rollout

- Tool: Codex
- Branch: `codex/content-hub-live`
- Changes:
  - Audited every local and remote branch, worktree and pull request before changing repository references.
  - Preserved all 20 historical local branches, both existing stashes and the complete dirty worktree in the verified bundle `/Users/dan/dev/population_matters/content-hub-pre-consolidation-20260718.bundle`.
  - Expanded the repository's previously `main`-only fetch mapping, audited all 28 hidden stale GitHub branches, and preserved every remote ref in `/Users/dan/dev/population_matters/content-hub-all-branches-pre-cleanup-20260718.bundle` before deletion.
  - Renamed the active reviewed branch from `feature/social-docs-2026-refresh` to the canonical `codex/content-hub-live` branch.
  - Pruned one stale worktree record and removed the backed-up historical local and GitHub branch pointers, leaving only `main` and `codex/content-hub-live` locally and remotely.
  - Kept the unmerged audience-simulation prototype and obsolete social-publishing implementation out of the forward branch; both remain recoverable from the bundle.
  - Closed stale pull request #6 after confirming its reporting, visual-integrity and strategy-alignment work had been superseded by later work already present in the repository.
  - Excluded generated TDD-guard path metadata from the consolidated source changes.
  - Made the public runtime-config generator apply the repository's canonical Prettier format, preventing build and commit hooks from leaving a formatting-only dirty worktree.
- Verification:
  - `git bundle verify` confirmed complete history, remote-ref and recoverable stash state in both backup bundles.
  - `git branch -vv` shows only `main` and `codex/content-hub-live`.
  - `git worktree list` shows one valid worktree on the canonical branch.
  - Two consecutive production builds left the generated public config unchanged.
  - GitHub reports no stale open pull requests and only `main` plus the published canonical rollout branch.
- Status: Branch history is consolidated and losslessly backed up; the canonical branch is published and ready for review
