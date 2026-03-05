# Data Model: Practice Replay (038)

**Phase**: Phase 1
**Branch**: `038-practice-replay`
**Date**: 2026-03-05
**Spec**: [spec.md](spec.md)

## Overview

This feature adds no backend entities and requires no database or storage changes. All state is transient — scoped to the lifetime of the practice results screen. Two new domain concepts are introduced as in-memory data structures inside the Practice View Plugin.

---

## Entity: PerformanceRecord

**What it represents**: A frozen snapshot of a completed practice exercise, captured at the moment the engine transitions to `'complete'` mode. Holds everything needed to replay the performance: the ordered note entries (for staff highlighting), the per-note results (for audio pitches), and the BPM at which the exercise was completed (for timing).

**Lifecycle**: Created once when `practiceState.mode → 'complete'`. Immutable for the duration of the results screen. Discarded when the user presses Try Again, New Exercise, or navigates away.

**Fields**:

| Field | Type | Description |
|---|---|---|
| `notes` | `PracticeNoteEntry[]` | Ordered note entries from the completed exercise. Each entry carries `tick`, `midiPitches[]`, and `noteIds[]`. Used during replay to resolve highlight targets (`noteIds`) in the correct playback order. |
| `noteResults` | `PracticeNoteResult[]` | Per-note capture results from the engine. Each entry carries `playedMidi` (the pitch that advanced the session), `outcome`, `noteIndex`, and timing data. Used during replay to emit the correct audio pitch via `context.playNote`. |
| `bpmAtCompletion` | `number` | Effective BPM (`playerState.bpm × tempoMultiplier`) frozen at exercise completion. Used to compute `msPerBeat` and all replay `offsetMs` values. Immutable post-capture. |

**Derivable values** (computed from `PerformanceRecord` at replay time, not stored):

| Value | Formula | Description |
|---|---|---|
| `msPerBeat` | `60_000 / bpmAtCompletion` | Duration of one quarter-note slot in ms |
| `msPerNote` | `msPerBeat × 0.85` | Note audio duration (85 % of beat, matches Train plugin) |
| `offsetMs_i` | `i × msPerBeat` | Playback start offset for note at sequential index `i` |
| `totalReplayDurationMs` | `(n-1) × msPerBeat + msPerNote + 300` | Total replay window including a 300 ms trailing buffer for the last note to decay |

**Relationship to existing types**: `notes` re-uses `PluginPracticeNoteEntry` (already imported from plugin-api); `noteResults` re-uses `PracticeNoteResult` (from `practiceEngine.types.ts`). No new imported types are needed.

---

## Entity: ReplayStatus

**What it represents**: The transient playback state of the replay feature within the results screen. Simple two-value enumeration.

**Values**:

| Value | Meaning |
|---|---|
| `'idle'` | Not currently replaying. Results screen shows the Replay button. |
| `'playing'` | Replay is active. The Replay button is replaced by the Stop button in-place. Staff highlights advance through expected note positions. |

**Lifecycle**: Starts as `'idle'` when the results screen appears. Transitions to `'playing'` when Replay is pressed. Returns to `'idle'` automatically when playback completes, or immediately when Stop is pressed.

**Important**: `ReplayStatus` is reset to `'idle'` on every `PerformanceRecord` update (i.e., after each Try Again cycle). A new `PerformanceRecord` always begins with `'idle'` replay status.

---

## State Transitions

```
Results screen appears
        │
        ▼
[ReplayStatus: idle] ◄─────────────────────────────────────────────┐
        │                                                           │
user presses Replay                                         playback ends (timer)
        │                                               OR  user presses Stop
        ▼                                                           │
[ReplayStatus: playing] ──────────────────────────────────────────►┘
```

---

## Replay Scheduling Contract (Internal)

When `ReplayStatus` transitions to `'playing'`, the component schedules:

1. **N per-note highlight timers**: `setTimeout(() => setReplayHighlightedNoteIds(noteIds_i), offsetMs_i)` — one per note in `noteResults`.
2. **N per-note audio events**: `context.playNote({ midiNote: noteResults[i].playedMidi, timestamp: Date.now(), type: 'attack', offsetMs: offsetMs_i, durationMs: msPerNote })` — all scheduled at the same wall-clock moment (offsetMs does the staggering).
3. **1 finish timer**: `setTimeout(handleReplayEnd, totalReplayDurationMs)` — triggers the `'playing' → 'idle'` transition.

When `ReplayStatus` transitions back to `'idle'`:
1. `context.stopPlayback()` — cancels all pending audio events.
2. All `setTimeout` handles (highlight timers + finish timer) are cleared via `clearTimeout`.
3. `replayHighlightedNoteIds` is reset to an empty Set.

---

## Impact on Existing Entities

| Entity | Impact |
|---|---|
| `PracticeState` (practiceEngine.ts) | **No change.** `noteResults` is read but not modified by replay. |
| `PracticeNoteResult` (practiceEngine.types.ts) | **No change.** `playedMidi` field is consumed by replay; no new fields added. |
| `PluginNoteEvent` / Plugin API | **No change.** Replay uses the existing `playNote` + `stopPlayback` API surface unchanged. |
| `ScoreRenderer` | **No change.** Receives updated `highlightedNoteIds`; no new props needed. |
