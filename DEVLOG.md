# Content Hub — Dev Log

## 2026-07-23 - Stage the governed saved-report canary

- Tool: Codex (production guard active; deterministic Hermes MCP path)
- Branch: `codex/pm-hermes-content-hub`
- Changes:
  - Reauthorised the Supabase CLI against the PM account after the previously active account could not access the canonical shared project, then confirmed `oepehanwmfelowfumkes` remained the linked target.
  - Reconciled the Reporting store and selected June 2026, the app's default previous month, as a truthful no-data canary because its bounded snapshot contains no published posts or recorded organic analytics and no June monthly report exists.
  - Advanced both proposal allowlists to `create_report`, kept local and Edge execution disabled, and staged inert action `3cc5a3b3-8fcd-405d-a72f-b9badb53eb9d`.
- Verification:
  - The proposal hash prefix is `9374f046fee7`; the Edge action is `proposed`, the local receipt is `awaiting_exact_approval`, and no `monthly_reports` record was created.
  - The proposal uses the inclusive 1–30 June 2026 `content_hub_entries` snapshot, which is untruncated and records `no_recent_posts` with zero posts and zero analysed posts for all five supported platforms.
  - No manual metric or evidence reference was supplied. Both layers expose only `create_report`, and both execution switches remain false.
- Status: Execute the saved-report canary only when Dan's newest direct message is exactly `execute 3cc5a3b3-8fcd-405d-a72f-b9badb53eb9d` before `2026-07-23T17:26:16.833+00:00`.

## 2026-07-21 - Execute the governed review-submission canary

- Tool: Codex (production guard active; deterministic Hermes MCP path)
- Branch: `codex/pm-hermes-content-hub`
- Changes:
  - Received Dan's exact approval, opened execution only for `submit_for_review`, applied that action once and immediately returned both execution switches to false.
- Verification:
  - The proposal hash prefix is `d4c6dbcfb1e1`; the Edge action is `applied`, the local receipt is `executed`, and both execution switches are false after reconciliation.
  - Entry `1edb47ba-aab8-4425-a01d-a9177026d307` is In Review/Pending at content revision 2, with its timestamp advanced to `2026-07-21T12:26:25.934125+00:00` and action `c68cabb2-2986-486d-85fd-c488806ea46a` recorded as PM Hermes provenance.
  - The allowlisted transaction cleared approval metadata and stopped before approval, scheduling or publication authority.
- Status: The attended `submit_for_review` canary passed. Reporting write classes remain disabled pending their separate rollout canaries.

## 2026-07-21 - Stage the governed review-submission canary

- Tool: Codex (production guard active; deterministic Hermes MCP path)
- Branch: `codex/pm-hermes-content-hub`
- Changes:
  - Reconciled the completed `add_comment` action and advanced both proposal allowlists to `submit_for_review` while keeping local and Edge execution disabled.
  - Staged revision- and timestamp-bound action `c68cabb2-2986-486d-85fd-c488806ea46a` to move Draft `1edb47ba-aab8-4425-a01d-a9177026d307` only into human review.
- Verification:
  - The proposal hash prefix is `d4c6dbcfb1e1`; the Edge action is `proposed`, the local receipt is `awaiting_exact_approval`, and the action has no application result.
  - The target remains Pending/Draft at content revision 2 with the unchanged timestamp `2026-07-21T11:40:37.900296+00:00`.
  - Both layers expose only `submit_for_review`, both execution switches are false, and pull request 29's checks pass for the completed comment canary commit.
  - If executed, the allowlisted transaction can set only In Review/Pending, clears approval metadata and cannot approve, schedule or publish the entry.
- Status: Execute the review-submission canary only when Dan's newest direct message is exactly `execute c68cabb2-2986-486d-85fd-c488806ea46a` before its recorded expiry.

## 2026-07-21 - Execute the governed comment canary

