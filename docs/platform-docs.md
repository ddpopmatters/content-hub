# Platform Documentation — Content Hub

_Generated: 2026-03-11. Re-run `/update-platform-docs` after major feature changes._

# Content Hub Platform Documentation

This document provides a comprehensive overview of the Content Hub web application, covering its purpose, features, key user workflows, and known technical limitations. It is intended for developers joining the project.

---

## 1. Product Overview

The **Content Hub** is a centralized web application designed to streamline the entire content lifecycle for Population Matters. It provides a single source of truth for planning, creating, approving, publishing, and analyzing social media and digital content.

**What it does:**

- **Content Planning**: Offers calendar and Kanban views for organizing content, tracking upcoming events (Content Peaks), managing ongoing series, and logging reactive rapid responses.
- **Content Creation**: Provides a detailed form for drafting content entries, including platform-specific captions, asset management, and meta-data tagging for strategic alignment.
- **Workflow & Approvals**: Implements a structured approval process with customizable sign-off routes, a dedicated approvals queue, and in-app notifications for mentions and approval requests.
- **Strategy & Assessment**: Integrates tools for content assessment (Golden Thread, Quick Assessment, Full Assessment) to ensure alignment with brand guidelines and strategic objectives. Features AI-powered copy checking.
- **Performance Tracking**: Allows manual logging or bulk import of analytics data for entries, providing insights dashboards, breakdown by various dimensions, and compliance tracking.
- **Idea & Opportunity Management**: Maintains a library of content ideas and a radar for external opportunities that could inform rapid response content.
- **User & Access Management**: Provides administrative tools for managing user accounts, roles (Admin, Approver), and feature access.
- **Publishing Integrations**: Supports connections to external platforms (e.g., Teams webhooks) and provides status tracking for publishing.

**Who uses it:**

The Content Hub is used by various roles within Population Matters involved in digital communications and strategy:

- **Content Creators/Authors**: Draft new content, manage asset details, and track their entries through the production pipeline.
- **Social Media Managers**: Oversee the content calendar, schedule posts, monitor performance, and manage community engagement.
- **Approvers (Comms Lead, Policy Lead, etc.)**: Review content entries, provide feedback, and give final approval based on designated sign-off routes.
- **Administrators**: Manage user accounts, permissions, audit logs, and global content standards.
- **Strategists**: Utilize analytics and reporting features to evaluate content performance, identify trends, and refine content strategy.
- **PR/Communications Leads**: Monitor opportunities for rapid response, track influencer collaborations, and ensure brand consistency through guidelines.

---

## 2. All Features

This section details every screen, page, component, and capability visible in the application's codebase.

### 2.1. Core Application Structure

- **ContentDashboard (`app.jsx`)**: The main authenticated application container. Manages global state, routing (via `currentView` and `planTab`), and orchestrates interactions between various feature hooks.
- **LoginScreen (`components/auth/LoginScreen.tsx`)**: The initial screen for user authentication, supporting both password-based login and magic link (email) sign-in. It also handles new user sign-up.
- **Invite Screen (inline in `app.jsx`)**: A specialized view displayed when a user accesses the app via an invite token, prompting them to set their initial password.
- **Sidebar (`components/layout/Sidebar.tsx`)**: The fixed left-hand navigation panel, providing access to main views like Dashboard, Content, Insights, Reporting, Influencers, and Admin. Displays current user profile info and unread notification counts.
- **Profile Menu (inline in `app.jsx`)**: A dropdown accessed from the sidebar showing user's name, email, avatar, and options to update profile (display name, photo) or change password.
- **NotificationBell (`components/common/NotificationBell.tsx`)**: A bell icon in the header that displays a dropdown of recent in-app notifications, including mentions and approval requests.
- **Sync Queue Toast (inline in `app.jsx`)**: A banner displayed at the top of the main content area indicating pending background synchronization tasks.
- **ChangePasswordModal (`components/auth/ChangePasswordModal.tsx`)**: A modal for users to update their password. Can require the current password or allow setting a new one (e.g., after an invite).

### 2.2. Main Application Views & Features

#### 2.2.1. Dashboard (`features/dashboard`)

