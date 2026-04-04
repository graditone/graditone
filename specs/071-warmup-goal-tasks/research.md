# Research: Warm-Up Goal Tasks for Sessions (Feature 071)

## RQ1 — How does the sessions plugin launch the Train view for an existing task?

**Decision**: Call `context.openPlugin('train-view', navigationData)` from `TaskRow.tsx`. The train-view plugin reads the payload via `context.getNavigationData()`.

**Rationale**: The plugin API exposes `openPlugin(pluginId, data?)` on the `PluginContext` interface (`frontend/src/plugin-api/types.ts` line 973). The receiving plugin reads it with `getNavigationData()` (line 978). This is the same mechanism used by the sessions plugin to open the practice view for score-based tasks (`context.openPlugin('practice-view-plugin', { taskConfig: {...} })`). For the train view, the `pluginId` is `"train-view"` (confirmed from `frontend/plugins/train-view/plugin.json`).

**Alternatives considered**: Storing state in shared context vs. navigation data — rejected because the plugin API is already designed for one-shot launch payloads; shared state would couple plugins.

**Navigation data contract** (new, defined this feature):
```typescript
// Passed to train-view via openPlugin('train-view', {...})
{
  warmUpTaskConfig: {
    taskId: string;
    sessionId: string;
    sessionName: string;
    scaleId: string;           // e.g. 'c-major'
    tempoMultiplier: number;   // e.g. 1.0
    loopCount: number;
    minResult: number;
  }
}
```
The train-view plugin reads this on mount and pre-selects the scale and sets the tempo slider accordingly.

---

## RQ2 — How is "free time" determined for an existing session?

**Decision**: Free time in a session = `session.availableTime - sum(task.estimatedDurationSecs for all tasks)`. A session has free time if this value ≥ 300 seconds (5 minutes).

**Rationale**: `Session.availableTime` stores the total budget in seconds (`sessionTypes.ts`). `SessionTask.estimatedDurationSecs` stores the estimated cost of each task. The warm-up task has a fixed cost of 300 s (5 min, per FR-009). The injection function checks `remainingTime >= 300` before inserting.

**Edge case**: Sessions without `availableTime` set (0 or undefined) are treated as having unlimited time — the warm-up task is inserted unconditionally (capped only by the session-count limit).

---

## RQ3 — Does `checkGoalCompletionAcrossSessions` work for warm-up goals without changes?

**Decision**: Yes, no changes needed to the completion-check logic.

**Rationale**: `checkGoalCompletionAcrossSessions(goalId, sessionIds, sessions)` in `goalEngine.ts` finds all tasks whose `goalId` matches across the provided sessions, collects their statuses, and calls `checkGoalCompletion(statuses)` which returns `'completed'` if all are `'done'`. Since warm-up tasks will have the same `goalId` field on `SessionTask`, the generic function will work correctly.

---

## RQ4 — How is `ScoreRef` extended for warm-up tasks, and does it break existing code?

**Decision**: Add `'warmup-scale'` as a third member of the `ScoreRef.type` union.

**Rationale**: `taskScoreUnavailable` in `TaskRow.tsx` already gates on `task.scoreRef.type === 'preloaded'`. A `'warmup-scale'` value will fall through the existing `&&` condition and evaluate to `false` (always available) — correct behaviour with zero additional logic. The `GoalsView` score-duplicate check uses `hasGoalForScoreAsync(scoreRef)` which compares `type + id` — warm-up goals never pass a score ref to this function, so no conflict.

**Alternatives considered**: A separate `WarmUpScaleTask` type union — rejected because the existing completion engine, status engine (`computeTaskStatus`), and storage layer all operate generically on `SessionTask`. Keeping a single `SessionTask` type avoids wide-spread type narrowing.

---

## RQ5 — What fields must `Goal` carry for warm-up goals, and do existing fields conflict?

**Decision**: Extend the existing `Goal` interface with three optional fields:
- `warmUpScaleId?: string` — the selected scale identifier
- `warmUpSessionCount?: number` — the user-configured target session count (stored for display; actual injection may be fewer)
- Existing `scoreRef`, `scoreTitle`, `startMeasure`, `endMeasure` are left as-is but semantically unused for `type: 'warm-up-scales'`

**Rationale**: The existing `Goal` already has `scoreRef` as a required field holding a `ScoreRef`. For warm-up goals, we reuse `scoreRef` with `type: 'warmup-scale'` and `id: scaleId` — this avoids adding a redundant field and keeps the persistence shape minimal. `scoreTitle` stores the scale display name (e.g. "C Major Warm-Up"). `startMeasure` and `endMeasure` are set to 0 (unused sentinel). This mirrors how the existing type discriminates via `goal.type`.

**Alternatives considered**: Separate `WarmUpGoal` type union — rejected because it would require refactoring all goal list rendering, storage, and completion-tracking code.

---

## RQ6 — How does the GoalsView form selection work?

**Decision**: Add a `goalType` selector at the top of the creation flow in `GoalsView`. When `'warm-up-scales'` is selected, render a new `WarmUpGoalCreationForm` component. The existing `GoalCreationForm` component is unchanged and used for `'learn-score-phrase'`.

**Rationale**: The current flow calls `handleCreateGoal()` and immediately shows `GoalCreationForm`. Adding a type selector before the form matches the existing UX pattern (the form already displays "Type of goal: Play Score" as a read-only label). Making the type a real selector enables future goal types without touching the inner forms.
