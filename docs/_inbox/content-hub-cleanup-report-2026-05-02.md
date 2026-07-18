# Content Hub cleanup report

Date: 2026-05-02
Agent: Codex
Repo: `/Users/dan/dev/population_matters/tools/content-hub`

## Verdict

NEEDS-WORK

The React app itself is locally healthy. `typecheck`, `lint`, `test`, and `build` all passed. I did not find a safe app-code cleanup to make without stepping into Dan's existing in-flight changes.

The repo still needs follow-up because the working tree is already dirty and the new Supabase Edge Function cannot be fully validated in this sandboxed session: `deno check` attempted to fetch `jsr:@supabase/supabase-js@2` and failed on network access before type validation could complete.

## Existing dirty tree before my edits

- Modified:
  - `.claude/tdd-guard/data/modifications.json`
  - `DEVLOG.md`
  - `PROJECT.md`
  - `docs/plans/2026-03-12-strategy-alignment.md`
  - `docs/superpowers/plans/2026-03-19-test-suite.md`
  - `docs/superpowers/plans/2026-03-26-publish-format-fixes.md`
  - `docs/superpowers/plans/2026-03-27-layer1-plumbing.md`
  - `docs/superpowers/plans/2026-03-27-layer2-carousel.md`
  - `docs/superpowers/plans/2026-03-27-layer3-video.md`
  - `docs/superpowers/plans/2026-03-27-layer4-token-refresh.md`
  - `public/platform-summary.json`
- Untracked:
  - `deno.lock`
  - `supabase/functions/platform-summary/index.ts`

## Checks run

- `npm run typecheck` - passed
- `npm run lint` - passed
- `npm test` - passed (`33` files, `244` tests)
- `npm run build` - passed
- `deno check supabase/functions/platform-summary/index.ts` - blocked by network fetch to JSR, so not a reliable local pass/fail signal here

## What I checked manually

- Read the required project guidance and the cleanup brief.
- Reviewed `package.json`, repo scripts, and lockfile/tooling layout.
- Inspected the untracked `supabase/functions/platform-summary/index.ts`.
- Searched narrow debug/cruft patterns across `src`, `tools`, and the new function path.
- Confirmed the `console.log` usage I found is either in build/test tooling or behind `APP_CONFIG.DEBUG_MODE`, not an obvious accidental production debug trace from this cleanup pass.

## Fixes made

- Reverted a verification-only formatting change to `public/content-hub-config.js` caused by running the build.
- Added this cleanup report.
- Appended a DEVLOG entry for the cleanup pass.

## Findings and remaining blockers

1. App checks are green.
   The main frontend and test surfaces are already in a reviewable state.

2. The new `platform-summary` function looks structurally plausible but is not fully validated here.
   The function shape is coherent and `public/platform-summary.json` now references a native summary function, but `deno check` could not complete because the environment could not fetch `jsr:@supabase/supabase-js@2`.

3. The current dirty tree appears to be grouped work rather than obvious trash.
   I did not delete `deno.lock` or the untracked Supabase function because they look like real feature work, not disposable generated output.

4. `npm run build` still produces a large bundle warning.
   `public/js/app.js` is reported at roughly `1.2mb`. That is not a cleanup blocker for this brief, but it remains a simplification/performance follow-up.

## Recommended commit groups

1. Metadata and docs cleanup
   Group `PROJECT.md`, `public/platform-summary.json`, and the related planning/docs edits if they belong to the same platform-alignment thread.

2. Native platform summary feature
   Group `supabase/functions/platform-summary/index.ts` with `deno.lock` and any follow-up validation or deployment notes once Deno dependency resolution can be checked in a network-enabled environment.

3. This cleanup pass
   Group `docs/_inbox/content-hub-cleanup-report-2026-05-02.md` and the new `DEVLOG.md` entry if Dan wants an audit trail separate from product work.

## First file Dan should open

`docs/_inbox/content-hub-cleanup-report-2026-05-02.md`