- **DashboardView (`features/dashboard/DashboardView.tsx`)**: The customizable landing page for authenticated users. Displays a selection of widgets providing quick insights and actions.
- **QuickActionsWidget (`dashboard/widgets/QuickActionsWidget.tsx`)**: Provides prominent buttons for common tasks like "Create Content," "Calendar," "Requests," "Reporting," "Approvals," and "Guidelines."
- **WeeklyStatsWidget (`dashboard/widgets/WeeklyStatsWidget.tsx`)**: Shows key performance metrics for the current week (posts published, total engagements, total reach, average engagement).
- **ApprovalQueueWidget (`dashboard/widgets/ApprovalQueueWidget.tsx`)**: Lists content entries awaiting the current user's approval.
- **UrgentOpportunitiesWidget (`dashboard/widgets/UrgentOpportunitiesWidget.tsx`)**: Highlights the count of high-urgency opportunities on the radar.
- **ContentPipelineWidget (`dashboard/widgets/ContentPipelineWidget.tsx`)**: Visualizes the overall content pipeline, showing counts of entries in different workflow stages (Draft, Pending Approval, Scheduled, Approved/Posted).
- **PillarBalanceWidget (`dashboard/widgets/PillarBalanceWidget.tsx`)**: Displays the distribution of content across different strategic content pillars for the last 30 days, with actual percentages.
- **PlatformCoverageWidget (`dashboard/widgets/PlatformCoverageWidget.tsx`)**: Shows content distribution across social media platforms for the last 30 days, categorized by platform tiers.
- **AudienceSegmentWidget (`dashboard/widgets/AudienceSegmentWidget.tsx`)**: Displays the breakdown of content by targeted audience segments over the last 30 days.
- **StrategyMixWidget (`dashboard/widgets/StrategyMixWidget.tsx`)**: Analyzes content categories against their strategic targets for the last 30 days, including reactive content, partner-led posts, and series/peaks.
- **ExecutionReadinessWidget (`dashboard/widgets/ExecutionReadinessWidget.tsx`)**: Summarizes the completion rates for various execution requirements (e.g., alt text, UTM plan, source verified) for recent content.
- **UpcomingPeaksWidget (`dashboard/widgets/UpcomingPeaksWidget.tsx`)**: Lists upcoming Content Peaks, showing their status and readiness score.
- **SeriesHealthWidget (`dashboard/widgets/SeriesHealthWidget.tsx`)**: Provides an overview of active content series, including total episodes and review status.
- **AssetMixWidget (`dashboard/widgets/AssetMixWidget.tsx`)**: Shows the ratio of different asset types (Video, Design, Carousel) scheduled for the current month versus their defined goals.

#### 2.2.2. Content Planning (`features/calendar`, `features/kanban`, `features/ideas`, `features/requests`, `features/peaks`, `features/series`, `features/responses`)

- **CalendarView (`features/calendar/CalendarView.tsx`)**: The primary content planning interface.
  - **View Modes**: Can switch between `month` (MonthGrid), `week` (WeekGrid), `board` (KanbanView), and `glance` (MonthlyGlance).
  - **MonthGrid (`features/calendar/MonthGrid.tsx`)**: A traditional calendar view showing content entries for a selected month, with drag-and-drop rescheduling. Highlights content gaps based on daily target.
  - **WeekGrid (`features/calendar/WeekGrid.tsx`)**: A detailed week-by-week view of content entries, also supporting drag-and-drop for rescheduling.
  - **MonthlyGlance (`features/calendar/MonthlyGlance.tsx`)**: A table-based list of all content for a month, allowing inline editing of workflow status and priority.
  - **KanbanView (`features/kanban/KanbanView.tsx`)**: A board-style view organizing content entries into customizable workflow columns (Draft, Ready for Review, Approved, Published).
  - **UpcomingDeadlines (`features/calendar/UpcomingDeadlines.tsx`)**: A sidebar component in the calendar view showing entries with approaching or overdue approval deadlines.
  - **MiniCalendar (`features/calendar/MiniCalendar.tsx`)**: A small calendar widget, often used in modals (e.g., "Create Content") to show content density.
  - **BulkDateShift (`features/calendar/BulkDateShift.tsx`)**: A tool for moving multiple selected entries forward or backward by a specified number of days.
  - **SavedFilters (`features/calendar/SavedFilters.tsx`)**: Allows users to save and apply custom filter combinations for the calendar/Kanban views.
- **ContentPeaksView (implied from `app.jsx` import `ContentPeaksView`)**: Manages and tracks key content moments or campaigns (e.g., World Population Day), showing linked content and readiness.
- **ContentSeriesView (implied from `app.jsx` import `ContentSeriesView`)**: Manages and tracks recurring content series, showing linked episodes and overall health.
- **RapidResponsesView (implied from `app.jsx` import `RapidResponsesView`)**: Organizes and tracks rapid response content, often created from opportunities.
- **IdeasBoard (`features/ideas/IdeasBoard.tsx`)**: A library of content ideas. Ideas can be filtered, marked as converted, and serve as a source for new content entries.
- **IdeaForm (`features/ideas/IdeaForm.tsx`)**: A form for logging new content ideas with details like type, title, notes, inspiration, links, and attachments.
- **ContentRequestsView (implied from `app.jsx` import `ContentRequestsView`)**: Manages content requests from internal stakeholders, allowing tracking and conversion into content entries.

