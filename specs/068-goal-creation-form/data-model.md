# Data Model: Goal Creation Form

**Feature**: `068-goal-creation-form`  
**Date**: 2026-04-01

---

## Overview

This feature introduces no new persisted entities and makes no schema changes to `Goal` or `SessionTask`. The changes are:

1. **`CreateGoalInput`** — extended with three optional configuration fields
2. **`GoalCreationFormParams`** — new transient type representing user-entered form state passed from `GoalCreationForm` to `GoalsView`
3. **`GoalCreationFormState`** — new internal React state shape inside `GoalCreationForm`

All persisted types (`Goal`, `SessionTask`, `Session`, `GoalIndexEntry`) are **unchanged**.

---

## Modified Entity: `CreateGoalInput`

**File**: `plugins-external/sessions-plugin/goalEngine.ts`

### Current shape

```typescript
export interface CreateGoalInput {
  scoreRef: ScoreRef;
  scoreTitle: string;
  phrases: ReadonlyArray<PhraseRegion>;
  staffCount: number;
  measureEndTicks: ReadonlyArray<number>;
}
```

### New shape (additive — fully backward-compatible)

```typescript
export interface CreateGoalInput {
  scoreRef: ScoreRef;
  scoreTitle: string;
  phrases: ReadonlyArray<PhraseRegion>;
  staffCount: number;
  measureEndTicks: ReadonlyArray<number>;
  /** Number of times each task region is repeated per practice session. Range: 1–20. Default: 10. */
  loopCount?: number;
  /** Tempo multiplier applied to the score's base tempo. Range: 0.5–2.0 (50%–200%). Default: 1.0. */
  tempoMultiplier?: number;
  /** Minimum practice score percentage required to mark a task done. Range: 0–100. Default: 90. */
  minResult?: number;
}
```

### Field rules

| Field | Type | Range | Default | Used as |
|-------|------|-------|---------|---------|
| `loopCount` | `number` (integer) | 1–20 | `10` | `SessionTask.loopCount` |
| `tempoMultiplier` | `number` (decimal) | 0.5–2.0 | `1.0` | `SessionTask.tempoMultiplier` |
| `minResult` | `number` (integer) | 0–100 | `90` | `SessionTask.minResult` |

When any optional field is absent (`undefined`), `createGoal()` applies the default via nullish coalescing (`?? default`). This preserves existing behavior exactly when called without the new fields.

---

## New Transient Type: `GoalCreationFormParams`

**File**: `plugins-external/sessions-plugin/GoalCreationForm.tsx` (or exported from `goalTypes.ts`)

Represents the validated user input collected by the form, passed out via the `onSubmit` prop.

```typescript
export interface GoalCreationFormParams {
  /** Reference to the selected score. */
  scoreRef: ScoreRef;
  /** Display title of the selected score. */
  scoreTitle: string;
  /** User-selected iterations. Integer in [1, 20]. */
  loopCount: number;
  /** User-selected minimum result. Integer in [0, 100]. */
  minResult: number;
  /**
   * User-selected tempo as a multiplier (0.5–2.0).
   * The UI exposes this as a percentage (50–200); the form converts before passing out.
   */
  tempoMultiplier: number;
}
```

This type is the sole output of the form. `GoalsView` receives it via `onSubmit(params: GoalCreationFormParams)` and passes its fields directly into `CreateGoalInput`.

---

## New Internal Type: `GoalCreationFormState`

**File**: `plugins-external/sessions-plugin/GoalCreationForm.tsx` (internal, not exported)

The local React state managed inside `GoalCreationForm`. Not persisted; exists only during form interaction.

```typescript
interface GoalCreationFormState {
  /** Currently selected score, or null if none selected yet. */
  selectedScore: { ref: ScoreRef; title: string } | null;
  /** Whether the score picker overlay is open. */
  showScoreSelector: boolean;
  /** Iterations slider value. Integer in [1, 20]. */
  iterations: number;
  /** Min result slider value. Integer in [0, 100]. */
  minResult: number;
  /** Tempo slider value as a percentage integer in [50, 200]. */
  tempoPercent: number;
  /** True when a duplicate active goal exists for the selected score. */
  duplicateWarning: boolean;
  /** True when the selected score is no longer available. */
  scoreUnavailable: boolean;
  /** True while the form is submitting (score loading + goal creation in progress). */
  submitting: boolean;
  /** Error message to display, or null when no error. */
  error: string | null;
}
```

---

## Unchanged Persisted Entities (reference only)

These entities are NOT modified by this feature. They are listed here for cross-reference.

### `Goal` (unchanged)

```typescript
interface Goal {
  id: string;
  type: GoalType;           // 'learn-score-phrase' — unchanged
  title: string;
  scoreRef: ScoreRef;
  scoreTitle: string;
  createdAt: string;
  status: GoalStatus;
  startMeasure: number;     // 0-based
  endMeasure: number;       // 0-based
  taskIds: readonly string[];
  sessionId: string | null;
}
```

### `SessionTask` (unchanged — fields already support user values)

```typescript
interface SessionTask {
  id: string;
  scoreRef: ScoreRef;
  scoreTitle: string;
  regionType: 'all' | 'measures';
  startMeasure: number | null;
  endMeasure: number | null;
  staffIndex: number;
  loopCount: number;         // ← populated from form (was hardcoded 10)
  tempoMultiplier: number;   // ← populated from form (was hardcoded 1.0)
  minResult: number;         // ← populated from form (was hardcoded 90)
  status: TaskStatus;
  currentRound: number;
  linkedPractices: TaskLinkedPractice[];
  goalId?: string;
}
```

---

## State Transitions

No new state machines introduced. Existing `GoalStatus` (`active` → `completed`) and `TaskStatus` (`todo` → `in-progress` → `done`/`failed`) transitions are unchanged.

---

## Constraints

- `loopCount` is stored as an integer. The slider produces integers (step=1), so no rounding needed.
- `tempoMultiplier` is stored as a decimal (e.g., `0.75` for 75%). The form slider works in integer percent (50–200); the conversion is `tempoMultiplier = tempoPercent / 100`.
- `minResult` is stored as an integer 0–100. The slider produces integers (step=5), so no rounding needed.
- All three values are written to **each generated task** identically — there is no per-task override at goal creation time.