- Tool: Codex (production guard active; deterministic Hermes MCP path)
- Branch: `codex/pm-hermes-content-hub`
- Changes:
  - Reconciled the completed `create_idea` action and advanced both proposal allowlists to `add_comment` while keeping local and Edge execution disabled.
  - Staged timestamp-bound action `ceb1adb4-27bf-4e69-a143-80f5c38368fd` to add one internal-only PM Hermes canary comment to Draft `1edb47ba-aab8-4425-a01d-a9177026d307`.
  - Kept the action unconsumed and both gates false when the Supabase CLI twice rejected the remote gate update for insufficient project privileges; re-authenticated against the account that exposes the linked canonical project before proceeding.
  - Received Dan's exact approval, opened execution only for `add_comment`, applied that action once and immediately returned both execution switches to false.
- Verification:
  - The proposal hash prefix is `f79a7e4e2a6e`; the Edge action is `applied`, the local receipt is `executed`, and both execution switches are false after reconciliation.
  - Comment record `a129d723-69a6-42ce-934f-e741e5745a6f` records action `ceb1adb4-27bf-4e69-a143-80f5c38368fd` as its PM Hermes provenance.
  - The target remains Pending/Draft at content revision 2, with its timestamp advanced to `2026-07-21T11:40:37.900296+00:00`; pull request 29's checks pass for the completed Ideas canary commit.
- Status: The attended `add_comment` canary passed. `submit_for_review` and all reporting write classes remain disabled pending their separate rollout canaries.

## 2026-07-21 - Execute the governed Ideas workflow canary

- Tool: Codex (production guard active; deterministic Hermes MCP path)
- Branch: `codex/pm-hermes-content-hub`
- Changes:
  - Reconciled the completed `update_entry` action and advanced both proposal allowlists to `create_idea` while keeping local and Edge execution disabled.
  - Staged inert action `572de5c8-fb92-4d5c-b007-c29457485375` to create an internal-only Ideas workflow canary with no links or publication intent.
  - Received Dan's exact approval, opened execution only for `create_idea`, applied that action once and immediately returned both execution switches to false.
  - Fixed the non-cryptographic UUID fallback so its documented minimum length is deterministic, after the commit gate exposed a random 19-character result; added an explicit fallback regression test.
- Verification:
  - The proposal hash prefix is `5521bafb2f95`; the Edge action is `applied`, the local receipt is `executed`, and both execution switches are false after reconciliation.
  - Ideas record `6f833f0f-190e-461a-a4f1-d53fb446c7ea` has the expected internal canary title and records action `572de5c8-fb92-4d5c-b007-c29457485375` as its PM Hermes provenance.
  - Pull request 29's lint/type-check, test, security and supply-chain checks all pass for the preceding update canary commit.
  - The focused utility suite passes 29 tests; the full application suite passes 309 tests, with strict lint and TypeScript checks clean.
- Status: The attended `create_idea` canary passed. `add_comment`, `submit_for_review` and all reporting write classes remain disabled pending their separate rollout canaries.

## 2026-07-21 - Execute the precision-fixed update canary

- Tool: Codex (production guard active; deterministic Hermes MCP path)
- Branch: `codex/pm-hermes-content-hub`
- Changes:
  - Received exact approval for update action `a8645c0a-eb2c-4549-938b-4f8ca6dc661d` after its two-hour local approval window had expired. Kept both execution switches false and did not call the executor.
  - Re-read the canary Draft's authoritative revision 1 and microsecond-precision `updated_at`, then staged fresh inert action `65876a12-5362-4dc7-9c17-1af4817bdf29` for the same caption-only update.
  - Received Dan's exact approval for the fresh action, opened execution only for `update_entry`, applied it once and immediately returned both execution switches to false.
  - Remediated newly published high-severity audit advisories in development tooling by updating the `js-yaml` override to 4.3.0 and resolving patched `brace-expansion` and ESLint transitive versions.
