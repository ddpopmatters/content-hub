# Plan: Publishing Integrity Remediation

> Source review: [`COMPREHENSIVE_APP_REVIEW.md`](../COMPREHENSIVE_APP_REVIEW.md), scheduled-publishing integrity checkpoint dated 16 July 2026.

## Plan status

- **Approved shape:** four larger vertical phases
- **Primary objective:** make manual and scheduled social publication secure, idempotent, observable and truthful
- **Current rating:** publishing path is not production-ready
- **Findings covered:** PUB-001 to PUB-010
- **Implementation constraint:** use the approved Supabase migration workflow; do not edit existing migrations or change production data without a verified backup and rollout plan

This plan covers only the publishing-integrity review. It does not certify or remediate the deferred whole-application audit areas such as reporting accuracy, complete authentication, broad accessibility, performance or privacy.

## Implementation progress

### 16 July 2026 — Phase 1 immediate containment checkpoint

- [x] Confirmed the runtime configuration targets the shared Intel Hub Supabase project.
- [x] Confirmed read-only that the deployed `publish-entry` v1 is active with `verify_jwt=false` and no in-function user check.
- [x] Added a fail-closed canonical-owner check before service-role or social-platform access.
- [x] Updated the browser request to send the current Supabase access token and publishable key.
- [x] Set repository function configuration to require gateway JWT verification as defence in depth.
- [x] Added owner, non-owner, invalid-session, missing-session and missing-configuration tests.
- [ ] Deploy the secured function and frontend to the shared project after review.
- [x] Complete the local Phase 1 revision-bound approval work through the Supabase CLI migration flow.

### 16 July 2026 — Phase 1 server-authoritative entry checkpoint

- [x] Reduced the browser publication request to the authenticated entry ID only.
- [x] Added an authoritative server lookup for publishable entry fields before any platform-connection query.
- [x] Rejected missing, soft-deleted and currently unapproved entries before any provider call.
- [x] Built caption, platform and media inputs exclusively from the current database row.
- [x] Removed the browser-controlled callback destination and outbound callback side effect from the Edge contract.
- [x] Added negative workflow-state, lookup-failure and authoritative-mapping regression tests.
- [x] Add content revisions so approval is bound to the exact publishable revision.
- [ ] Deploy this checkpoint only after the shared project database and rollback gates are available.

### 16 July 2026 — Phase 1 publication capability checkpoint

- [x] Added one fail-closed capability matrix shared by the browser and Edge boundary.
- [x] Allowed only implemented text, image and carousel combinations for BlueSky, Instagram, Facebook and LinkedIn.
- [x] Blocked Video, YouTube direct publishing, LinkedIn carousel downgrades and unsupported text-only Instagram posts.
- [x] Required complete HTTPS media and enforced per-platform carousel limits before connection or provider access.
- [x] Removed the YouTube publisher stub and made BlueSky image publication fail before posting when its image cannot be loaded or uploaded.
- [x] Hid Publish and Retry actions for unsupported approved entries and displayed the server-aligned reason.
- [ ] Add server-side media MIME, size, public-fetchability and private-network checks during durable job preflight.
- [ ] Deploy this checkpoint only after the shared project database and rollback gates are available.

### 16 July 2026 — Phase 1 planning-date truthfulness checkpoint

- [x] Removed the dormant Zapier webhook, browser-secret and Auto-publish settings panel.
- [x] Removed its unused browser payload builder, `no-cors` sender, settings type, exports and `useEntries` dependency.
- [x] Added a one-time browser cleanup for previously persisted `pm-publish-settings` data.
- [x] Described entry dates as planned dates across creation, editing, calendar summaries, previews, approval pages and approval emails.
- [x] Removed unused planning-date and campaign metadata from the internal Edge publisher payload.
- [x] Kept platform connection management visible because it supports the secured manual publishing path.
- [ ] Introduce scheduling controls only with the durable idempotent job model in Phase 4.
- [ ] Deploy this checkpoint only after the shared project database and rollback gates are available.

### 17 July 2026 — Phase 1 approval-freshness containment checkpoint

- [x] Defined the exact entry fields currently sent to social providers and made edits to those fields clear approval and return the entry to Ready for Review.
- [x] Persisted approval revocation with the content edit while retaining functional local-state merging for rapid successive edits.
- [x] Added one shared browser/Edge containment contract which initially rejected missing, invalid or materially stale approval timestamps before connection or provider access.
- [x] Added truthful UI messaging for entries which require approval again and hid Publish and Retry until that happens.
- [x] Added regression coverage for content-edit revocation, stale timestamps, database-trigger clock skew and rapid partial edits.
- [x] Replaced timestamp containment with monotonic `content_revision` and `approved_revision` fields through the Supabase CLI migration flow.
- [ ] Deploy this checkpoint only after the shared project database and rollback gates are available.

