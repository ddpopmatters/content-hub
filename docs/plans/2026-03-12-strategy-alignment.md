# Strategy Alignment Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement three targeted improvements that align the Content Hub with PM's social media strategy: surface quality engagement signals (shares/saves) first on the dashboard, add a visual integrity checklist to the approval flow, and add partner content provenance fields to entries.

**Architecture:** Three independent subsystems — Chunk A modifies `WeeklyStatsWidget` and `PLATFORM_METRICS`, Chunk B adds a new `VisualIntegrityCheck` component parallel to `GoldenThreadCheck` and integrates it into the approval modal, Chunk C extends the Entry type and EntryForm with three new partner provenance fields plus a Supabase migration. Each chunk ships independently testable functionality.

**Tech Stack:** React 19, TypeScript, Vitest 4 + @testing-library/react (jsdom), Tailwind CSS, Supabase (migrations via `mcp__supabase__apply_migration`).

**Run tests:** `npm test` (from `tools/Content Hub/`)
**Run typecheck:** `npx tsc --noEmit`

---

## Chunk A: Quality Engagement Metrics

The social media strategy is explicit: shares, saves, and quote posts are the priority signals. "Follower numbers and raw impressions tell us very little." The current `WeeklyStatsWidget` surfaces Total Reach as a primary metric and ignores saves entirely. BlueSky has no quote posts metric. This chunk fixes both.

### File Map

| Action | File                                                                  |
| ------ | --------------------------------------------------------------------- |
| Modify | `src/constants.ts` (lines 296–301, BlueSky PLATFORM_METRICS)          |
| Modify | `src/features/dashboard/widgets/WeeklyStatsWidget.tsx`                |
| Create | `src/features/dashboard/widgets/__tests__/WeeklyStatsWidget.test.tsx` |

---

### Task 1: Add BlueSky quote posts to PLATFORM_METRICS

**Files:**

- Modify: `src/constants.ts` (lines 296–301)

- [ ] **Step 1: Locate the BlueSky block**

  `src/constants.ts` lines 296–301 currently reads:

  ```ts
  BlueSky: [
    { key: 'impressions', label: 'Impressions' },
    { key: 'likes', label: 'Likes' },
    { key: 'shares', label: 'Reposts' },
    { key: 'comments', label: 'Replies' },
  ],
  ```

- [ ] **Step 2: Add `quotePosts` metric between Reposts and Replies**

  Replace those lines with:

  ```ts
  BlueSky: [
    { key: 'impressions', label: 'Impressions' },
    { key: 'likes', label: 'Likes' },
    { key: 'shares', label: 'Reposts' },
    { key: 'quotePosts', label: 'Quote posts' },
    { key: 'comments', label: 'Replies' },
  ],
  ```

- [ ] **Step 3: Verify TypeScript compiles**

  Run: `npx tsc --noEmit`
  Expected: no errors (`key` is typed as `string`)

- [ ] **Step 4: Commit**
  ```bash
  git add src/constants.ts
  git commit -m "feat(analytics): add quote posts metric to BlueSky PLATFORM_METRICS"
  ```

---

### Task 2: Write failing tests for WeeklyStatsWidget

**Files:**

- Create: `src/features/dashboard/widgets/__tests__/WeeklyStatsWidget.test.tsx`

