# Content Hub — Feature Specs

**Locked:** 2026-03-03
**Status:** Ready to build

---

## Feature A: Request Intake Form

**What it is:** A public (unauthenticated) form for Anthony and the fundraising team to submit content requests, replacing ad-hoc emails and Teams messages.

### Scope decisions

- No login required — anyone with the URL can submit
- Internal review UI lives inside the authenticated app (new tab in Content view)
- Admin converts accepted requests to entries (same pattern as idea→entry)

### New DB table: `content_requests`

| Column                  | Type          | Notes                                                                   |
| ----------------------- | ------------- | ----------------------------------------------------------------------- |
| `id`                    | uuid PK       |                                                                         |
| `title`                 | text NOT NULL | Short description of what's needed                                      |
| `description`           | text          | Full brief                                                              |
| `requested_by_name`     | text NOT NULL | Submitter name (free text, no auth)                                     |
| `requested_by_email`    | text NOT NULL | Submitter email                                                         |
| `platforms`             | text[]        | Which platforms content is for                                          |
| `content_type`          | text          | `'Social post' \| 'Email' \| 'Blog' \| 'Video' \| 'Other'`              |
| `deadline`              | date          | When they need it by                                                    |
| `campaign`              | text          | Which campaign/initiative                                               |
| `notes`                 | text          | Additional context, links, references                                   |
| `status`                | text          | `'new' \| 'acknowledged' \| 'in_progress' \| 'converted' \| 'declined'` |
| `converted_to_entry_id` | uuid FK       | Set when converted to a calendar entry                                  |
| `converted_at`          | timestamptz   |                                                                         |
| `acknowledged_by`       | text          | Team member who picked it up                                            |
| `created_at`            | timestamptz   |                                                                         |

**RLS:** Allow anon INSERT (no SELECT). Authenticated users can SELECT/UPDATE/DELETE.

### New components

- `public/request.html` — standalone static page, no auth, loads Supabase anon client directly
- `src/features/requests/RequestsView.tsx` — internal view showing the requests queue
- `src/features/requests/RequestCard.tsx` — request item with status + convert action
- `src/hooks/domain/useRequests.ts` — CRUD hook following useIdeas pattern

### Routing

- New `planTab` value: `'requests'`
- Sidebar item: "Requests" under Content nav group (gated by `admin` or new `requests` feature flag)
- Badge count on sidebar item showing `new` + `acknowledged` requests

---

## Feature B: Opportunity Radar

**What it is:** A place to log upcoming content moments — awareness days, news hooks, research milestones, partner moments — so they surface proactively.

### Scope decisions

- Manual entry only (no auto-populated calendar)
- Lives as a new top-level sidebar item (its own view, not a content sub-tab)
- Calendar integration: opportunities render as markers on MonthGrid alongside entries

### New DB table: `opportunities`

| Column                  | Type          | Notes                                                                                   |
| ----------------------- | ------------- | --------------------------------------------------------------------------------------- |
| `id`                    | uuid PK       |                                                                                         |
| `title`                 | text NOT NULL |                                                                                         |
| `date`                  | date NOT NULL | When the moment occurs                                                                  |
| `type`                  | text          | `'Awareness day' \| 'News hook' \| 'Research milestone' \| 'Partner moment' \| 'Other'` |
| `notes`                 | text          | Context, angles, relevant links                                                         |
| `status`                | text          | `'spotted' \| 'actioned' \| 'dismissed'`                                                |
| `converted_to_entry_id` | uuid FK       | Set when a content entry is created for it                                              |
| `converted_at`          | timestamptz   |                                                                                         |
| `created_by`            | text          |                                                                                         |
| `created_at`            | timestamptz   |                                                                                         |

### New components

- `src/features/opportunities/OpportunitiesView.tsx` — list view, sorted by date, grouped by month
- `src/features/opportunities/OpportunityForm.tsx` — add/edit form (modal)
- `src/features/opportunities/OpportunityCard.tsx` — card with type badge, date, "Create content" CTA
- `src/hooks/domain/useOpportunities.ts` — CRUD hook

### Routing

- New `currentView` value: `'opportunities'`
- New sidebar nav item: "Opportunities" (visible to all users)
- Calendar: pass `opportunities` to `CalendarView` → render as small markers on MonthGrid days (different colour/style from entries)

---

## Feature C: Monthly Narrative Planning

**What it is:** A higher-level monthly view showing the narrative arc across a month — pillar distribution, campaign balance, platform coverage, and content gaps by week.

### Scope decisions

- No new table — derives from existing `entries` data
- New tab in Content view (`planTab: 'narrative'`)
- Reuses existing `monthCursor` navigation

### What it shows

**Week-by-week grid:** 4-5 rows (one per week), each showing:

- Content pillar distribution for that week (colour-coded pills)
- Campaign tags
- Platform coverage (which platforms have content)
- Entry count / status overview (approved, draft, pending)
- Gaps highlighted (weeks with no content, pillars missing, platforms not covered)

**Month summary bar (top):**

- Total entries planned
- Pillar balance chart (reuse PillarBalanceWidget logic)
- Platform coverage (reuse PlatformCoverageWidget logic)
- Approval status breakdown

### New components

- `src/features/calendar/NarrativeView.tsx` — the tab component
- `src/features/calendar/NarrativeWeekRow.tsx` — one row per week with pillar/campaign/platform breakdown
- `src/features/calendar/NarrativeSummaryBar.tsx` — month-level stats header

### Routing

- New `planTab` value: `'narrative'`
- Tab label: "Narrative" alongside Calendar / Board / Approvals / Ideas / Requests

---

## Build order

1. **Feature A (Intake Form)** — highest operational value, solves Anthony's problem immediately
2. **Feature B (Opportunity Radar)** — relatively self-contained, new table + view
3. **Feature C (Narrative Planning)** — no DB work, derived view, can build once entries data is solid