### 17 July 2026 — Phase 1 exact approval-revision checkpoint

- [x] Generated the migration with `supabase migration new`; no migration history was overwritten and no hosted schema was changed.
- [x] Added a database-owned trigger which increments once when provider-facing fields change, ignores client revision values and revokes approval before the update is stored.
- [x] Bound approval only on an actual approval transition or new approval timestamp, retained the bound revision after publication and left pre-migration approvals unbound until explicit re-approval.
- [x] Replaced the five-second timestamp heuristic in the shared browser/Edge guard with exact positive-integer revision equality.
- [x] Added application mapping, sanitisation and optimistic UI revision handling without sending revision values back in browser database writes.
- [x] Added reusable SQL invariants and validated the new migration on clean Postgres 17; the repository-wide local Supabase replay remains blocked earlier by the pre-existing invalid `CREATE POLICY IF NOT EXISTS` statement in `20260318_org_events.sql`.
- [ ] Inventory and reconcile the hosted `entries` schema before applying the migration, deploy the revision-requiring Edge boundary before the migration so any version skew fails closed, then deploy the frontend and require re-approval of legacy approved entries.

### 17 July 2026 — Phase 1 OAuth integrity checkpoint

- [x] Replaced browser-generated identity, platform and redirect state with an authenticated owner-only initiation action.
- [x] Added a 256-bit opaque nonce stored under a SHA-256-derived key in the existing service-only secrets table, with a ten-minute expiry and best-effort expired-state cleanup.
- [x] Made callback consumption atomic and one-time before any provider token exchange or connection write.
- [x] Bound stored state to the canonical owner and selected platform, and derived the callback and success destinations exclusively from server configuration.
- [x] Rejected malformed, tampered, expired, replayed and wrong-owner state with one sanitised error contract.
- [x] Restricted browser navigation to exact Meta or LinkedIn HTTPS authorisation endpoints and accepted success messages only from the exact same-origin popup window.
- [x] Removed OAuth identifiers and URL construction from the frontend bundle, removed the unsupported YouTube callback path and sanitised callback/provider failures.
- [ ] Deploy the initiation function, callback, frontend and gateway setting together after confirming server-side public OAuth identifiers and `APP_URL` on the shared project.

### 17 July 2026 — Phase 1 publication-result integrity checkpoint

- [x] Replaced provider response bodies, exception text and database messages with a fixed public error contract before results are stored or returned.
- [x] Restricted published links to exact platform origins and paths, removed query strings and fragments, and omitted provider post identifiers from the browser response.
- [x] Mapped browser transport failures by status without reading or persisting response bodies, including an actionable expired-session message.
- [x] Required at least one confirmed published result before the Edge response reports success.
- [x] Kept partially published entries Approved, blocked another direct attempt which could duplicate a successful platform post and displayed per-platform details automatically.
- [x] Added explicit complete, partial and failed outcome copy which states that the current entry-level record is not a queued or recoverable publication job.
- [x] Replace entry-level result authority with durable jobs, per-platform attempts and an explicit `unknown` outcome in Phase 2.
- [x] Add a targeted retry transition for only failed platforms after partial success; published, skipped and unknown results remain blocked.
- [ ] Deploy only with the rest of the reviewed Phase 1 boundary and complete a test-account success, rejection and ambiguous-failure smoke test.

### 17 July 2026 — Phase 2 durable schema checkpoint

- [x] Generated an additive migration through `supabase migration new`; no existing migration or hosted schema was changed.
- [x] Added durable publication job and per-platform result tables with lifecycle, outcome-shape, uniqueness and exact entry-revision constraints.
- [x] Added owner-only browser reads with column grants that exclude approved payload snapshots, requester email and provider post IDs; browser mutations and orchestration calls are denied.
- [x] Added service-only atomic functions to create or replay one request key, claim each pending platform once, complete a claimed result and derive failed, partial, published or unknown aggregate state.
- [x] Added reusable SQL invariants for replay, conflicting keys, mismatched payload platforms, one-time claims, failed-plus-skipped, partial success, unknown outcomes, fixed stored errors and browser permissions.
- [x] Ran a two-session claim race against clean Postgres 17; exactly one caller acquired the pending platform result.
- [x] Validated the revision and durable-job migrations together on clean Postgres 17.
- [ ] Generate and drift-check Supabase database types after the earlier repository migration replay blocker is reconciled.
- [x] Switch the local `publish-entry` runtime to the durable primitives after media preflight and fault-injection coverage; hosted activation remains pending.

