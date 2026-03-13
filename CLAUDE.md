# Content Hub

PM content planning, creation, and approval workflow tool.

## Tech Stack

- React 19 + TypeScript + esbuild + Tailwind 4.2
- Supabase (PostgreSQL + Auth + RLS + Realtime)
- Vitest (81 tests)
- jsPDF (report export)

## Key Commands

- `npm run dev` — esbuild dev server
- `npm run build` — production bundle
- `npm test` — Vitest
- `npm run lint` / `npm run typecheck` — quality gates

## Key Files & Directories

- `src/app.jsx` — main app entry (large file, ~76KB)
- `src/features/` — 24 feature modules (analytics, approvals, calendar, kanban, etc.)
- `src/hooks/` — domain hooks (useContentPeaks, useContentSeries, etc.)
- `src/lib/supabase.ts` — Supabase client wrapper
- `supabase/migrations/` — schema versioning
- `tools/` — dev server, build script, test utilities
- `docs/` — platform docs, plans, Fran resources

## Architecture

Single-page React app with Supabase backend. Features organised as self-contained modules in `src/features/`. Auth via Supabase. Content flows through: creation -> assessment -> approval -> publishing. Realtime subscriptions for collaborative features.

## Conventions

- Global PM rules apply (tokens, fonts, copy guidelines)
- Supabase calls in hooks or lib/, never in components directly
- Schema changes via `apply_migration` MCP tool only
- `src/app.jsx` is oversized — simplification is the #1 priority

## Current State

See DEVLOG.md for latest activity and active branches.

## Claude Code Notes

- MCP: Supabase (project "Workstream Tool")
- Progress files in `.claude/progress/`
- Existing Codex specs in `.codex-specs/`
- Platform docs: `docs/platform-docs.md` (auto-generated reference)