- Verification:
  - The expired Edge action remains unexecuted. The fresh Edge action is `applied`, its local receipt is `executed`, and both local writes and Edge execution are false after reconciliation.
  - Entry `1edb47ba-aab8-4425-a01d-a9177026d307` remains Pending/Draft, advanced to content revision 2 and records action `65876a12-5362-4dc7-9c17-1af4817bdf29` as its PM Hermes provenance.
  - Production dependencies were already clean; the complete dependency audit now reports zero vulnerabilities.
- Status: The attended `update_entry` canary passed without granting approval, scheduling or publication authority. Other write classes remain disabled pending their separate rollout canaries.

## 2026-07-20 - Fail the update canary safely and preserve timestamp precision

- Tool: Codex (production guard active; deterministic Hermes MCP path)
- Branch: `codex/pm-hermes-content-hub`
- Changes:
  - Accepted Dan's exact approval for update action `9034488c-fa0f-4051-aea9-26b3df5b397b`, opened execution only for `update_entry`, received the authoritative `conflict` result and immediately returned both execution switches to false.
  - Confirmed the Draft remained unchanged. The conflict exposed that `isoTimestamp(...)` re-serialised PostgreSQL microseconds through JavaScript `Date`, truncating the proposal token to milliseconds before the executor's exact equality check.
  - Changed the action validator to retain the validated timestamp string, added a microsecond-precision regression test and deployed only `content-hub-agent` version 18 with gateway JWT verification still false and HMAC authentication unchanged.
  - Staged fresh inert update action `a8645c0a-eb2c-4549-938b-4f8ca6dc661d` against the exact unchanged revision and timestamp.
- Verification:
  - The failed local receipt and Edge action are both terminal `failed`; the Draft remains revision 1, Draft/Pending, with the original create-action provenance.
  - All eight focused action tests and the deployed Edge type-check pass. The live function is Active, proposal-only, and execution is disabled.
  - The replacement proposal is `proposed` / `awaiting_exact_approval` and changed no application record.
- Status: The conflict/stale canary passed safely and the precision defect is fixed live. Execute the replacement only when Dan's newest direct message is exactly `execute a8645c0a-eb2c-4549-938b-4f8ca6dc661d`.

## 2026-07-20 - Refresh the expired PM Hermes update canary

- Tool: Codex (production guard active; deterministic Hermes MCP path)
- Branch: `codex/pm-hermes-content-hub`
- Changes:
  - Received exact approval for update action `8de02761-1c7e-4c7e-9817-344fd9b96ae3` after its local approval receipt had expired. Kept both execution switches false and did not transfer that approval or call the execution tool.
  - Re-read the canary Draft's authoritative revision binding and created a fresh inert `update_entry` proposal, `9034488c-fa0f-4051-aea9-26b3df5b397b`, for the same caption-only change.
  - Used the deterministic MCP client because the Hermes language-model provider reported a temporary quota limit; no approval boundary was bypassed.
- Verification:
  - The Draft remains at content revision 1 with unchanged `updated_at`, and the fresh action is `proposed` / `awaiting_exact_approval` with no application result.
  - Local writes and Edge execution remain disabled throughout. No Content Hub application record changed.
- Status: Execute the refreshed update only when Dan's newest direct message is exactly `execute 9034488c-fa0f-4051-aea9-26b3df5b397b`.

## 2026-07-20 - Keep the completed create canary replay-safe

- Tool: Codex (production guard active)
- Branch: `codex/pm-hermes-content-hub`
- Changes:
  - Received the already-consumed exact command for create action `dbdcc1bb-980b-4be6-9119-a4ba9f5d7227` a second time.
  - Kept both execution switches false and performed only a read-only reconciliation; the execution tool was not called again and no production record changed.
- Verification:
  - The local receipt remains `executed`, the Edge action remains `applied`, and both still resolve to the original Draft entry `1edb47ba-aab8-4425-a01d-a9177026d307`.
  - The local write switch and Edge execution switch are false. The separately staged update action remains `8de02761-1c7e-4c7e-9817-344fd9b96ae3`.