### 17 July 2026 — Phase 2 media and orchestration prerequisite checkpoint

- [x] Removed new inline base64 fallback from the shared create/edit preview uploader while retaining explicit Storage-backed image, video and PDF planning formats.
- [x] Added synchronous browser truthfulness checks which require direct-publication media to use the exact public `content-media` origin and reject external or signed URLs.
- [x] Added server preflight before platform-credential lookup with exact origin/path validation, manual redirects, bounded range fetches, a 10 MB limit, image MIME allowlisting, magic-byte verification and timeout handling.
- [x] Added a dependency-injected durable orchestration kernel which preflights before job creation, claims before provider execution and reuses the database request-key contract.
- [x] Added simultaneous-call coverage proving one publisher invocation per platform, plus fault tests for media rejection, claim failure, provider timeout, ignored aborts, unexpected exceptions and completion persistence failure.
- [x] Made all post-claim exceptions conservative Unknown outcomes; completion failure cannot report a false durable success and leaves visible Publishing state for recovery.
- [x] Adapt the current provider functions and Supabase RPC repository to the kernel and replace entry-level browser authority with owner-scoped durable job reads.

### 17 July 2026 — Phase 2 durable runtime checkpoint

- [x] Resolve an existing owner/request key before mutable entry approval, capability or media checks so lost-response replay returns the original job.
- [x] Route new manual work through the service-only repository, atomic claims and abort-aware provider adapters; provider redirects and transient mutation responses fail to Unknown.
- [x] Serialise claim, concurrent platform completion and stale recovery with one parent-before-child lock order, verified with a true two-session completion race.
- [x] Prevent simultaneous active intents for one owner, entry and revision even when separate tabs generate different request keys; fully failed jobs release the guard for corrected retry.
- [x] Recover Publishing claims older than five minutes to Unknown and close abandoned queued work as Failed with fixed stored copy and service-only execution.
- [x] Rehydrate the latest owner-visible durable job and results on entry loads, reconcile queued or publishing jobs through same-key recovery using the server clock, project them into the existing UI and fail closed when durable reads are unavailable.
- [x] Mark local-storage projections unavailable before authenticated hydration so a legacy cached entry cannot expose Publish while durable state is still unknown.
- [x] Preserve Unknown as a first-class UI state which blocks automatic retry; a fully failed durable job clears its browser key for a deliberate corrected retry.
- [x] Reject over-limit platform captions before job creation and send approved captions unchanged, with no silent adapter truncation.
- [x] Reject non-empty first comments until that separate publication side effect can be represented and verified durably.
- [x] Pin Meta callback and publication calls to supported Graph API `v24.0`, and modernise LinkedIn image/post calls to the versioned `202607` APIs with exact upload-host validation.
- [x] Commit a repeatable multi-session PostgreSQL test for guarded creation, duplicate claim, sibling completion and completion-versus-recovery races.
- [x] Add targeted per-platform retry for failed results after a partial job without resetting confirmed or unknown siblings.
- [ ] Reconcile the hosted schema and generate drift-checked database types before rollout.

### 17 July 2026 — Phase 2 targeted retry checkpoint

- [x] Generated a service-only retry migration through the Supabase CLI and retained the existing durable job rather than creating a second publication intent.
- [x] Re-check the authenticated owner, exact current approval revision and immutable payload snapshot in the same transaction that claims provider execution.
- [x] Claim only one definitive Failed child on a Partial manual job; Published, Skipped and Unknown results remain non-claimable.
- [x] Bind the atomic retry claim to a durable request key so simultaneous calls and HTTP replays after Failed or Published completion make at most one provider call for that intent.
- [x] Added the per-platform retry control to the entry publication panel, with confirmed siblings preserved across success, failure and lost-response reconciliation.
- [x] Fail closed to Unknown for only the selected platform when the browser cannot reload the same durable job after dispatch.
- [x] Added orchestration, browser, UI and PostgreSQL invariant coverage for targeted retry, in-flight and completed replays, duplicate claims, wrong owners, stale approvals and unknown outcomes.

### 18 July 2026 — Fail-closed hosted rollout checkpoint

- [x] Reconfirmed that the production build resolves to the shared Intel Hub Supabase project and that the older standalone Content Hub project is not the runtime target.
- [x] Confirmed read-only that both projects are inactive and that the shared runtime project still exposes unauthenticated legacy `publish-entry` version 1 without the durable contract.
- [x] Added the service-only `durable-manual-v1` database marker and an authenticated Edge readiness response which remains unavailable until the matching schema exists.
- [x] Added a production preflight which uses the exact same Supabase configuration resolver as the build and blocks Pages deployment on target, availability or contract drift.
- [x] Removed the obsolete direct-post test script and documented the attended restore, schema inventory, Edge-first activation, migration, smoke-test and rollback order.
- [ ] Restore and inventory the shared runtime project during an attended maintenance window, reconcile schema/migration drift, deploy the secured Edge boundary and apply the reviewed migrations.
- [ ] Generate drift-checked database types and complete owner/non-owner plus provider test-account smoke tests before allowing the frontend through the gate.

