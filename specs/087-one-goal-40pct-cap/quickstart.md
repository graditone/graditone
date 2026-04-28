# Quickstart: One-Goal 40% Session Time Cap

**Feature**: `087-one-goal-40pct-cap`  
**Phase**: 1 — Implementation Guide  
**Date**: 2026-04-28

---

## Overview

This feature adds a 40% per-goal time cap to session generation when multiple `learn-score-phrase` goals are active. All changes are in `plugins-external/sessions-plugin/`.

---

## Prerequisites

The `plugins-external/` directory must be cloned into the worktree before starting:

```bash
cd /Users/alvaro.delcastillo/devel/graditone/.worktrees/087-one-goal-40pct-cap
git clone git@github.com:aylabs/graditone-pro-plugins.git plugins-external
cd plugins-external
git checkout -b 087-one-goal-40pct-cap
cd sessions-plugin && npm install
```

---

## Implementation Order

Follow this order to maintain red-green-refactor discipline (Principle V):

### Step 1 — Extend `sessionTypes.ts`

Add `goalIds` to `Session` and `SessionIndexEntry`:

```typescript
// In Session interface:
readonly goalIds?: readonly string[];  // Feature 087: multi-goal sessions

// In SessionIndexEntry interface:
goalIds?: string[];  // Feature 087: mirrors Session.goalIds
```

### Step 2 — Add `GoalPhraseGroup` and `DistributedSession.goalIds` to `sessionDistribution.ts`

```typescript
export interface GoalPhraseGroup extends PhraseGroup {
  goalId: string;
}

// In DistributedSession:
goalIds?: string[];  // Feature 087
```

### Step 3 — Write failing tests for `distributeMultiGoalTasks()` in `sessionDistribution.test.ts`

Write these tests (they must fail before Step 4):

```typescript
describe('distributeMultiGoalTasks', () => {
  // TC-1: Two goals, each contributing at most 40% per session
  it('caps each goal at 40% of available time per session', () => { ... });

  // TC-2: Single goal → no cap, uses full session budget
  it('bypasses cap for single-goal input', () => { ... });

  // TC-3: Unlimited mode → all in one session, no cap
  it('returns one session for unlimited mode', () => { ... });

  // TC-4: Excess tasks from capped goal roll to next session
  it('defers excess tasks to future sessions', () => { ... });

  // TC-5: First phrase group of a goal always admitted even if over 40%
  it('includes oversized first group (best-effort)', () => { ... });

  // TC-6: Tasks with no estimatedDurationSecs count as 0 toward budget
  it('places zero-duration tasks freely without consuming budget', () => { ... });

  // TC-7: Three goals, each at most 40%, all represented in session
  it('balances three goals in a single session', () => { ... });

  // TC-8: Output goalIds matches which goals contributed tasks
  it('populates goalIds per session correctly', () => { ... });
});
```

### Step 4 — Implement `distributeMultiGoalTasks()` in `sessionDistribution.ts`

See data-model.md for the full algorithm. Key implementation notes:

- Build per-goal FIFO queues from the input `GoalPhraseGroup[]`, sorted by `phraseIndex`.
- Single-goal fast path: call `distributeTasks(singleGoalGroups, availableTime)` and set `goalIds` to the single goalId.
- Unlimited fast path: aggregate all tasks into one `DistributedSession`, `goalIds` = all goalIds.
- Main loop: greedy round-robin, `goalBudget = availableTime * 0.4`.
- First-group rule: if `goalUsed.get(goalId) === 0`, admit regardless of budget.
- Collect `goalIds` per session: the set of distinct goalIds whose tasks appear in that session.

```typescript
export function distributeMultiGoalTasks(
  groups: GoalPhraseGroup[],
  availableTime: number,
): DistributedSession[] {
  // implementation per data-model.md algorithm
}
```

### Step 5 — Write failing tests for `reconstructPhraseGroupsFromTasks()` in `goalEngine.test.ts`

```typescript
describe('reconstructPhraseGroupsFromTasks', () => {
  // TC-1: Correct grouping by (goalId, startMeasure, endMeasure)
  it('groups tasks by phrase region into GoalPhraseGroups', () => { ... });

  // TC-2: totalDuration sums estimatedDurationSecs
  it('sums estimated durations per group', () => { ... });

  // TC-3: Groups sorted by startMeasure ascending
  it('sorts groups by startMeasure', () => { ... });

  // TC-4: Excludes warmup-scale tasks
  it('excludes warmup tasks from reconstruction', () => { ... });

  // TC-5: Excludes tasks with status !== 'todo'
  it('excludes completed or in-progress tasks', () => { ... });
});
```

