# Content Hub Test Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill the most valuable test coverage gaps in Content Hub's lib/ and UI layer, prioritising PM messaging enforcement and regression protection during the ongoing simplification effort.

**Architecture:** Content Hub has 21 existing Vitest tests covering business logic and domain hooks. This plan adds tests for four untested modules: the PM messaging terminology checker (critical compliance gate), two pure-logic lib files, and the shared `Button` primitive. All new tests are fully isolated — no Supabase, no network, no real DOM beyond Button's render test.

**Tech Stack:** Vitest 4 · jsdom (already configured) · @testing-library/react (already installed) · Vitest globals on, setupFiles at `src/__tests__/setup.ts`

---

## File Structure

| Action | Path                                          | Responsibility                                               |
| ------ | --------------------------------------------- | ------------------------------------------------------------ |
| Create | `src/lib/terminology.test.ts`                 | Tests `checkTerminology` and `hasTerminologyIssues`          |
| Create | `src/lib/filters.test.ts`                     | Tests `isApprovalOverdue` and `matchesSearch`                |
| Create | `src/lib/utils.test.ts`                       | Tests `cx`, date helpers, `ensureArray`, `ensurePeopleArray` |
| Create | `src/components/ui/__tests__/Button.test.tsx` | Smoke tests: render, disabled, click handler                 |

---

### Task 1: Terminology checker tests

The terminology checker is the programmatic enforcement of PM's messaging transformation. These tests lock in the exact banned terms so a developer can never remove an entry from `TERMINOLOGY_MAP` without a failing test. This is the highest-priority test in the plan.

**Files:**

- Create: `src/lib/terminology.test.ts`
- Read first: `src/lib/terminology.ts`, `src/constants.ts` (contains `TERMINOLOGY_MAP`)

- [ ] **Step 1: Write the failing test file**

```typescript
// src/lib/terminology.test.ts
import { describe, it, expect } from 'vitest';
import { checkTerminology, hasTerminologyIssues } from './terminology';

describe('checkTerminology', () => {
  it('returns empty array for clean text', () => {
    expect(checkTerminology('Reproductive rights are fundamental.')).toEqual([]);
  });

  it('flags "overpopulation" with the correct replacement suggestion', () => {
    const matches = checkTerminology('The problem of overpopulation is often misunderstood.');
    expect(matches).toHaveLength(1);
    expect(matches[0].term.toLowerCase()).toBe('overpopulation');
    expect(matches[0].useInstead).toContain('unsustainable population growth');
  });

  it('flags "population control" with the correct replacement suggestion', () => {
    const matches = checkTerminology('We oppose population control policies.');
    expect(matches).toHaveLength(1);
    expect(matches[0].term.toLowerCase()).toBe('population control');
    expect(matches[0].useInstead).toContain('voluntary family planning access');
  });

  it('flags "overpopulated countries"', () => {
    const matches = checkTerminology('overpopulated countries face real pressures');
    expect(matches).toHaveLength(1);
    expect(matches[0].useInstead).toContain('rapid population growth');
  });

  it('flags "too many people"', () => {
    const matches = checkTerminology('There are too many people on the planet.');
    expect(matches).toHaveLength(1);
    expect(matches[0].useInstead).toContain('rights');
  });

  it('flags "population stabilisation"', () => {
    const matches = checkTerminology('population stabilisation is our stated goal');
    expect(matches).toHaveLength(1);
  });

  it('is case-insensitive', () => {
    expect(checkTerminology('Overpopulation is wrong framing.')).toHaveLength(1);
    expect(checkTerminology('OVERPOPULATION concerns')).toHaveLength(1);
    expect(checkTerminology('Population Control')).toHaveLength(1);
  });

  it('does not flag "population" as a partial match for "population control"', () => {
    expect(checkTerminology('population matters as an organisation')).toHaveLength(0);
  });

  it('finds multiple banned terms in the same text', () => {
    const matches = checkTerminology('Overpopulation leads some to support population control.');
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('returns matches sorted by their position in the text', () => {
    const matches = checkTerminology(
      'Overpopulation and population control are both wrong frames.',
    );
    expect(matches[0].index).toBeLessThan(matches[1].index);
  });

  it('returns the correct index and length of the match', () => {
    const text = 'The word overpopulation appears here.';
    const matches = checkTerminology(text);
    expect(matches[0].index).toBe(text.indexOf('overpopulation'));
    expect(matches[0].length).toBe('overpopulation'.length);
  });

  it('returns empty array for empty string', () => {
    expect(checkTerminology('')).toEqual([]);
  });

  it('returns empty array for whitespace-only input', () => {
    expect(checkTerminology('   ')).toEqual([]);
  });
});

describe('hasTerminologyIssues', () => {
  it('returns false for clean text', () => {
    expect(hasTerminologyIssues('Rights-based approach to family planning.')).toBe(false);
  });

  it('returns true when text contains a banned term', () => {
    expect(hasTerminologyIssues('overpopulation is the real issue')).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(hasTerminologyIssues('')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail (module loads, assertions check logic)**

```bash
cd "/Users/dan/dev/population_matters/tools/Content Hub" && npm test -- --run src/lib/terminology.test.ts
```

Expected: Tests may pass immediately — the functions are already implemented. If failures appear, check that `TERMINOLOGY_MAP` in `src/constants.ts` contains the expected terms. Fix tests to match constants, not the other way around.

- [ ] **Step 3: Run tests to verify they all pass**

```bash
cd "/Users/dan/dev/population_matters/tools/Content Hub" && npm test -- --run src/lib/terminology.test.ts
```

Expected: All 13 tests PASS

- [ ] **Step 4: Commit**

```bash
cd "/Users/dan/dev/population_matters/tools/Content Hub"
git add src/lib/terminology.test.ts
git commit -m "test(lib): add terminology checker tests — locks in PM messaging compliance gate"
```

---

### Task 2: Filters tests

**Files:**

- Create: `src/lib/filters.test.ts`
- Read first: `src/lib/filters.ts`, `src/types/models.ts` (for the `Entry` type shape)

- [ ] **Step 1: Write the failing test file**

```typescript
// src/lib/filters.test.ts
import { describe, it, expect } from 'vitest';
import { isApprovalOverdue, matchesSearch } from './filters';
import type { Entry } from '../types/models';