- Status: Completed create action safely treated as already consumed; no duplicate entry or update was created.

## 2026-07-20 - Execute the first PM Hermes write canary and stage an update

- Tool: Codex (full-access production session with production guard active)
- Branch: `codex/pm-hermes-content-hub`
- Changes:
  - Accepted Dan's exact `execute dbdcc1bb-980b-4be6-9119-a4ba9f5d7227` message, opened execution only for `create_entry`, atomically applied that action once and immediately returned both local and Edge execution switches to false.
  - Created one Pending/Draft Content Hub entry, `1edb47ba-aab8-4425-a01d-a9177026d307`, with PM Hermes provenance bound to the approved action. No approval, scheduling or publication state was granted.
  - Advanced the proposal allowlist from `create_entry` to `update_entry` with execution still disabled. Staged revision-bound action `8de02761-1c7e-4c7e-9817-344fd9b96ae3` to update only the canary caption.
- Verification:
  - The local receipt is `executed`, the authoritative Edge action is `applied`, the campaign contains exactly one entry, and the record is `Draft` / `Pending` at content revision 1 with matching PM Hermes action provenance.
  - Reconciliation confirmed both execution switches are false after the write window. The Edge reports proposal-only mode.
  - The update proposal left the canary's content revision and `updated_at` unchanged and has no application result.
- Status: The `create_entry` canary passed. Execute the revision-bound update only when Dan's newest direct message is exactly `execute 8de02761-1c7e-4c7e-9817-344fd9b96ae3`; all other write classes remain disabled.

## 2026-07-20 - Activate governed PM Hermes reads and stage the first write canary

- Tool: Codex (full-access production session with production guard active)
- Branch: `codex/pm-hermes-content-hub`
- Changes:
  - Provisioned the Hermes MCP environment hand-off without exposing credential values, enabled signed reads on the canonical `oepehanwmfelowfumkes` backend and kept proposal/execution emergency stops closed during authentication tests.
  - Corrected the Hermes HMAC client to sign the `/content-hub-agent` path verified after Supabase Edge gateway rewriting, with a focused regression assertion.
  - Applied only the reviewed `add_pm_hermes_agent_actions` and `lock_down_entry_review_reads` migrations through an isolated migration workspace. Browser roles remain excluded from both agent ledgers and anonymous entry reads now expose zero rows.
  - Enabled proposal-only access for `create_entry` at the local and Edge boundaries while keeping execution disabled. Staged action `dbdcc1bb-980b-4be6-9119-a4ba9f5d7227`; its campaign matched zero entries before and after proposal creation.
- Verification:
  - Live negative probes passed for method restriction, body limit, invalid signature, expired timestamp, operation allowlisting, nonce replay and the 60-request per-minute limit.
  - Hermes live health, bounded entry list/detail, calendar, reporting, saved-report and publication-status reads passed. Reporting retained null analytics coverage when no measurements were available.
  - Signed review returned 200 only for a valid token with the bounded projection; missing, expired and tampered tokens returned 400 before and after lockdown. A known entry returned zero rows to the anonymous REST role after lockdown.
  - The live GitHub Pages app loaded in Brave. That browser profile was signed out, so an authenticated UI read was not claimed from the browser session.
  - All 10 PM Hermes Python tests passed after the signing correction.
- Status: Reads and reporting are live. Proposal-only `create_entry` is live, but application writes remain disabled. Execute the canary only when Dan's newest direct message is exactly `execute dbdcc1bb-980b-4be6-9119-a4ba9f5d7227`; otherwise no Draft will be created. Pull request 29 remains draft and unmerged.

## 2026-07-20 - Begin the PM Hermes production backend rollout