#### 2.2.3. Content Entry & Lifecycle (`features/entry`, `features/assessment`, `features/copy-check`)

- **EntryForm (`features/entry/EntryForm.tsx`)**: The comprehensive form for creating new content entries. Includes fields for scheduling, platforms, captions (main and platform-specific), asset types, links, campaign, pillars, approvers, and various execution details.
- **EntryModal (`features/entry/EntryModal.jsx`)**: The detailed modal for viewing and editing an existing content entry. Allows editing all fields, manages lifecycle (approve, delete, clone, publish), displays comments, and shows audit trail.
- **EntryPreviewModal (`features/entry/EntryPreviewModal.jsx`)**: A simplified modal for quickly viewing a content entry, primarily focused on the social media preview and comments. Used for quick glances from the calendar or notifications.
- **SocialPreview (implied from usage)**: A component used within `EntryForm`, `EntryModal`, and `EntryPreviewModal` to simulate how content will appear on various social media platforms.
- **ApproverMulti (`features/entry/ApproverMulti.tsx`)**: A multi-select component for choosing approvers, with recommendations based on sign-off routes.
- **AudienceSelector (`features/entry/AudienceSelector.tsx`)**: A component for selecting target audience segments.
- **PlatformGuidancePanel (`features/entry/PlatformGuidancePanel.tsx`)**: Displays contextual tips and best practices for selected platforms and content pillars from the Content Creation Guide.
- **TerminologyAlert (`features/entry/TerminologyAlert.tsx`)**: Flags specific words or phrases in the caption that violate brand terminology guidelines, suggesting alternatives.
- **QuickAssessment (`features/assessment/QuickAssessment.tsx`)**: A set of quick checks (e.g., "Hook", "Platform fit") for content quality.
- **GoldenThreadCheck (`features/assessment/GoldenThreadCheck.tsx`)**: A critical assessment tool based on core ethical principles (coercion, blame, instrumentalisation, co-option) that content must pass.
- **FullAssessment (`features/assessment/FullAssessment.tsx`)**: A more detailed, multi-level assessment of content quality and strategic alignment.
- **CopyCheckSection (`features/copy-check/CopyCheckSection.tsx`)**: An AI-powered tool that analyzes captions for clarity, brevity, and adherence to brand guidelines, offering suggestions.

#### 2.2.4. Insights & Reporting (`features/analytics`, `features/engagement`, `features/reporting`, `features/performance`)

- **AnalyticsView (`features/analytics/AnalyticsView.tsx`)**: A dashboard for analyzing content performance.
  - **Filters**: Extensive filtering options by time period, platforms, metrics, content pillars, campaigns, asset types, authors, and statuses.
  - **Summary Cards**: Displays aggregated metrics (total posts, total metric value, average per post, coverage).
  - **Breakdown Cards**: Shows performance distribution across different dimensions (platforms, pillars, categories, etc.).
  - **Trend Card**: Visualizes metric performance over time.
  - **Top Performers**: Lists the highest-performing content entries based on selected metrics.
  - **Data Readiness & Strategy Compliance**: Sections highlighting data completeness and adherence to strategic requirements.
- **AnalyticsInputWizard (`features/analytics/AnalyticsInputWizard.tsx`)**: A guided wizard for manually logging performance metrics for specific entries and platforms.
- **PerformanceImportModal (implied from `app.jsx` import `PerformanceImportModal`)**: A modal for bulk importing performance data via CSV files.
- **EngagementView (`features/engagement/EngagementView.tsx`)**: Tracks proactive outreach and engagement activities.
  - **Activity Log**: Records interactions (comments, shares, replies, DMs) with external accounts.
  - **Account Directory**: Manages external accounts (allies, media, influencers) for engagement.
  - **Goals**: Sets and tracks weekly targets for different types of engagement actions.
- **ReportingWorkspace (implied from `app.jsx` import `ReportingWorkspace`)**: A dedicated area for generating and managing leadership-ready reports based on content performance data.

#### 2.2.5. Admin & Settings (`features/admin`, `features/publishing`, `features/guidelines`)

