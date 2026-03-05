# Research: Practice Replay (038)

**Phase**: Phase 0
**Branch**: `038-practice-replay`
**Date**: 2026-03-05

## R-001: Scheduled Note Playback via `context.playNote` + `offsetMs`

**Decision**: Use `context.playNote({ midiNote, timestamp: Date.now(), type: 'attack', offsetMs, durationMs })` with staggered `offsetMs` values to schedule replay notes.

**Evidence**: `frontend/plugins/train-view/TrainPlugin.tsx` lines 715–723 uses exactly this pattern to schedule exercise guide notes in sequence:

```ts
context.playNote({
  midiNote: note.midiPitch,
  timestamp: Date.now(),
  type: 'attack',
  offsetMs: note.expectedOnsetMs,   // slotIndex × (60_000 / bpm)
  durationMs: msPerBeat * 0.85,
});
```

**Replay offset formula**: `offsetMs = noteIndex × (60_000 / bpmAtCompletion)` — identical to the practice exercise onset timing defined in spec 034 and used by the Train plugin. Each captured note occupies one quarter-note slot regardless of original pitch or duration.

**Rationale**: Reusing the existing scheduling path requires zero new Plugin API surface, is already tested in the Train plugin suite, and is the only permitted audio path inside plugins (Principle VI — no direct ToneAdapter use).

**Alternatives considered**: A new dedicated `context.replayPerformance(notes[])` host-side call was considered (Q3 in clarifications) but rejected as unnecessary — the existing scheduling API is sufficient.

---

## R-002: Cancellation via `context.stopPlayback()`

**Decision**: Call `context.stopPlayback()` on Stop press, on navigation away, and on unmount to cancel all pending scheduled notes.

**Evidence**: `frontend/src/plugin-api/types.ts` line 708:
```ts
stopPlayback(): void;
// Cancels all pending scheduled playNote calls for the calling plugin and calls ToneAdapter.stopAll().
```
Train plugin calls `context.stopPlayback()` in its finish timer, on stop, and in its unmount cleanup.

**Note duration for replay**: Each note plays for `durationMs = msPerBeat × 0.85` (85 % of the beat duration), matching the Train plugin pattern. At 120 BPM this equals ~425 ms. At 60 BPM ~850 ms. This ensures clean note separation without audible clipping.

**Rationale**: Calling `stopPlayback()` cancels all pending `setTimeout`-based note events immediately, satisfying SC-004 (stop within one audio processing frame).

---

## R-003: Staff Highlighting During Replay

**Decision**: Drive `highlightedNoteIds` passed to `ScoreRenderer` with the `noteIds` of the currently active replay slot, updated via `setTimeout` timers (one per note, matching `offsetMs`).

**Evidence**: `practiceState.notes[i].noteIds` (from `PluginPracticeNoteEntry`) contains the opaque note ID strings. These are passed as `highlightedNoteIds` to `ScoreRenderer`, which already handles highlight rendering. The existing results overlay renders on top of the `ScoreRenderer` div. During replay the backdrop of the overlay must allow the staff highlights to be visible (semi-transparent or removed).

**Approach**:
1. One `setTimeout` per note at `offsetMs` → updates a `replayHighlightedNoteIdsRef` and triggers a state update.
2. At completion timer → clears highlights by setting to empty Set.

**Spec alignment**: Q2 clarification — expected notes remain on the staff; cursor (highlight) advances through expected note positions; wrong-pitch audio plays but staff shows the expected note.

This means: even when a `noteResult.playedMidi` differs from the expected pitch, the highlight still targets `practiceState.notes[noteIndex].noteIds` (expected note position). Only the audio emits the wrong pitch.

**Rationale**: No layout computation required — just passing opaque `noteIds` strings, fully compliant with Principle VI.

---

## R-004: BPM Capture at Exercise Completion

**Decision**: Snapshot `playerState.bpm × tempoMultiplier` into a `bpmAtCompletion` ref in the `useEffect` that watches `practiceState.mode === 'complete'`. This ref is then included in the `PerformanceRecord`.

**Evidence**: `PracticeViewPlugin.tsx` already has:
```ts
useEffect(() => {
  if (practiceState.mode === 'complete') {
    setResultsOverlayVisible(true);
  }
}, [practiceState.mode]);
```
We extend this same effect (or a companion effect) to also capture BPM and build the `PerformanceRecord`. The currently effective BPM is `playerState.bpm * tempoMultiplier` (see line 288 in PracticeViewPlugin.tsx: `const effectiveBpm = playerState.bpm * tempoMultiplier`).

**Spec alignment**: Q5 — BPM frozen at exercise completion; sidebar slider changes after completion do not affect replay tempo.

**Rationale**: A `useEffect` on `mode === 'complete'` fires synchronously after the render that sets `mode: 'complete'` in the reducer, so the `playerState.bpm` and `tempoMultiplier` values are guaranteed to reflect the exercise-end state before any user interaction on the results screen.

---

## R-005: Replay Completion Detection

**Decision**: One `setTimeout` at `totalReplayDurationMs = (n - 1) × msPerBeat + msPerNote + 300` — mirrors the Train plugin's `finishMs` calculation exactly.

**Formula**:
```
msPerBeat   = 60_000 / bpmAtCompletion
msPerNote   = msPerBeat × 0.85          // note audio tail
totalDuration = (noteCount - 1) × msPerBeat + msPerNote + 300ms buffer
```

On fire: call `context.stopPlayback()`, clear all per-note setTimeout refs, and call `setIsReplaying(false)`.

**Rationale**: Same pattern as Train plugin (lines 731–748 in TrainPlugin.tsx); well-tested; requires no additional state or promise chains.

---

## R-006: Replay Button Visibility and Missed Notes

**Decision**: Display Replay button when `practiceReport !== null` AND `practiceReport.results.length > 0`. Hide (do not render) when `results.length === 0`.

**Evidence**: `practiceReport` in `PracticeViewPlugin.tsx` is already computed as `null` when `results.length === 0`. So the Replay button check is straightforwardly:
```tsx
{practiceReport && practiceReport.results.length > 0 && !isReplaying && (
  <button onClick={handleReplay}>Replay</button>
)}
```

**Missed notes**: All `PracticeNoteResult` entries have `playedMidi > 0` because CORRECT_MIDI fires only when the user plays the correct pitch — every entry in `noteResults` represents a successfully-played (correct or late) note. There are no "missed" entries in the current engine. The spec's missed-note edge case (FR-006) is handled trivially: since all results have `playedMidi > 0`, no slot is silently skipped.

**Rationale**: The practice engine only records results for notes the user advanced through (CORRECT_MIDI). Every session that reaches 'complete' has all notes resolved. The Replay button guard `results.length > 0` covers the spec's FR-009.

---

## R-007: No New Plugin API Required

**Decision**: Zero Plugin API surface changes. All replay behaviour is implemented within the Practice View plugin using existing `context.playNote`, `context.stopPlayback`, and `context.components.ScoreRenderer`.

**Rationale**: The three clarified decisions (Q3 — reuse playNote/stopPlayback, Q1 — results stay visible, Q2 — expected notes on staff) all reduce to operations already available in the existing v2 Plugin API. No host-side changes are needed. This keeps the feature self-contained and reduces integration risk.
