# Research: Fix Metronome Issues (085)

**Date**: 2026-04-26  
**Branch**: `085-fix-metronome-issues`  
**Method**: Code inspection of `frontend/src/services/metronome/`, `frontend/src/plugin-api/metronomeContext.ts`, `frontend/src/services/playback/MusicTimeline.ts`, and `frontend/src/services/playback/ToneAdapter.ts`.

---

## R-001: Root Cause — Ultraslow Tempo Desync (Issue #1)

**Question**: Why does the metronome tick faster than playback at 10 BPM?

**Decision**: `MetronomeEngine.clampBpm()` clamps BPM to `[20, 300]` — a minimum of 20 BPM. When the user sets 10 BPM, the engine silently uses 20 BPM, making the metronome tick twice as fast as playback advances through the score.

**Evidence** (`MetronomeEngine.ts`, line ~67):
```typescript
public clampBpm(bpm: number): number {
  const clamped = Math.min(300, Math.max(20, bpm)); // <-- minimum is 20
  ...
}
```

The `_computeBeatInterval` formula itself (`(60 / bpm) * (4 / denominator)`) is correct for any positive BPM. The only issue is the clamping floor.

**Rationale**: Change `Math.max(20, bpm)` to `Math.max(10, bpm)` so the supported range becomes `[10, 300]`, matching the spec requirement (FR-001, FR-009, SC-001).

**Alternatives considered**:
- Redesign scheduler to use position-based timing instead of wall-clock intervals. **Rejected**: Tone.js `Transport.scheduleRepeat` is already position-based (Transport time ≠ wall clock); it maintains accuracy at 10 BPM without changes. The issue is purely the clamping floor.

---

## R-002: Root Cause — Metronome Stops After Loop Boundary (Issue #2)

**Question**: Why does the metronome stop after the second (and subsequent) loop iterations?

**Decision**: A chain of three events kills the metronome's `scheduleRepeat` on every loop restart, and no code path re-registers it while status stays `'playing'`.

**Detailed trace**:

1. `MusicTimeline.ts` rAF tick detects `currentTick >= loopEndTick`.
2. Calls `scheduler.clearSchedule()` → `adapter.stopAll()` (clears note events only, not the metronome event).
3. Calls `adapter.startTransport()` which:
   a. Fires `transportRestartListeners` synchronously — this invokes `MetronomeEngine._clearEvent()`, cancelling the metronome's `scheduleRepeat` Transport event.
   b. Calls `Transport.stop()` then `Transport.start('+0.05', 0)`.
4. Status remains `'playing'` throughout.
5. `metronomeContext.ts` subscriber only restarts the engine when:
   ```typescript
   if (prevStatus !== 'playing' && s.status === 'playing') { ... }
   ```
   Since status never transitions during a loop, the engine never restarts.

**Rationale**: In `useMetronomeBridge`, subscribe to `adapter.onTransportRestart`. When fired while the engine is active, queue a microtask (`Promise.resolve().then(...)`) to call `engine.start()` after `startTransport()` completes (so the Transport is already running at position 0). Start from beat 0 at Transport time 0 — this is always correct because `startTransport()` always resets the Transport to position 0.

**Why microtask**: `onTransportRestart` fires synchronously BEFORE `Transport.stop()` / `Transport.start()`. Calling `engine.start()` during the listener would register a `scheduleRepeat` on the old Transport timeline (about to be cleared). A `Promise.resolve().then()` defers execution until after the synchronous call stack completes, by which time `Transport.start('+0.05', 0)` has been called.

