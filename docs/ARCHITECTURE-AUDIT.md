## TECH STACK

- Frontend runtime: React `19.2.3`, React DOM `19.2.3` (`src/app.jsx` bootstraps via `createRoot`).
- Language/tooling: JavaScript + TypeScript types, TypeScript `5.6.x`, esbuild-based custom scripts (`tools/dev-server.mjs`, `tools/build.mjs`).
- Styling: Tailwind CSS `4.2.1` with custom theme tokens (`src/styles/app.css`), utility-first classes, custom UI primitives in `src/components/ui/*`.
- Data/auth backend: Supabase JS `2.45.0` (`src/lib/supabase.ts`) with Supabase Auth + Postgres schema/migrations in `supabase/migrations/*`.
- Local fallback persistence: `localStorage` helpers in `src/lib/storage.ts` + domain hooks for offline-first behavior.
- Testing/quality: Vitest, Testing Library, ESLint, Prettier, Husky.

## DIRECTORY STRUCTURE (annotated src/ tree)

```text
src/
|-- app.jsx                        # Main app shell, view-state routing, modal orchestration
|-- constants.ts                   # Domain enums/options (platforms, statuses, pillars, features)
|-- styles/
|   `-- app.css                    # Tailwind import + custom color theme tokens
|-- types/
|   |-- models.ts                  # Core domain interfaces (Entry, Idea, Influencer, etc.)
|   |-- api.ts                     # API request/response contracts
|   |-- ui.ts                      # UI/view routing/form prop type contracts
|   `-- index.ts                   # Type barrel
|-- lib/
|   |-- supabase.ts                # Supabase client + DB mapping layer (snake_case <-> app models)
|   |-- sanitizers.ts              # Data normalization + workflow derivation
|   |-- exportUtils.ts             # CSV/JSON export utilities
|   |-- performance.ts             # CSV performance merge logic
|   |-- guidelines.ts              # Guidelines defaults/normalization/storage
|   |-- storage.ts                 # localStorage persistence
|   |-- styles.ts                  # Shared utility class strings
|   `-- ...                        # audit, mentions, notifications, managers, utils, csv, email
|-- hooks/
|   |-- domain/
|   |   |-- useAuth.ts             # Auth lifecycle, login/invite/profile/password
|   |   |-- useEntries.ts          # Entry CRUD/workflow/comments/publish/sync queue integration
|   |   |-- useIdeas.ts            # Idea CRUD + sync
|   |   |-- useInfluencers.ts      # Influencer + custom niche persistence (Supabase)
|   |   |-- useGuidelines.ts       # Guidelines state + persistence
|   |   |-- useAdmin.ts            # User admin state/actions
|   |   |-- useApprovals.ts        # Outstanding approval calculations
|   |   |-- usePublishing.ts       # Publish settings/goals/targets
|   |   |-- useNotifications.ts    # Mentions/approval notification logic
|   |   `-- ...
|   `-- useApi.ts                  # HTTP helper for `/api/*` fallback paths
|-- components/
|   |-- ui/                        # Shared UI primitives (Button, Input, Card, Modal, Toggle, etc.)
|   |-- layout/                    # Sidebar/header/layout scaffolding
|   |-- auth/                      # Login + change password modal
|   `-- common/                    # Icons, notification bell, export menu, mention suggestions
|-- features/
|   |-- dashboard/                 # Dashboard + widgets
|   |-- calendar/                  # Calendar/month/week grids + filters + bulk date shift
|   |-- entry/                     # Create/edit/preview entry flows + assessment integrations
|   |-- ideas/                     # Idea capture and idea board
|   |-- approvals/                 # Approval queue views/modal
|   |-- kanban/                    # Workflow board
|   |-- analytics/                 # Performance analytics view
|   |-- engagement/                # Engagement log, directory, goals
|   |-- influencers/               # Influencer pipeline and modal
|   |-- guidelines/                # Guidelines modal
|   |-- performance/               # Performance CSV import modal
|   |-- publishing/                # Publish settings/actions
|   |-- assessment/                # Quick/Full/Golden Thread assessment widgets
|   |-- copy-check/                # Copy quality tooling
|   `-- social/                    # Social preview renderer
`-- __tests__/ + hooks/domain/__tests__
```