- **AdminPanel (`features/admin/AdminPanel.tsx`)**: The primary screen for administrative tasks.
  - **Recent Audit Events**: Displays a log of user activities and system changes.
  - **Approver Directory**: Lists all users designated as content approvers.
  - **User Roster**: Manages user accounts, their status, and roles (Admin, Approver).
  - **AddUserForm (`features/admin/AddUserForm.tsx`)**: Form for creating new user accounts.
  - **AccessModal (`features/admin/AdminPanel.tsx`)**: A modal for granting or revoking specific feature access to individual users.
- **GuidelinesModal (`features/guidelines/GuidelinesModal.tsx`)**: A modal for viewing and managing global content standards, including terminology, voice & tone, platform-specific tips, and brand guidelines (banned words, required phrases, character limits).
- **PublishSettingsPanel (implied from `app.jsx` import `PublishSettingsPanel`)**: Manages global publishing-related settings, such as daily post targets.
- **PlatformConnectionsView (implied from `app.jsx` import `PlatformConnectionsView`)**: Manages connections to external platforms (e.g., social media APIs, Teams webhooks) for notifications or direct publishing.

#### 2.2.6. UI Components (`components/ui`, `components/common`)

- **Buttons (`Button`)**: Various styles (default, secondary, ghost, outline, destructive, success) and sizes (default, sm, lg, icon).
- **Inputs (`Input`, `Textarea`)**: Standard text and multi-line input fields.
- **Labels (`Label`)**: Form field labels.
- **Cards (`Card`, `CardHeader`, `CardContent`, `CardTitle`)**: Flexible container components for structuring content.
- **Badges (`Badge`)**: Small inline labels for status or categorization.
- **Modals (`Modal`, `ModalHeader`, `ModalContent`, `ModalFooter`)**: Overlay dialogs with accessibility features.
- **Toggle (`Toggle`)**: A switch-like component for boolean options.
- **Separator (`Separator`)**: Horizontal or vertical dividers.
- **Toast (`Toast`, `ToastContainer`)**: Temporary notification messages (success, error, warning, info).
- **MultiSelect (`MultiSelect`)**: A dropdown for selecting multiple options.
- **FieldRow (`FieldRow`)**: Layout component for form fields with a label on the left and content on the right.
- **Icons (`CalendarIcon`, `ChevronDownIcon`, `CheckCircleIcon`, `LoaderIcon`, `TrashIcon`, `RotateCcwIcon`, `PlusIcon`, `XIcon`, `CopyIcon`, `ArrowUpIcon`, `ArrowPathIcon`, `ClockIcon`)**: A collection of SVG icons used throughout the application.
- **ExportMenu (`ExportMenu`)**: A dropdown for exporting data (entries, ideas, full backup).

---

## 3. Key User Flows

Here are the step-by-step descriptions for the three most important user workflows.

### 3.1. Flow 1: Creating and Approving a Content Entry

This flow covers the end-to-end process from drafting a new content idea to getting it approved.

1.  **Initiate Content Creation**:
    - The user navigates to the "Content" section from the Sidebar.
    - Clicks the "Create Content" button (either in the main header of the "Plan" view or the "Add Content" button in the Sidebar). This opens the `EntryForm`.
    - Alternatively, the user can convert an existing "Idea" from the "Ideas Library" or a "Content Request" from the "Requests" view, which pre-fills the `EntryForm`.
    - Also, from "Opportunities Radar", a user can "Start response" which creates a `RapidResponse` and then can lead to an `EntryForm` pre-fill.
    - From "Content Peaks" or "Content Series", a user can initiate "Create Entry from Peak" or "Create Entry from Series" for pre-filled data.