## Outcomes

When this plan is complete:

- Only the authenticated application owner can publish or manage social connections.
- The server, not the browser, decides which approved content and platforms may be published.
- Repeated execution cannot create duplicate posts for the same publication intent.
- Per-platform outcomes survive reloads and distinguish published, partial, failed, skipped and unknown results.
- Scheduled posts have an exact UTC instant, an explicit display timezone and a monitored execution path.
- Unsupported platform/media combinations are rejected before any external side effect.
- Failed or ambiguous work is visible and recoverable without blindly reposting successful platforms.
- The implementation remains proportionate to a single-user internal tool while retaining clean ownership boundaries for later users.

## Non-goals

- Multi-tenant organisations, workspaces or enterprise role hierarchies.
- Microservices or a separate queueing platform.
- Automatic support for every media format on every social network.
- A rewrite of the Content Hub frontend or Supabase integration.
- Refactoring unrelated large files solely to improve code aesthetics.
- Migrating or exposing production credentials during development.

## Architectural decisions

These decisions apply across all four phases.

### Application and service boundary

- Keep one React application, Supabase Postgres, Supabase Storage and the existing Edge Function layer.
- Retain `/functions/v1/publish-entry` as the publication boundary, but require an authenticated owner for manual calls.
- Share publication orchestration between manual requests and the scheduled worker. Do not implement two independent publishing engines.
- Keep social platform adapters behind the orchestration boundary; platform-specific validation remains explicit.

### Authentication and authorisation

- The browser is untrusted and may request an action, but it may not authorise content, account credentials or workflow state.
- Every privileged Edge action validates the Supabase JWT and canonical owner before constructing or using a service-role client.
- The OAuth callback remains publicly reachable because providers require it, but it consumes a one-time, short-lived state bound to the initiating authenticated owner, platform and fixed return destination.
- `platform_connections` remains server-only. Token fields are never returned to the browser or written to application logs.

### Publication data model

- `entries.date` remains a planning-calendar date and is no longer treated as an executable schedule.
- Add a monotonic `content_revision` to an entry. Editing publishable content invalidates approval for the old revision or prevents an existing job from publishing it.
- A `publication_jobs` record represents one deliberate manual or scheduled publication intent across one or more platforms.
- A `publication_results` record represents the state of one platform within a job and is unique by job and platform.
- A job stores its trigger (`manual` or `scheduled`), approved content revision, optional `scheduled_at TIMESTAMPTZ`, actor, lifecycle timestamps and aggregate state.
- Platform results store status, provider post ID/URL where available, sanitised error code/message, attempt count and lifecycle timestamps.
- Job states are `queued`, `publishing`, `partial`, `published`, `failed`, `unknown` and `cancelled`.
- Platform states are `pending`, `publishing`, `published`, `failed`, `skipped` and `unknown`.

### Idempotency and concurrency

- Every publication request has a stable server-recognised request key. Replaying the same request returns the existing job rather than creating another post.
- One active scheduled job is permitted for an entry revision. Rescheduling updates or replaces that intent explicitly.
- Workers claim due work atomically. A lease may be recovered after a defined timeout, but recovery never republishes a result already recorded as published.
- A provider timeout after an uncertain side effect becomes `unknown`; it is not automatically retried until reconciled or explicitly resolved by the owner.

### Scheduling and timezones

- Store executable schedules as UTC instants in `TIMESTAMPTZ`.
- Display and edit times in an explicit timezone, initially `Europe/London`, and show the timezone beside the control.
- Use one Supabase-scheduled worker at a one-minute cadence. The worker invokes the same idempotent publication orchestration as manual publishing.
- Cancellation and rescheduling remain possible until the job has been claimed. Claimed jobs show their in-flight state rather than pretending cancellation succeeded.

### Media

- Use one Supabase Storage upload path for both create and edit flows.
- Persist object identity rather than base64 payloads. Generate appropriately lived signed URLs server-side for third-party ingestion when required.
- Validate MIME type, size, fetchability and platform capability before claiming a publication job.
- Keep Video publication blocked for a platform until that platform has a tested video adapter.

### Observability and privacy