## ROUTING (every route/page, path, purpose)

Routing is state-driven in `src/app.jsx` (no `react-router`).

### Auth flow routes

- `authStatus = loading`
  - Path behavior: default startup state.
  - Purpose: session/access check screen.
- `authStatus = login`
  - Path behavior: shown when no valid session/invite.
  - Component: `LoginScreen`.
  - Purpose: password login, sign-up, magic-link sign-in.
- `authStatus = invite`
  - Path/query behavior: triggered by `?invite=<token>`.
  - Purpose: invite activation (set password).
- `authStatus = ready`
  - Purpose: main authenticated app.

### Main app view routes (`currentView`)

- `dashboard` (also `menu` alias)
  - Hash set by sidebar: `#dashboard`.
  - Component: `DashboardView`.
  - Purpose: overview widgets, quick actions, approvals/deadlines snapshots.
- `form`
  - Hash behavior: `#form`; special hash fallback `#create` forces this view.
  - Component: `EntryForm` page layout.
  - Purpose: create a content entry.
- `plan`
  - Hash set by sidebar content/ideas: `#content` or `#ideas`.
  - Purpose: planning workspace with tabs below.
- `analytics`
  - Hash: `#analytics`.
  - Component: `AnalyticsView`.
  - Purpose: platform/time-period performance analysis.
- `engagement`
  - Hash: `#engagement`.
  - Component: `EngagementView`.
  - Purpose: proactive engagement logging + goals.
- `influencers`
  - Hash: `#influencers`.
  - Component: `InfluencersView`.
  - Purpose: influencer pipeline management.
- `admin`
  - Hash: `#admin`.
  - Purpose: user/feature management, audits, publishing settings.

### Plan sub-routes (`planTab` when `currentView === plan`)

- `plan` -> calendar planning (`CalendarView`).
- `trash` -> soft-deleted entries recovery/permanent delete UI.
- `kanban` -> production workflow board (`KanbanView`).
- `approvals` -> approvals queue (`ApprovalsView`).
- `ideas` -> side-by-side `IdeaForm` + `IdeasBoard`.

### Deep-link behaviors

- `?entry=<id>`: opens entry detail when authenticated and entry is available.
- `#create`: hashchange fallback to open create-content form.

## SUPABASE SCHEMA (every table, columns, types, foreign keys)

Source of truth audited from `supabase/migrations/001-008*.sql`.

### `user_profiles`

- `id UUID PRIMARY KEY DEFAULT uuid_generate_v4()`
- `auth_user_id UUID UNIQUE`
- `email TEXT UNIQUE NOT NULL`
- `name TEXT NOT NULL`
- `features JSONB DEFAULT '[]'::jsonb`
- `status TEXT DEFAULT 'pending' CHECK (status IN ('pending','active','disabled'))`
- `is_admin BOOLEAN DEFAULT false`
- `is_approver BOOLEAN DEFAULT false`
- `avatar_url TEXT`
- `created_at TIMESTAMPTZ DEFAULT NOW()`
- `updated_at TIMESTAMPTZ DEFAULT NOW()`
- `last_login_at TIMESTAMPTZ`
- `manager_email TEXT` (added in migration `005`)
- Foreign keys:
  - `auth_user_id -> auth.users(id) ON DELETE CASCADE`

### `entries`

- `id UUID PRIMARY KEY DEFAULT uuid_generate_v4()`
- `date DATE NOT NULL`
- `platforms JSONB DEFAULT '[]'::jsonb`
- `asset_type TEXT DEFAULT 'Design'`
- `caption TEXT`
- `platform_captions JSONB DEFAULT '{}'::jsonb`
- `first_comment TEXT`
- `approval_deadline DATE`
- `status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected'))`
- `approvers JSONB DEFAULT '[]'::jsonb`
- `author TEXT`
- `author_email TEXT`
- `campaign TEXT`
- `content_pillar TEXT`
- `preview_url TEXT`
- `checklist JSONB DEFAULT '{}'::jsonb`
- `analytics JSONB DEFAULT '{}'::jsonb`
- `workflow_status TEXT DEFAULT 'Draft' CHECK (workflow_status IN ('Draft','In Review','Approved','Scheduled','Published'))`
- `status_detail TEXT`
- `ai_flags JSONB DEFAULT '[]'::jsonb`
- `ai_score JSONB DEFAULT '{}'::jsonb`
- `testing_framework_id UUID`
- `testing_framework_name TEXT`
- `created_at TIMESTAMPTZ DEFAULT NOW()`
- `updated_at TIMESTAMPTZ DEFAULT NOW()`
- `approved_at TIMESTAMPTZ`
- `deleted_at TIMESTAMPTZ`
- Added by migration `007`:
  - `audience_segments JSONB DEFAULT '[]'::jsonb`
  - `golden_thread_pass BOOLEAN`
  - `assessment_scores JSONB DEFAULT '{}'::jsonb`
