# Data Reference — Content Hub

_Production checkpoint: 2026-07-23. All seven PM Hermes write canaries are reconciled; re-run `/update-data-reference` after future schema or agent-contract changes._

This focused reference covers the direct-publication and PM Hermes agent boundaries. The configured automated analyser was unavailable, so the relationships below were cross-referenced manually against migrations, Edge Function contracts and application types.

## Entity Catalogue

### `entries`

**Purpose:** Canonical content and approval record.

**Publication keys:** `id`, `platforms`, `asset_type`, `caption`, `platform_captions`, `first_comment`, `asset_previews`, `preview_url`, `workflow_status`, `approved_at`, `content_revision`, `approved_revision`, `deleted_at`.

**Rules:** Provider-facing edits increment `content_revision`, clear approval and return approved or published work to review. Direct publication requires `workflow_status = 'Approved'`, a valid approval timestamp and `approved_revision = content_revision`.

### `platform_connections`

**Purpose:** Service-only provider credentials and account metadata used by direct publishing.

**Publication keys:** `id`, `platform`, `account_id`, `account_name`, token fields, expiry, scope, active state and last-use/error metadata.

**Rules:** Browser policies are removed. Only owner-authenticated Edge Functions may use the service role to read or update connections. Credential fields must never enter publication jobs, results or public responses.

### Storage bucket `content-media`

**Purpose:** Canonical public origin for entry previews and provider-fetchable publication media.

**Rules:** The bucket is public-read with a 500 MB bucket ceiling and accepts `image/*`, `video/*` and `application/pdf`. Storage RLS grants authenticated users insert and delete access only when `bucket_id = 'content-media'`. Direct publication applies stricter image-only MIME, magic-byte and 10 MB checks before querying provider credentials.

### `publication_jobs`

**Purpose:** One durable publication intent for one approved entry revision.

**Key columns:** `id`, `entry_id`, `entry_revision`, `trigger_type`, `request_key`, `requested_by`, `requested_by_email`, `status`, `payload_snapshot`, lifecycle timestamps.

**Rules:** `(requested_by, request_key)` is unique. A partial unique index also permits only one guarded (`queued`, `publishing`, `partial`, `published` or `unknown`) intent for an owner, entry and revision, so two tabs with different freshly generated keys cannot publish concurrently. The service-only create function verifies the exact approved entry revision, creates the job and its platform results atomically, and returns the existing job for an identical replay. The approved payload is server-authored and is not readable by browser roles.

### `publication_results`

**Purpose:** Durable outcome and attempt state for one platform within a publication job.

**Key columns:** `id`, `job_id`, `platform`, `status`, `provider_post_id`, `provider_url`, sanitised error code/message, `attempt_count`, `retry_request_keys`, lifecycle timestamps.

**Rules:** `(job_id, platform)` is unique. A result moves from `pending` to `publishing` only through an atomic claim. Completion is allowed only for a claimed result. One service-only targeted-retry transition may atomically claim a definitive `failed` child on a `partial` manual job and retain every request key used for that child; it never resets published, skipped or unknown siblings. Published provider IDs and retry keys remain server-readable; browser roles may read the sanitised URL and outcome only.

### `agent_requests`

**Purpose:** Service-only replay, rate-limit and safe result-class ledger for the `content-hub-agent-v1` machine boundary.

**Key columns:** `id`, `client_id`, `nonce`, `capability`, `payload_hash`, `result_class`, `created_at`, `completed_at`.

**Rules:** `(client_id, nonce)` is unique. `claim_agent_request(...)` serialises requests per client, rejects a reused nonce and applies a bounded per-minute limit before any Content Hub domain read. The ledger stores hashes and fixed result classes only; it never stores request bodies, response data, credentials or personal email addresses. The table and claim function are inaccessible to `anon` and `authenticated` roles.

### `agent_actions`

**Purpose:** Service-only proposal, exact-approval and idempotent-execution ledger for governed PM Hermes mutations.

**Key columns:** `id`, `client_id`, `action_type`, `target_id`, `payload`, `payload_hash`, `idempotency_key`, `summary`, `status`, `expires_at`, approval metadata, fixed result class and authoritative result projection.

