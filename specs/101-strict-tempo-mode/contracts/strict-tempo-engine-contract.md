# Contract: Strict Tempo Engine

**Feature**: `101-strict-tempo-mode`  
**Applies to**: `frontend/plugins/practice-view-plugin/strictTempo.ts`, `practiceEngine.ts`, `practiceEngine.types.ts`

This is an internal, pure-engine contract. It has no network, storage, audio, or React dependency. The MIDI hook supplies the measured times; the reducer owns the state.

---

## 1. Pure helper

```ts
export const STRICT_WINDOW_RATIO = 0.40;
export const STRICT_WINDOW_MIN_MS = 120;
export const STRICT_WINDOW_MAX_MS = 300;
export const STRICT_FAILURE_LIMIT = 3;

export interface StrictAnchor {
  readonly expectedTimeMs: number;
  readonly responseTimeMs: number;
}

export interface StrictEvaluation {
  /** Anchor in effect after this note. Always non-null: a grace note creates one. */
  readonly anchor: StrictAnchor;
  /** Signed deviation from the anchor grid. 0 for a grace note. */
  readonly deltaMs: number;
  /** Window applied to this note, 120–300 ms. */
  readonly windowMs: number;
  /** True when this note established/re-established the grid. */
  readonly isGrace: boolean;
  /** True when the note is on the beat (always true for a grace note). */
  readonly onBeat: boolean;
}

export function computeStrictWindowMs(expectedGapMs: number): number;

export function evaluateStrictOnset(params: {
  readonly anchor: StrictAnchor | null;
  readonly responseTimeMs: number;
  readonly expectedTimeMs: number;
  readonly expectedGapMs: number;
}): StrictEvaluation;
```

### Behavior

- `computeStrictWindowMs(gap)` returns `round(clamp(0.40 × gap, 120, 300))`. For non-finite or negative `gap`, use the floor (120 ms).
- `evaluateStrictOnset`:
  - If `anchor === null`: `isGrace = true`, `onBeat = true`, `deltaMs = 0`, `anchor = { expectedTimeMs, responseTimeMs }`.
  - Otherwise: `deltaMs = round((responseTimeMs - anchor.responseTimeMs) - (expectedTimeMs - anchor.expectedTimeMs))`; `windowMs = computeStrictWindowMs(expectedGapMs)`; `onBeat = |deltaMs| <= windowMs`; the returned `anchor` is the input anchor unchanged.
  - A grace note never counts as a failure and never changes the consecutive count.
  - The comparison is inclusive at the boundary (`|delta| == window` is on time).

### Test obligations

- Gaps 0, 100, 300, 500, 750, 1000, 2000 ms → windows 120, 120, 120, 200, 300, 300, 300.
- Positive and negative deltas.
- Grace sets the anchor and returns `deltaMs = 0`.
- Judge uses the anchor without updating it.
- Inclusive boundary on both sides.
- Integer rounding.
- A constant lag (same interval deviation, growing absolute deviation) is caught by a later note.
- A catch-up note can be on the grid even when its interval delta is large.

---

## 2. Reducer state

```ts
interface PracticeState {
  // ...existing fields...
  readonly strictMode: boolean;
  readonly strictFailureCount: number;       // 0..3
  readonly strictAnchor: StrictAnchor | null;
  readonly strictReanchorPending: boolean;
}
```

### Invariants

1. `strictFailureCount` is an integer in `[0, 3]`.
2. `!strictMode` ⇒ `strictFailureCount === 0 && strictAnchor === null`.
3. `strictAnchor` is created only by a grace note and never changed by a normal accepted note.
4. `strictReanchorPending` is only set while a tempo change occurs during `holding`; the next note after the hold is a grace note.
5. A `tempo-stopped` mode is entered only when `strictFailureCount` reaches 3.
6. Grace notes and wrong pitches never change `strictFailureCount`.
7. One note attempt contributes at most one failure.

---

## 3. Reducer actions

```ts
type PracticeAction =
  // ...existing...
  | { type: 'START'; /* existing */ strictTempo?: boolean }
  | { type: 'STRICT_ENABLE' }
  | { type: 'STRICT_DISABLE' }
  | { type: 'REANCHOR' };
```