- Tool: Codex (`prod` profile for live changes; production guard active)
- Branch: `codex/pm-hermes-content-hub`
- Changes:
  - Verified `oepehanwmfelowfumkes` as the active, healthy shared Intel Hub Supabase backend and preserved the inactive standalone Content Hub project.
  - Applied the additive `add_pm_hermes_agent_requests` migration and deployed the reviewed signed-review and disabled agent boundaries as `approve-entry` v2, `send-notification` v6 and `content-hub-agent` v1.
  - Kept pull request 29 unmerged. No PM Hermes credential, read switch, proposal switch, write switch, anonymous-entry RLS policy, action ledger or application record was changed.
- Verification:
  - The request ledger has RLS enabled, no browser policies or DML grants, service-role-only DML, and a service-role-only security-definer claim RPC with a pinned search path.
  - All deployed source files match the reviewed branch byte-for-byte with the intended gateway JWT settings.
  - The 26 focused Deno contract tests, three Edge type checks and signed review-boundary contract passed; Hermes still discovers all 18 tools and the local wrapper reports no runtime credentials with proposals and writes disabled.
- Status: Rollout paused safely before credential provisioning. The Supabase CLI remains unauthenticated, outbound shell DNS and the isolated browser are unavailable for live probes, and the active Codex profile changed to `daily`; resume in `prod` through an authenticated production secret workflow, then continue from the signed negative probes. Do not apply the review RLS lockdown or merge pull request 29 yet.

## 2026-07-20 - Revalidate the PM Hermes production rollout checkpoint

- Tool: Codex (`prod` profile with production guard active)
- Branch: `codex/pm-hermes-content-hub`
- Changes:
  - Reconciled the local Supabase link with the approved canonical project `oepehanwmfelowfumkes` and did not merge pull request 29.
  - Rechecked the rollout runbook, current data reference and focused RLS boundaries for `entries`, `agent_requests` and `agent_actions`; no production migration, function, secret, feature switch or application record was changed.
  - Refreshed the PM Hermes control-plane and tool-availability reports. The wrapper still fails closed with all 18 tools discoverable, no runtime configuration, and proposal/write switches disabled.
- Verification:
  - All 308 Vitest tests, 26 Deno contract tests, 10 PM Hermes Python tests, TypeScript checking, strict lint, the production build, focused PR formatting, the signed review-boundary contract, Ruff and `git diff --check` passed.
  - Deno checks passed for `content-hub-agent`, `approve-entry` and `send-notification` with automatic npm dependency resolution.
  - PM Hermes control-plane validation, security scan, tool hygiene and Hermes Doctor passed with zero findings.
  - The live npm advisory query was unavailable because the sandbox could not resolve the npm registry; the unchanged lockfile last passed with zero vulnerabilities on 19 July.
- Status: Production rollout remains safely blocked before the first migration because Supabase MCP requires OAuth and the CLI has no access token in this sandbox. Re-authenticate the Supabase MCP from an attended terminal, then resume at `add_pm_hermes_agent_requests`; do not merge pull request 29 until the full backend-readiness sequence passes.

## 2026-07-19 - Align the Hermes release candidate with CI formatting

- Tool: Codex
- Branch: `codex/pm-hermes-content-hub`
- Changes:
  - Applied the two indentation-only changes required by the lockfile-pinned Prettier 3.6.2 formatter in `useEntries.ts`.
  - Reinstalled dependencies from the lockfile so local commit hooks and GitHub Actions use the same formatter version.
- Verification:
  - Full-repository Prettier checking, TypeScript checking, strict ESLint and `git diff --check` passed.
- Status: Formatter-only CI repair complete with no behavioural or production change

## 2026-07-19 - Verify the PM Hermes production rollout boundary

- Tool: Codex
- Branch: `codex/pm-hermes-content-hub`
- Changes:
  - Reconciled the local Supabase link against the canonical shared Intel Hub target without reading `.env*` or reporting secret values.
  - Confirmed the existing durable publication backend remains healthy and the new `content-hub-agent` function is not yet hosted, preserving the intended pre-rollout baseline.
  - Kept the production guard active throughout the preflight; no migration, function, runtime secret, feature switch, GitHub Pages deployment or application record was changed.