- [ ] **Step 1: Create the test file**

  ```tsx
  // @vitest-environment jsdom
  import { render, screen } from '@testing-library/react';
  import { describe, expect, it } from 'vitest';
  import { WeeklyStatsWidget } from '../WeeklyStatsWidget';
  import type { Entry } from '../../../../types/models';

  function makeEntry(overrides: Partial<Entry>): Entry {
    return {
      id: 'e1',
      date: new Date().toISOString().split('T')[0], // today — within this week
      platforms: ['Instagram'],
      caption: 'Test post',
      platformCaptions: {},
      firstComment: '',
      status: 'Approved',
      priorityTier: 'Medium',
      approvers: [],
      author: 'dan@example.com',
      campaign: '',
      contentPillar: 'Social Justice',
      assetType: 'Design',
      previewUrl: '',
      checklist: {},
      analytics: {},
      workflowStatus: 'Published',
      statusDetail: '',
      aiFlags: [],
      aiScore: {},
      testingFrameworkId: '',
      testingFrameworkName: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      approvedAt: null,
      deletedAt: null,
      ...overrides,
    } as Entry;
  }

  describe('WeeklyStatsWidget', () => {
    it('shows Shares count from analytics', () => {
      const entry = makeEntry({
        analytics: { Instagram: { shares: 42, likes: 10, comments: 5, reach: 1000 } },
      });
      render(<WeeklyStatsWidget entries={[entry]} />);
      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('Shares')).toBeInTheDocument();
    });

    it('shows Saves count from analytics', () => {
      const entry = makeEntry({
        analytics: { Instagram: { saves: 17, likes: 10, comments: 2, reach: 500 } },
      });
      render(<WeeklyStatsWidget entries={[entry]} />);
      expect(screen.getByText('17')).toBeInTheDocument();
      expect(screen.getByText('Saves')).toBeInTheDocument();
    });

    it('does not show Total Reach as a primary metric label', () => {
      const entry = makeEntry({
        analytics: { Instagram: { reach: 9999, likes: 1 } },
      });
      render(<WeeklyStatsWidget entries={[entry]} />);
      expect(screen.queryByText('Total Reach')).not.toBeInTheDocument();
    });

    it('shows zero saves gracefully when analytics has no saves field', () => {
      const entry = makeEntry({ analytics: {} });
      render(<WeeklyStatsWidget entries={[entry]} />);
      expect(screen.getByText('Saves')).toBeInTheDocument();
      // Both Shares and Saves should render 0
      expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(2);
    });
  });
  ```

- [ ] **Step 2: Run tests to confirm they fail**

  Run: `npm test -- WeeklyStatsWidget`
  Expected: FAIL — widget currently shows 'Total Reach', does not compute saves, and 'Shares' label not present.

---

### Task 3: Update WeeklyStatsWidget to compute saves/shares and reorder

**Files:**

- Modify: `src/features/dashboard/widgets/WeeklyStatsWidget.tsx`

- [ ] **Step 1: Extend the stats computation (replace lines 25–66)**

  ```tsx
  const stats = useMemo(() => {
    const weekStart = getWeekStart();
    const thisWeekEntries = entries.filter((e) => {
      if (e.deletedAt) return false;
      const entryDate = new Date(e.date);
      return entryDate >= weekStart && (e.status === 'Approved' || e.status === 'Posted');
    });

    let totalEngagements = 0;
    let totalShares = 0;
    let totalSaves = 0;
    let postsWithAnalytics = 0;

    thisWeekEntries.forEach((entry) => {
      if (!entry.analytics) return;
      entry.platforms?.forEach((platform) => {
        const platformStats = entry.analytics?.[platform];
        if (platformStats && typeof platformStats === 'object') {
          const s = platformStats as Record<string, number>;
          const likes = s.likes || 0;
          const comments = s.comments || 0;
          const shares = s.shares || 0;
          const saves = s.saves || 0;

          if (likes || comments || shares || saves) {
            postsWithAnalytics++;
            totalEngagements += likes + comments + shares;
            totalShares += shares;
            totalSaves += saves;
          }
        }
      });
    });

    return {
      postsPublished: thisWeekEntries.length,
      totalEngagements,
      totalShares,
      totalSaves,
    };
  }, [entries]);
  ```

- [ ] **Step 2: Reorder the metrics display array (replace lines 68–77)**

  Quality signals (shares, saves) go first. Reach is removed — it's explicitly what the strategy says not to surface.

  ```tsx
  const metrics = [
    { label: 'Shares', value: formatNumber(stats.totalShares), color: 'text-ocean-600' },
    { label: 'Saves', value: formatNumber(stats.totalSaves), color: 'text-emerald-600' },
    { label: 'Posts Published', value: stats.postsPublished, color: 'text-graystone-700' },
    { label: 'Engagements', value: formatNumber(stats.totalEngagements), color: 'text-amber-600' },
  ];
  ```

- [ ] **Step 3: Run tests — expect pass**

  Run: `npm test -- WeeklyStatsWidget`
  Expected: all 4 tests PASS