- Added by migration `008`:
  - `evergreen BOOLEAN DEFAULT false`
  - `influencer_id TEXT`
  - `url TEXT`
  - `script TEXT`
  - `design_copy TEXT`
  - `carousel_slides JSONB DEFAULT '[]'::jsonb`
- Check constraints:
  - `audience_segments_is_array`
  - `assessment_scores_is_object`
  - `carousel_slides_is_array`
- Foreign keys: none.

### `ideas`

- `id UUID PRIMARY KEY DEFAULT uuid_generate_v4()`
- `type TEXT DEFAULT 'Other'`
- `title TEXT NOT NULL`
- `notes TEXT`
- `links JSONB DEFAULT '[]'::jsonb`
- `attachments JSONB DEFAULT '[]'::jsonb`
- `inspiration TEXT`
- `created_by TEXT`
- `created_by_email TEXT`
- `target_date DATE`
- `target_month TEXT`
- `created_at TIMESTAMPTZ DEFAULT NOW()`
- Foreign keys: none.

### `guidelines`

- `id TEXT PRIMARY KEY DEFAULT 'default'`
- `char_limits JSONB DEFAULT '{}'::jsonb`
- `banned_words JSONB DEFAULT '[]'::jsonb`
- `required_phrases JSONB DEFAULT '[]'::jsonb`
- `language_guide TEXT`
- `hashtag_tips TEXT`
- `updated_at TIMESTAMPTZ DEFAULT NOW()`
- Note: `teams_webhook_url` existed initially and was removed in migration `004`.
- Foreign keys: none.

### `linkedin_submissions`

- `id UUID PRIMARY KEY DEFAULT uuid_generate_v4()`
- `submission_type TEXT DEFAULT 'My own account'`
- `status TEXT DEFAULT 'Draft'`
- `title TEXT`
- `post_copy TEXT`
- `comments TEXT`
- `owner TEXT`
- `owner_email TEXT`
- `submitter TEXT`
- `submitter_email TEXT`
- `links JSONB DEFAULT '[]'::jsonb`
- `attachments JSONB DEFAULT '[]'::jsonb`
- `target_date DATE`
- `created_at TIMESTAMPTZ DEFAULT NOW()`
- `updated_at TIMESTAMPTZ DEFAULT NOW()`
- Foreign keys: none.

### `testing_frameworks`

- `id UUID PRIMARY KEY DEFAULT uuid_generate_v4()`
- `name TEXT NOT NULL`
- `hypothesis TEXT`
- `audience TEXT`
- `metric TEXT`
- `duration TEXT`
- `status TEXT DEFAULT 'Planned' CHECK (status IN ('Planned','Running','Completed','Cancelled'))`
- `notes TEXT`
- `created_at TIMESTAMPTZ DEFAULT NOW()`
- Foreign keys: none.

### `activity_log`

- `id UUID PRIMARY KEY DEFAULT uuid_generate_v4()`
- `action_type TEXT NOT NULL`
- `target_type TEXT NOT NULL`
- `target_id UUID`
- `target_title TEXT`
- `actor_email TEXT NOT NULL`
- `actor_name TEXT`
- `details JSONB DEFAULT '{}'::jsonb`
- `related_users JSONB DEFAULT '[]'::jsonb`
- `created_at TIMESTAMPTZ DEFAULT NOW()`
- Foreign keys: none.

### `notifications`