// Minimal stub — only fields these functions inspect.
// If Entry has required fields not shown here, add them as needed.
function makeEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 'entry-1',
    caption: '',
    platforms: [],
    status: 'Draft',
    workflowStatus: 'Draft',
    ...overrides,
  } as Entry;
}

describe('isApprovalOverdue', () => {
  it('returns false when entry has no approvalDeadline', () => {
    expect(isApprovalOverdue(makeEntry())).toBe(false);
  });

  it('returns false when approvalDeadline is in the future', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    expect(isApprovalOverdue(makeEntry({ approvalDeadline: future, status: 'Draft' }))).toBe(false);
  });

  it('returns true when approvalDeadline is in the past and status is not Approved', () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    expect(isApprovalOverdue(makeEntry({ approvalDeadline: past, status: 'Draft' }))).toBe(true);
  });

  it('returns false when deadline is past but status is Approved', () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    expect(isApprovalOverdue(makeEntry({ approvalDeadline: past, status: 'Approved' }))).toBe(
      false,
    );
  });

  it('returns false for an invalid date string', () => {
    expect(isApprovalOverdue(makeEntry({ approvalDeadline: 'not-a-date' }))).toBe(false);
  });
});

describe('matchesSearch', () => {
  it('returns true for empty query — all entries match', () => {
    expect(matchesSearch(makeEntry({ caption: 'hello' }), '')).toBe(true);
    expect(matchesSearch(makeEntry({ caption: 'hello' }), '   ')).toBe(true);
  });

  it('matches against caption, case-insensitively', () => {
    const entry = makeEntry({ caption: 'Climate action is urgent' });
    expect(matchesSearch(entry, 'climate')).toBe(true);
    expect(matchesSearch(entry, 'CLIMATE')).toBe(true);
  });

  it('returns false when query does not appear in any field', () => {
    expect(
      matchesSearch(makeEntry({ caption: 'Population rights', platforms: ['LinkedIn'] }), 'xyz123'),
    ).toBe(false);
  });

  it('matches against platforms array', () => {
    expect(matchesSearch(makeEntry({ platforms: ['LinkedIn', 'Twitter'] }), 'linkedin')).toBe(true);
  });

  it('matches against author field', () => {
    expect(matchesSearch(makeEntry({ author: 'Fran Harrison' }), 'fran')).toBe(true);
  });

  it('matches against campaign field', () => {
    expect(matchesSearch(makeEntry({ campaign: 'World Population Day' }), 'population day')).toBe(
      true,
    );
  });

  it('matches against assetType field', () => {
    expect(matchesSearch(makeEntry({ assetType: 'Video' }), 'video')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "/Users/dan/dev/population_matters/tools/Content Hub" && npm test -- --run src/lib/filters.test.ts
```

Expected: Import resolves, tests run. Any failures indicate type mismatches — read `src/types/models.ts` and adjust the `makeEntry` stub to match the real `Entry` shape.

- [ ] **Step 3: Fix any type mismatches in the Entry stub, then run again**

```bash
cd "/Users/dan/dev/population_matters/tools/Content Hub" && npm test -- --run src/lib/filters.test.ts
```

Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
cd "/Users/dan/dev/population_matters/tools/Content Hub"
git add src/lib/filters.test.ts
git commit -m "test(lib): add filters tests — isApprovalOverdue, matchesSearch"
```

---

### Task 3: Utils tests

**Files:**

- Create: `src/lib/utils.test.ts`
- Read first: `src/lib/utils.ts` (confirm all exported functions)

- [ ] **Step 1: Write the failing test file**

```typescript
// src/lib/utils.test.ts
import { describe, it, expect } from 'vitest';
import {
  cx,
  daysInMonth,
  isoFromParts,
  monthStartISO,
  monthEndISO,
  isOlderThanDays,
  localMonthKey,
  ensureArray,
  ensurePeopleArray,
} from './utils';

describe('cx', () => {
  it('joins truthy strings with a space', () => {
    expect(cx('a', 'b', 'c')).toBe('a b c');
  });

  it('filters out falsy values', () => {
    expect(cx('a', false, null, undefined, 'b')).toBe('a b');
  });

  it('returns empty string when all values are falsy', () => {
    expect(cx(false, null, undefined)).toBe('');
  });
});

describe('daysInMonth', () => {
  it('returns 31 for January (monthIndex 0)', () => {
    expect(daysInMonth(2024, 0)).toBe(31);
  });

  it('returns 28 for February in a non-leap year', () => {
    expect(daysInMonth(2023, 1)).toBe(28);
  });

  it('returns 29 for February in a leap year', () => {
    expect(daysInMonth(2024, 1)).toBe(29);
  });

  it('returns 30 for April (monthIndex 3)', () => {
    expect(daysInMonth(2024, 3)).toBe(30);
  });
});

describe('isoFromParts', () => {
  it('formats year + monthIndex + day into ISO date string', () => {
    // monthIndex 2 = March
    expect(isoFromParts(2024, 2, 5)).toBe('2024-03-05');
  });

  it('pads single-digit month and day', () => {
    expect(isoFromParts(2024, 0, 1)).toBe('2024-01-01');
  });
});

describe('monthStartISO', () => {
  it('returns the first day of the month as ISO string', () => {
    expect(monthStartISO(new Date(2024, 2, 15))).toBe('2024-03-01');
  });
});

describe('monthEndISO', () => {
  it('returns the last day of the month as ISO string', () => {
    // Feb 2024 is a leap year
    expect(monthEndISO(new Date(2024, 1, 1))).toBe('2024-02-29');
    // Nov = 30 days
    expect(monthEndISO(new Date(2024, 10, 1))).toBe('2024-11-30');
  });
});

describe('isOlderThanDays', () => {
  it('returns true when ISO date is older than the given number of days', () => {
    const old = new Date(Date.now() - 8 * 864e5).toISOString(); // 8 days ago
    expect(isOlderThanDays(old, 7)).toBe(true);
  });

  it('returns false when ISO date is within the given number of days', () => {
    const recent = new Date(Date.now() - 2 * 864e5).toISOString(); // 2 days ago
    expect(isOlderThanDays(recent, 7)).toBe(false);
  });
});

describe('localMonthKey', () => {
  it('returns YYYY-MM string for the given date', () => {
    expect(localMonthKey(new Date(2024, 2, 15))).toBe('2024-03');
    expect(localMonthKey(new Date(2026, 0, 1))).toBe('2026-01');
  });
});

describe('ensureArray', () => {
  it('returns an array unchanged (filtering falsy elements)', () => {
    expect(ensureArray(['a', 'b'])).toEqual(['a', 'b']);
  });

  it('filters falsy values from arrays', () => {
    expect(ensureArray(['a', '', false, null, 'b'] as unknown[])).toEqual(['a', 'b']);
  });

  it('returns empty array for non-array input', () => {
    expect(ensureArray('a string')).toEqual([]);
    expect(ensureArray(null)).toEqual([]);
    expect(ensureArray(undefined)).toEqual([]);
  });
});

describe('ensurePeopleArray', () => {
  it('returns array of trimmed strings', () => {
    expect(ensurePeopleArray(['Fran ', ' Dan'])).toEqual(['Fran', 'Dan']);
  });

  it('converts a single non-empty string to a one-element array', () => {
    expect(ensurePeopleArray('Fran')).toEqual(['Fran']);
  });

  it('returns empty array for empty string', () => {
    expect(ensurePeopleArray('')).toEqual([]);
  });

  it('returns empty array for null or undefined', () => {
    expect(ensurePeopleArray(null)).toEqual([]);
    expect(ensurePeopleArray(undefined)).toEqual([]);
  });

  it('filters out empty strings in arrays', () => {
    expect(ensurePeopleArray(['Fran', '', 'Dan'])).toEqual(['Fran', 'Dan']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "/Users/dan/dev/population_matters/tools/Content Hub" && npm test -- --run src/lib/utils.test.ts
```

- [ ] **Step 3: Run tests to verify they all pass**

All functions are already implemented — tests should pass without code changes.

```bash
cd "/Users/dan/dev/population_matters/tools/Content Hub" && npm test -- --run src/lib/utils.test.ts
```

Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
cd "/Users/dan/dev/population_matters/tools/Content Hub"
git add src/lib/utils.test.ts
git commit -m "test(lib): add utils tests — cx, date helpers, array utilities"
```

---

### Task 4: Button component smoke tests

Protects against regressions during the #1 priority simplification effort. Tests behaviour and accessibility — not Tailwind class names.

**Files:**

- Create: `src/components/ui/__tests__/Button.test.tsx`
- Read first: `src/components/ui/Button.tsx`

- [ ] **Step 1: Write the failing test file**

```tsx
// src/components/ui/__tests__/Button.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../Button';

describe('Button', () => {
  it('renders its children', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
  });

  it('defaults to type="button" to prevent accidental form submission', () => {
    render(<Button>Click</Button>);
    expect(screen.getByRole('button').getAttribute('type')).toBe('button');
  });

  it('calls onClick handler when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it('does not call onClick when disabled', () => {
    const handleClick = vi.fn();
    render(
      <Button disabled onClick={handleClick}>
        Disabled
      </Button>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('forwards aria-label and data attributes', () => {
    render(
      <Button aria-label="Save entry" data-testid="save-btn">
        Save
      </Button>,
    );
    const btn = screen.getByTestId('save-btn');
    expect(btn.getAttribute('aria-label')).toBe('Save entry');
  });

  it('merges custom className without losing base styles', () => {
    render(<Button className="my-custom">Go</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('my-custom');
    // Base style class should still be present
    expect(btn.className).toContain('rounded-xl');
  });

  it('renders all variants without crashing', () => {
    const variants = [
      'default',
      'secondary',
      'ghost',
      'outline',
      'destructive',
      'success',
    ] as const;
    variants.forEach((variant) => {
      const { unmount } = render(<Button variant={variant}>{variant}</Button>);
      expect(screen.getByRole('button')).toBeTruthy();
      unmount();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "/Users/dan/dev/population_matters/tools/Content Hub" && npm test -- --run "src/components/ui/__tests__/Button.test.tsx"
```

- [ ] **Step 3: Run tests to verify they all pass**

```bash
cd "/Users/dan/dev/population_matters/tools/Content Hub" && npm test -- --run "src/components/ui/__tests__/Button.test.tsx"
```

Expected: All 7 tests PASS

- [ ] **Step 4: Run the full test suite to confirm no regressions**

```bash
cd "/Users/dan/dev/population_matters/tools/Content Hub" && npm test
```

Expected: All tests PASS. New total should be approximately 21 + ~35 = ~56 tests.

- [ ] **Step 5: Commit**

```bash
cd "/Users/dan/dev/population_matters/tools/Content Hub"
git add src/components/ui/__tests__/Button.test.tsx
git commit -m "test(ui): add Button smoke tests — regression guard for simplification"
```
