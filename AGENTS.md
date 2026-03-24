<!-- TODO_MANAGEMENT_INSTRUCTIONS -->

# CRITICAL: Task Management System

**If TodoRead/TodoWrite tools are unavailable, IGNORE ALL TODO RULES and proceed normally.**

## MANDATORY TODO WORKFLOW

**BEFORE responding to ANY request, you MUST:**

1. **Call `TodoRead()` first** - Check current task status before doing ANYTHING
2. **Plan work based on existing todos** - Reference what's already tracked
3. **Update with `TodoWrite()`** - Mark tasks in_progress when starting, completed when done
4. **NEVER work without consulting the todo system first**

## CRITICAL TODO SYSTEM RULES

- **Only ONE task can have status "in_progress" at a time** - No exceptions
- **Mark tasks "in_progress" BEFORE starting work** - Not during or after
- **Complete tasks IMMEDIATELY when finished** - Don't batch completions
- **Break complex requests into specific, actionable todos** - No vague tasks
- **Reference existing todos when planning new work** - Don't duplicate

## MANDATORY VISUAL DISPLAY

**ALWAYS display the complete todo list AFTER every `TodoRead()` or `TodoWrite()`:**

```
Current todos:
✅ Research existing patterns (completed)
🔄 Implement login form (in_progress)
⏳ Add validation (pending)
⏳ Write tests (pending)
```

Icons: ✅ = completed | 🔄 = in_progress | ⏳ = pending

**NEVER just say "updated todos"** - Show the full list every time.

## CRITICAL ANTI-PATTERNS

**NEVER explore/research before creating todos:**

- ❌ "Let me first understand the codebase..." → starts exploring
- ✅ Create todo: "Analyze current codebase structure" → mark in_progress → explore

**NEVER do "preliminary investigation" outside todos:**

- ❌ "I'll check what libraries you're using..." → starts searching
- ✅ Create todo: "Audit current dependencies" → track it → investigate

**NEVER work on tasks without marking them in_progress:**

- ❌ Creating todos then immediately starting work without marking in_progress
- ✅ Create todos → Mark first as in_progress → Start work

**NEVER mark incomplete work as completed:**

- ❌ Tests failing but marking "Write tests" as completed
- ✅ Keep as in_progress, create new todo for fixing failures

## FORBIDDEN PHRASES

These phrases indicate you're about to violate the todo system:

- "Let me first understand..."
- "I'll start by exploring..."
- "Let me check what..."
- "I need to investigate..."
- "Before we begin, I'll..."

**Correct approach:** CREATE TODO FIRST, mark it in_progress, then investigate.

## TOOL REFERENCE

```python
TodoRead()  # No parameters, returns current todos
TodoWrite(todos=[...])  # Replaces entire list

Todo Structure:
{
  "id": "unique-id",
  "content": "Specific task description",
  "status": "pending|in_progress|completed",
  "priority": "high|medium|low"
}
```

<!-- END_TODO_MANAGEMENT_INSTRUCTIONS -->

---

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