2.  **Draft Content Details (`EntryForm`)**:
    - **Platforms**: Selects target social media platforms (e.g., Instagram, LinkedIn) or toggles "Select all platforms."
    - **Caption**: Enters the main caption. Optionally, can provide platform-specific captions that override the main one using tabs. The `TerminologyAlert` may flag problematic words.
    - **Asset Type**: Selects the type of asset (Video, Design, Carousel, No asset). Depending on the choice, additional fields for `Script`, `Design copy`, or `Carousel slides` appear.
    - **First Comment**: Adds an optional first comment (e.g., for hashtags or external links).
    - **Date**: Specifies the planned publication date.
    - **Approval Deadline**: Sets an optional deadline for approvers.
    - **Strategy Fields**: Fills in relevant strategic meta-data (Campaign, Content Pillar, Content Category, Response Mode). This helps `recommendSignOffRoute` and `recommendApproversForRoute`.
    - **Approvers**: Assigns specific approvers. The system suggests approvers based on the chosen strategic meta-data. The user can override these recommendations.
    - **Optional Fields**: Fills in other optional fields like URL, Preview Asset (upload/URL), Origin Content ID, Partner Org, Series Name/Episode, Priority Tier, Influencer, and Audience Segments.
    - **Execution Readiness**: Updates status for Alt text, Subtitles, UTM plan, Link Placement, CTA Type, SEO Primary Query, and confirms Source Verified. These affect workflow blockers.
    - **Content Assessment**:
      - **Quick Assessment**: Answers quick 'Yes/No' questions (Hook, Platform fit, Share-worthy, PM Voice).
      - **Golden Thread Check**: Answers critical 'Yes/No' questions related to ethical content principles (Coercion, Blame, Instrumentalisation, Co-option). Failure here typically blocks approval.
      - **Full Assessment**: (Optional) Provides a more detailed score (1-5) across mission alignment, platform optimization, engagement quality, PM voice, and pillar alignment.
    - **AI Copy Checker**: The user can run the AI Copy Checker to get suggestions for their captions, and apply them.

3.  **Submit to Plan**:
    - Clicks "Submit to plan."
    - The system validates the form. If required fields are missing or Golden Thread fails, error messages are displayed.
    - If a scheduling conflict (another entry on the same date/platforms) is detected, a warning is shown, and the user can choose to "Submit anyway."
    - Upon successful submission, the entry is created, its `workflowStatus` is set (e.g., 'Draft' or 'Ready for Review' based on completeness), and it appears on the calendar/Kanban board. A success toast (`pushSyncToast`) confirms the action.
    - If the entry has approvers, notifications may be generated (`onNotifyApproversAboutChange`).

4.  **Approver Review and Action**:
    - An assigned approver receives an in-app notification (via `NotificationBell`).
    - The approver can click the notification, or navigate to "Approvals" from the Sidebar/Dashboard, to open the `EntryModal` or `EntryPreviewModal` for the entry.
    - In the modal, the approver sees a "Review Content" view.
    - They can review all content details, strategic context, execution readiness, and planned platforms (with social previews).
    - **Comments**: The approver can add comments using the comment section, utilizing `@mentions` to tag other users for feedback.
    - **Approval**: If all "Approval Blockers" are resolved (as indicated in the `EntryModal`), the approver can click "Mark as approved."
    - The entry's status is updated to 'Approved', and relevant notifications are sent.

### 3.2. Flow 2: Tracking Content Performance

This flow describes how users can monitor and update content performance metrics.

1.  **Access Analytics View**:
    - The user navigates to "Insights" from the Sidebar.
    - The "Analytics" tab within the `AnalyticsView` is typically the default.

2.  **Filter Performance Data**:
    - In the "Filters" section, the user selects desired parameters:
      - **Timeframe**: Chooses a predefined period (e.g., "This Month", "Last 30 days") or a "Custom range" with specific start and end dates.
      - **Metric**: Selects the primary metric for analysis (e.g., "Impressions", "Engagements", "Engagement rate", "Likes", "Comments").
      - **Dimensions**: Applies filters for Platforms, Status, Review Readiness, Content Pillars, Content Categories, Campaigns, Asset Types, Authors, and Audience Segments.
    - The dashboard dynamically updates to reflect the filtered data.

3.  **Review Insights Snapshot**:
    - **Summary Cards**: Views aggregated data like "Posts in scope," total/average values for the selected metric, and "Metric coverage" (percentage of posts with data for the chosen metric).
    - **Trend over time**: Observes how the selected metric has performed over the chosen timeframe.
    - **Breakdown Cards**: Analyzes performance distribution across various dimensions (e.g., "Platform breakdown," "Content pillar breakdown," "Campaign breakdown").
    - **Top Performers**: Identifies the highest-performing individual posts based on the active metric and filters.
    - **Data Readiness**: Assesses how complete the analytics data is for the filtered content, highlighting gaps.
    - **Strategy Compliance**: Reviews how well posts adhere to content strategy requirements (e.g., CTA defined, Alt text ready).