- Verification:
  - All 308 Vitest tests, 86 Deno tests, 10 PM Hermes Python tests, TypeScript checking, strict lint, Ruff, Edge checks, the production build, review-boundary contract, dependency audit and `git diff --check` passed.
  - The three agent migrations and their RLS, replay, idempotency, conflict and provenance invariants passed in isolated PostgreSQL 17.
  - The Content Hub MCP server discovered all 18 tools. PM Hermes control-plane, tool-availability, pre-handoff, security, tool-hygiene and Doctor checks passed; the integration correctly reports unavailable while runtime values are absent.
- Status: Release candidate verified and production-disabled. The current Supabase CLI identity lacks the privileges required to inspect or mutate the canonical linked project, so attended production rollout remains blocked until the production profile and authorised Supabase organisation access are active

## 2026-07-19 - Implement approval-gated PM Hermes Content Hub writes

- Tool: Codex
- Branch: `codex/pm-hermes-content-hub`
- Changes:
  - Added the service-only `agent_actions` proposal/execution ledger, immutable PM Hermes provenance and a transactional executor for idea/Draft creation, eligible entry updates, comments, Draft-to-review submission and canonical `monthly_reports` create/update.
  - Added strict allowlisted payload validation, PM language checks, exact payload hashes and idempotency keys, proposal expiry, stale entry/report rejection, one-time local approval receipts and the exact `execute <action-id>` confirmation boundary.
  - Expanded the local MCP server from nine read tools to 18 read/governed tools. Local and Edge proposal/execution switches remain independently false by default, with no action types enabled.
  - Made report proposals derive metrics from bounded Content Hub analytics, retain coverage and evidence references, require named sources for manual figures and query campaign reports by the exact campaign. Live reporting also supports bounded campaign, content-pillar and asset-type filters.
  - Added safe JSONB comment mapping and strictly sanitised provenance labels/timeline context in the entry UI. Updated the implementation plan, data reference, platform documentation and attended rollout/rollback runbook.
- Verification:
  - Strict lint, TypeScript checking, the production build, all 308 Vitest tests, the signed review-boundary test and `git diff --check` passed.
  - All 86 Deno tests and the Edge Function check passed; all 10 app-local Python integration/approval tests and Ruff passed.
  - The generated action migration and its RLS/idempotency/conflict/provenance invariants passed in an isolated PostgreSQL 17 container.
  - `hermes mcp test content-hub` discovered 18 tools. PM Hermes control-plane validation, pre-handoff validation, security scan, tool hygiene and Doctor passed with no findings; `npm audit --omit=dev` found no vulnerabilities.
  - The configured data/platform analyser was unavailable, so both references were reconciled manually against the migration, Edge contract and application types.
- Residual check: the pre-existing standalone `npm run test:copy-check` command does not load its JSON rule import under the installed Node 25 runtime; the normal Vitest suite and production bundler cover that module successfully.
- Status: Local Phase 2 implementation complete and production-disabled; no migration, function, runtime secret, proposal flag or write flag was applied to production

## 2026-07-19 - Implement the PM Hermes read and reporting foundation

- Tool: Codex
- Branch: `codex/pm-hermes-content-hub`
- Changes:
  - Added the fail-closed `content-hub-agent-v1` Edge boundary with HMAC authentication, bounded request streaming, timestamp validation, replay protection, per-client throttling, safe result classes and fixed read projections for entries, calendar summaries, organic reporting, saved reports and publication status.
  - Added a service-only `agent_requests` ledger and a separately deployable anonymous-review-policy lockdown migration, generated through the Supabase CLI so production rollout can verify signed review reads before removing the old policy.
  - Replaced guessable public review reads with recipient-specific signed links and a fixed `approve-entry` projection. New tokens contain a keyed recipient identifier rather than a readable email address; legacy signed tokens remain verifiable during transition.
  - Added a nine-tool read-only PM Hermes MCP client, safe readiness CLI, reporting snapshot compatibility path, control-plane registration and an attended rollout/rotation/rollback runbook.
  - Kept `monthly_reports` as the first canonical saved-report source, made missing analytics distinct from measured zero, removed stored error text from agent publication responses and treated all returned content as untrusted application data.
  - Kept every create, update, delete, approval, publication, retry, raw database and administrative capability out of this checkpoint.