- Persist publication lifecycle events and sanitised failures; never log access tokens, refresh tokens, app passwords, OAuth codes or signed media URLs.
- Alert only on actionable conditions: failed scheduled work, stale publishing leases and repeated connection-refresh failure.
- Use a lightweight owner-facing queue and a concise recovery runbook rather than enterprise monitoring infrastructure.

### Migration and deployment discipline

- Before the first schema change, reactivate the hosted database, take a backup and compare hosted schema/RLS/Storage state with local migrations.
- Apply only additive migrations until the replacement path has been verified with real data.
- Generate database types after every schema phase and fail CI on drift.
- Never roll back to an unauthenticated publication function. If a release fails, disable publishing while retaining the secured boundary.

---

## Pre-implementation gates

Complete these checks before Phase 1 changes reach production:

- [x] Confirm the hosted runtime project is the shared Intel Hub Supabase project.
- [ ] Reactivate the hosted Intel Hub database; it was reported inactive and read-only SQL timed out.
- [ ] Capture a read-only schema, RLS, Edge Function and Storage-bucket inventory.
- [ ] Confirm whether `PUBLISH_WEBHOOK_SECRET` is configured without reading or recording its value.
- [ ] Confirm current active platform connections and intended owner account without exposing token values.
- [ ] Confirm a recoverable database backup and document the restore command/process.
- [ ] Record the deployed Edge Function versions and a known-good frontend deployment for rollback.
- [ ] Decide whether direct publishing should remain temporarily disabled during Phase 1 rollout.
- [ ] Establish test or non-critical social accounts for smoke testing; do not use live campaign content for failure-path tests.

---

## Phase 1: Secure and truthful manual publishing

**Findings:** PUB-001, PUB-003 containment, PUB-007, PUB-008 containment

**User stories:**

- As the application owner, I can publish an approved supported post and know that no unauthenticated caller can trigger it.
- As the application owner, I cannot accidentally publish stale, unapproved or unsupported content.
- As the application owner, I can connect a social account without another browser session forging or replaying the connection state.
- As the application owner, the interface does not claim that a planning date will automatically publish.

### What to build

Deliver a secured end-to-end manual publication path. The browser sends its current access token and a minimal publication request. The Edge boundary validates the owner, loads the entry from the database, verifies its current approved revision, validates the selected platform/media combination and only then accesses social credentials.

Replace browser-generated OAuth state with an authenticated connection-initiation step that issues a one-time state and fixed return location. Until real scheduling exists, present dates as planning dates, remove or disable Auto-publish controls and block Video publication where no real adapter exists.

### Delivery checkpoints

1. **Immediate containment release:** lock the Edge boundary first. A brief period where Publish is disabled is acceptable; unauthenticated fallback is not.
2. **Authenticated manual path:** update the browser request and restore Publish for the owner after negative authorisation tests pass.
3. **Connection and UI truthfulness:** secure OAuth initiation/callback, block unsupported formats and remove misleading scheduling claims.

### Acceptance criteria

- [ ] Anonymous, expired-token, malformed-token and non-owner publication requests fail before any service-role query or social API call.
- [x] A valid owner request succeeds only for an existing, non-deleted, currently approved entry revision.
- [x] Caption, platform and media values supplied by a modified browser request cannot override the database entry.
- [x] A Video entry cannot reach an image/text publisher or the YouTube stub.
- [x] Publication errors returned to the browser contain no credential, OAuth-code or sensitive connection data.
- [x] OAuth state is one-time, owner-bound, platform-bound, expires quickly and cannot redirect outside the fixed allowlist.
- [x] Replayed, modified, expired or wrong-owner OAuth state is rejected without writing credentials.
- [x] The UI calls `date` a planned date and does not promise automatic publication.
- [x] Auto-publish and dormant browser-secret controls are removed or disabled.
- [x] Manual success and failure are clearly communicated without claiming durable status yet.

### Validation

- Edge unit tests covering every rejected authorisation and workflow-state case.
- OAuth negative tests for tampering, replay, expiry, wrong owner and redirect manipulation.
- Browser integration test proving the access token is sent and an expired session receives an actionable sign-in error.
- Deno check, TypeScript check, targeted lint, targeted tests and production build.
- Hosted smoke test with a test social account and sanitised logs.

### Rollout and rollback

- Deploy the secured Edge boundary before the browser update.
- Keep direct publishing disabled if the owner smoke test fails.
- Roll back the browser independently if necessary, but never restore the unauthenticated Edge version.
- Keep existing social credentials untouched; OAuth migration affects only new/reconnected flows until verified.

### Suggested commit boundaries