4.  **Update Performance Metrics**:
    - **Manual Logging (AnalyticsInputWizard)**:
      - Clicks the "Log metrics" button (available if `onUpdateEntry` is provided).
      - The `AnalyticsInputWizard` modal opens.
      - User searches and selects an approved entry.
      - For each platform associated with the entry, the wizard prompts for various metrics (Impressions, Reach, Likes, Comments, Shares, etc.).
      - User inputs numeric values, leaving blank to skip.
      - After reviewing, the user saves the metrics. The entry's analytics data is updated, and `analyticsUpdatedAt` is timestamped.
    - **Bulk Import (PerformanceImportModal)**:
      - Clicks the "Import CSV" button.
      - The `PerformanceImportModal` modal opens.
      - User uploads a CSV file containing performance data.
      - The system processes the CSV, matching rows to existing entries (by ID or caption/date/platform) and updating their `analytics` fields. A summary of imported/matched/missing rows is provided.
    - After updates, the `AnalyticsView` automatically refreshes to reflect the new data.

### 3.3. Flow 3: Managing User Access and Roles (Admin)

This flow details how an administrator manages user accounts and their permissions within the Content Hub.

1.  **Access Admin Tools**:
    - An admin user logs into the Content Hub.
    - Navigates to the "Admin" section from the Sidebar.

2.  **Review User Roster**:
    - The "User roster" card displays a list of all registered users.
    - For each user, it shows their name, email, status (Active, Invite pending, Disabled), and roles (Admin, Approver).
    - The admin can also review the "Approver directory" to see who is currently designated as an approver.

3.  **Add a New User**:
    - In the "User roster" card, the admin uses the `AddUserForm`.
    - Inputs the new user's "First name," "Last name," and "Email."
    - Selects which "features" the new user should have access to (e.g., Calendar & planning, Approvals queue, Ideas log).
    - Optionally, checks the "Approver" checkbox to designate them as an approver.
    - Clicks "Add user."
    - The system creates the user, sends an invite email (if applicable), and updates the user roster. A success or error message is displayed.

4.  **Modify Existing User Access and Roles**:
    - For an existing user in the "User roster," the admin can click:
      - **"Make approver" / "Remove approver" button**: Toggles the user's `isApprover` role directly.
      - **"Access" button**: Opens the `AccessModal`.
        - In the modal, the admin sees the user's name and a list of all available features.
        - Checks or unchecks checkboxes to grant or revoke specific features.
        - Clicks "Save access" to apply changes.
    - The user's permissions are updated, affecting their visible features and capabilities within the application.

5.  **Remove a User**:
    - For an existing user in the "User roster," the admin clicks the "Remove" button.
    - A confirmation prompt appears.
    - Upon confirmation, the user account is removed from the system.

6.  **Review Audit Logs**:
    - In the "Recent audit events" card, the admin can view a chronological log of significant activities within the system (e.g., entry updates, user changes).
    - Clicks "Refresh audits" to fetch the latest log entries from the server.
    - Each log entry shows the action type, user, target entry ID, and timestamp.

---

## 4. Known Limitations or Gaps Visible in the Code

This section highlights specific areas in the codebase that indicate limitations, incomplete features, or potential improvements.

1.  **Partial Component Extraction/Coupling**:
    - **Header/Profile Menu (`components/layout/Header.tsx`)**: The `Header` component is explicitly described as a "typed shell for Phase 1. The full extraction from app.jsx will happen in Phase 2." This indicates that complex logic related to user profile editing (display name, avatar upload), password change, and profile menu state management is still tightly coupled within `app.jsx` rather than being fully encapsulated within the `Header` or a dedicated profile management component.
    - **Modals**: Several modals (e.g., `TrashModal`, `ApprovalsModal`, `OpportunitiesModal`) are implemented directly within `app.jsx` as conditional renders, rather than using dedicated, reusable modal components from `components/ui/Modal.tsx`. This leads to verbose `app.jsx` and less modular code.

2.  **Authentication and User Management Transition**:
    - **Dual-backend Auth (`AuthContext.tsx`, `LoginScreen.tsx`)**: The `AuthContext` and `LoginScreen` logic suggest a hybrid or transitional authentication setup. It attempts to check for a "Supabase session first" but also includes a "Fallback to legacy API." This implies either an ongoing migration or support for multiple authentication backends, which adds complexity.
    - **API Readiness Polling (`AuthContext.tsx`, `LoginScreen.tsx`)**: The `AuthContext` and `LoginScreen` use a `setInterval` poll (`100ms`) as a "fallback" to detect `window.api?.enabled`. While it also listens for a `pm-api-ready` event, relying on polling introduces potential inefficiency and slight delays in initialization if the event isn't consistently fired/caught.
    - **Default User Records**: `DEFAULT_USERS` in `constants.ts` and `DEFAULT_USER_RECORDS` in `lib/users.ts` are still present. While `app.jsx` attempts to fetch `userList` from the server for admin views, these defaults might be used as fallbacks or for local development, indicating an incomplete shift to a fully dynamic user directory.