- `id UUID PRIMARY KEY DEFAULT uuid_generate_v4()`
- `user_email TEXT NOT NULL`
- `type TEXT NOT NULL`
- `title TEXT NOT NULL`
- `message TEXT`
- `link TEXT`
- `read BOOLEAN DEFAULT false`
- `created_at TIMESTAMPTZ DEFAULT NOW()`
- Foreign keys: none.

### `app_secrets`

- `key TEXT PRIMARY KEY`
- `value TEXT NOT NULL`
- `updated_at TIMESTAMPTZ DEFAULT NOW()`
- Foreign keys: none.

### Trigger/function layer

- Function `update_updated_at_column()` updates `updated_at` on update.
- Triggers applied to: `user_profiles`, `entries`, `linkedin_submissions`, `guidelines`.

### RLS/policy summary

- RLS enabled for all main tables above (plus `app_secrets`).
- Admin helper functions: `is_admin()`, `current_user_email()`.
- Notable hardening: migration `003_fix_user_profile_rls.sql` restricts self-profile updates to prevent role/feature escalation.

### Schema drift found (code vs migrations)

`src/lib/supabase.ts` reads/writes two tables not created by any migration file:

- `influencers` (expected columns inferred from `InfluencerRow`: `id`, `created_at`, `created_by`, `name`, `handle`, `profile_url`, `platform`, `platform_profiles`, `follower_count`, `engagement_rate`, `contact_email`, `niche`, `estimated_rate`, `notes`, `status`).
- `custom_niches` (expected columns inferred from API calls: `id`, `niches`).

Also, `entries.influencer_id` is currently `TEXT` without a foreign key constraint.

## DATA TYPES (key TypeScript interfaces)

Key models are in `src/types/models.ts`:

- `User`: identity, role flags, feature flags, invite metadata.
- `Entry`: core content entity. Includes scheduling, approvals, captions per platform, checklist, analytics, workflow, strategy fields (`audienceSegments`, `goldenThreadPass`, `assessmentScores`), influencer link, production fields (`url`, `script`, `designCopy`, `carouselSlides`), and publishing fields.
- `Idea`: idea bank record with links, attachments, planning date/month, conversion metadata.
- `Guidelines`: copy standards (`charLimits`, banned/required terms, language/hashtag guidance).
- `Comment`: timeline/comment payload with mention support.
- `Notification`: user notification model.
- `AuditEntry`: audit event model.
- `EngagementActivity`, `EngagementAccount`, `EngagementGoals`: engagement tracking models.
- `Influencer`, `PlatformProfile`: influencer pipeline models.

Supporting type layers:

- `src/types/ui.ts`: `ViewType`, `PlanTab`, filter/form/event types.
- `src/types/api.ts`: request/response contracts for auth, entries, ideas, users, guidelines, notify, audit.
- `src/lib/supabase.ts`: DB row interfaces (`EntryRow`, `IdeaRow`, etc.) for snake_case DB mapping.

## EXISTING VIEWS (name, route, what it shows)

- Auth Loading View (`authStatus=loading`): session/access verification state.
- Login View (`authStatus=login`): sign-in/sign-up/magic-link UI.
- Invite Activation View (`authStatus=invite`, `?invite=`): password setup for invite acceptance.
- Dashboard (`currentView=dashboard/menu`): KPI widgets, pipeline, approvals, deadlines, quick actions.
- Create Content (`currentView=form`, `#create` fallback): entry creation form + mini calendar sidebar.
- Plan Calendar (`currentView=plan`, `planTab=plan`): month/week planning grids, filters, import, deadlines, bulk date shift.
- Plan Trash (`currentView=plan`, `planTab=trash`): 30-day soft-delete recovery and permanent delete actions.
- Plan Board (`currentView=plan`, `planTab=kanban`): status-column kanban board.
- Plan Approvals (`currentView=plan`, `planTab=approvals`): approval queue cards and approve/open actions.
- Plan Ideas (`currentView=plan`, `planTab=ideas`): idea capture + idea library, convert-to-entry.
- Analytics (`currentView=analytics`): period/platform performance summaries, comparisons, top performers.
- Engagement (`currentView=engagement`): activity log, account directory, weekly goals tracking.
- Influencers (`currentView=influencers`): influencer pipeline table with filters/sorting and detail modal entry point.
- Admin (`currentView=admin`): audit feed, approver directory, user roster management, access control, publishing settings.