**Alternatives considered**:
- Detect loop restart by checking if `currentTick` jumps backwards in the scorePlayer subscriber. **Rejected**: Fragile (user can also seek backwards); doesn't fire at the right moment (tick update happens via React state = asynchronous).
- Add a dedicated loop-restart callback to `MusicTimeline`. **Rejected**: Introduces a new coupling between MusicTimeline and metronome, violating Hexagonal Architecture (Principle II). The existing `onTransportRestart` hook in `ToneAdapter` is the correct boundary.
- Make `MetronomeEngine._unsubTransportRestart` re-register instead of just clearing. **Rejected**: The engine lacks the context to know the correct beat phase (it doesn't know the loop start tick or new Transport offset).

---

## R-003: Root Cause — Visual Blink Ignores Subdivision (Issue #3)

**Question**: Why does the visual blink only fire on full beats even when subdivision is set to 1/8?

**Decision**: `MetronomeEngine._fireBeat()` only notifies subscribers when `isOnBeat === true` (i.e., `_subBeatIndex === 0`). Subdivision ticks (`_subBeatIndex > 0`) are scheduled, play audio, but never trigger subscriber notifications.

**Evidence** (`MetronomeEngine.ts`, `_fireBeat()`, line ~285):
```typescript
// Notify subscribers only on real beat boundaries (not sub-ticks)
if (isOnBeat) {
  const state: MetronomeState = { ... };
  this._subscribers.forEach(h => h(state));
}
```

The audio correctly plays on subdivision ticks; only the state broadcast is gated to beat boundaries.

**Rationale**: 
1. Add `subBeatIndex: number` to `MetronomeState` — carries the sub-beat position within the current beat (0 = on-beat, 1..subdivision-1 = subdivision tick).
2. Remove the `if (isOnBeat)` gate — notify on EVERY tick.
3. `playbackToolbar.tsx` already uses `metronomeBeatIndex` as a React `key` prop to trigger CSS animation restarts. With subdivision, update the key to include `subBeatIndex`: `metro-${beatIndex}-${subBeatIndex}`. This causes the animation to restart on each subdivision tick.
4. `PlayScorePlugin.tsx` passes `state.subBeatIndex` as a new `metronomeSubBeatIndex` prop to `PlaybackToolbar`.

**Impact on subscriber call rate**: At 120 BPM with subdivision 2 (eighth notes), subscribers receive 4 calls/second (2 × 2). At 300 BPM with subdivision 4, up to 20 calls/second. All handlers are simple state snapshots — no performance concern.

**Alternatives considered**:
- Add a separate `tickSerial` monotonic counter to `MetronomeState`. **Rejected**: Less expressive — consumers lose the ability to know which sub-beat position fired.
- Keep the `if (isOnBeat)` gate but add a separate `onSubdivisionTick` callback. **Rejected**: Splits the notification API unnecessarily; the existing `subscribe()` model is sufficient.

---

## R-004: Tone.js Transport accuracy at low BPM

**Question**: Does `Tone.Transport.scheduleRepeat` maintain sub-50ms accuracy at 10 BPM (6-second interval)?

**Decision**: Yes. Tone.js schedules events in Transport time (not wall-clock time), using the Web Audio API's `AudioContext.currentTime` as its clock. At 10 BPM, the interval between ticks is 6,000 ms. The Web Audio clock runs at sample-rate precision (~0.02 ms), so a 6-second interval has negligible drift. The ±10–15 ms jitter comes from the audio buffer size, not from the interval length. This is well within the ≤50 ms threshold at all supported tempos.

**Rationale**: No changes to the scheduler architecture are needed beyond the BPM clamping fix.

---

## R-005: Regression impact

**Tests affected** by each fix:

| Fix | Existing tests to update | New tests required |
|-----|--------------------------|-------------------|
| #1 BPM range 10–300 | `MetronomeEngine.test.ts` — "clamps BPM below 20 to 20" and "boundary values (20 and 300)" must be updated to reflect new minimum of 10 | Tests: 10 BPM accepted; 5 BPM clamped to 10; `updateBpm` clamps to 10 |
| #2 Loop restart | `metronomeContext.test.ts` — no existing loop tests | New: engine restarts on `onTransportRestart` while active; does NOT restart when inactive |
| #3 Subdivision blink | `MetronomeEngine.test.ts` — subscriber notification tests must include `subBeatIndex`; `PlaybackToolbar` snapshot/prop tests | New: subscribers notified on subdivision ticks; state includes `subBeatIndex` |

---

## R-006: No backend changes required

All three issues are confined to the frontend TypeScript codebase. The Rust/WASM backend is not involved in metronome scheduling — it only provides score data (notes, time signatures) via the layout engine. No Cargo changes.

---

## Summary of decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| R-001 | Extend BPM clamp floor from 20 → 10 | Spec requires 10–300 BPM range |
| R-002 | Subscribe to `onTransportRestart` in `useMetronomeBridge`; restart engine via microtask | Only correct interception point; microtask ensures Transport is running |
| R-003 | Add `subBeatIndex` to `MetronomeState`; notify on all ticks | Enables subdivision-aware visual blink; minimal API surface addition |
| R-004 | No scheduler architecture changes | Tone.js Transport clock is already accurate at 10 BPM |
| R-005 | Update BPM clamping tests; add loop + subdivision blink tests | Principle VII (Regression Prevention): each bug → test |
