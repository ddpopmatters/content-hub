# Task

Convert `src/features/entry/EntryForm.jsx` to TypeScript (`EntryForm.tsx`).

## Context

- Files to read:
  - `src/features/entry/EntryForm.jsx` — the file to convert (1393 lines)
  - `src/types/models.ts` — Entry interface and related types
  - `src/features/entry/ApproverMulti.tsx` — example of a typed component in the same directory
  - `src/hooks/domain/useOpportunities.ts` — shows `pushSyncToast` and `runSyncTask` signatures
  - `src/features/entry/index.ts` — re-exports EntryForm; update the import if needed
  - `src/features/influencers/index.ts` — check Influencer type export
  - `src/lib/guidelines.ts` — check FALLBACK_GUIDELINES type
- Do not modify: `supabase/`, `.env`, any other files outside `src/features/entry/`
- Reference: `.codex-specs/CODEBASE_MAP.md` if present

## Requirements

1. **Create `src/features/entry/EntryForm.tsx`** with the exact same logic as `EntryForm.jsx`. This is a mechanical conversion — no logic changes, no refactoring, no new abstractions.

2. **Add an `EntryFormProps` interface** at the top of the file (before the component):

   ```typescript
   interface EntryFormProps {
     onSubmit: (data: Partial<Entry>) => void;
     existingEntries?: Entry[];
     onPreviewAssetType?: (assetType: string) => void;
     guidelines?: typeof FALLBACK_GUIDELINES;
     currentUser?: string;
     currentUserEmail?: string;
     approverOptions?: string[];
     influencers?: Influencer[];
     onInfluencerChange?: (influencers: Influencer[]) => void;
     teamsWebhookUrl?: string;
     pushSyncToast?: (message: string, type?: 'success' | 'warning' | 'error') => void;
     initialValues?: Partial<Entry> | null;
   }
   ```

   Use the actual types from the codebase — if `Influencer` is named differently, use the correct name. If `guidelines` has an explicit type, use that.

3. **Type all state variables** using `useState<T>()`. Infer from initial values where obvious (string, boolean, string[]). Use `Record<string, string>` for `platformCaptions`. Use `Record<string, boolean>` for `quickAssessment` and `goldenThread`. Use `string[]` for `entryFormErrors` and `entryFormErrorFields`.

4. **Type all refs**: `useRef<HTMLDivElement>(null)` for both `errorSummaryRef` and `conflictWarningRef`.

5. **Fix any TypeScript errors** that arise from implicit `any` — add minimal type annotations to silence them. Use `as` casts only where genuinely necessary (e.g. const-asserted arrays). Do not add types that aren't needed.

6. **Delete `src/features/entry/EntryForm.jsx`** once the `.tsx` file is complete and verified.

7. **Update `src/features/entry/index.ts`** only if the import path needs changing (it uses `./EntryForm` without extension, so it likely does not need changing — verify and only touch it if necessary).

8. **Run `npx tsc --noEmit`** from the project root after writing the file. If it reports errors in `EntryForm.tsx`, fix them. Do not fix errors in other files unless they were introduced by this change.

## Acceptance criteria

- `src/features/entry/EntryForm.tsx` exists with a typed `EntryFormProps` interface
- `src/features/entry/EntryForm.jsx` no longer exists
- `npx tsc --noEmit` passes with no new errors
- `npm test -- --run` passes
- The component's runtime behaviour is identical to before — no logic changes
