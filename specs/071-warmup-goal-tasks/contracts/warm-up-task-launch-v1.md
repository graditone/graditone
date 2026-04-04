# Contract: Warm-Up Task Launch (TaskRow → train-view, v1)

**Direction**: sessions-plugin → train-view  
**Mechanism**: `context.openPlugin('train-view', payload)` (Plugin API v8, `openPlugin`)  
**Version**: v1 (Feature 071)

---

## Overview

When a user taps **Practice** on a warm-up scale task in `TaskRow`, the sessions plugin calls `context.openPlugin('train-view', { warmUpTaskConfig: WarmUpTaskConfig })`. The train-view plugin reads the payload via `context.getNavigationData()` on mount and pre-configures its exercise state.

---

## Payload Type

```typescript
/**
 * Navigation payload passed from sessions-plugin to train-view
 * when launching a warm-up scale task.
 *
 * Accessed in train-view via: context.getNavigationData<{ warmUpTaskConfig: WarmUpTaskConfig }>()
 */
export interface WarmUpTaskConfig {
  /** Unique task ID (used to mark the task done when the session ends). */
  taskId: string;
  /** ID of the session this task belongs to. */
  sessionId: string;
  /** Human-readable session name (e.g. "Monday, Jun 9"). */
  sessionName: string;
  /**
   * Scale identifier. Must match a key in SCALE_OPTIONS from exerciseGenerator.ts.
   * Examples: 'c-major', 'g-major', 'a-minor'.
   */
  scaleId: string;
  /**
   * Tempo multiplier relative to the score's BPM.
   * Range: 0.5–2.0 (50%–200%). Default: 1.0.
   */
  tempoMultiplier: number;
  /**
   * Number of times the scale must be played to satisfy one loop.
   * Default: 10.
   */
  loopCount: number;
  /**
   * Minimum accuracy score (0–100) required to pass.
   * Default: 90.
   */
  minResult: number;
}
```

---

## Caller Contract (sessions-plugin / TaskRow.tsx)

**Preconditions**:
- `task.scoreRef.type === 'warmup-scale'`
- `task.scoreRef.id` is a valid key in `SCALE_OPTIONS`
- All numeric fields are within their documented ranges

**Call site**:
```typescript
context.openPlugin('train-view', {
  warmUpTaskConfig: {
    taskId: task.id,
    sessionId: activeSession.id,
    sessionName: activeSession.name,
    scaleId: task.scoreRef.id,
    tempoMultiplier: task.tempoMultiplier,
    loopCount: task.loopCount,
    minResult: task.minResult,
  } satisfies WarmUpTaskConfig,
});
```

---

## Receiver Contract (train-view plugin)

**On mount** (`useEffect`), train-view checks for navigation data:
```typescript
const navData = context.getNavigationData<{ warmUpTaskConfig?: WarmUpTaskConfig }>();
if (navData?.warmUpTaskConfig) {
  const { scaleId, tempoMultiplier, loopCount, minResult } = navData.warmUpTaskConfig;
  // 1. Pre-select scale from SCALE_OPTIONS matching scaleId
  // 2. Set tempo slider to tempoMultiplier
  // 3. Set loopCount
  // 4. Set minResult
  // 5. Store taskId + sessionId in component state for use when exercise ends
}
```

**On exercise completion**:
- Train-view MUST call back into sessions-plugin to mark the warm-up task as done.
- Mechanism: `context.openPlugin('sessions-plugin', { completedWarmUpTask: { taskId, sessionId, result } })`
- This is an internal back-channel; sessions-plugin handles it in `GoalsView` or a new `useEffect` hook.

> **Note**: If `getNavigationData()` returns null or no `warmUpTaskConfig`, train-view operates in its standard free-practice mode. No fallback error handling is needed.

---

## Completion Callback Contract (train-view → sessions-plugin, v1)

**Direction**: train-view → sessions-plugin  
**Mechanism**: `context.openPlugin('sessions-plugin', payload)`

```typescript
export interface WarmUpTaskCompletionPayload {
  completedWarmUpTask: {
    taskId: string;
    sessionId: string;
    /** Accuracy result 0–100. */
    result: number;
    /** Unix timestamp (ms) of when the exercise completed. */
    completedAt: number;
  };
}
```

Sessions-plugin reads this on mount via `context.getNavigationData()` and updates task status + linked practices.

---

## Routing Summary

| Step | Caller | Callee | Mechanism | Payload Key |
|------|--------|--------|-----------|-------------|
| Launch | sessions-plugin TaskRow | train-view | `openPlugin('train-view', ...)` | `warmUpTaskConfig` |
| Complete | train-view | sessions-plugin | `openPlugin('sessions-plugin', ...)` | `completedWarmUpTask` |

---

## Backward Compatibility

- train-view's existing `getNavigationData()` usage (if any) must check for `warmUpTaskConfig` presence before applying warm-up mode.
- sessions-plugin's existing navigation data handling must check for `completedWarmUpTask` presence before acting on it.
- Both additions are opt-in: absent payload keys = standard behavior.
