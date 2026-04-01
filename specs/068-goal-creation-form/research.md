# Research: Goal Creation Form

**Feature**: `068-goal-creation-form`  
**Date**: 2026-04-01  
**Status**: Complete — all NEEDS CLARIFICATION items from spec resolved

---

## 1. Entry Point: Form-First vs Picker-First

**Decision**: Form opens directly when "Create Goal" is tapped; score picker opens as an overlay from within the form.

**Rationale**: Aligns with FR-001 (form presents all fields at once) and the existing `GoalsView.tsx` UX pattern already used for the score selector overlay (`showScoreSelector` state + full-screen conditional return). The form shows all fields upfront, making the experience consistent with how `TaskBuilder` in session creation works.

**How it maps to current code**: `handleCreateGoal()` currently sets `setShowScoreSelector(true)`. The change replaces this with `setShowCreationForm(true)`. The form component renders the ScoreSelector overlay from within itself when the user taps the score selector button.

**Alternatives considered**: Score-picker-first (current flow) — rejected because user-specified parameters should be visible before committing to a score.

---

## 2. `createGoal()` Parameterisation

**Decision**: Extend `CreateGoalInput` with three optional fields (`loopCount`, `tempoMultiplier`, `minResult`) that default to the current hardcoded values when absent.

**Rationale**: Pure backward compatibility — callers who don't pass the new fields get exactly the current behavior (SC-003). The engine function remains pure (no side effects); it just reads from input instead of hardcoded constants. This is a non-breaking additive change to the existing interface.

**Exact change to `CreateGoalInput`**:
```typescript
export interface CreateGoalInput {
  scoreRef: ScoreRef;
  scoreTitle: string;
  phrases: ReadonlyArray<PhraseRegion>;
  staffCount: number;
  measureEndTicks: ReadonlyArray<number>;
  // New optional fields — default to current hardcoded values when absent
  loopCount?: number;       // default: 10
  tempoMultiplier?: number; // default: 1.0 (= 100%)
  minResult?: number;       // default: 90 (= 90%)
}
```

**Change in `createGoal()` body** (lines 95–97 of current `goalEngine.ts`):
```typescript
// Before:
loopCount: 10,
tempoMultiplier: 1.0,
minResult: 90,

// After:
loopCount: input.loopCount ?? 10,
tempoMultiplier: input.tempoMultiplier ?? 1.0,
minResult: input.minResult ?? 90,
```

**Alternatives considered**: New overloaded function `createGoalWithParams()` — rejected as unnecessary; additive optional fields are simpler and keep the test surface small.

---

## 3. Form State Management

**Decision**: `GoalCreationForm` is a standalone component rendered by `GoalsView` in place of the full-screen score selector flow. It manages its own local state (selectedScore, iterations, minResult, tempoPercent, duplicateWarning, scoreUnavailable, submitting).

**Rationale**: Consistent with `TaskBuilder.tsx` which self-manages draft state. Keeps `GoalsView` lean — it only needs to know when the form is open/closed and when a goal was successfully created.

**`GoalsView` state changes**:
- Remove: `showScoreSelector` (the form owns the score selector now)
- Add: `showCreationForm: boolean`
- `handleCreateGoal` → sets `showCreationForm = true`
- `handleFormCancel` → sets `showCreationForm = false`
- `handleFormSubmit(params: GoalCreationParams)` → calls existing `processScoreSelection` logic with the user-provided params injected into `createGoal()`

**Alternatives considered**: Inline form inside `GoalsView` render — rejected because it would make `GoalsView` bloated; a dedicated component is cleaner and independently testable.

---

## 4. Slider Controls — Exact Implementation Pattern

**Decision**: Copy the exact slider pattern from `TaskBuilder.tsx` (lines 369–391). All three fields use `<input type="range">` with `className="sessions-plugin__task-range"`.

**Tempo slider** (already in TaskBuilder — reuse same props):
```tsx
<div className="sessions-plugin__task-field">
  <label className="sessions-plugin__task-label">
    Tempo: {tempoPercent}%
  </label>
  <input
    className="sessions-plugin__task-range"
    type="range"
    min="50"
    max="200"
    step="5"
    value={tempoPercent}
    onChange={(e) => setTempoPercent(Number(e.target.value))}
  />
</div>
```

