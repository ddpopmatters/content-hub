# PM Hermes Content Hub differential review

- Date: 23 July 2026
- Review base: `origin/main` (`a1ef7ee`)
- Reviewed branch: `codex/pm-hermes-content-hub`
- Pull request: #29

## Executive summary

The branch adds a signed, replay-resistant PM Hermes boundary for bounded Content Hub reads, approval-gated proposals and seven allowlisted write classes. It also replaces broad anonymous entry reads with signed review projections and records immutable agent provenance and report evidence.

The review found two high-severity and six medium-severity issues during implementation. All high and medium findings were remediated before release. No known blocker remains. The remaining low-risk limitation is that review-recipient enforcement is covered by token unit tests, handler type checks and a static boundary contract rather than a fully dependency-injected HTTP handler suite; production negative probes are therefore part of the attended rollout.

Release outcome: PR #29 passed final CI and merged as `8cc4e4b`. The matched migration and Edge bundles are deployed, execution remains disabled, the documented live negative probes pass, and GitHub Pages is serving the merged bundle.

## Scope and blast radius

The reviewed delta contains 19 commits before the final remediation commit and, at the time of review, 53 changed files with 8,791 insertions and 252 deletions.

Primary affected surfaces:

- `content-hub-agent`: new HMAC-authenticated read, proposal and execution boundary.
- `agent_requests` and `agent_actions`: service-only replay, rate-limit, approval and idempotency ledgers.
- `approve-entry` and `send-notification`: revision-, scope- and recipient-bound review links.
- PM Hermes MCP and operator CLI: bounded tools with approval receipt creation kept outside the model-facing tool surface.
- `monthly_reports`: governed report writes, persisted source evidence and explicit calculated-metric refresh semantics.
- Content Hub entry/report projections, provenance labels, tests, runbooks and release documentation.

Permanent authority exclusions remain approval, rejection, scheduling, publication, publication retry, deletion, analytics import, administration, arbitrary SQL and raw credential access.

## Findings and remediation

### High severity

1. **Approval receipts could be minted by the model-facing execution path.** Remediation: exact approval is now recorded only by the operator CLI; MCP execution can consume only a separately recorded, unexpired receipt.

2. **A write applied by the database could be reported as failed if request-ledger completion failed afterwards.** Remediation: the handler now returns the authoritative applied result after dispatch and classifies genuinely indeterminate client outcomes as `outcome_unknown`.

### Medium severity

1. **Approval tokens were not bound to the exact content revision.** Remediation: tokens require `rev`, `scp` and a pseudonymous recipient binding; legacy tokens are rejected.

2. **Removed recipients could retain review access and non-approvers could receive approve links.** Remediation: token minting and GET/POST use recheck the persisted current author or approver set, with approve scope restricted to current approvers.

3. **Approval and content-change emails could race persistence.** Remediation: every signed approval/review notification is emitted only after `saveEntry` succeeds. Gated hook tests assert persistence occurs before notification.

4. **Report updates could overwrite manually entered metrics, including common metric names.** Remediation: qualitative-only updates preserve the exact saved metric set. Calculated metrics refresh only when `refreshCalculatedMetrics` is explicitly true, and named manual metrics remain authoritative in both modes.

5. **Missing engagement analytics could be converted to measured zero.** Remediation: engagement totals, rates and top-post scores remain `null` unless an engagement component is present.

6. **Report evidence and references were not durably preserved.** Remediation: `monthly_reports.agent_evidence` is derived by a protected trigger from the exact service-only action payload; browser writes cannot forge or clear it, and omitted update references retain the stored set.

## Verification

Completed locally against the final remediation:

- 312 Vitest tests passed.
- 94 Deno tests passed.
- 11 Python integration and approval tests passed.
- TypeScript strict type-check passed.
- ESLint passed with zero warnings.
- Production build passed.
- Review-link boundary contract passed.
- `npm audit` reported zero vulnerabilities.
- PostgreSQL 17 isolated migration and `agent_action_invariants.sql` run passed.
- Content Hub MCP registration discovered all 18 intended tools.
- `git diff --check` passed.

The final remediation, lockfile-Prettier correction and production-evidence documentation commits passed GitHub CI, security and supply-chain checks before merge.

## History review

Commit history was inspected from `origin/main` through the complete reviewed branch. The implementation was introduced as one bounded integration, followed by signing-path correction, timestamp-precision and dependency fixes, separately recorded production canary checkpoints for each governed write class, final security remediation and a lockfile-version formatting correction. No unrelated branch history or hidden merge was found. `origin/main` is the sole base and the reviewed branch was 21 commits ahead with no commits behind before the production-evidence record.

## Method and limitations

The review combined source and migration inspection, call-path tracing, focused adversarial review, full local automated verification, isolated PostgreSQL execution, Git history inspection and production metadata reconciliation. No `.env*` file or secret value was read.

The public review handler still lacks a fully dependency-injected HTTP integration suite. Its security-critical token parser and authorisation conditions are tested or statically asserted, and the implementation rejects stale revisions, wrong scopes and removed recipients. After deployment, attended production probes confirmed that missing and malformed GET tokens and a malformed POST token all fail closed with HTTP 400; stale-revision and removed-recipient behaviour remains covered below the handler boundary.