- [ ] **Step 4: Commit**
  ```bash
  git add src/features/dashboard/widgets/WeeklyStatsWidget.tsx \
          src/features/dashboard/widgets/__tests__/WeeklyStatsWidget.test.tsx
  git commit -m "feat(dashboard): surface shares and saves as primary quality signals in WeeklyStatsWidget"
  ```

---

## Chunk B: Visual Integrity Check

The strategy has specific requirements for imagery: no victim imagery, show agency and leadership, name individuals from partner networks with consent. GoldenThreadCheck covers textual ethics — this chunk adds a parallel check for imagery, displayed in the approval flow at the same point.

### File Map

| Action | File                                                                                           |
| ------ | ---------------------------------------------------------------------------------------------- |
| Modify | `src/constants.ts` (add after GOLDEN_THREAD_QUESTIONS, ~line 724)                              |
| Modify | `src/types/models.ts` (add `visualIntegrity` to assessmentScores, line 151)                    |
| Create | `src/features/assessment/VisualIntegrityCheck.tsx`                                             |
| Create | `src/features/assessment/__tests__/VisualIntegrityCheck.test.tsx`                              |
| Modify | `src/features/assessment/index.ts`                                                             |
| Modify | `src/features/entry/EntryModal.jsx` (~line 1678, between GoldenThreadCheck and FullAssessment) |

---

### Task 4: Define VISUAL_INTEGRITY_QUESTIONS in constants

**Files:**

- Modify: `src/constants.ts` (insert after line 724, before `QUICK_ASSESSMENT_QUESTIONS`)

