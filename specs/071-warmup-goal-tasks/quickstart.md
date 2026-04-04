# Quickstart: Implementing Warm-Up Goal Tasks (Feature 071)

This guide gives an ordered implementation path that respects the TDD mandate (Principle V) and avoids touching the backend or layout engine.

All modified files live in `plugins-external/sessions-plugin/` unless noted.
The sole exception is `frontend/plugins/train-view/` for Step 7 (train-view integration).

---

## Prerequisites

```bash
cd plugins-external/sessions-plugin
pnpm test --watch   # keep vitest running
```

---

## Step 1 — Extend Types

**Files**: `sessionTypes.ts`, `goalTypes.ts`

### 1a. `sessionTypes.ts`

Add `'warmup-scale'` to the `ScoreRef` type union:

```typescript
export interface ScoreRef {
  readonly type: 'preloaded' | 'user' | 'warmup-scale';
  readonly id: string;
}
```

### 1b. `goalTypes.ts`

Extend `GoalType` and add warm-up fields to `Goal`:

```typescript
export type GoalType = 'learn-score-phrase' | 'warm-up-scales';

// In Goal interface, add:
readonly warmUpScaleId?: string;
readonly warmUpSessionCount?: number;

// New params type for creation form:
export interface WarmUpGoalCreationFormParams {
  goalType: 'warm-up-scales';
  scaleId: string;
  scaleDisplayName: string;
  tempoMultiplier: number;
  loopCount: number;
  minResult: number;
  sessionCount: number;
}
```

**Tests**: After extending, run existing tests — all must still pass. No new tests needed for pure type changes.

---

## Step 2 — Add `createWarmUpGoal()` (TDD)

**File**: `goalEngine.ts`

### 2a. Write failing tests

```typescript
// goalEngine.test.ts
describe('createWarmUpGoal', () => {
  it('creates a goal with warm-up-scales type', () => { ... });
  it('creates a SessionTask with scoreRef.type warmup-scale', () => { ... });
  it('sets estimatedDurationSecs to 300', () => { ... });
  it('sets scoreRef.id to the provided scaleId', () => { ... });
  it('populates warmUpScaleId and warmUpSessionCount', () => { ... });
});
```

### 2b. Implement `createWarmUpGoal()`

```typescript
export interface CreateWarmUpGoalInput {
  scaleId: string;
  scaleDisplayName: string;
  tempoMultiplier: number;
  loopCount: number;
  minResult: number;
  sessionCount: number;
  createdAt?: number;
}

export interface CreateWarmUpGoalResult {
  goal: Goal;
  taskTemplate: SessionTask;  // Caller stamps a unique ID per session copy
}

export function createWarmUpGoal(input: CreateWarmUpGoalInput): CreateWarmUpGoalResult {
  // Returns goal with no sessionIds/taskIds yet (assigned post-injection).
  // Returns a taskTemplate with all fields set; caller clones it with a unique id per session.
}
```

---

## Step 3 — Add `insertWarmUpTaskIntoSessions()` (TDD)

**File**: `goalEngine.ts`

### 3a. Write failing tests

```typescript
describe('insertWarmUpTaskIntoSessions', () => {
  it('injects into sessions with sufficient free time', () => { ... });
  it('skips sessions without enough free time', () => { ... });
  it('respects maxCount limit', () => { ... });
  it('orders by targetDate ascending', () => { ... });
  it('prepends the task at index 0', () => { ... });
  it('treats availableTime = 0 as unlimited', () => { ... });
});
```

### 3b. Implement

```typescript
export function insertWarmUpTaskIntoSessions(
  taskTemplate: SessionTask,
  sessions: Session[],
  maxCount: number,
  warmUpDurationSecs = 300,
): Array<{ session: Session; task: SessionTask }> {
  // Returns array of { modified session, task copy with unique id }.
  // Returns up to maxCount entries.
  // Does not mutate inputs.
}
```

---

## Step 4 — Create `WarmUpGoalCreationForm.tsx` (TDD with RTL)

**File**: `WarmUpGoalCreationForm.tsx` (new)

### UI elements

| Control | Default | Range |
|---------|---------|-------|
| Scale selector (dropdown) | C Major | All 24 `SCALE_OPTIONS` entries |
| Tempo slider | 100% | 50% – 200% |
| Iterations slider | 10 | 1 – 20 |
| Min score slider | 90 | 0 – 100 |
| Sessions counter | 5 | 1 – 20 |
| Submit button | "Add Warm-Up Goal" | |

### 4a. Write failing tests (RTL)

```typescript
// WarmUpGoalCreationForm.test.tsx
it('renders C Major as the default scale', () => { ... });
it('renders sessions counter defaulted to 5', () => { ... });
it('calls onSubmit with correct WarmUpGoalCreationFormParams on submit', () => { ... });
it('disables submit when no sessions exist', () => { ... });
```

### 4b. Implement

Import `SCALE_OPTIONS` from `'../../frontend/plugins/train-view/exerciseGenerator'` (or re-export it from a shared types package — check the current import path used by sessions-plugin).

Props:
```typescript
interface WarmUpGoalCreationFormProps {
  onSubmit: (params: WarmUpGoalCreationFormParams) => void;
  onCancel: () => void;
  existingSessionCount: number; // to cap sessions slider max; show warning when 0
}
```