| Action | Strict effect |
|--------|---------------|
| `START` | `strictMode = !!strictTempo`; count 0; anchor null; pending false. |
| `STRICT_ENABLE` | Only while `waiting`/`active`/`holding`: `strictMode = true`; count 0; anchor null; pending false. |
| `STRICT_DISABLE` | Only while `waiting`/`active`/`holding`: `strictMode = false`; count 0; anchor null; pending false. Results keep their flags. |
| `REANCHOR` | Only while strict and `waiting`/`active`/`holding`. If `holding`: pending true, anchor unchanged. Else: anchor null, pending false. Count preserved. |
| `LOOP_RESTART` | Anchor null, pending false. Count preserved. First note of the loop is grace. |
| `SEEK` | Anchor null, pending false. Count preserved. Next note is grace. |
| `STOP` | All strict fields reset. |

---

## 4. Evaluation integration

### `CORRECT_MIDI` — no hold

1. Compute the legacy `relativeDeltaMs` exactly as today.
2. If `strictMode`:
   - Compute `expectedGapMs` from the previous result (0 if none).
   - Call `evaluateStrictOnset` with the current `strictAnchor`.
   - If grace: `outcome = 'correct'`, `strictFailure = false`, `beatDeltaMs = 0`.
   - Else if off-beat: `outcome = 'correct-late'`, `strictFailure = true`, `beatDeltaMs = deltaMs`, count += 1.
   - Else: `outcome = 'correct'`, `strictFailure = false`, `beatDeltaMs = deltaMs`, count = 0.
   - Store `strictAnchor = evaluation.anchor`.
   - `strictReanchorPending` is false after a non-holding note.
3. If the count reaches 3: `mode = 'tempo-stopped'`.
4. Else if this is the last index: `mode = 'complete'`.
5. Else: advance to the next note.

### `HOLD_COMPLETE`

1. If there is already an early-release result for this note in the current loop (`existingResult`):
   - Do not append a duplicate result.
   - If `strictMode` and `strictAnchor === null` and not pending: set the anchor to this retry’s onset (grace).
   - If pending: leave the anchor null for the next note; clear pending.
   - Count unchanged. Advance/complete as today.
2. Otherwise build the result as today. If `strictMode`:
   - Evaluate the onset with `holdResponseTimeMs` / `holdExpectedTimeMs` and the gap from the previous result.
   - Apply the same grace/on-beat/off-beat rules as above.
   - If the count reaches 3: `mode = 'tempo-stopped'` (even on the last index; the orchestrator decides complete-vs-partial).
   - Else if last index: `mode = 'complete'`.
   - Else advance.
   - If `strictReanchorPending`: after evaluating (or after setting a grace anchor), set `strictAnchor = null` and pending false so the next note is grace.

### `EARLY_RELEASE`

1. If `isHoldAccepted(...)`, delegate to `HOLD_COMPLETE` (existing behavior).
2. Otherwise build the `early-release` result as today. If `strictMode`:
   - `strictFailure = true`; count += 1.
   - `beatDeltaMs` = onset delta against the current anchor, or 0 if the anchor is null.
   - `strictAnchor = null` (the retry is grace); `strictReanchorPending = false`.
   - If count reaches 3: `mode = 'tempo-stopped'`.
   - Else: stay on the same note (`active`), as today.

### `WRONG_MIDI`

- No strict change: no result, no count change, no anchor change.

---

## 5. Stop contract

- The reducer only signals; the orchestrator performs side effects.
- `tempo-stopped` is terminal for the session. It does not trigger `usePracticeLoop`’s complete/restart branch.
- The orchestrator must, exactly once:
  1. Snapshot the current results/notes/wrong events.
  2. If the last result is an accepted note (`correct`/`correct-late`) and the current index is the end of the final iteration, build a complete `PerformanceRecord`; otherwise build a `PartialPerformanceRecord` with `stopReason: 'tempo'`.
  3. Show the results overlay.
  4. Dispatch `STOP`.
  5. Call `lifecycle.onSessionEnd()` (metronome stops/re-arms if enabled).
  6. Stop the score player and seek to the loop start (or 0).
- Repractice starts a fresh session with the metronome still enabled; `START` resets the count.

---

## 6. Regression obligations

- Metronome off: `strictMode=false`, legacy `relativeDeltaMs`/`LATE_THRESHOLD_MS=500` classification unchanged, no `tempo-stopped` mode.
- Free Practice: never dispatches `START` for score practice, never shows strict state.
- Manual stop: no tempo stop; partial results keep the existing behavior, even if 1–2 strict failures were recorded.
- Existing saved practices: no new required fields; old results load and score identically.