### Step 6 — Implement `reconstructPhraseGroupsFromTasks()` in `goalEngine.ts`

```typescript
export function reconstructPhraseGroupsFromTasks(
  tasks: readonly SessionTask[],
): GoalPhraseGroup[] {
  const pending = tasks.filter(
    t => t.status === 'todo' &&
         t.regionType === 'measures' &&
         t.goalId !== undefined &&
         t.scoreRef.type !== 'warmup-scale',
  );

  // Group by (goalId, startMeasure, endMeasure)
  const groupMap = new Map<string, { tasks: SessionTask[]; totalDuration: number }>();
  for (const task of pending) {
    const key = `${task.goalId}|${task.startMeasure}|${task.endMeasure}`;
    const existing = groupMap.get(key) ?? { tasks: [], totalDuration: 0 };
    existing.tasks.push(task);
    existing.totalDuration += task.estimatedDurationSecs ?? 0;
    groupMap.set(key, existing);
  }

  // Sort by startMeasure ascending and assign phraseIndex
  const sorted = [...groupMap.entries()].sort((a, b) => {
    const aMeasure = a[1].tasks[0]?.startMeasure ?? 0;
    const bMeasure = b[1].tasks[0]?.startMeasure ?? 0;
    return aMeasure - bMeasure;
  });

  return sorted.map(([key, group], i) => {
    const goalId = key.split('|')[0];
    return {
      phraseIndex: i,
      goalId,
      tasks: group.tasks,
      totalDuration: group.totalDuration,
    };
  });
}
```

### Step 7 — Update `GoalsView.tsx` multi-goal orchestration

In `handleGoalSubmit` (the `learn-score-phrase` creation handler), after `createGoal()`:

```typescript
// Detect other active learn-score-phrase goals
const allGoalEntries = listGoalsIndex();
const otherActiveGoalIds = allGoalEntries
  .filter(e => e.status === 'active' && e.id !== result.goal.id)
  .map(e => e.id);

if (otherActiveGoalIds.length > 0) {
  // Multi-goal path: cancel scheduled sessions of other goals, redistribute all
  await redistributeWithMultiGoalCap(result, otherActiveGoalIds, availableTime);
} else {
  // Single-goal path: existing distributeTasks() flow (unchanged)
  const distributedSessions = distributeTasks(result.phraseGroups, availableTime);
  // ... (existing session creation code)
}
```

The `redistributeWithMultiGoalCap` helper:
1. Loads each other active goal from IndexedDB.
2. Loads their sessions; filters to `scheduled` ones.
3. Extracts all tasks from scheduled sessions.
4. Calls `reconstructPhraseGroupsFromTasks(tasks)` to get `GoalPhraseGroup[]`.
5. Cancels the scheduled sessions (delete IndexedDB + remove index).
6. Annotates new goal's phrase groups with `goalId`.
7. Concatenates all `GoalPhraseGroup[]`.
8. Calls `distributeMultiGoalTasks(allGroups, availableTime)`.
9. Creates new sessions, setting `goalIds` from each `DistributedSession.goalIds`.
10. Updates each affected goal's `sessionIds`.

---

## Running Tests

```bash
cd plugins-external/sessions-plugin
npx vitest run --reporter=verbose
```

Or to run only the new tests:

```bash
npx vitest run sessionDistribution goalEngine --reporter=verbose
```

---

## Verification Scenario

**Setup**: Create Goal A (Arabesque, ~10 sessions of tasks) with a 3600 s session budget.  
**Then**: Create Goal B (Für Elise) in the GoalsView.  
**Expected**:
1. Previously scheduled sessions for Goal A are cancelled.
2. New sessions contain tasks from both Goal A and Goal B.
3. For each new session: `goalA_tasks_duration / session_total ≤ 0.4` and `goalB_tasks_duration / session_total ≤ 0.4`.
4. All tasks from both goals appear across the new sessions (no tasks dropped).
5. Session names and calendar dates are assigned correctly.

**Single-goal regression**: With only Goal A active, creating no second goal leaves the single-goal path unchanged (all sessions use up to 100% of available time).

---

## Key Constants

| Constant | Value | Location |
|----------|-------|----------|
| `GOAL_CAP_FRACTION` | `0.4` | `sessionDistribution.ts` |
| `totalSessionTime` | `3600` (seconds) | `GoalsView.tsx` |
| `MAX_SESSIONS` | `50` | `sessionTypes.ts` |
