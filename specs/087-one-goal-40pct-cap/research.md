# Research: One-Goal 40% Session Time Cap

**Feature**: `087-one-goal-40pct-cap`  
**Phase**: 0 — Research & Unknowns Resolution  
**Date**: 2026-04-28

---

## Research Questions

The following unknowns were identified from the Technical Context during plan.md authoring.

---

### Q1: What is the correct interpretation of "session time" in the 40% cap?

**Decision**: Per-goal budget = `availableTime × 0.4`

**Rationale**: The spec Assumptions section states _"'Session time' refers to the session's configured available time (or total estimated task duration if no available time is set)"_. Using `availableTime` (the session's configured budget — currently hardcoded to 3600 s) as the denominator avoids a circular dependency: if the cap were relative to the session's actual total task time, the cap amount would depend on what's included, which depends on the cap. Using `availableTime` is clean, deterministic, and O(1) to compute.

Edge case: If `availableTime` is 0 or undefined (unlimited mode), the cap does not apply (FR-003).

**Alternatives considered**:
- *Cap relative to actual session task total*: circular, requires iterative solver, rejected.
- *Fixed absolute cap (e.g., 24 minutes)*: not specified in the spec; doesn't adapt to session length, rejected.

---

### Q2: How do we get phrase groups for existing active goals when creating a new goal?

**Decision**: Reconstruct `GoalPhraseGroup[]` from pending tasks in `scheduled` sessions by grouping tasks on `(goalId, startMeasure, endMeasure)`.

**Rationale**: Goals store `taskIds[]` and `sessionIds[]` but not raw `PhraseGroup` metadata. Re-loading scores for each existing goal would require async score loads and WASM calls — too complex and slow. The task objects already carry all needed fields: `goalId`, `startMeasure`, `endMeasure`, `estimatedDurationSecs`. Grouping by `(startMeasure, endMeasure)` within a goalId reconstructs the phrase triplets (RH/LH/BH groups share the same measure range). Only tasks from `scheduled` (not `active` or `closed`) sessions are reconstructed, since those represent unfulfilled future practice.

**Warmup tasks**: Tasks with `scoreRef.type === 'warmup-scale'` or `regionType === 'all'` are excluded from reconstruction; warmup goals use `insertWarmUpTaskIntoSessions` which is a separate, unaffected flow.

**Alternatives considered**:
- *Store `phraseGroups` in Goal IndexedDB object*: schema change, migration complexity, bloat — rejected.
- *Re-run goalEngine for existing goals*: requires score reload per goal (async WASM), ~1–3 s per goal, terrible UX — rejected.

---

### Q3: What happens to existing scheduled sessions for previously created goals during multi-goal redistribution?

**Decision**: All `scheduled` sessions belonging to active `learn-score-phrase` goals are cancelled (deleted from IndexedDB + index) before the unified redistribution runs. `active` sessions (currently being practiced) and `closed` sessions are untouched.

**Rationale**: Keeping old sessions intact would leave the student with pre-cap sessions containing 100% of one goal's tasks plus new cap-respecting sessions — inconsistent and violating the spirit of FR-001. Cancelling only `scheduled` sessions is safe: the student has not started those yet. Deleting `closed` and `active` sessions would destroy practice history and interrupt in-progress practice.

**Goal.sessionIds update**: After redistribution, each affected goal's `sessionIds` array is replaced with the IDs of the newly created multi-goal sessions that contain at least one of its tasks.

**Alternatives considered**:
- *Do not redistribute existing goals; only apply cap to newly created goal*: leaves prior sessions unbalanced, violates US1 — rejected.
- *Cancel all sessions including active*: destructive to in-progress work — rejected.

---

### Q4: What is the algorithm for `distributeMultiGoalTasks()`?

**Decision**: Greedy round-robin interleave with per-goal budget enforcement.

**Algorithm sketch**:

```
CONSTANTS:
  goalBudget = availableTime × 0.4

INPUT:
  groups: GoalPhraseGroup[]   (sorted within each goal by phraseIndex ascending)
  availableTime: number

INVARIANTS:
  - Single goal or unlimited → delegate to existing distributeTasks()
  - Groups from the same goal are always processed in phraseIndex order

ALGORITHM:
  queues = Map<goalId, GoalPhraseGroup[]>  // per-goal FIFO queues, ordered by phraseIndex

  while any queue is non-empty:
    open new session (tasks=[], sessionTotal=0)
    goalUsed = Map<goalId, 0>
    
    round-robin until no group was added in a full pass:
      for each goalId in queues (stable order):
        group = queues[goalId].peek()
        if group is undefined: skip
        
        used = goalUsed[goalId]
        withinGoalBudget  = (used + group.totalDuration ≤ goalBudget)
                          OR (used === 0)   // FR-005: first group always accepted
        withinSessionBudget = (sessionTotal + group.totalDuration ≤ availableTime)
                            OR (sessionTotal === 0)  // FR-005: first group always accepted
        
        if withinGoalBudget AND withinSessionBudget:
          dequeue group; add tasks to session; update sessionTotal + goalUsed[goalId]
    
    push session (even if tasks is empty → guard: emit only if tasks.length > 0)
```

**Properties**:
- O(n) amortised per session (each group dequeued exactly once)
- Phrase groups within a goal maintain phraseIndex order
- The FR-005 "best-effort" clause is implemented as: a group that is the ONLY remaining group for its goal in a session is always admitted even if it exceeds the goal's budget
- Tasks without `estimatedDurationSecs` contribute 0 to session and goal totals (FR-006 — distributed freely)

**Alternatives considered**:
- *Sorted merge by duration ascending*: optimises bin-packing but violates phraseIndex ordering (phrase 3 before phrase 1 is pedagogically wrong) — rejected.
- *LP-based optimal packing*: overkill for n ≤ 150 groups — rejected.

---

### Q5: How should `GoalPhraseGroup` integrate with existing `PhraseGroup`?

**Decision**: New interface `GoalPhraseGroup` extends `PhraseGroup` with a non-optional `goalId: string`.

```typescript
// sessionDistribution.ts
export interface GoalPhraseGroup extends PhraseGroup {
  goalId: string;
}
```

The existing `distributeTasks()` signature is unchanged. `distributeMultiGoalTasks()` accepts `GoalPhraseGroup[]`, making the goalId presence a compile-time guarantee. The `GoalsView` annotates the new goal's phrase groups with `goalId` before passing them in, and reconstructed phrase groups already have `goalId` from the task's `goalId` field.

---

### Q6: Do multi-goal sessions need a schema change to `Session`?

**Decision**: Yes — add `goalIds?: readonly string[]` to `Session` and `SessionIndexEntry`.

**Rationale**: The existing `goalId?: string` field covers single-goal sessions and warmup-injection sessions. Multi-goal sessions have tasks from 2+ goals; `goalId` alone cannot express this. Adding an optional `goalIds` array provides:
1. Storage of which goals contributed tasks (needed to update each goal's `sessionIds`)
2. Backward compatibility — older sessions without `goalIds` continue to work
3. No migration needed — field is optional and consumers fall back gracefully

Single-goal sessions: only `goalId` is set (existing behaviour, no `goalIds`).
Multi-goal sessions: `goalId` is `undefined`; `goalIds` is set.

**Alternatives considered**:
- *Reuse `goalId` as comma-separated list*: type-unsafe, breaks existing consumers — rejected.
- *No schema change; look up goalIds from tasks at runtime*: works but requires extra task scan on every session read — rejected for simplicity.

---

### Q7: How does the 40% cap interact with tasks that have no `estimatedDurationSecs`?

**Decision**: Tasks with `estimatedDurationSecs === undefined` or `=== 0` contribute **zero** to both the per-goal budget usage and the session total. They are placed in the session along with their phrase group's other tasks, effectively for free.

**Rationale**: FR-006 states these tasks are "distributed freely without consuming any goal's 40% allocation". Since `GoalPhraseGroup.totalDuration` is already computed as the sum of `estimatedDurationSecs` for all tasks in the group (with undefined treated as 0 in `goalEngine.ts`), no special handling is needed at the distribution level — the group's `totalDuration` will be 0 and it will always fit within budget.

---

### Q8: Should `DistributedSession` carry `goalIds`?

**Decision**: Yes — extend `DistributedSession` with `goalIds?: string[]`.

```typescript
export interface DistributedSession {
  tasks: SessionTask[];
  totalEstimatedDurationSecs: number;
  availableTime: number;
  goalIds?: string[];  // Feature 087: populated only for multi-goal sessions
}
```

The `GoalsView` uses `goalIds` from each `DistributedSession` to populate `Session.goalIds` and to update each contributing goal's `sessionIds` array after saving.

---

## Summary Table

| Question | Decision |
|----------|----------|
| Denominator for 40% | `availableTime` (configured session budget) |
| Source of existing-goal phrase groups | Reconstruct from pending tasks in `scheduled` sessions |
| Fate of existing scheduled sessions | Cancelled and replaced by redistribution |
| Algorithm | Greedy round-robin, per-goal budget + best-effort first-group |
| `GoalPhraseGroup` type | `PhraseGroup & { goalId: string }` |
| Session schema change | Add `goalIds?: string[]` to `Session` + `SessionIndexEntry` |
| Zero-duration tasks | Contribute 0 to budget; placed freely |
| `DistributedSession` change | Add `goalIds?: string[]` |
