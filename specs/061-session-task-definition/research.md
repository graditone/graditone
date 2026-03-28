# Research: Tasks-Based Session Definition

**Feature**: 061-session-task-definition  
**Date**: 2026-03-28

## R1: Navigation Data for Task Config

**Decision**: Pass task configuration via `openPlugin(pluginId, navData)` — the existing `Record<string, unknown>` contract supports arbitrary fields.

**Rationale**: `getNavigationData()` already returns `Record<string, unknown> | null`. The practice view currently only checks for `navData.savedPracticeId`. Adding new fields (`taskId`, `scoreRef`, `staffIndex`, `tempoMultiplier`, `loopRegion`, `loopCount`) is backward-compatible — unrecognized fields are ignored by existing code paths.

**Alternatives considered**:
- Separate event bus for task launch → over-engineering; the nav data mechanism exists for exactly this purpose.
- Store task config in localStorage → race conditions, cleanup burden.

**Key finding**: The main challenge is programmatically setting `loopRegion`. `usePracticeLoop` currently only exposes `setLoopCount`, not a way to set pin positions directly. The hook needs to accept initial pin/tick values via parameters or a new setter.

## R2: Measure-to-Tick Conversion

**Decision**: Create a small utility function to convert 1-based measure numbers to `{ startTick, endTick }` using `measure_end_ticks` from the score.

**Rationale**: No existing utility exists in the frontend. The `measure_end_ticks: number[]` array is available on the `Score` TypeScript type and populated by the Rust/WASM backend. Conversion is straightforward:
- `startTick = measureIndex === 0 ? 0 : measure_end_ticks[measureIndex - 1]`
- `endTick = measure_end_ticks[measureIndex]`

The conversion happens at practice launch time (after the score loads), not at task creation time. Tasks store user-facing 1-based measure numbers, keeping the task definition score-load-independent.

**Alternatives considered**:
- Expose `context.scorePlayer.getMeasureTickRange()` via plugin API → heavier change for a function only needed in one place.
- Convert at task creation time → requires loading the score during session creation, which is unnecessary and complicates the flow.

## R3: Score Picker Reuse

**Decision**: Reuse `context.components.ScoreSelector` (host-provided component) in the task builder.

**Rationale**: The `ScoreSelector` is already injected into all plugins via `PluginContext.components.ScoreSelector`. It fires `onSelectScore(catalogueId)` for preloaded scores and `onSelectUserScore(id)` for user scores — exactly the two ID types needed for `ScoreRef { type, id }`. The `savedPractices` / `onDeleteSavedPractice` props can be omitted since the task builder only needs score selection.

**Alternatives considered**:
- Build a custom score picker → duplicates existing functionality; violates DRY.
- Import ScoreSelector source directly → bypasses the plugin API contract boundary.

## R4: Task Config → Practice View Mapping

**Decision**: Map task fields to practice view state as follows:

| Task Field | Stored As | Practice View State | Conversion |
|---|---|---|---|
| Score | `ScoreRef { type, id }` | `loadScore()` call | `type === 'preloaded'` → `{ kind: 'catalogue', catalogueId }`, else `{ kind: 'userScore', scoreId }` |
| Hand | `staffIndex: number` | `setSelectedStaffIndex(n)` | Direct: 0=RH, 1=LH, -1=BH |
| Tempo | `tempoMultiplier: number` | `setTempoMultiplier(m)` + `scorePlayer.setTempoMultiplier(m)` | Direct ratio (0.5–2.0) |
| Region | `startMeasure, endMeasure` (1-based) | `loopRegion: { startTick, endTick }` | Via `measure_end_ticks` after score load |
| Iterations | `loopCount: number` | `setLoopCount(n)` | Direct |

**Key finding on tempo**: `tempoMultiplier` is a ratio, not BPM. `effectiveBpm = originalTempo * tempoMultiplier`. Tasks should store `tempoMultiplier` directly to avoid needing the score's base BPM at creation time. The task builder UI can display a percentage (e.g., "100%", "75%", "50%") rather than absolute BPM, since BPM depends on the score.

## R5: PracticeSavedEvent Extension

**Decision**: Add `readonly taskId?: string` to `PracticeSavedEvent`. The practice view reads `taskId` from navData, stores it in a ref, and includes it when broadcasting.

**Rationale**: This is the minimal, backward-compatible change. Existing consumers ignore unknown fields. The sessions plugin handler already processes `PracticeSavedEvent` via `addActivityToActiveSession()` — it simply gains a new check for `event.taskId` to update the originating task's status.

**Alternatives considered**:
- Separate bus for task completion → over-engineering; task status depends on practice save timing.
- Track taskId in sessionStorage → race conditions, not type-safe, cleanup needed.
- Return taskId via a callback on the plugin context → requires plugin API v9 changes for a single optional field.

## Open Design Decisions Resolved

### Tempo Storage: BPM vs Multiplier

**Decision**: Store `tempoMultiplier` (ratio 0.5–2.0) in the task, not absolute BPM.

**Rationale**: The score's base tempo is only known after loading. Storing a ratio is self-contained and directly consumable by the practice view. The UI presents this as a percentage slider (50%–200%) consistent with the existing practice view tempo control.

**Impact on spec**: The spec says "Tempo (BPM)" but the implementation stores `tempoMultiplier`. The task builder UI converts between the two: if the user selects a score, the UI can show the resulting BPM as `baseBPM × multiplier`. If no score is selected yet, the UI shows only the percentage.

### Loop Region Setup

**Decision**: Extend `usePracticeLoop` to accept initial tick values via parameters, applied on mount.

**Rationale**: The current hook only sets loop pins via long-press gestures. Task-based practice needs programmatic initialization. Adding optional `initialStartTick` / `initialEndTick` params to the hook is the cleanest approach — it avoids synthetic event simulation and keeps the hook's API cohesive.