1. Authorisation and server-source contract tests.
2. Secured publication boundary and deployment setting.
3. Authenticated browser invocation and truthful capability/date controls.
4. One-time OAuth initiation/callback and tests.

---

## Phase 2: Durable, idempotent and recoverable publishing

**Findings:** PUB-002, PUB-004, PUB-005, PUB-006, PUB-009

**User stories:**

- As the application owner, repeated clicks, tabs or requests cannot create duplicate posts.
- As the application owner, publication status and platform links survive reloads and devices.
- As the application owner, I can see which platforms succeeded, failed, skipped or have an unknown outcome.
- As the application owner, I can retry only a failed platform without reposting successful platforms.
- As the application owner, media selected while creating or editing an entry behaves consistently at publication time.

### What to build

Introduce the durable publication job/result model and move outcome persistence into the server-side orchestration. A manual Publish request creates or returns one idempotent job for the approved content revision, atomically claims its platform results, calls providers and persists each result before responding.

Replace ephemeral entry status with database-backed job state. Present a single publication panel in the entry experience with per-platform results, provider links, an explicit unknown state and safe retry controls. Route all media uploads through the shared Storage contract and preflight media before creating side effects.

### Acceptance criteria

- [ ] Local migrations reproducibly create the publication job/result schema, constraints, indexes, RLS and generated types.
- [ ] The hosted schema is reconciled before migration; the missing `platform_connections` baseline is resolved without overwriting live credentials.
- [x] Two simultaneous requests with the same request key result in one job and at most one provider call per platform.
- [x] Reloading or opening another browser shows the same durable job and per-platform results.
- [x] A failed-plus-skipped result with zero successes never appears Published.
- [x] Partial success remains `partial`; successful platforms cannot be retried accidentally.
- [x] A definitive failed child on a Partial job can be retried in place without reposting successful siblings.
- [x] A provider timeout after a possible side effect becomes `unknown` and blocks blind automatic retry.
- [x] Provider post IDs/URLs are stored when available, while token and signed-media values are excluded.
- [x] An explicit “Post again” action creates a new publication intent rather than replaying the prior one.
- [x] Database failure before a provider call leaves no false success; failure after an uncertain provider call remains recoverable as unknown.
- [x] Create and edit flows produce the same Storage-backed media representation.
- [ ] New entries do not persist base64 media; existing base64-only media is inventoried and requires re-upload or a controlled one-time migration.
- [x] Required media that is missing, invalid or not fetchable is rejected before any platform call.

### Validation

- Local Supabase reset and migration replay against an empty database.
- Generated-type drift check.
- Concurrency test proving one provider call under simultaneous requests.
- Result-matrix tests for all-published, partial, all-failed, all-skipped, failed-plus-skipped and unknown.
- Fault-injection tests for database failure and timeout before/after simulated provider acceptance.
- RLS tests proving browser roles cannot mutate job results or read connection credentials.
- Browser tests for reload persistence, targeted retry and unified upload behaviour.

### Rollout and rollback

- Use additive schema changes and retain current entry fields until the durable UI has run successfully in production.
- Initially create jobs in observation mode with a test account before enabling real provider calls through the new path.
- Enable one supported platform first, then the remaining currently supported platforms.
- If orchestration fails, disable new job execution while retaining records for diagnosis; do not delete or recreate unknown jobs.

### Suggested commit boundaries

1. Schema, constraints, RLS and generated types.
2. Idempotent job creation/claim and concurrency tests.
3. Per-platform result persistence and unknown-outcome handling.
4. Durable publication UI and safe retry.
5. Unified Storage upload/preflight and legacy-media inventory.

---

## Phase 3: Real scheduling and platform resilience

**Findings:** PUB-003 full remediation, PUB-008 supported capability work, PUB-010

**User stories:**

- As the application owner, I can schedule an approved revision for an exact local time and see the corresponding timezone.
- As the application owner, I can cancel or reschedule work that has not started.
- As the application owner, due posts publish once even across worker overlap, restart or deployment.
- As the application owner, platform outages, rate limits and expired credentials produce clear, recoverable states.
- As the application owner, I can only select media/platform combinations the application genuinely supports.

### What to build

Extend durable jobs with exact scheduled execution. The UI creates a queued job using an explicit Europe/London time converted to UTC. A single Supabase worker runs each minute, atomically claims due jobs and invokes the same idempotent orchestration used by manual publishing.

Add cancellation, rescheduling, stale-lease recovery, bounded provider timeouts and platform-specific error classification. Retries occur only where the result is known not to have produced a post. Honour `Retry-After` for throttling. Use one capability matrix to drive server validation, UI choices and contract tests. Video remains unavailable per platform until a complete tested adapter exists.

### Acceptance criteria