3.  **Feature Flagging Inconsistencies**:
    - **Hardcoded Feature Flags**: `canUseInfluencers` and `canUseRequests` are hardcoded to `true` in `app.jsx`. This means these features are always visible and accessible regardless of any specific feature flags assigned to the `currentUser`. This negates the purpose of feature-based access control for these specific areas.
    - **Plan Tab Feature Mapping**: `PLAN_TAB_FEATURES` and `PLAN_TAB_ORDER` exist, mapping tabs to feature keys. However, the logic checking `hasFeature(needed)` and falling back to a different tab within `useEffect` in `app.jsx` can be brittle if feature requirements change or if a user has access to a specific view (`currentView`) but not a sub-tab (`planTab`).

4.  **Local Storage Over-Reliance**:
    - **Draft Entry Auto-save (`EntryModal.jsx`)**: Drafts are auto-saved to `localStorage` at `DRAFT_AUTO_SAVE_INTERVAL` (30 seconds). While useful for preventing data loss, this is client-side only. There's no server-side synchronization for drafts, meaning a user's unsaved work is tied to a specific browser and device.
    - **Calendar Themes (`MonthGrid.tsx`)**: Calendar day/week/month themes are stored locally in `localStorage` (`THEMES_KEY`). These customizations are not synced across devices or shared among users.
    - **Saved Filters (`SavedFilters.tsx`)**: Filter presets are saved to `localStorage`, making them user-specific and non-transferable.

5.  **Manager Hierarchy (`managers.test.ts`, `app.jsx`)**:
    - The `_managers` state in `app.jsx` is explicitly commented as "consumed when ManagerHub is extracted," with `buildManagersFromProfiles` used. The `DEFAULT_MANAGERS` constant is marked `@deprecated`. This clearly indicates a planned "ManagerHub" feature or module that is not yet fully implemented or separated, with the current manager logic scattered.

6.  **AI Copy Checker Implementation (`features/copy-check/CopyCheckSection.tsx`)**:
    - The AI Copy Checker relies on either a global `window.copyChecker` object or a `/api/copy-check` endpoint. The code does not provide the implementation details for `window.copyChecker` or the backend endpoint, creating a dependency on an external or unmanaged service. Its availability and reliability are external concerns.

7.  **Inconsistent Toast Implementation**:
    - While a `Toast` and `ToastContainer` component (`components/ui/Toast.tsx`) exist, the `syncToast` state variable in `app.jsx` is rendered as a single, fixed `div` directly, not leveraging the `ToastContainer` for managing multiple toasts or consistent display. This suggests partial adoption of the Toast pattern.

8.  **Form Management Verbosity (`EntryForm.tsx`, `EntryModal.jsx`)**:
    - The `EntryForm` and `EntryModal` components manage a large number of individual state variables (e.g., `date`, `platforms`, `caption`, `assetType`, `script`, etc.) and `onChange` handlers. For complex forms, this can lead to boilerplate code and potential for inconsistencies. A more unified form management solution (e.g., React Hook Form, Formik with a single state object) could simplify this.

9.  **Accessibility (A11y) Gaps**:
    - The `Modal` component includes robust focus trap and keyboard navigation, which is excellent. However, some interactive elements, such as the drag-and-drop targets in `MonthGrid` and `WeekGrid` or the click handler on `div` in `AnalyticsInputWizard`, use `role="button"` or `tabIndex={0}` but sometimes lack `onKeyDown` handlers for `Enter` or `Space` keys to activate the action. This can hinder keyboard-only users.

10. **Data Structures and Scalability**:
    - Many operations involving `entries` (e.g., filtering, sorting, calculating summaries) are performed client-side on the entire `entries` array using `useMemo`. For very large datasets, this could lead to performance bottlenecks, especially on less powerful client devices. This might eventually require server-side pagination, filtering, or more aggressive data aggregation.
    - Hardcoded lists like `ALL_PLATFORMS`, `CAMPAIGNS`, `CONTENT_PILLARS`, `IDEA_TYPES`, `INFLUENCER_STATUSES` in `constants.ts` mean adding or changing these requires code modification and redeployment, rather than administrative configuration.

## Data Layer

### Database Schema Summary

**Overall Purpose:** Manages the full lifecycle of content — from idea generation and strategic planning to scheduling, approval, publishing, and reporting — with robust user roles and security.

### Entities

