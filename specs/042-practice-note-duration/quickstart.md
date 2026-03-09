# Quickstart: Practice Note Duration Validation

**Feature**: 042-practice-note-duration  
**Date**: 2026-03-09

---

## What This Feature Does

After this feature is implemented, practising from a loaded score enforces hold durations. The user must hold each note/chord for at least 90% of its written duration before the session advances. Releasing too early records a half-credit result and keeps the session on the same note so the user can retry.

---

## Test It Manually

1. Load a score that contains whole notes (e.g., `scores/Pachelbel_CanonD.mxl` — it contains half and whole notes in the upper voice in the opening section).
2. Open the **Practice** view and select the staff.
3. Press the **Practice** button.
4. When a whole note is highlighted, press the correct key on the MIDI keyboard and **release immediately** (before ~1 beat has elapsed at the current tempo).
5. **Expected**: The session does NOT advance. A hold progress indicator should have appeared briefly. The note is still highlighted.
6. Press the key again and hold it for the full measure.
7. **Expected**: The session advances to the next note.

---

## Files Changed

| File | Change |
|------|--------|
| `frontend/src/plugin-api/types.ts` | Add `durationTicks: number` to `PluginPracticeNoteEntry` |
| `frontend/src/plugin-api/scorePlayerContext.ts` | Populate `durationTicks` in `extractPracticeNotes` |
| `frontend/plugins/practice-view-plugin/practiceEngine.types.ts` | Add `'holding'` mode, `'early-release'` outcome, `HOLD_COMPLETE`/`EARLY_RELEASE` actions, `holdStartTimeMs`/`requiredHoldMs` state |
| `frontend/plugins/practice-view-plugin/practiceEngine.ts` | Handle new actions in reducer |
| `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx` | Hold timer (rAF), MIDI release handler, hold progress state + indicator UI |
| `frontend/plugins/practice-view-plugin/practiceEngine.test.ts` | Tests for new actions and transitions |
| `frontend/plugins/practice-view-plugin/PracticeViewPlugin.test.tsx` | Component tests for hold progression and early-release display |

---

## Key Formula

```
requiredHoldMs = (entry.durationTicks / ((bpm / 60) * 960)) * 1000
holdThresholdMs = requiredHoldMs * 0.90
```

Where `bpm = playerState.bpm` (session BPM slider, includes tempo multiplier).

**Example** — whole note (3840 ticks) at 120 BPM:
```
requiredHoldMs = (3840 / ((120/60) * 960)) * 1000 = (3840 / 1920) * 1000 = 2000 ms
holdThresholdMs = 2000 * 0.90 = 1800 ms
```

The user must hold for at least 1800 ms (1.8 seconds).

**Example** — quarter note (960 ticks) at 60 BPM:
```
requiredHoldMs = (960 / ((60/60) * 960)) * 1000 = (960 / 960) * 1000 = 1000 ms
holdThresholdMs = 1000 * 0.90 = 900 ms
```

---

## Score Calculation

```
score = ((correct + (late + earlyRelease) × 0.5) / total) × 100 − min(wrongAttempts × 2, 30)
```

`early-release` outcomes contribute 0.5 credit — same as `correct-late`.

---

## Hold Indicator Visibility Rule

The visual hold progress indicator is shown **only when** the note's required duration is greater than one quarter note at the current BPM:

```typescript
const quarterNoteMs = (960 / ((bpm / 60) * 960)) * 1000;
const showIndicator = requiredHoldMs > quarterNoteMs && holdProgress > 0;
```

For quarter notes and shorter durations, no indicator is shown — duration checking and scoring still apply.

---

## Running Tests

```bash
cd frontend
pnpm vitest run plugins/practice-view-plugin/practiceEngine.test.ts
pnpm vitest run plugins/practice-view-plugin/PracticeViewPlugin.test.tsx
```

---

## Architecture Notes

- The practice engine reducer (`practiceEngine.ts`) remains a **pure function** — no timers, no `Date.now()` calls inside the reducer. The React component is responsible for all timing and dispatches `HOLD_COMPLETE` / `EARLY_RELEASE` as actions.
- `holdStartTimeMs` is stored in the engine state so tests can inspect it; the component reads it to compute progress.
- `requestAnimationFrame` loop in `PracticeViewPlugin.tsx` reads `holdStartTimeMs` from `practiceStateRef.current` and the BPM from `playerStateRef.current.bpm` to compute progress each frame.
- No Rust or WASM changes are required.