Modal views used across routes:

- `EntryModal`, `EntryPreviewModal`, `ApprovalsModal`, `GuidelinesModal`, `PerformanceImportModal`, `InfluencerModal`, `ChangePasswordModal`.

## EXISTING FORMS (name, all fields, where it submits)

- Invite Activation Form (`app.jsx`):
  - Fields: `password`, `confirm password`.
  - Submit path: `submitInvite` (`useAuth`) -> `window.api.acceptInvite(...)` or `PUT /api/auth`.

- Login / Signup / Magic Link (`components/auth/LoginScreen.tsx`):
  - Sign-in fields: `email`, `password`.
  - Sign-up fields: `email`, `password`, `confirm password`.
  - Magic-link action uses `email`.
  - Submit path: `window.api.login`, `window.api.signUp`, `window.api.signInWithMagicLink`.

- Profile Form (`app.jsx` profile modal):
  - Fields: `display name`, `profile photo` (file upload).
  - Submit path: `handleProfileSave` (`useAuth`) -> `window.api.updateProfile` or `PUT /api/user`.

- Change Password Modal (`components/auth/ChangePasswordModal.tsx`):
  - Fields: `current password` (conditional), `new password`, `confirm new password`.
  - Submit path: `handleChangePassword` (`useAuth`) -> `window.api.changePassword` or `PUT /api/password`.

- Create Content Form (`features/entry/EntryForm.jsx`):
  - Fields: `date`, `approvalDeadline`, `campaign`, `contentPillar`, `audienceSegments`, `influencerId` (if enabled), `approvers`, `platforms`/all-platforms toggle, `caption` + platform caption overrides, `url`, `previewUrl` (+ file), `assetType`, conditional `script`/`designCopy`/`carouselSlides` (count + per-slide text), `firstComment`, `quickAssessment`, `goldenThread`.
  - Submit path: `addEntry` (`useEntries`) -> local state + sync queue -> `window.api.createEntry(...)`.

- Entry Edit Form (`features/entry/EntryModal.jsx` author mode):
  - Fields: `date`, `approvers`, `campaign`, `contentPillar`, `evergreen`, `platforms`, `caption` + platform overrides, `url`, `previewUrl` (+ file), `assetType`, conditional `script`/`designCopy`/`carouselSlides`, `firstComment`, checklist items, quick/golden-thread/full assessments.
  - Submit path: `onSave={upsert}` -> `useEntries.upsert` -> `window.api.updateEntry(...)` or create for `_isNew` clones.

- Entry Comment Form (`EntryModal.jsx`):
  - Fields: `comment body` with mention suggestions.
  - Submit path: local update via `onUpdate={upsert}` + mention notifications via `onNotifyMentions`.

- Entry Preview Comment Form (`EntryPreviewModal.jsx`):
  - Fields: `comment body` with mention suggestions.
  - Submit path: `onUpdate={upsert}` + mention notifications.

- Idea Form (`features/ideas/IdeaForm.tsx`):
  - Fields: `type`, `logged by` (readonly), `targetMonth`, `targetDate`, `title`, `notes`, `inspiration`, dynamic `links[]`, `attachments[]` (multi-file).
  - Submit path: `addIdea` (`useIdeas`) -> sync queue -> `window.api.createIdea(...)`.

- Engagement Quick Log (`features/engagement/EngagementView.tsx`):
  - Fields: `platform`, `actionType`, `accountHandle`, `note`.
  - Submit path: parent callback `onAddActivity` (currently in-memory state update in `app.jsx`).

- Engagement Account Add Form (`features/engagement/EngagementView.tsx`):
  - Fields: `handle`, `platform`, `displayName`, `accountType`, `notes`.
  - Submit path: parent callback `onAddAccount` (currently in-memory state update in `app.jsx`).

- Engagement Goals Editor (`features/engagement/EngagementView.tsx`):
  - Fields: `weeklyComments`, `weeklyShares`, `weeklyReplies`, `weeklyLikes`, `weeklyFollows`, `weeklyDms`, `weekStartDay`.
  - Submit path: `onUpdateGoals` (currently in-memory state update).