- [ ] A scheduled job stores an exact UTC instant and the UI always displays its timezone.
- [ ] `entries.date` is treated only as a planning date and cannot trigger publication.
- [ ] One active schedule is allowed per entry revision; rescheduling is explicit and auditable.
- [ ] Cancellation succeeds only before claim and never reports success for an already in-flight job.
- [ ] Two overlapping workers cannot claim the same platform result.
- [ ] Worker restart or deployment safely recovers stale work without reposting completed results.
- [ ] Editing or withdrawing approval invalidates or pauses a queued job for the old content revision.
- [ ] Europe/London spring-forward and autumn-back transitions produce the selected real-world instant or a clear validation error for an invalid/ambiguous time.
- [ ] Provider requests have bounded timeouts and sanitised, platform-specific error classification.
- [ ] Rate-limited work honours provider retry timing and remains visible in the queue.
- [ ] Expired connections refresh where supported or stop with a clear reconnect action.
- [x] Unsupported image, carousel, video or text combinations are unavailable in the UI and rejected by the server.
- [ ] A failed scheduled job and a stale lease create an actionable owner alert.

### Validation

- Fake-clock integration suite for due selection, overlap, cancellation, rescheduling and stale leases.
- DST tests for both Europe/London transitions, plus UTC round-trip tests.
- Deployment-during-job and worker-crash recovery tests.
- Provider contract fixtures for 429/`Retry-After`, 5xx, timeout, malformed response, token expiry and revocation.
- Manual test-account smoke test for every enabled platform and media capability.
- Alert delivery smoke test with no private content or credentials in payloads.

### Rollout and rollback

- Deploy the worker disabled, verify due-job selection in dry observation, then enable only for test-account jobs.
- Activate one platform and a narrow scheduling window before general use.
- Keep the worker kill switch server-side. Disabling it must leave queued jobs intact and visible.
- Roll back capability enablement independently; never route an unsupported format through a fallback publisher.

### Suggested commit boundaries

1. Scheduling fields, UI timezone contract and cancellation/rescheduling.
2. Atomic worker claim and scheduled execution.
3. Lease recovery, timeout and rate-limit policy.
4. Shared capability matrix and platform contract tests.
5. Alerts, queue health and scheduler runbook.

---

## Phase 4: Operational readiness, simplification and additional-user guardrails

**Findings:** completes the operational and code-reduction actions associated with PUB-001 to PUB-010

**User stories:**

- As the application owner, I can understand and recover failed publishing without inspecting raw logs.
- As the application owner, I know how publishing data, media and credentials are backed up and restored.
- As a maintainer, there is one publishing path, one upload path and one status model.
- As a future additional user, I cannot access content, credentials or publication actions unless explicitly authorised.

### What to build

Finish the operational controls around the now-working subsystem and remove superseded paths. Provide a concise owner queue, connection-health view, redacted structured logs, failed/stale alerts and a tested recovery runbook. Verify backup and restore for publication metadata without exporting social credentials into developer artefacts.

Remove dormant browser-side Zapier settings, unused publication UI and obsolete base64 fallbacks after production usage confirms the replacement path. Consolidate publishing orchestration and platform adapters only where it reduces change risk.

Add the simplest safe future-user boundary: explicit ownership for protected content, owner/action RLS policies, server-side action authorisation and immutable actor/time events. Do not add organisation or workspace abstractions. This work prepares the path but does not itself invite or enable more users.

### Acceptance criteria

- [ ] The owner can filter queued, publishing, partial, failed, unknown, published and cancelled jobs.
- [ ] Alerts cover failed scheduled jobs, stale leases and repeated credential-refresh failure without including private content or secrets.
- [ ] A documented recovery exercise restores publication metadata and verifies job/result consistency.
- [ ] Social credentials remain server-only and are excluded from exports, browser payloads and ordinary logs.
- [ ] Storage bucket access, signed-URL lifetime, retention and orphan cleanup are documented and tested.
- [ ] Dormant Zapier browser settings and secrets are removed.
- [ ] Exactly one publication-status UI and one media-upload path remain.
- [ ] Dead publishing code is removed only after usage/search evidence and replacement tests exist.
- [ ] Protected records have an explicit owner or documented single-owner rule suitable for safe backfill.
- [ ] Owner, anonymous and synthetic second-user RLS tests cover content, jobs, results, media and credential metadata.
- [ ] A non-owner cannot publish, retry, cancel, schedule, connect or disconnect an account.
- [ ] Audit events identify actor, action, target, result and timestamp without storing secrets.
- [ ] The deployment and recovery runbooks identify how to pause the worker and publishing endpoint safely.
- [ ] Adding another user remains blocked until the isolation test matrix passes in a staging environment.