- Verification:
  - `npm run typecheck`, strict lint, all 307 Vitest tests, review-boundary contract, production build and `git diff --check` passed.
  - Fourteen Deno tests and Deno checks for the agent, approval and notification Edge functions passed.
  - Four app-local Python client tests and three migrated Hermes snapshot-wrapper tests passed; `hermes mcp test content-hub` discovered exactly nine read-only tools.
  - PM Hermes control-plane validation passed with zero findings. The tool probe remains correctly unavailable until production runtime values are provisioned.
  - `npm audit --omit=dev` reported zero vulnerabilities, the PM Hermes security scan reported zero findings and Hermes Doctor completed successfully.
  - Both new migrations and `agent_request_invariants.sql` passed in an isolated PostgreSQL container. The full local Supabase stack remains blocked earlier by the pre-existing `20260318_org_events.sql` `CREATE POLICY IF NOT EXISTS` syntax and that historical migration was not changed.
- Status: Local Phase 1 foundation complete and production-disabled; production migration/function rollout and Phase 2 approval-gated writes remain pending

## 2026-07-19 - Add reporting to the PM Hermes integration plan

- Tool: Codex
- Branch: `main`
- Changes:
  - Made live reporting analysis and saved-report creation/update required PM Hermes outcomes.
  - Added bounded reporting queries, period comparisons, coverage disclosure, evidence references, and exact approval-gated report writes.
  - Selected `monthly_reports` as the initial agent write target because it backs the currently rendered Reporting and Insights screens; prohibited dual writes to the unused `reporting_periods` workspace model.
  - Added report-specific conflict checks, create/update canaries, missing-data handling, observability, risks, and completion criteria.
- Verification:
  - Inspected the rendered Reporting and Insights flows, both report models, reporting calculations, metric registry, persistence services, and current organic reporting contract.
  - Revalidated plan structure, permissions, rollout gates, and completion definition against the reporting requirement.
- Status: Complete

## 2026-07-19 - Make PM Hermes writing and updating a required outcome

- Tool: Codex
- Branch: `main`
- Changes:
  - Revised `plans/pm-hermes-content-hub-integration.md` so live Content Hub creation and updates are mandatory Phase 2 deliverables rather than an optional future capability.
  - Defined the initial write scope: ideas, drafts, eligible entry fields, comments, and submission for human review, with authoritative read-after-write results.
  - Added separate create and update production canaries and made both required for completion.
  - Retained exact one-time approval for each mutation and kept approval, publication, deletion, administration, arbitrary database access, and edits to Approved or Published records blocked.
- Verification:
  - Rechecked the current platform catalogue for Content Hub create/edit capabilities.
  - Revalidated plan acceptance criteria, rollout gates, and completion definition against the clarified write/update requirement.
- Status: Complete

## 2026-07-18 - Plan PM Hermes Agent integration

- Tool: Codex
- Branch: `main`
- Changes:
  - Added `plans/pm-hermes-content-hub-integration.md`, defining three larger vertical phases for secure read access, approval-gated content preparation, and production hardening.
  - Selected a PM-owned local MCP wrapper and versioned Edge API instead of browser automation, raw Supabase access, or direct provider access.
  - Made removal of the existing anonymous `entries` read dependency a Phase 1 prerequisite and preserved human-only approval and publication as hard boundaries.
  - Defined HMAC request authentication, replay protection, bounded projections, exact one-time action approvals, revision-safe idempotency, provenance, rollout, rollback, and acceptance tests.
