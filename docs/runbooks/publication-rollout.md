# Durable Publication Rollout

_Last verified locally: 18 July 2026._

This runbook keeps direct publishing unavailable until the hosted database, Edge Function and frontend all use `durable-manual-v1`. It covers the Content Hub publication path only.

## Current hosted baseline

Read-only Supabase inventory on 18 July 2026 found:

- The production build and public runtime configuration resolve to the shared `Intel Hub` Supabase project. That project is `INACTIVE`, so table and migration inventory is unavailable without an attended restore.
- Its deployed `publish-entry` is version 1 with gateway JWT verification disabled. It accepts browser-authored publication fields, treats `PUBLISH_WEBHOOK_SECRET` as optional, uses the service role to load full platform connections and accepts a caller-provided callback URL.
- It does not contain owner authentication, authoritative entry loading, durable jobs/results, targeted retry or the `durable-manual-v1` readiness contract.
- The older standalone `Content Hub` project is also `INACTIVE` and retains a separate legacy `publish-entry` version 13. It is not the configured runtime target and must not be substituted during rollout.

Do not deploy the frontend while this baseline remains. Restore only the intended shared runtime project, and only in the attended maintenance window below.

## Required order

1. Switch to the production-safe Codex profile and confirm a recoverable database backup and previous frontend/Edge versions.
2. Keep direct publishing unavailable to users.
3. Confirm the deployment secret resolves through `tools/public-config.mjs` to the intended shared runtime project, then restore that project only during an attended maintenance window. Do not restore or target the standalone project as a shortcut.
4. Capture a read-only schema, RLS, function, migration and Storage inventory. Resolve the missing local `platform_connections` baseline and the invalid historical `CREATE POLICY IF NOT EXISTS` migration without overwriting live credentials or editing an already-applied migration.
5. Deploy the secured `publish-entry` bundle first with gateway JWT verification enabled. Its readiness endpoint must return HTTP 503 until the database marker exists; POST requests must fail before provider access while the schema is behind.
6. Apply the reviewed approval-revision and durable-publication migrations in order. Run the owner, non-owner, retry, RLS and concurrency invariants against a safe branch or staging database before production.
7. Verify `GET /functions/v1/publish-entry` with the project publishable key returns exactly:

   ```json
   { "ready": true, "contractVersion": "durable-manual-v1" }
   ```

8. Run `npm run check:publication-backend`. It resolves the backend through the same configuration function as the production build, requires the canonical shared-project origin and accepts only the exact two-field readiness response. The GitHub Pages workflow runs the same check and blocks the frontend when the target, endpoint, Edge code or schema is missing or mismatched.
9. Deploy the frontend, require re-approval of legacy approved entries, then perform test-account success, definitive rejection, partial retry and ambiguous-failure smoke tests. Never use live campaign content for failure testing.

The old `tools/test-publish-api.mjs` direct-post script has been removed. It used the legacy browser-authored payload, defaulted to a different PM Supabase project and could contact real providers outside the durable test-account workflow.

## Rollback

- Frontend: redeploy the last known-good Pages artefact, but do not roll back to a frontend that can call the legacy publisher.
- Edge Function: pause direct publishing before changing versions. Never restore shared-project version 1 or standalone-project version 13 while social credentials are active.
- Database: use the confirmed Supabase backup/restore process. Do not manually delete durable job/result rows or reverse a partially applied migration in place.
- If runtime and schema versions differ, leave the readiness endpoint failing and the frontend deployment blocked. Investigate under maintenance conditions; do not bypass the gate.

## Evidence to retain

- Backup timestamp and restore procedure.
- Hosted schema/migration diff with credential values excluded.
- Edge Function versions and gateway JWT settings.
- Passing database invariants and `check:publication-backend` output.
- Test-account smoke-test job IDs, statuses and timestamps, with post content and tokens excluded.
