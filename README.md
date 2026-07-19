# Content Hub

Canonical metadata for this repo lives in `PROJECT.md`. Use that file for naming, aliases, stack, infra, and key paths.

## Quick Start

```bash
npm install
npm run dev
```

## Core Commands

- `npm run dev` - local development
- `npm run build` - production build
- `npm run lint` - lint checks
- `npm run typecheck` - type checks
- `npm test` - Vitest suite

## Key Paths

- `src/app.jsx` - main app shell and a simplification hotspot
- `src/features/` - feature modules
- `docs/platform-docs.md` - architecture reference
- `docs/runbooks/pm-hermes-content-hub.md` - signed PM Hermes rollout and rollback
- `docs/user-guides/` - end-user documentation

## Notes

- The canonical product name is `Content Hub`; `pm-dashboard` remains an alias.
- Supabase is the live backend. Legacy Cloudflare code is reference material, not the active architecture.
- The local PM Hermes integration exposes bounded reads plus exact-approval proposal/write tools; all live access and every write class remain disabled until separately enabled at the wrapper and Edge boundaries.
- Treat `.env*` files and `supabase/migrations/` as protected surfaces.