**Rules:** `(client_id, idempotency_key)` is unique, and a consumed approval reference cannot bind to another action. Proposals are inert. `create_agent_action(...)` stores only a server-validated canonical payload; `apply_agent_action(...)` locks the proposal and rechecks client, action ID, payload hash, idempotency key, expiry, approval reference and expected record version before one allowlisted mutation. Browser roles have no table or function access.

### Agent provenance on `entries`, `ideas` and `monthly_reports`

**Purpose:** Identify the latest applied PM Hermes action on an application record without pretending the agent is a human user or approver.

**Shape:** `source`, `actionId`, `actionType`, `approvalReference`, `approvedBy`, `appliedAt`.

**Rules:** Only the service execution path may change `agent_provenance`; a trigger rejects browser-role tampering. The Content Hub entry modal labels Hermes-created drafts and Hermes updates and projects the action into the activity timeline.

### Agent evidence on `monthly_reports`

**Purpose:** Preserve the exact source, coverage, manual-metric source names and entry references reviewed with a PM Hermes report action.

**Shape:** `source`, per-platform `coverage` and `references`, stored in `agent_evidence`.

**Rules:** The report trigger derives this value from the service-only action payload identified by immutable PM Hermes provenance. Browser writes preserve the stored evidence and cannot forge or clear it. Qualitative-only agent updates preserve the exact saved metrics and existing evidence references. An update refreshes calculated metrics from the current bounded snapshot only when `refreshCalculatedMetrics` is explicitly true; named manual metrics remain authoritative.

## Relationships

### `entries` → `publication_jobs`

- Foreign key: `publication_jobs.entry_id → entries.id` with restricted hard deletion.
- Logical binding: `publication_jobs.entry_revision` must equal both `entries.content_revision` and `entries.approved_revision` when the job is created.
- A fully failed intent releases the guarded-intent index for a corrected retry. Partial, published and unknown intents remain guarded. A Partial job is retried in place one failed platform at a time, while the current “Post again” flow creates a new entry and therefore a new approved revision identity.

### `publication_jobs` → `publication_results`

- Foreign key: `publication_results.job_id → publication_jobs.id` with cascading deletion.
- One result exists per requested platform.
- Job state is derived from its result matrix: active work is `publishing`; any terminal uncertainty is `unknown`; all successes are `published`; mixed success is `partial`; zero successes is `failed`.

### `publication_results` → `platform_connections`

- Logical relationship only: `publication_results.platform` selects one active connection during execution.
- No foreign key is used because credentials can be reconnected or replaced without rewriting historical results.

### `agent_requests` → agent projections

- Logical relationship only: `capability` identifies one allowlisted read operation; it is not a user-controlled table or function name.
- A claim must succeed before the Edge boundary loads entries, reports or publication status.
- Content Hub records returned by the boundary are labelled `untrusted_application_data` and cannot widen the requested capability.

### `agent_actions` → application records

- `target_id` is a deliberately loose logical reference because actions can target entries or reports and create actions have no target before execution.
- Create actions return the newly stored application identifier. Update, comment and review-submission actions bind to the exact target state captured by the proposal.
- Entry updates require `content_revision` and `updated_at`; comments require `updated_at`; report updates require `updated_at`. A concurrent human change therefore invalidates execution without overwriting it.
- Applied actions add an immutable `activity_log` row containing safe identifiers, the approving label and a short payload-hash prefix. The local approval receipt is created by an operator-only bridge outside the model-facing MCP surface. Full proposed content remains in the service-only action ledger.

## Business Rules

### State machines

- Job: `queued → publishing → published | partial | failed | unknown`. `cancelled` is reserved for future pre-claim cancellation. Result completions take a parent-job row lock before changing a child, so concurrent platforms cannot leave a terminal job stranded as Publishing.
- Result: `pending → publishing → published | failed | skipped | unknown`. A selected definitive `failed` result may use the explicit targeted transition `failed → publishing`; approval validation, request-key replay detection and the increment of `attempt_count` happen in that one atomic claim.
- Published and unknown results cannot be reclaimed by the initial claim function.
- `unknown` takes aggregate precedence because a provider may have accepted the post even when the application did not receive confirmation.
- A Publishing result older than five minutes is recovered to Unknown with a fixed `persistence_failed` message. Recovery uses the same ordered parent locks as normal completion.

