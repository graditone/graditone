# Quickstart: Practice Replay (038)

**Branch**: `038-practice-replay`
**Date**: 2026-03-05

## Scope

All changes are **frontend-only** — inside `frontend/plugins/practice-view-plugin/`. No backend (Rust/WASM), no new dependencies, no Plugin API changes.

## Files Changed

| File | Change Type | Description |
|---|---|---|
| `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx` | Modified | Add `PerformanceRecord` state, `isReplaying` state, handlers, and Replay/Stop button in results overlay |
| `frontend/plugins/practice-view-plugin/PracticeViewPlugin.test.tsx` | Modified | Add replay-specific test cases |

## Dev Setup

No new dependencies. Existing frontend toolchain applies.

```bash
cd frontend
npm install          # only if not already done
npm run dev          # start Vite dev server
```

## Running Tests

```bash
cd frontend

# Run all practice plugin tests
npx vitest run plugins/practice-view-plugin/PracticeViewPlugin.test.tsx

# Run all plugin tests in watch mode
npx vitest plugins/practice-view-plugin/

# Run all frontend tests
npm test
```

## Key Source Locations

| Path | Purpose |
|---|---|
| `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx` | Main plugin component — results overlay is lines ~840–1086 |
| `frontend/plugins/practice-view-plugin/practiceEngine.types.ts` | `PracticeNoteResult`, `PracticeNoteEntry`, `PracticeState` types |
| `frontend/plugins/practice-view-plugin/practiceEngine.ts` | Pure state machine reducer |
| `frontend/plugins/practice-view-plugin/PracticeViewPlugin.test.tsx` | Existing test suite (RTL + Vitest) |
| `frontend/plugins/train-view/TrainPlugin.tsx` | Reference implementation of `context.playNote` + `offsetMs` scheduling pattern (lines 715–748) |
| `frontend/src/plugin-api/types.ts` | Plugin API type definitions (`PluginContext`, `PluginNoteEvent`, `playNote`, `stopPlayback`) |

## Implementation Pattern Reference

### How to capture PerformanceRecord on exercise completion

```tsx
// In the useEffect that watches practiceState.mode:
useEffect(() => {
  if (practiceState.mode === 'complete') {
    setResultsOverlayVisible(true);
    setPerformanceRecord({
      notes: [...practiceState.notes],
      noteResults: [...practiceState.noteResults],
      bpmAtCompletion: playerState.bpm * tempoMultiplier,
    });
    setIsReplaying(false);  // reset replay state on new completion
  }
}, [practiceState.mode]);
// NOTE: playerState and tempoMultiplier must be included in deps
```

### How to schedule replay (Train plugin pattern)

```tsx
const handleReplay = useCallback(() => {
  if (!performanceRecord || isReplaying) return;
  setIsReplaying(true);

  const msPerBeat = 60_000 / performanceRecord.bpmAtCompletion;
  const msPerNote = msPerBeat * 0.85;

  // Schedule audio
  performanceRecord.noteResults.forEach((result, i) => {
    context.playNote({
      midiNote: result.playedMidi,
      timestamp: Date.now(),
      type: 'attack',
      offsetMs: i * msPerBeat,
      durationMs: msPerNote,
    });
  });

  // Schedule per-note highlights
  const timers: ReturnType<typeof setTimeout>[] = [];
  performanceRecord.noteResults.forEach((result, i) => {
    const noteIds = performanceRecord.notes[result.noteIndex]?.noteIds ?? [];
    const t = setTimeout(() => {
      setReplayHighlightedNoteIds(new Set(noteIds));
    }, i * msPerBeat);
    timers.push(t);
  });

  // Finish timer
  const n = performanceRecord.noteResults.length;
  const totalMs = (n - 1) * msPerBeat + msPerNote + 300;
  const finishTimer = setTimeout(() => {
    context.stopPlayback();
    timers.forEach(clearTimeout);
    setReplayHighlightedNoteIds(new Set());
    setIsReplaying(false);
  }, totalMs);
  timers.push(finishTimer);

  replayTimersRef.current = timers;
}, [context, performanceRecord, isReplaying]);
```

### Stop handler

```tsx
const handleReplayStop = useCallback(() => {
  context.stopPlayback();
  replayTimersRef.current.forEach(clearTimeout);
  replayTimersRef.current = [];
  setReplayHighlightedNoteIds(new Set());
  setIsReplaying(false);
}, [context]);
```

### Replay button in results overlay JSX

```tsx
{/* Replace existing "Press ♩ Practice to try again" hint */}
<div className="practice-results__replay-row">
  {!isReplaying ? (
    <button
      className="practice-results__replay-btn"
      onClick={handleReplay}
      aria-label="Replay your performance"
    >
      ▶ Replay
    </button>
  ) : (
    <button
      className="practice-results__replay-btn practice-results__replay-btn--stop"
      onClick={handleReplayStop}
      aria-label="Stop replay"
    >
      ■ Stop
    </button>
  )}
</div>
```

## Test Cases to Add (`PracticeViewPlugin.test.tsx`)

Following Principle V (Test-First Development), write these tests before implementing:

1. **Replay button visible after exercise completes** — render results overlay → Replay button exists.
2. **Replay button absent when no results** — impossible in practice (complete always has results) but guard: if `noteResults.length === 0`, no Replay button.
3. **Replay button replaced by Stop when pressed** — press Replay → Stop button appears; Replay button gone.
4. **Stop button cancels playback** — press Replay → press Stop → `context.stopPlayback()` called; Replay button restored.
5. **context.playNote called N times with correct offsetMs** — press Replay with N results → verify N `playNote` calls with correctly staggered `offsetMs` values.
6. **playNote uses playedMidi not expectedMidi** — result has `playedMidi = 61`, expected = 60 → verify `playNote` called with `midiNote: 61`.
7. **BPM frozen at completion** — BPM changes after completion → press Replay → `offsetMs` values reflect original BPM.
8. **Replay button restored after natural end** — press Replay → fast-forward finish timer → Replay button reappears; `stopPlayback` called.
9. **Unmount during replay clears timers** — press Replay → unmount → no pending state updates after unmount.
