# Internal API Contract: Replay Scheduling

**Feature**: 038-practice-replay
**Scope**: Internal Plugin API usage contract — no new Plugin API surface
**Date**: 2026-03-05

## Context

This feature adds no new Plugin API methods. All replay behaviour is implemented internally within the Practice View Plugin using the existing Plugin API v2. This document records the precise contract for how the existing API is used during replay, forming the basis for contract tests.

---

## Contract 1: Replay Note Scheduling

**Trigger**: User presses the Replay button on the results screen.

**Pre-conditions**:
- `performanceRecord` is non-null.
- `performanceRecord.noteResults.length > 0`.
- `isReplaying === false`.

**Actions** (all synchronous, initiated at the same wall-clock moment `t₀`):

```
For each result at index i in performanceRecord.noteResults:
  context.playNote({
    midiNote:   result.playedMidi,
    timestamp:  Date.now(),
    type:       'attack',
    offsetMs:   i × (60_000 / performanceRecord.bpmAtCompletion),
    durationMs: (60_000 / performanceRecord.bpmAtCompletion) × 0.85
  })
```

**Constraints**:
- `midiNote` MUST be `result.playedMidi` (the actual pitch played by the user), NOT the expected `notes[i].midiPitches[0]`.
- `offsetMs` MUST be computed from `bpmAtCompletion`; live `playerState.bpm` is NOT used.
- All `playNote` calls are made at the same instant (`Date.now()` is read once or effectively the same); the `offsetMs` field does all scheduling.

**Post-conditions**:
- `isReplaying === true`.
- Replay button replaced by Stop button in results overlay.
- Per-note highlight timers are running.

---

## Contract 2: Replay Highlight Timers

**Trigger**: Each `setTimeout` fires at `offsetMs_i = i × msPerBeat`.

**Action**:
```
setReplayHighlightedNoteIds(new Set(performanceRecord.notes[result.noteIndex].noteIds))
```

**Constraint**: `noteIds` MUST come from `notes[result.noteIndex]` (expected note position), NOT from any derived coordinate or position. Principle VI compliance.

---

## Contract 3: Replay Completion (Natural End)

**Trigger**: Finish timer fires at `totalReplayDurationMs = (n-1) × msPerBeat + msPerNote + 300`.

**Actions** (in order):
1. `context.stopPlayback()` — cancel any still-pending audio events.
2. `clearTimeout` all per-note highlight timer handles.
3. `setReplayHighlightedNoteIds(new Set())` — clear staff highlights.
4. `setIsReplaying(false)` — restore Replay button.

**Post-conditions**:
- `isReplaying === false`.
- Results screen fully restored (all existing controls visible).
- No lingering audio.

---

## Contract 4: Stop Button Press

**Trigger**: User presses Stop button during replay (`isReplaying === true`).

**Actions** (in order, same as Contract 3):
1. `context.stopPlayback()`.
2. `clearTimeout` all per-note highlight timer handles.
3. `clearTimeout` finish timer handle.
4. `setReplayHighlightedNoteIds(new Set())`.
5. `setIsReplaying(false)`.

**Constraint**: Must cancel ALL pending timers — highlight timers, finish timer. Failure to cancel would result in orphaned state updates after replay has ended.

---

## Contract 5: Navigation / Unmount Cleanup

**Trigger**: Plugin unmounts while `isReplaying === true` (user navigates away).

**Actions**: Same as Contract 4. The existing teardown `useEffect` (SC-006) calls `context.stopPlayback()` on unmount; replay must additionally clear all its own `setTimeout` handles in a replay-specific cleanup path.

**Constraint**: All setTimeout handles must be stored in a ref (e.g. `replayTimersRef`) and cleared in the unmount effect.

---

## Summary: Existing API Surface Used

| API | Usage in Replay |
|---|---|
| `context.playNote({ midiNote, timestamp, type, offsetMs, durationMs })` | Schedule N replay notes at staggered offsets |
| `context.stopPlayback()` | Cancel pending scheduled notes on Stop, completion, or unmount |
| `context.components.ScoreRenderer` `highlightedNoteIds` prop | Receive updated Set of noteIds per replay position |

No new Plugin API methods, no new host-side changes.