---

## Step 5 — Update `GoalsView.tsx`

**File**: `GoalsView.tsx`

### Changes

1. **Goal-type selector**: Before rendering the creation form, show a 2-option selector:
   - "Learn Score Phrase" (existing)
   - "Warm-Up Scales" (new)

2. **Branched rendering**:
   ```typescript
   {selectedGoalType === 'warm-up-scales'
     ? <WarmUpGoalCreationForm onSubmit={handleWarmUpGoalSubmit} ... />
     : <GoalCreationForm onSubmit={handleGoalSubmit} ... />}
   ```

3. **`handleWarmUpGoalSubmit(params)`**: 
   - Call `createWarmUpGoal(params)` → `{ goal, taskTemplate }`
   - Load sessions from IndexedDB
   - Call `insertWarmUpTaskIntoSessions(taskTemplate, sessions, params.sessionCount, 300)`
   - For each `{ session, task }` in result:
     - Save task inside updated session to IndexedDB
     - Update session index
   - Update `goal.sessionIds` and `goal.taskIds`
   - Save goal to IndexedDB + update goal index
   - Refresh goals and sessions state

### Tests (RTL integration-style)

```typescript
// GoalsView.test.tsx additions
it('renders goal type selector', () => { ... });
it('shows WarmUpGoalCreationForm when warm-up-scales selected', () => { ... });
it('injects warm-up tasks into sessions on submit', () => { ... });
it('shows warning when no sessions available', () => { ... });
```

---

## Step 6 — Update `TaskRow.tsx`

**File**: `TaskRow.tsx`

### Changes

In `handlePractice()`, add a branch for the warm-up task type:
```typescript
if (task.scoreRef.type === 'warmup-scale') {
  context.openPlugin('train-view', {
    warmUpTaskConfig: {
      taskId: task.id,
      sessionId: activeSession.id,
      sessionName: activeSession.name,
      scaleId: task.scoreRef.id,
      tempoMultiplier: task.tempoMultiplier,
      loopCount: task.loopCount,
      minResult: task.minResult,
    },
  });
  return;
}
// existing practice-view-plugin path follows...
```

The existing `scoreUnavailable` check uses `task.scoreRef.type === 'preloaded'` — no change needed; warm-up tasks will always be available.

### Tests

```typescript
it('calls openPlugin train-view for warm-up-scale tasks', () => { ... });
it('does not show score-unavailable warning for warm-up-scale tasks', () => { ... });
```

---

## Step 7 — Update `train-view` (frontend/plugins/train-view/)

**File**: main plugin component (discover by checking `src/` in train-view)

### Changes

On plugin mount, read navigation data:
```typescript
const navData = context.getNavigationData<{ warmUpTaskConfig?: WarmUpTaskConfig }>();
if (navData?.warmUpTaskConfig) {
  const { scaleId, tempoMultiplier, loopCount, minResult, taskId, sessionId } = navData.warmUpTaskConfig;
  // Pre-select scale matching scaleId in SCALE_OPTIONS
  // Set tempo to tempoMultiplier
  // Store taskId+sessionId in state for completion callback
}
```

On exercise completion (existing completion hook):
```typescript
if (warmUpTaskId) {
  context.openPlugin('sessions-plugin', {
    completedWarmUpTask: {
      taskId: warmUpTaskId,
      sessionId: warmUpSessionId,
      result: finalScore,
      completedAt: Date.now(),
    },
  });
}
```

### Tests

```typescript
it('pre-selects scale from navigation data', () => { ... });
it('calls sessions-plugin completion callback when exercise ends', () => { ... });
```

---

## Step 8 — Handle Completion Callback in sessions-plugin

**File**: `GoalsView.tsx` or a dedicated `useWarmUpCompletion.ts` hook

On sessions-plugin mount, check navigation data for `completedWarmUpTask`:
```typescript
const navData = context.getNavigationData<{ completedWarmUpTask?: WarmUpTaskCompletionPayload['completedWarmUpTask'] }>();
if (navData?.completedWarmUpTask) {
  const { taskId, sessionId, result, completedAt } = navData.completedWarmUpTask;
  // 1. Load session from IndexedDB
  // 2. Find task by taskId
  // 3. Append a linkedPractice entry: { id, ts: completedAt, result }
  // 4. Save updated session
  // 5. checkGoalCompletionAcrossSessions() for the task's goalId
  // 6. If completed, update goal status → 'completed'
}
```

**Tests**:
```typescript
it('marks warm-up task done when completion payload received', () => { ... });
it('auto-completes goal when all session warm-up tasks are done', () => { ... });
```

---

## Implementation Order Summary

| Step | File(s) | TDD Test Count |
|------|---------|----------------|
| 1 | sessionTypes.ts, goalTypes.ts | 0 (type-only) |
| 2 | goalEngine.ts | ~5 |
| 3 | goalEngine.ts | ~6 |
| 4 | WarmUpGoalCreationForm.tsx | ~4 |
| 5 | GoalsView.tsx | ~4 |
| 6 | TaskRow.tsx | ~2 |
| 7 | train-view/\* | ~2 |
| 8 | GoalsView.tsx or hook | ~2 |

> **Principle V reminder**: Write tests _before_ implementation in each step. Run `pnpm test --watch` throughout.