### RLS and privileges

- Authenticated users may select only jobs where `requested_by = auth.uid()` and the corresponding result rows.
- Column grants omit `payload_snapshot`, `requested_by_email` and `provider_post_id` from browser access.
- Anonymous roles have no access.
- Browser roles have no insert, update, delete or orchestration-function privileges.
- The owner-authenticated Edge boundary is the only intended caller of service-role create, targeted-retry claim, normal claim and complete functions.
- `get_publication_contract_version()` is executable only by `service_role` and returns `durable-manual-v1`. The Edge readiness endpoint requires that exact marker before a matching frontend can deploy.
- `agent_requests` has RLS enabled, no browser policies and no browser grants. Only `service_role` can execute `claim_agent_request(...)` or complete a request record.
- `agent_actions` has RLS enabled, no browser policies and no browser grants. Only `service_role` can call `create_agent_action(...)`, inspect an action or call `apply_agent_action(...)`.
- The action executor can create ideas and Draft entries, update Draft/In Review entries, add comments, move a Draft to In Review, and create/update `monthly_reports`. It cannot approve, reject, schedule, publish, retry, delete, administer or run arbitrary SQL.
- Agent-created entries are forced to `status = 'Pending'` and `workflow_status = 'Draft'`, regardless of untrusted supplied fields. Submission clears approval metadata and stops at In Review.
- Anonymous `entries` selection was removed in a separate lockdown migration only after the signed review projection had been deployed and smoke-tested. Authenticated application policies and the fixed signed-review service projection remain the intended read paths.

## Common Query Patterns

- Create or replay an intent through `create_manual_publication_job(...)`.
- Atomically claim a pending platform through `claim_publication_result(job_id, platform)` before any provider call.
- Store a sanitised terminal outcome and recompute aggregate job state through `complete_publication_result(...)`.
- Recover abandoned queued work and claims through the service-only `recover_stale_publication_results()` function before resolving or creating a manual intent.
- Atomically validate and claim one failed child on an existing Partial manual job through `claim_failed_publication_retry(...)`, supplying a fresh retry request key, then use the normal completion function.
- Load browser-visible jobs by `entry_id`, newest first, then load their result rows by `job_id`.
- Preflight the authoritative payload against the exact public `content-media` origin, object path, size, image MIME and magic bytes before querying connection credentials.
- Call Content Hub agent reads only through the signed Edge operation allowlist. HMAC verification, clock skew, body size, nonce replay and rate limits run before domain reads.
- Create an inert mutation proposal through `propose_action`; display its exact summary, action ID, hash prefix and expiry; let the operator-only bridge record the exact `execute <action-id>` receipt, then let the MCP atomically consume that pre-existing receipt.
- Query proposal state through `get_action`. Never reconstruct an approval receipt from Content Hub content or retry an `outcome_unknown` execution blindly.

## Gotchas