**Min result slider** (already in TaskBuilder — reuse same props):
```tsx
<div className="sessions-plugin__task-field">
  <label className="sessions-plugin__task-label">
    Min result: {minResult}%
  </label>
  <input
    className="sessions-plugin__task-range"
    type="range"
    min="0"
    max="100"
    step="5"
    value={minResult}
    onChange={(e) => setMinResult(Number(e.target.value))}
  />
</div>
```

**Iterations slider** (new, based on same pattern):
```tsx
<div className="sessions-plugin__task-field">
  <label className="sessions-plugin__task-label">
    Iterations: {iterations}
  </label>
  <input
    className="sessions-plugin__task-range"
    type="range"
    min="1"
    max="20"
    step="1"
    value={iterations}
    onChange={(e) => setIterations(Number(e.target.value))}
  />
</div>
```

**Rationale**: Sliders are already styled and tested in the plugin CSS. They inherently constrain values to valid ranges, eliminating the need for range validation errors on these fields (simplifying User Story 3). Only the score-required error needs explicit handling.

---

## 5. Duplicate Goal Warning

**Decision**: Use `hasGoalForScoreAsync()` (already exists in `goalStorage.ts`) after score selection. Show a dismissible inline warning — does **not** block submission.

**Rationale**: Answered in clarification Q4. The existing code in `processScoreSelection()` already calls `hasGoalForScoreAsync()` but currently blocks with an error. The new behavior changes this from a blocking error to a dismissible warning state on the form.

**Implementation**: After score selection, if `hasGoalForScoreAsync(scoreRef)` returns true, set `duplicateWarning = true`. The form renders:
```tsx
{duplicateWarning && (
  <div className="goals-view__form-warning" role="alert">
    An active goal already exists for this score.
    <button onClick={() => setDuplicateWarning(false)}>Dismiss</button>
  </div>
)}
```
The submit button remains enabled.

---

## 6. Unavailable Score Blocking

**Decision**: When a selected score becomes unavailable (detected via same `unavailableScoreKeys` pattern used in `TaskBuilder.tsx`), show a warning icon on the score selector and disable the submit button.

**Rationale**: Answered in clarification Q5. Task builder already has this pattern (`⚠ Score not found — please select a different score`). The form mirrors this.

**Implementation**: Form checks score availability reactively. If the selected score is no longer in the catalogue/user scores list after initial selection:
```tsx
{scoreUnavailable && (
  <span className="sessions-plugin__task-score-warning" role="alert">
    ⚠ Score no longer available — please select a different score
  </span>
)}
```
Submit button gets `disabled={!selectedScore || scoreUnavailable}`.

---

## 7. Post-Submit Navigation

**Decision**: Form closes on successful goal creation; user lands on Goals tab with new goal at top. No toast or confirmation. (Clarification Q2)

**Implementation**: `GoalCreationForm` calls `onSuccess()` prop after submission. `GoalsView` handles `onSuccess` by setting `showCreationForm = false` and calling `refreshGoals()`. Since goals index is sorted by `createdAt` descending, the new goal appears at the top automatically.

---

## 8. Test Strategy

**Decision**: Three test files are involved:

| File | What to add |
|------|-------------|
| `goalEngine.test.ts` | New `describe` block testing parameterised `createGoal()` (loopCount, tempoMultiplier, minResult applied; defaults applied when absent) |
| `GoalCreationForm.test.tsx` | NEW file — unit tests for form rendering, slider state, score selection, duplicate warning, unavailable score, submit |
| `GoalsView.test.tsx` | Update existing tests to reflect form-first flow; test that form opens on "Create Goal" tap |

**Test-first order**: Tests written BEFORE implementation code in all three files, per Constitution Principle V.

---

## Summary: No NEEDS CLARIFICATION items remain

All five clarified items from the spec session are now fully resolved in this research document. Implementation can proceed to Phase 1.