- [ ] **Step 1: Add the interface and questions**

  ```ts
  export interface VisualIntegrityQuestion {
    key: string;
    label: string;
    description: string;
  }

  export const VISUAL_INTEGRITY_QUESTIONS: VisualIntegrityQuestion[] = [
    {
      key: 'victimImagery',
      label: 'Victim imagery',
      description:
        'Does this image show suffering, passivity, or disempowerment — rather than agency, strength, or leadership?',
    },
    {
      key: 'anonWithoutContext',
      label: 'Anonymous without context',
      description:
        "Is this an uncredited stock photo or anonymous image where a named individual from PM's partner network could be used instead?",
    },
    {
      key: 'recipientFraming',
      label: 'Recipient framing',
      description:
        "Does this image position our partners as recipients of PM's help, rather than as leaders of their own work?",
    },
  ];
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  Run: `npx tsc --noEmit`
  Expected: no errors

- [ ] **Step 3: Commit**
  ```bash
  git add src/constants.ts
  git commit -m "feat(assessment): add VISUAL_INTEGRITY_QUESTIONS to constants"
  ```

---

### Task 5: Extend assessmentScores type for visualIntegrity

**Files:**

- Modify: `src/types/models.ts` (assessmentScores starts at line 151)

- [ ] **Step 1: Read the current assessmentScores definition**

  Run: `grep -n "assessmentScores" src/types/models.ts`
  It currently reads (lines 151–165):

  ```ts
  assessmentScores?: {
    full?: {
      mission?: number; platform?: number; engagement?: number; voice?: number; pillar?: number;
    };
    quick?: {
      goldenThread?: boolean; hook?: boolean; platformFit?: boolean;
      shareWorthy?: boolean; pmVoice?: boolean;
    };
  ```

  Note: `goldenThread` values are stored at `assessmentScores.goldenThread` (not inside `quick`) — that's how `EntryModal.jsx` reads them. The type doesn't fully reflect this — don't change it, just add the new key.

- [ ] **Step 2: Add `visualIntegrity` at the same level as `full` and `quick`**

  After the closing `};` of the `quick` block, add:

  ```ts
    visualIntegrity?: {
      victimImagery?: boolean;
      anonWithoutContext?: boolean;
      recipientFraming?: boolean;
    };
  ```

- [ ] **Step 3: Verify TypeScript compiles**

  Run: `npx tsc --noEmit`
  Expected: no errors

- [ ] **Step 4: Commit**
  ```bash
  git add src/types/models.ts
  git commit -m "feat(types): add visualIntegrity to Entry assessmentScores"
  ```

---

### Task 6: Build VisualIntegrityCheck component (TDD)

**Files:**

- Create: `src/features/assessment/__tests__/VisualIntegrityCheck.test.tsx`
- Create: `src/features/assessment/VisualIntegrityCheck.tsx`

Pattern to follow: `GoldenThreadCheck.tsx` — same Yes/No framing, same colour coding, same reframe guidance on failure.

- [ ] **Step 1: Write failing tests**

  Create `src/features/assessment/__tests__/VisualIntegrityCheck.test.tsx`:

  ```tsx
  // @vitest-environment jsdom
  import { fireEvent, render, screen } from '@testing-library/react';
  import { describe, expect, it, vi } from 'vitest';
  import { VisualIntegrityCheck } from '../VisualIntegrityCheck';

  describe('VisualIntegrityCheck', () => {
    it('renders all three check labels', () => {
      render(<VisualIntegrityCheck values={{}} onChange={vi.fn()} />);
      expect(screen.getByText('Victim imagery')).toBeInTheDocument();
      expect(screen.getByText('Anonymous without context')).toBeInTheDocument();
      expect(screen.getByText('Recipient framing')).toBeInTheDocument();
    });

    it('calls onChange with flag raised when Yes is clicked', () => {
      const onChange = vi.fn();
      render(<VisualIntegrityCheck values={{}} onChange={onChange} />);
      fireEvent.click(screen.getAllByRole('button', { name: 'Yes' })[0]);
      expect(onChange).toHaveBeenCalledWith({ victimImagery: true });
    });

    it('calls onChange with flag cleared when No is clicked', () => {
      const onChange = vi.fn();
      render(<VisualIntegrityCheck values={{ victimImagery: true }} onChange={onChange} />);
      fireEvent.click(screen.getAllByRole('button', { name: 'No' })[0]);
      expect(onChange).toHaveBeenCalledWith({ victimImagery: false });
    });

    it('shows reframe guidance when victim imagery is flagged', () => {
      render(<VisualIntegrityCheck values={{ victimImagery: true }} onChange={vi.fn()} />);
      expect(screen.getByText(/Replace with imagery showing agency/i)).toBeInTheDocument();
    });

    it('shows all-clear message when all checks answered No', () => {
      render(
        <VisualIntegrityCheck
          values={{ victimImagery: false, anonWithoutContext: false, recipientFraming: false }}
          onChange={vi.fn()}
        />,
      );
      expect(screen.getByText(/Visual integrity passed/i)).toBeInTheDocument();
    });

    it('disables all buttons in readOnly mode', () => {
      render(<VisualIntegrityCheck values={{}} onChange={vi.fn()} readOnly />);
      screen.getAllByRole('button', { name: 'Yes' }).forEach((btn) => {
        expect(btn).toBeDisabled();
      });
    });
  });
  ```

- [ ] **Step 2: Run tests to confirm they fail**

  Run: `npm test -- VisualIntegrityCheck`
  Expected: FAIL — module not found

- [ ] **Step 3: Implement the component**

  Create `src/features/assessment/VisualIntegrityCheck.tsx`:

  ```tsx
  import React from 'react';
  import { cx } from '../../lib/utils';
  import { VISUAL_INTEGRITY_QUESTIONS } from '../../constants';

  export interface VisualIntegrityValues {
    victimImagery?: boolean;
    anonWithoutContext?: boolean;
    recipientFraming?: boolean;
  }

  export interface VisualIntegrityCheckProps {
    values: VisualIntegrityValues;
    onChange: (values: VisualIntegrityValues) => void;
    readOnly?: boolean;
  }

  const REFRAME_GUIDANCE: Record<string, string> = {
    victimImagery:
      'Replace with imagery showing agency, leadership, and strength. Stock photography showing distress or passivity reinforces the narratives PM is working to dismantle.',
    anonWithoutContext:
      "Where possible, name individuals (with consent) from PM's partner network. 'Amina, a community health worker in Kaduna' is more powerful and more respectful than an uncredited stock image.",
    recipientFraming:
      "Reframe to position partners as experts and leaders of their own work. PM's role is to amplify their expertise — not to present ourselves as delivering it.",
  };

  export function VisualIntegrityCheck({
    values,
    onChange,
    readOnly = false,
  }: VisualIntegrityCheckProps): React.ReactElement {
    const allAnswered = VISUAL_INTEGRITY_QUESTIONS.every(
      (q) => values[q.key as keyof VisualIntegrityValues] !== undefined,
    );
    const allPassed = VISUAL_INTEGRITY_QUESTIONS.every(
      (q) => values[q.key as keyof VisualIntegrityValues] === false,
    );

    const setAnswer = (key: string, answer: boolean) => {
      if (readOnly) return;
      onChange({ ...values, [key]: answer });
    };

    return (
      <div className="space-y-4 rounded-2xl border border-graystone-200 bg-white p-4">
        <div>
          <h3 className="text-sm font-semibold text-ocean-700">Visual Integrity Check</h3>
          <p className="text-xs text-graystone-500">
            Flag any issues with the image. Failures show guidance — content can still be submitted.
          </p>
        </div>

        <div className="space-y-3">
          {VISUAL_INTEGRITY_QUESTIONS.map((q) => {
            const val = values[q.key as keyof VisualIntegrityValues];
            const failed = val === true;
            return (
              <div
                key={q.key}
                className={cx(
                  'rounded-xl border p-3',
                  failed ? 'border-red-200 bg-red-50' : 'border-graystone-100 bg-graystone-50',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-graystone-700">{q.label}</div>
                    <p className="mt-0.5 text-xs text-graystone-600">{q.description}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => setAnswer(q.key, true)}
                      aria-pressed={val === true}
                      className={cx(
                        'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                        val === true
                          ? 'bg-red-500 text-white'
                          : 'bg-graystone-100 text-graystone-500 hover:bg-red-100 hover:text-red-600',
                        readOnly && 'cursor-default opacity-60',
                      )}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => setAnswer(q.key, false)}
                      aria-pressed={val === false}
                      className={cx(
                        'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                        val === false
                          ? 'bg-emerald-500 text-white'
                          : 'bg-graystone-100 text-graystone-500 hover:bg-emerald-100 hover:text-emerald-600',
                        readOnly && 'cursor-default opacity-60',
                      )}
                    >
                      No
                    </button>
                  </div>
                </div>
                {failed && (
                  <p className="mt-2 rounded-lg bg-red-100 px-2 py-1.5 text-xs text-red-700">
                    {REFRAME_GUIDANCE[q.key]}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {allAnswered && (
          <div
            className={cx(
              'rounded-xl px-3 py-2 text-xs font-semibold',
              allPassed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700',
            )}
          >
            {allPassed
              ? 'Visual integrity passed. Image is consistent with PM principles.'
              : 'Visual integrity issues flagged. Review guidance above before publishing.'}
          </div>
        )}
      </div>
    );
  }

  export default VisualIntegrityCheck;
  ```

- [ ] **Step 4: Run tests — expect pass**

  Run: `npm test -- VisualIntegrityCheck`
  Expected: all 6 tests PASS

- [ ] **Step 5: Commit**
  ```bash
  git add src/features/assessment/VisualIntegrityCheck.tsx \
          src/features/assessment/__tests__/VisualIntegrityCheck.test.tsx
  git commit -m "feat(assessment): add VisualIntegrityCheck component"
  ```

---

### Task 7: Export and integrate VisualIntegrityCheck into EntryModal

**Files:**

- Modify: `src/features/assessment/index.ts`
- Modify: `src/features/entry/EntryModal.jsx`

- [ ] **Step 1: Export from assessment index**

  Add to `src/features/assessment/index.ts`:

  ```ts
  export { VisualIntegrityCheck } from './VisualIntegrityCheck';
  export type { VisualIntegrityValues } from './VisualIntegrityCheck';
  ```

- [ ] **Step 2: Import VisualIntegrityCheck in EntryModal**

  In `src/features/entry/EntryModal.jsx`, line 68, extend the import:

  ```js
  import {
    QuickAssessment,
    FullAssessment,
    GoldenThreadCheck,
    VisualIntegrityCheck,
  } from '../assessment';
  ```

- [ ] **Step 3: Add VisualIntegrityCheck after the Golden Thread FieldRow**

  In `EntryModal.jsx`, the GoldenThreadCheck FieldRow ends around line 1678. Insert between it and the FullAssessment FieldRow:

  ```jsx
  <FieldRow label="Visual integrity">
    <VisualIntegrityCheck
      values={draft.assessmentScores?.visualIntegrity || {}}
      onChange={(visualIntegrity) =>
        update('assessmentScores', {
          ...(draft.assessmentScores || {}),
          visualIntegrity,
        })
      }
    />
  </FieldRow>
  ```

- [ ] **Step 4: Run full test suite**

  Run: `npm test`
  Expected: all tests pass

- [ ] **Step 5: Typecheck**

  Run: `npx tsc --noEmit`
  Expected: no errors

- [ ] **Step 6: Commit**
  ```bash
  git add src/features/assessment/index.ts \
          src/features/entry/EntryModal.jsx
  git commit -m "feat(entry): integrate VisualIntegrityCheck into approval flow"
  ```

---

## Chunk C: Partner Content Provenance

The strategy requires named individuals from partner networks, consent tracking, and capture context. Currently `Entry` only has `partnerOrg?: string`. This chunk adds three fields to cover the strategy's requirements: `partnerIndividualName`, `partnerConsentStatus`, and `partnerCaptureContext`. The new fields only appear in the form when `partnerOrg` has a value.

### File Map

| Action | File                                                             |
| ------ | ---------------------------------------------------------------- |
| Modify | `src/types/models.ts` (after `partnerOrg` at line 141)           |
| Create | `supabase/migrations/20260312_add_partner_provenance.sql`        |
| Modify | `src/features/entry/EntryForm.tsx` (~line 1191, partner section) |
| Create | `src/features/entry/__tests__/partnerProvenance.test.ts`         |

---

### Task 8: Extend Entry type with provenance fields

**Files:**

- Modify: `src/types/models.ts`

- [ ] **Step 1: Add three fields immediately after `partnerOrg` (line 141)**

  ```ts
  partnerOrg?: string;
  partnerIndividualName?: string;
  partnerConsentStatus?: 'confirmed' | 'pending' | 'not-required';
  partnerCaptureContext?: string;
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  Run: `npx tsc --noEmit`
  Expected: no errors

- [ ] **Step 3: Commit**
  ```bash
  git add src/types/models.ts
  git commit -m "feat(types): add partner provenance fields to Entry model"
  ```

---

### Task 9: Add Supabase migration

**Files:**

- Create: `supabase/migrations/20260312_add_partner_provenance.sql`

- [ ] **Step 1: Write the migration file**

  ```sql
  ALTER TABLE entries ADD COLUMN IF NOT EXISTS partner_individual_name TEXT;
  ALTER TABLE entries ADD COLUMN IF NOT EXISTS partner_consent_status TEXT
    CHECK (partner_consent_status IN ('confirmed', 'pending', 'not-required'));
  ALTER TABLE entries ADD COLUMN IF NOT EXISTS partner_capture_context TEXT;
  ```

- [ ] **Step 2: Apply via Supabase MCP**

  Use `mcp__supabase__apply_migration` with:
  - name: `add_partner_provenance`
  - query: the SQL above

  Expected: no error returned.

- [ ] **Step 3: Commit the migration file**
  ```bash
  git add supabase/migrations/20260312_add_partner_provenance.sql
  git commit -m "chore(db): add partner provenance columns to entries table"
  ```

---

### Task 10: Write failing tests for form state

**Files:**

- Create: `src/features/entry/__tests__/partnerProvenance.test.ts`

- [ ] **Step 1: Create the test file**

  These unit tests confirm the consent status union and option labels are correct before wiring up the form.

  ```ts
  import { describe, expect, it } from 'vitest';

  describe('partner provenance field definitions', () => {
    it('consent status options cover the three valid states', () => {
      const validStatuses = ['confirmed', 'pending', 'not-required'] as const;
      type ConsentStatus = (typeof validStatuses)[number];
      const value: ConsentStatus = 'confirmed';
      expect(validStatuses).toContain(value);
    });

    it('select option labels are non-empty for all three states', () => {
      const labels: Record<string, string> = {
        confirmed: 'Consent confirmed',
        pending: 'Consent pending',
        'not-required': 'Not required',
      };
      Object.values(labels).forEach((label) => expect(label.length).toBeGreaterThan(0));
    });
  });
  ```

- [ ] **Step 2: Run tests to confirm pass**

  Run: `npm test -- partnerProvenance`
  Expected: PASS (these validate constants, not yet the component)

---

### Task 11: Add provenance fields to EntryForm

**Files:**

- Modify: `src/features/entry/EntryForm.tsx`

- [ ] **Step 1: Add state variables after `partnerOrg` state (line ~140)**

  ```tsx
  const [partnerOrg, setPartnerOrg] = useState<string>('');
  const [partnerIndividualName, setPartnerIndividualName] = useState<string>('');
  const [partnerConsentStatus, setPartnerConsentStatus] = useState<
    'confirmed' | 'pending' | 'not-required' | ''
  >('');
  const [partnerCaptureContext, setPartnerCaptureContext] = useState<string>('');
  ```

- [ ] **Step 2: Initialise from `initialValues` in the existing useEffect (line ~216)**

  Add after the `setPartnerOrg` initialisation:

  ```tsx
  setPartnerIndividualName(initialValues.partnerIndividualName || '');
  setPartnerConsentStatus(initialValues.partnerConsentStatus || '');
  setPartnerCaptureContext(initialValues.partnerCaptureContext || '');
  ```

- [ ] **Step 3: Include in submission output (line ~451, where `partnerOrg: partnerOrg || undefined` appears)**

  ```tsx
  partnerOrg: partnerOrg || undefined,
  partnerIndividualName: partnerIndividualName || undefined,
  partnerConsentStatus: (partnerConsentStatus || undefined) as 'confirmed' | 'pending' | 'not-required' | undefined,
  partnerCaptureContext: partnerCaptureContext || undefined,
  ```

- [ ] **Step 4: Add the three new fields to the UI (after the partnerOrg input, ~line 1196)**

  Wrap all three new inputs in `{partnerOrg && (...)}` so they only appear when a partner org is set:

  ```jsx
  {partnerOrg && (
    <>
      <Label htmlFor="partnerIndividualName">Named individual</Label>
      <Input
        id="partnerIndividualName"
        value={partnerIndividualName}
        onChange={(e) => setPartnerIndividualName(e.target.value)}
        placeholder="e.g. Amina Bello, community health worker, Kaduna"
      />

      <Label htmlFor="partnerConsentStatus">Consent status</Label>
      <select
        id="partnerConsentStatus"
        value={partnerConsentStatus}
        onChange={(e) =>
          setPartnerConsentStatus(
            e.target.value as 'confirmed' | 'pending' | 'not-required' | '',
          )
        }
        className="w-full rounded-lg border border-graystone-200 px-3 py-2 text-sm focus:border-ocean-400 focus:outline-none focus:ring-2 focus:ring-ocean-200"
      >
        <option value="">— select —</option>
        <option value="confirmed">Consent confirmed</option>
        <option value="pending">Consent pending</option>
        <option value="not-required">Not required</option>
      </select>

      <Label htmlFor="partnerCaptureContext">Capture context</Label>
      <Input
        id="partnerCaptureContext"
        value={partnerCaptureContext}
        onChange={(e) => setPartnerCaptureContext(e.target.value)}
        placeholder="e.g. Photographed by E2P team, Kaduna, Feb 2026"
      />
    </>
  )}
  ```

- [ ] **Step 5: Reset in the form clear handler (line ~368)**

  Add after `setPartnerOrg('')`:

  ```tsx
  setPartnerIndividualName('');
  setPartnerConsentStatus('');
  setPartnerCaptureContext('');
  ```

- [ ] **Step 6: Run full test suite**

  Run: `npm test`
  Expected: all tests pass

- [ ] **Step 7: Typecheck**

  Run: `npx tsc --noEmit`
  Expected: no errors

- [ ] **Step 8: Commit**
  ```bash
  git add src/features/entry/EntryForm.tsx
  git commit -m "feat(entry): add partner individual name, consent status, and capture context fields"
  ```

---

## Completion Checklist

- [ ] Chunk A: BlueSky quote posts metric added
- [ ] Chunk A: WeeklyStatsWidget shows Shares and Saves as primary signals; Total Reach removed
- [ ] Chunk B: VisualIntegrityCheck component built and tested
- [ ] Chunk B: VisualIntegrityCheck visible in EntryModal approval flow after Golden Thread
- [ ] Chunk C: Three partner provenance fields in Entry type and EntryForm
- [ ] Chunk C: Supabase migration applied
- [ ] All tests pass: `npm test`
- [ ] TypeScript clean: `npx tsc --noEmit`