- Bulk Date Shift Form (`features/calendar/BulkDateShift.tsx`):
  - Fields: `filterStartDate`, `filterEndDate`, selected `entryIds[]`, `daysDelta`.
  - Submit path: `onShift` -> `handleBulkDateShift` (`useEntries`) -> batch `window.api.updateEntry(id,{date})`.

- Guidelines Brand Form (`features/guidelines/GuidelinesModal.tsx`, Brand tab):
  - Fields: `bannedWords`, `requiredPhrases`, `languageGuide`, `hashtagTips`, per-platform `charLimits`, optional `teamsWebhookUrl` (admin).
  - Submit path: `handleGuidelinesSave` (`useGuidelines`) -> local + sync queue -> `window.api.saveGuidelines(...)`; webhook path via `onSaveWebhookUrl` when wired.

- Performance Import (`features/performance/PerformanceImportModal.tsx`):
  - Fields: `csv file`.
  - Submit path: `onImport` -> `importPerformanceDataset` (`app.jsx`) -> `mergePerformanceData` + `window.api.updateEntry(...)` for analytics updates.

- Influencer Detail Form (`features/influencers/InfluencerModal.tsx`):
  - Fields: `name`, `platformProfiles[]` (`platform`, `handle`, `profileUrl`), `followerCount`, `engagementRate`, `contactEmail`, `niche`, `estimatedRate`, `status`, `notes`, entry linking selector.
  - Submit path: `onSave` -> `handleAddInfluencer`/`handleUpdateInfluencer` -> `SUPABASE_API.saveInfluencer(...)`; niche persistence via `SUPABASE_API.saveCustomNiches(...)`.

- Admin User Creation Controls (`app.jsx` admin section):
  - Fields: `firstName`, `lastName`, `email`, `features[]`, `isApprover`.
  - Submit path: `addUser` (`useAdmin`) -> `window.api.createUser(...)`.

- Admin User Row Controls (`app.jsx` admin section):
  - Fields/actions: `managerEmail` selector, approver toggle, access modal open, remove user.
  - Submit path: manager change -> `SUPABASE_API.updateUserManager(...)`; role/access/remove -> `window.api.updateUser(...)` / `window.api.deleteUser(...)`.

- Access Modal (`app.jsx` usage of access control modal):
  - Fields: feature checkbox set per user.
  - Submit path: `handleAccessSave` (`useAdmin`) -> `window.api.updateUser(userId,{features})`.

## UI PATTERNS (component library, conventions)

- Component system: custom primitives in `src/components/ui/*` (`Button`, `Input`, `Textarea`, `Card`, `Badge`, `Toggle`, `Modal`, etc.); no third-party UI kit.
- Styling conventions:
  - Tailwind utility classes in-component.
  - Shared class tokens in `src/lib/styles.ts` (e.g., `selectBaseClasses`, `fileInputClasses`).
  - Theming via custom Tailwind v4 tokens (`ocean`, `aqua`, `graystone`) in `src/styles/app.css`.
- Layout conventions:
  - Fixed left sidebar + scrollable content pane.
  - Card-based surfaces (`rounded-2xl/3xl`, soft borders, shadow-sm/xl).
  - Rounded full-pill controls and compact action bars.
- Interaction conventions:
  - Modal-first detail editing (entry/influencer/guidelines/import/password).
  - Multi-step state transitions via view flags (`currentView`, `planTab`, `authStatus`).
  - Mention autocomplete in comment textareas.
  - Toggle + select driven filtering in calendar and engagement views.
- Data flow conventions:
  - Domain hooks own business logic (`useEntries`, `useIdeas`, `useAuth`, etc.).
  - Sync queue wraps server mutations and retries (`useSyncQueue`).
  - Local-first UI updates followed by async sync task.
  - Supabase mapping layer translates app camelCase <-> DB snake_case.
- Accessibility conventions:
  - `Modal` implements focus trap, escape handling, and label requirements (`aria-label`/`aria-labelledby`).

## PLANNED FEATURES — TOUCH POINTS

### 1. Priority tiering (priority levels on content items)

Files to change:

- `src/types/models.ts` (add `priorityTier` to `Entry`)
- `src/types/api.ts` (include in create/update request types)
- `src/lib/sanitizers.ts` (normalize/default priority)
- `src/lib/supabase.ts` (`EntryRow`, mappers, save/fetch)
- `src/constants.ts` (priority enum/options + display colors)
- `src/features/entry/EntryForm.jsx` (new field)
- `src/features/entry/EntryModal.jsx` (edit/view field)
- `src/features/calendar/CalendarView.tsx`, `MonthGrid.tsx`, `WeekGrid.tsx` (filter/badge)
- `src/features/kanban/KanbanBoard.tsx` (visual indicator/sort)
- `src/features/dashboard/*` widgets where prioritization matters
  Schema changes needed:
- `entries.priority_tier` (recommended `TEXT` with check constraint or `ENUM`, default e.g. `'Medium'`)
- Optional index on `entries.priority_tier`.

### 2. Exportable calendar

Files to change:

- `src/features/calendar/CalendarView.tsx` (export controls in header)
- `src/lib/exportUtils.ts` (add ICS generation and date-range calendar export)
- `src/components/common/ExportMenu.tsx` (extend menu or embed in calendar)
- `src/app.jsx` (wire export UI if centralized)
- Optional: add tests under `src/__tests__/` for ICS formatting
  Schema changes needed:
- None for basic client-side file export (CSV/ICS download).
- Optional (if shareable subscribed feeds are needed): new table `calendar_export_tokens` with token, owner, filters, expiry.

### 3. Content request intake form (key messages, images, audiences, approvers, deadlines -> auto-generates brief)

Files to change:

- `src/app.jsx` + `src/components/layout/Sidebar.tsx` (new route/nav entry)
- New feature module (recommended `src/features/requests/*`) for intake UI and detail view
- `src/types/models.ts` and `src/types/api.ts` (new `ContentRequest` model)
- `src/lib/supabase.ts` (CRUD for new request tables)
- `src/hooks/domain/*` (new hook or extension for request lifecycle)
- `src/features/entry/EntryForm.jsx` or conversion utility for auto-generated briefs
  Schema changes needed:
- New table `content_requests` (requester, title, key_messages, images/asset refs, audience_segments, approvers, deadline, status, generated_brief, linked_entry_id, timestamps).
- Optional child table `content_request_assets` (if not storing assets as JSON).
- Optional FK `content_requests.linked_entry_id -> entries.id`.

### 4. Opportunity radar (log reactive content moments: date, description, angle, urgency)

Files to change:

- `src/app.jsx` + `src/components/layout/Sidebar.tsx` (new view route)
- New feature module (recommended `src/features/opportunities/*`) for list + create/edit form
- `src/types/models.ts` (`Opportunity` interface)
- `src/lib/supabase.ts` + domain hook for opportunity CRUD
- `src/features/dashboard/DashboardView.tsx` (optional widget surfacing urgent opportunities)
  Schema changes needed:
- New table `opportunities` with columns: `id`, `date`, `description`, `angle`, `urgency`, `status`, `created_by`, `linked_entry_id`, `created_at`, `updated_at`.
- Optional FK `linked_entry_id -> entries.id`.

### 5. Monthly narrative planning view (how posts connect thematically)

Files to change:

- `src/app.jsx` (new `planTab` or dedicated view)
- `src/components/layout/TabNavigation.tsx` + `src/constants.ts` (`PLAN_TAB_ORDER`, feature gating)
- New feature module (recommended `src/features/narrative/*`) for monthly map/timeline visualization
- `src/features/entry/EntryForm.jsx` and `src/features/entry/EntryModal.jsx` (tag entries with narrative metadata)
- `src/types/models.ts`, `src/lib/sanitizers.ts`, `src/lib/supabase.ts` (new narrative fields/mappings)
  Schema changes needed:
- Option A (minimal): add to `entries` -> `narrative_theme TEXT`, `narrative_phase TEXT`, `narrative_order INT`.
- Option B (normalized, recommended):
  - `narrative_themes` table (`id`, `month`, `title`, `objective`, `owner`, timestamps)
  - `entry_narrative_links` table (`entry_id`, `theme_id`, `phase`, `sequence`)
  - FKs: `entry_narrative_links.entry_id -> entries.id`, `entry_narrative_links.theme_id -> narrative_themes.id`.