### Validation

- End-to-end owner journey: connect, create, approve, schedule, publish, partial failure, targeted retry, cancel and inspect history.
- Anonymous and second-user isolation suite across database, Storage and Edge actions.
- Backup/restore rehearsal in a non-production environment.
- Secret-redaction tests for logs, errors, alerts and exports.
- Dead-code and call-site checks before removals.
- Full lint, typecheck, unit/integration/E2E suites, Deno checks, local database reset and production build.
- Dedicated accessibility/browser pass over publication status, queue, dialogs and dynamic announcements.

### Rollout and rollback

- Ship observability before deleting legacy code.
- Remove old paths in separate commits after at least one successful manual and scheduled production cycle is recorded.
- Apply ownership migrations with a rehearsed backfill and backup; stop if any row cannot be assigned safely.
- Keep additional-user access disabled until staging isolation tests pass and the owner explicitly approves enablement.

### Suggested commit boundaries

1. Queue, health indicators, alerts and redacted logging.
2. Recovery/backup runbook and restore verification.
3. Removal of dormant Zapier, duplicate UI and legacy upload paths.
4. Ownership schema/backfill and RLS tests.
5. Server action authorisation, audit events and additional-user release gate.

---

## Cross-phase quality gates

Every phase must pass the following before completion:

- [ ] Observable behaviour is covered by tests before old behaviour is removed.
- [ ] TypeScript strict checks and relevant lint pass.
- [ ] Edge Functions pass Deno checks and boundary tests.
- [ ] Database changes replay from an empty local database and generated types match.
- [ ] RLS tests include anonymous, owner and synthetic non-owner roles.
- [ ] Production build passes without adding new known high/critical dependency findings.
- [ ] No secret, token, private post content or signed media URL appears in test artefacts or logs.
- [ ] Deployment order, rollback and data-migration risks are documented in the phase pull request.
- [ ] A read-only review prioritises correctness, regression, security and missing tests before merge.
- [ ] `DEVLOG.md` records the completed phase and verification results.

## Finding traceability

| Finding                                                |                    Primary phase | Completion evidence                                         |
| ------------------------------------------------------ | -------------------------------: | ----------------------------------------------------------- |
| PUB-001 — unauthenticated publication boundary         |                                1 | Hosted negative authorisation tests and owner smoke test    |
| PUB-002 — no idempotency or server approval validation |                                2 | Concurrent replay test with one provider call               |
| PUB-003 — scheduling promise without scheduler         |      1 containment, 3 completion | Truthful UI, then DST-tested scheduled worker               |
| PUB-004 — misleading aggregate status                  |                                2 | Result-matrix tests and durable partial state               |
| PUB-005 — non-durable/reproducible schema              |                                2 | Migration replay, schema reconciliation and generated types |
| PUB-006 — unknown external outcome                     |                                2 | Fault-injection and reconciliation-safe unknown state       |
| PUB-007 — weak OAuth state                             |                                1 | Tamper/replay/wrong-owner OAuth tests                       |
| PUB-008 — unsupported video/platform behaviour         | 1 containment, 3 capability work | Server rejection, capability matrix and contract tests      |
| PUB-009 — base64 edit-media path                       |                                2 | Shared Storage upload contract tests                        |
| PUB-010 — no timeout/rate-limit/retry policy           |                                3 | Provider failure fixtures and scheduled retry tests         |

## Indicative sequence and effort

These are planning ranges, not delivery commitments:

| Phase                                             | Indicative effort | Release result                                                           |
| ------------------------------------------------- | ----------------: | ------------------------------------------------------------------------ |
| 1. Secure and truthful manual publishing          |  3–5 working days | Critical boundary contained; owner-only supported manual publishing      |
| 2. Durable, idempotent and recoverable publishing |         1–2 weeks | Reload-safe results, duplicate prevention and safe failure recovery      |
| 3. Real scheduling and platform resilience        |         1–2 weeks | Exact-time monitored scheduling with safe provider behaviour             |
| 4. Operational readiness and guardrails           |  4–8 working days | Recoverable, simpler subsystem ready for a later user-isolation decision |

Phase 1 should begin with the immediate containment release even if the remainder of that larger phase takes several days. Phase 3 must not start executing real schedules until Phase 2 idempotency and durable unknown outcomes are proven.

## Completion definition

The publishing-integrity programme is complete when all PUB-001–PUB-010 acceptance evidence is linked, the hosted configuration matches the repository, one manual and one scheduled test-account journey have completed without duplicate or ambiguous state, recovery has been rehearsed, and the owner-facing interface communicates the exact durable platform outcome.
