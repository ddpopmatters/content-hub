# PM Dashboard

A content management and planning dashboard for social media teams.

## User Guides

End-user documentation for Wave 1 lives in [`docs/user-guides/`](docs/user-guides/index.md).

Recommended starting points:

- [`docs/user-guides/overview.md`](docs/user-guides/overview.md)
- [`docs/user-guides/quick-start.md`](docs/user-guides/quick-start.md)
- [`docs/user-guides/roles/content-editor.md`](docs/user-guides/roles/content-editor.md)

## Architecture

This project supports two backend configurations:

### Option A: Supabase Backend (Recommended)

- **Database**: Supabase PostgreSQL with Row Level Security
- **Auth**: Supabase Auth (email/password, magic links)
- **Storage**: Supabase Storage for file attachments
- **Real-time**: Supabase Realtime for live updates

### Option B: Cloudflare Backend (Legacy)

- **Database**: Cloudflare D1 (SQLite)
- **Auth**: Session-based with Cloudflare Access
- **Functions**: Cloudflare Pages Functions

## Quick Start (Supabase)

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your project URL and anon key from Settings > API

### 2. Run Migrations

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Push migrations
supabase db push
```

Or run the SQL files manually in the Supabase SQL Editor:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_rls_policies.sql`

### 3. Configure the App

Update `src/lib/config.js` with your Supabase credentials:

```javascript
export const APP_CONFIG = {
  SUPABASE_URL: 'https://YOUR_PROJECT.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR_ANON_KEY',
  // ...
};
```

### 4. Run Locally

```bash
npm install
npm run dev
# Opens at http://localhost:3000
```

## Project Structure

```
pm-dashboard/
├── src/
│   ├── app.jsx              # Main React application
│   ├── components/ui/       # Reusable UI components
│   ├── features/            # Feature modules
│   ├── hooks/               # Custom React hooks
│   ├── lib/
│   │   ├── config.js        # App configuration
│   │   ├── supabase.js      # Supabase client & API wrapper
│   │   ├── utils.js         # Utility functions
│   │   └── sanitizers.js    # Content sanitizers
│   └── context/             # React contexts
├── supabase/
│   ├── migrations/          # Database migrations
│   └── config.toml          # Local dev config
├── functions/api/           # Cloudflare Workers (legacy)
├── public/                  # Static assets
└── tools/                   # Build and test scripts
```

## Features

- **Content Calendar**: Schedule and manage social media posts
- **Kanban Board**: Track content through workflow stages
- **Approval Queue**: Review and approve content
- **Ideas Log**: Capture and organize content ideas
- **LinkedIn Submissions**: Manage LinkedIn draft posts
- **A/B Testing**: Track testing frameworks
- **Copy Optimizer**: AI-powered copy checking (requires OpenAI API)
- **Activity Log**: Audit trail of all actions

## Scripts

```bash
npm run dev           # Start local development server
npm run build         # Build for production
npm run lint          # Run ESLint
npm run format        # Format with Prettier
npm run typecheck     # TypeScript type checking
```

## Environment Variables

### Supabase Configuration

Set in `src/lib/config.js`:

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Your Supabase anonymous key

### Copy Optimizer (Optional)

Set in Supabase Edge Functions or environment:

- `OPENAI_API_KEY` - OpenAI API key
- `OPENAI_MODEL` - Model to use (default: `gpt-4o-mini`)

## Keyboard Shortcuts

| Key      | Action                  |
| -------- | ----------------------- |
| `?`      | Show keyboard shortcuts |
| `Escape` | Close modal/panel       |
| `n`      | New content entry       |
| `i`      | New idea                |
| `/`      | Focus search            |
| `c`      | Calendar view           |
| `k`      | Kanban view             |
| `a`      | Approvals view          |
| `d`      | Ideas view              |
| `b`      | Toggle notifications    |

## Database Schema

The Supabase schema includes:

- `user_profiles` - User accounts linked to Supabase Auth
- `entries` - Scheduled content posts
- `ideas` - Content ideas
- `guidelines` - Brand guidelines and rules
- `linkedin_submissions` - LinkedIn draft posts
- `testing_frameworks` - A/B testing configurations
- `activity_log` - Audit trail
- `notifications` - User notifications

All tables have Row Level Security (RLS) policies for data protection.

---

## Legacy: Cloudflare Backend

If using the Cloudflare backend instead of Supabase:

### Cloudflare Pages Functions

Located in `functions/api/*`:

- `copy-check.ts` - LLM-powered copy optimization
- `entries.ts` - Content entries CRUD
- `ideas.ts` - Ideas CRUD
- `guidelines.ts` - Content guidelines
- `audit.ts` - Audit logging
- `auth.ts` - Session authentication
- `users.ts` - User management
- `notify.ts` - Teams/email notifications

### D1 Database Setup

```bash
# Apply schema
wrangler d1 execute pm_dashboard --file=schema.sql
```

### Environment Variables (Cloudflare)

- `OPENAI_API_KEY` - For copy optimizer
- `ACCESS_ALLOWED_EMAILS` - Comma-separated email allowlist
- `MAIL_FROM`, `MAIL_FROM_NAME` - Email sender config
- `TEAMS_WEBHOOK_ALLOW_LIST` - Allowed webhook domains

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm run lint` and `npm run typecheck`
5. Submit a pull request

## License

Private - Population Matters
