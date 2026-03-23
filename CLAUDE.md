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

## Design Context

Full context in `.impeccable.md`. Summary for every session:

**Users:** Dan + Fran — two-person team, daily use, first tool they open. Emotional goal: calm confidence.

**Brand personality:** Purposeful. Warm. Direct. Small team — the tool can have personality.

**Colour tokens** (`src/styles/app.css`):

- `ocean-600` (#0e4d63) — primary actions, buttons, active states
- `ocean-400` (#1fb1c7) — hover, interactive highlights
- `aqua-500` (#00ffff) — accent only, use sparingly
- Status: `emerald`=published, `amber`=scheduled, `sky`=in review, `rose`=blocked
- Use token names always — never raw hex in components

**Typography:** Neue Haas Grotesk (font-sans). Semibold labels/buttons, regular body/metadata.

**Shape language:** rounded-xl buttons, rounded-3xl modals/menus, shadow-sm cards, shadow-2xl elevated panels.

**Microcopy:** "Add content" not "Create new item". "In review" not "PENDING_REVIEW". Encouraging empty states.

**Anti-patterns — never build:** clinical white + grey-on-grey, glassmorphism, generic charity blue/white, cards-on-cards noise, SCREAMING_LABELS, "No data available" empty states.

**Design principles:**

1. Calendar is the hero surface — everything else serves it
2. Glanceable: type, status, assignee visible without clicking in
3. Status colours do work — don't waste them on decoration
4. Warm, not corporate — two colleagues who want to open this daily
5. Reduce cognitive load on context switches between content types