- Verification:
  - Cross-checked the plan against the current Content Hub application, platform documentation, production architecture, PM Hermes capability registries, approval policy, plugin runbook, and existing organic reporting wrapper.
  - Markdown formatting and structural checks recorded with the plan.
- Status: Complete

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

## 2026-07-18 - Make rollout CI self-contained

- Tool: Codex
- Branch: `codex/content-hub-live`
- Changes:
  - Vendored the current rights-framing rule registry into Content Hub and changed the copy checker to import the tracked snapshot instead of a file outside the repository.
  - Removed the obsolete Cloudflare Pages staging workflow so GitHub Pages is the single deployment path.
- Verification:
  - The tracked rules registry is valid JSON and byte-for-byte identical to the shared source snapshot.
  - Focused copy-check suite passed (1 file, 13 tests).
  - Full frontend suite passed (40 files, 307 tests).
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
  - `npm audit` reports zero vulnerabilities.
  - `git diff --check`
  - GitHub Actions passed tests, lint and type-check, dependency security, and the supply-chain IOC scan.
- Status: Local and GitHub verification passed

## 2026-07-18 - Initialise the production Supabase publication backend

- Tool: Codex
- Branch: `codex/content-hub-live`
- Changes:
  - Restored only the intended shared Intel Hub Supabase project and applied the reviewed approval-revision plus durable-publication migrations in dependency order.
  - Aligned the five local publication migration filenames with their hosted migration versions so future migration tooling sees one history.
  - Deployed `publish-entry` version 2 and `platform-connections` version 5 with gateway JWT verification enabled.
  - Deployed the matching one-time-state `oauth-callback`, signed `approve-entry`, and read-only `platform-summary` functions with their intentional public gateway settings.
  - Recorded those intentional public gateway settings in the repository's Supabase configuration so future CLI deployments preserve the hosted contract.
  - Corrected platform-summary action URLs so they retain the canonical `/content-hub/` GitHub Pages path.
  - Refreshed the Deno lockfile's npm overrides to match the already-reviewed Vite, DOMPurify and JS-YAML security pins.
  - Preserved existing entries and provider connection records; legacy approvals remain deliberately unbound from a content revision until explicitly re-approved.
- Verification:
  - `npm run check:publication-backend` returned `durable-manual-v1` against the production project.
  - Supabase reports RLS enabled on both durable tables, service-only orchestration privileges, and zero error-level security adviser findings.
  - Hosted TypeScript type generation includes `publication_jobs` and `publication_results`.
  - Unauthenticated `publish-entry` and `platform-connections` requests return 401; an OAuth callback without state and an approval request without a signed token return 400.
  - The live platform summary returns the canonical status and `/content-hub/` action URLs.
  - Deno checks passed for all five deployed Content Hub Edge Functions after correcting the platform-summary query type.
  - Full frontend suite passed (40 files, 307 tests), followed by typecheck, lint, build, Prettier and `git diff --check`.
- Status: Production backend initialisation complete; frontend merge and GitHub Pages smoke verification remain

## 2026-07-18 - Enable production content-media storage

- Tool: Codex
- Branch: `main`
- Changes:
  - Added and applied the recorded `initialise_content_media_storage` migration to the intended shared Supabase project.
  - Created the public `content-media` bucket with the reviewed 500 MB ceiling and image, video and PDF MIME families.
  - Added authenticated insert and delete policies scoped to that bucket.
  - Enabled Content Hub file uploads in the GitHub Pages production build after the existing durable-backend gate.
- Verification:
  - Confirmed the hosted bucket settings and both exact Storage RLS policies through read-only metadata queries.
  - `npm run test:content-media` confirmed the public bucket contract; authenticated upload/delete probing remains intentionally skipped until approved test credentials are supplied.
- Status: Storage initialisation complete; production Pages redeployment and live config smoke verification remain