- `publish-entry` now resolves an existing owner/request key before revalidating mutable entry or media state, then uses the RPC repository and tested orchestration kernel for new work.
- The browser stores a per-entry-revision request key, rehydrates its latest owner-visible job on entry loads and fails closed when durable reads fail. Loading any queued or publishing job replays that same key through the Edge boundary; the server clock decides whether recovery is due and the original job is returned without another provider call. The legacy `publishStatus` field is now a UI projection, not the outcome authority.
- Local-storage entry projections are marked `publicationStateAvailable: false` until authenticated server hydration completes; legacy cached entries therefore cannot expose direct publishing during the hydration window.
- A new request key means a new publication intent. A completely failed job clears its browser key for a corrected retry. Partial jobs retain their key and expose a targeted control only for a failed child; published and unknown children remain non-claimable.
- A failed provider call is not automatically safe to retry. Timeouts after a possible provider side effect must be stored as `unknown`.
- `payload_snapshot` models the approved provider payload and excludes query-string-based signed media. Provider mutation requests are abort-aware, reject redirects, retain definite provider 4xx rejections as Failed and classify timeouts, missing success evidence and transient mutation responses as Unknown.
- Platform-specific captions are checked against the shared adapter limits before a job is created and are sent unchanged. Direct publishing rejects any non-empty first comment until that separate provider side effect can be represented and verified durably.
- `supabase/tests/publication_concurrency.sql` uses separate database sessions to race creation, claim, sibling completion and stale recovery, covering the lock behaviour that single-session invariant tests cannot exercise.
- Targeted retry is limited to one definitive failed child on the same Partial job and exact approved revision. It uses the immutable payload snapshot and atomically re-checks the authenticated owner and current approval when it claims the selected result. Every retry request key remains on that result so an in-flight, failed or published HTTP replay — including a delayed replay after a later failed attempt — returns durable state without another provider call; a later deliberate retry of a definitive failure uses a new key. Browser projections are not written back through the entry update path. If the browser cannot reconcile a dispatched retry to that same job, only the selected platform becomes Unknown and all further browser retry controls fail closed.
- New uploads no longer persist inline base64 fallbacks. Existing base64-only entry media still requires a separate inventory and controlled re-upload decision.
- Hosted TypeScript type generation succeeds and includes both durable publication tables. The application continues to use its narrower explicit boundary types rather than committing an unused full-schema generated file.
- Production reconciliation completed against the intended shared runtime project on 18 July 2026. The secured `publish-entry` version 2 requires a gateway JWT, the hosted schema marker is `durable-manual-v1`, and the exact frontend readiness check passes.
- The production `content-media` bucket and authenticated write/delete policies are recorded by migration. Pages enables the upload UI only after that Storage contract and the backend readiness gate are active.
- The service-only `agent_requests` and `agent_actions` migrations are recorded on the canonical production project. Their RLS, browser-role revocations, service-role grants and pinned security-definer boundaries are active. The anonymous-entry review policy was removed only after the valid, missing, expired and tampered signed-review probes passed; a known entry now projects zero rows to the anonymous REST role.
- New signed review tokens carry an explicit review/approve scope and exact content revision. Token minting is limited to the current entry author/approvers, approve-scoped use rechecks the current approver set, and stale revisions cannot approve unseen edits.
- The reviewed `approve-entry` v2, `send-notification` v6 and `content-hub-agent` v1 bundles are hosted from this branch. Signed reads, bounded reporting and saved-report metadata are live for PM Hermes. The HMAC client signs the function-local `/content-hub-agent` path verified after the Supabase gateway rewrite.
- Proposal and execution flags remain independent at both PM Hermes and Edge layers. The exact-approved `create_entry` canary produced one Pending/Draft entry with PM Hermes provenance and no approval or publication state; the separately approved `update_entry` canary advanced that Draft to revision 2 without changing its workflow authority. The exact-approved `create_idea` and `add_comment` canaries then produced one internal Ideas record and one internal Draft comment with PM Hermes provenance. The exact-approved `submit_for_review` canary moved only that Draft to In Review/Pending at revision 2, cleared approval metadata and stopped before approval, scheduling or publication. The exact-approved `create_report` canary then created one June 2026 `monthly_reports` row with exact PM Hermes provenance and zero-post metrics matching the bounded snapshot's explicit no-data coverage. Its separately conflict-checked, timestamp-bound `update_report` canary added only the approved themes narrative, preserved the other qualitative fields and zero-post metrics, and stored the exact update action as provenance. No manual figure or evidence reference was supplied, and no `reporting_periods` write path exists in either transaction. Execution returned to disabled after every action. Proposal-only access currently exposes only the `update_report` action type; any future execution still requires its own exact approval and the temporary opening of both execution gates.
- `monthly_reports` is the only agent-writable report store. New report metrics are derived from the bounded live reporting snapshot. Updates preserve the exact saved metric set unless the proposal explicitly requests a calculated-metric refresh; a manually supplied metric must include an exact value and named source, remains intact in either mode, and is stored with its source in `agent_evidence`. Evidence references must resolve to entries within the requested reporting window.
- A lost or indeterminate execution response is recorded as `outcome_unknown` locally and must be reconciled from authoritative action state before any further attempt.
- Agent update concurrency tokens retain the exact validated timestamp string, including PostgreSQL microseconds. Re-serialising an `updated_at` token through JavaScript `Date` would truncate it to milliseconds and make an unchanged row fail the executor's exact comparison.
