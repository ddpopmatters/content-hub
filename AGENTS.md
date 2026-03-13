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
- `npm run lint` / `npm run typecheck`

## Key Files & Directories

- `src/app.jsx` — main app entry (large, ~76KB — simplification priority)
- `src/features/` — 24 feature modules
- `src/hooks/` — domain hooks
- `src/lib/supabase.ts` — Supabase client wrapper
- `supabase/migrations/` — schema versioning (DO NOT MODIFY)
- `docs/platform-docs.md` — auto-generated architecture reference

## Architecture

Single-page React app with Supabase backend. Features as self-contained modules in `src/features/`. Auth via Supabase. Content flows: creation -> assessment -> approval -> publishing.

## Conventions

- Supabase calls in hooks or lib/, never in components
- Functional components, Tailwind for styling
- TypeScript strict mode

## Current State

See DEVLOG.md for latest activity and active branches.

## Codex Notes

- Every call is stateless — full context must be in the spec
- Key files to read before implementing: `src/app.jsx`, `src/lib/supabase.ts`, `docs/platform-docs.md`
- Do not modify: `supabase/migrations/`, `.env`, `.env.local`
- Existing specs in `.codex-specs/` — check for prior work before starting
- Output format: summarise changes, don't dump raw files
