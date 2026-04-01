# Quickstart: Goal Creation Form

**Feature**: `068-goal-creation-form`  
**Date**: 2026-04-01

---

## Prerequisites

Node.js (for the sessions plugin). All work for this feature is confined to `plugins-external/sessions-plugin/`.

```bash
cd plugins-external/sessions-plugin
npm install   # only needed on first setup
```

---

## Run Tests

All tests for this feature run inside the sessions-plugin Vitest suite:

```bash
cd plugins-external/sessions-plugin
npm test
```

To run in watch mode during development:

```bash
npm run test:watch
```

To run only goal-related tests:

```bash
npx vitest run goalEngine.test.ts
npx vitest run GoalCreationForm.test.tsx
npx vitest run GoalsView.test.tsx
```

**Expected baseline** (before any changes): All existing tests pass. New test files for this feature will fail until implementation is in place (Constitution Principle V — Red-Green-Refactor).

---

## Type-check

```bash
npm run typecheck
```

This validates TypeScript strict mode across the plugin. Run after every file change.

---

## Dev Server (visual preview)

```bash
npm run dev
```

Opens `http://localhost:5173` with a standalone plugin harness. The Goals tab is accessible from the tab bar. Use this to manually verify the form opens directly on "Create Goal" tap.

---

## Implementation Order (Constitution V: test-first)

Work through files in this order:

### Step 1: Extend `createGoal()` engine

1. Write **failing** tests in `goalEngine.test.ts` for the parameterised variant:
   - `createGoal()` with `loopCount=5` produces tasks with `loopCount: 5`
   - `createGoal()` with `tempoMultiplier=0.75` produces tasks with `tempoMultiplier: 0.75`
   - `createGoal()` with `minResult=80` produces tasks with `minResult: 80`
   - `createGoal()` with no new params produces the same output as today (SC-003)

2. Run `npm test` → confirm new tests **FAIL**

3. Modify `goalEngine.ts`:
   - Add `loopCount?`, `tempoMultiplier?`, `minResult?` to `CreateGoalInput`
   - Replace hardcoded `10`, `1.0`, `90` with `input.loopCount ?? 10`, etc.

4. Run `npm test` → confirm all tests **PASS**

### Step 2: Build `GoalCreationForm` component

1. Write **failing** tests in `GoalCreationForm.test.tsx`:
   - Form renders with correct default slider values (iterations=10, minResult=90%, tempo=100%)
   - Read-only fields show "Play Score" and "Phrases"
   - Submit is disabled when no score selected
   - Submit fires `onSubmit` with correct params when score is selected
   - Duplicate warning rendered when `hasDuplicate` prop is true; dismiss button clears it
   - Unavailable score warning shown and submit disabled when score is unavailable

2. Run `npm test` → confirm new tests **FAIL**

3. Create `GoalCreationForm.tsx` implementing the `GoalCreationFormProps` contract

4. Run `npm test` → confirm tests **PASS**

### Step 3: Wire into `GoalsView`

1. Update failing tests in `GoalsView.test.tsx`:
   - Tapping "Create Goal" renders `GoalCreationForm`, not `ScoreSelector` directly
   - `handleFormSubmit` with valid params creates goal and closes form

2. Run `npm test` → confirm tests **FAIL**

3. Modify `GoalsView.tsx`:
   - Replace `showScoreSelector` state with `showCreationForm`
   - `handleCreateGoal` → `setShowCreationForm(true)`
   - Render `<GoalCreationForm>` instead of `<ScoreSelector>` overlay
   - Pass `onSubmit` handler that calls `processScoreSelection` with user params
   - Restructure `processScoreSelection` to accept `GoalCreationFormParams`

4. Run `npm test` → confirm all tests **PASS**

---

## Key Files

| File | Role |
|------|------|
| `goalEngine.ts` | Pure goal creation logic — extend `CreateGoalInput` |
| `goalEngine.test.ts` | Tests for engine (add parameterised tests) |
| `GoalCreationForm.tsx` | New form component |
| `GoalCreationForm.test.tsx` | New test file for form |
| `GoalsView.tsx` | Wire form into goals tab |
| `GoalsView.test.tsx` | Update existing tests |
| `SessionsPlugin.css` | Reuse existing CSS classes; add `.goals-view__form-*` if needed |

---

## CSS Classes to Reuse

The following classes already exist and should be used directly (no new CSS unless a class is missing):

| Existing class | Use in form |
|----------------|-------------|
| `sessions-plugin__task-field` | Each form row wrapper |
| `sessions-plugin__task-label` | Field labels |
| `sessions-plugin__task-range` | All three sliders |
| `sessions-plugin__task-score-btn` | Score selector button |
| `sessions-plugin__task-score-warning` | Unavailable score warning |
| `sessions-plugin__confirm-overlay` | Modal overlay wrapper |
| `sessions-plugin__confirm-dialog` | Modal dialog box |
| `sessions-plugin__confirm-actions` | Action button row |
| `sessions-plugin__confirm-btn` | Cancel/Submit buttons |
| `sessions-plugin__confirm-btn--danger` | Destructive action (not needed here) |
| `goals-view__error` | Error/warning message area |

New classes (only if unavoidable): `goals-view__form-warning` for the duplicate goal dismissible inline warning.

---

## Verification Checklist

Before marking this feature complete:

- [ ] `npm test` passes (all tests green)
- [ ] `npm run typecheck` passes with zero errors
- [ ] Manual: "Create Goal" tap opens form directly (not score picker)
- [ ] Manual: Form shows sliders at correct defaults (10 / 90% / 100%)
- [ ] Manual: Adjusting sliders and submitting creates goal with correct task params
- [ ] Manual: Submitting with defaults produces same goal as previous flow (SC-003)
- [ ] Manual: Selecting a score with an existing active goal shows dismissible warning
- [ ] Manual: Submit disabled when no score selected
