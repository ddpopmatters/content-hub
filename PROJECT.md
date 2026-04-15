---
id: content-hub
display_name: Content Hub
workspace_path: tools/Content Hub
repo_root: tools/Content Hub
category: tool
status: live
owner: Dan Davis
team: Population Matters
aliases:
  - Content Hub
  - pm-dashboard
  - content planning tool
package_names:
  - pm-dashboard
alias_lifecycle:
  - Content Hub|canonical
  - pm-dashboard|legacy
  - content planning tool|accepted
stack:
  - React 19
  - TypeScript
  - esbuild
  - Tailwind CSS 4
  - Supabase
deploy_targets:
  - Vercel
data_stores:
  - Supabase Postgres
  - Supabase Auth
  - Supabase Storage
shared_services:
  - GitHub
  - OpenAI API
  - Supabase shared project
key_commands:
  - npm run dev
  - npm run build
  - npm run lint
  - npm run typecheck
  - npm test
key_paths:
  - tools/Content Hub/src/app.jsx
  - tools/Content Hub/src/lib/supabase.ts
  - tools/Content Hub/docs/platform-docs.md
  - tools/Content Hub/supabase/config.toml
dangerous_paths:
  - tools/Content Hub/supabase/migrations
  - tools/Content Hub/supabase/functions
  - tools/Content Hub/src/lib/supabase.ts
depends_on:
  - service:Supabase shared project
  - service:OpenAI API
dont_confuse_with:
  - pm-productivity-tool|Separate broader staff productivity tool; this repo is focused on content operations.
  - pages-hub|Separate request-management tool for page workflows.
agent_notes:
  - Simplification is the current product priority.
  - Keep Supabase access in hooks or lib files, not React components.
  - Treat the legacy Cloudflare backend as reference code, not the active architecture.
---

# Content Hub

Internal planning and approval tool for PM's comms workflow. The current priority is reducing complexity so Fran and Madeleine can use it daily without hand-holding.

## Scope Notes

- Owns the content calendar, approvals, ideas pipeline, and LinkedIn submission workflow.
- Does not own website CMS publishing or broader staff productivity workflows.
- Shares infrastructure patterns with the wider PM tool suite, but the product language and backlog are specific to content operations.