| Entity                 | Key Columns                                                                                   | Description                                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `user_profiles`        | `id`, `auth_user_id`, `is_admin`, `is_approver`, `manager_email`                              | User accounts linked to Supabase Auth. Roles: admin, approver.                                       |
| `entries`              | `id`, `status`, `workflow_status`, `priority_tier`, `author_email`, `approvers`, `deleted_at` | Main content entity. Soft-deleted. Rich JSONB fields for platforms, captions, analytics, assessment. |
| `ideas`                | `id`, `origin`, `target_date`                                                                 | Repository of content ideas.                                                                         |
| `guidelines`           | `id` TEXT DEFAULT 'default'                                                                   | Single-row global content rules. Sensitive fields moved to `app_secrets`.                            |
| `linkedin_submissions` | `id`, `owner`, `submitter`, `status`                                                          | LinkedIn post submission tracking.                                                                   |
| `testing_frameworks`   | `id`, `hypothesis`, `audience`, `status`                                                      | A/B and content testing experiments.                                                                 |
| `activity_log`         | `id`, `target_id` UUID (loose FK), `actor_email`                                              | Append-only audit trail. No UPDATE/DELETE policies.                                                  |
| `notifications`        | `id`, `user_id`                                                                               | System-generated user notifications.                                                                 |
| `app_secrets`          | `key` TEXT                                                                                    | Admin-only sensitive config (e.g. webhook URLs).                                                     |
| `opportunities`        | `id`, `urgency`, `status`, `linked_entry_id`                                                  | Reactive content opportunities. Status: Open → Acted / Dismissed.                                    |
| `content_requests`     | `id`, `status`, `converted_entry_id`                                                          | Internal content intake briefs. Status: Pending → In Progress → Converted / Declined.                |
| `reporting_periods`    | `id`, `cadence`, `status`, `metrics`, `narrative`                                             | Social media reporting periods with JSONB metrics.                                                   |
| `content_peaks`        | `id`, `start_date`, `end_date`, `owner`                                                       | Strategic campaign peaks with linked content.                                                        |
| `content_series`       | `id`, `status`, `episodes`                                                                    | Recurring content series. Status: Active / Paused / Completed.                                       |
| `rapid_responses`      | `id`, `status`, `source_opportunity_id`, `linked_entry_id`                                    | Quick-turnaround reactive content. Status: New → Drafting → In Review → Ready to Publish → Closed.   |

### RLS Patterns

- **Admins** (`is_admin()`): Full CRUD on all tables.
- **Authenticated users**: SELECT on most tables (high internal transparency).
- **Self-service**: Users update own profile (restricted to `name`, `avatar_url` — privilege escalation fix in migration 003).
- **Creator/owner**: INSERT + UPDATE + soft-DELETE own entries/opportunities/requests/peaks/series.
- **Approvers**: Can UPDATE entries where they appear in `approvers` JSONB.
- **Audit trail**: `activity_log` is INSERT-only for authenticated users — no UPDATE/DELETE.

### State Machines

| Entity              | Column            | States                                                 |
| ------------------- | ----------------- | ------------------------------------------------------ |
| `user_profiles`     | `status`          | pending → active / disabled                            |
| `entries`           | `status`          | Pending → Approved / Rejected                          |
| `entries`           | `workflow_status` | Draft → In Review → Approved → Scheduled → Published   |
| `entries`           | `priority_tier`   | Low / Medium / High / Urgent                           |
| `opportunities`     | `status`          | Open → Acted / Dismissed                               |
| `content_requests`  | `status`          | Pending → In Progress → Converted / Declined           |
| `rapid_responses`   | `status`          | New → Drafting → In Review → Ready to Publish → Closed |
| `reporting_periods` | `status`          | Draft → Ready → Published                              |
| `content_series`    | `status`          | Active / Paused / Completed                            |

### Non-Obvious Business Rules

- **Soft deletion** on `entries` via `deleted_at` — RLS excludes soft-deleted rows from SELECT.
- **Single-row guidelines table** — always `id = 'default'`.
- **Content pillar remapping** (migration 007) — old pillar values rewritten to strategy-aligned ones; "Conversion" nullified. Signals a messaging transformation.
- **`manager_email`** on `user_profiles` — models reporting hierarchy for approval routing.
- **Rich JSONB usage**: `platforms`, `platform_captions`, `approvers`, `analytics`, `assessment_scores`, `carousel_slides`, `metrics`, `qualitative` — flexible schema for evolving attributes without migrations.
- **Loose FK on `activity_log.target_id`** — references multiple tables without formal constraint; immutable append-only audit.
