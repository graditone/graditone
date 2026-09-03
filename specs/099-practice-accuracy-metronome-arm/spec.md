# Feature Specification: Practice Accuracy & Metronome Arming (Minor Fixes)

**Feature Branch**: `099-practice-accuracy-metronome-arm`
**Created**: 2026-09-03
**Status**: Implemented
**Input**: User description: "Two small issues: (1) the chord hold-detection error margin is too high — ask for more accuracy; (2) when the metronome is active before pressing the Practice button, the metronome is not armed when the practice button is pressed (Score Practice)."

## Summary

Two small practice-view fixes on the branch created from `main`:

1. **Accuracy**: set the chord hold-acceptance margin to 20% / 1500 ms, requiring 80% of the notated duration to be held (more accurate than the original 25%, forgiving enough to be comfortable).
2. **Metronome arming**: fix a race so that starting Score Practice with the metronome already running reliably arms (defers) the metronome to the first note.

## User Scenarios & Testing

### User Story 1 - More Accurate Chord Detection (Priority: P1)

A practitioner holding a long chord should be required to sustain it for the large majority of its duration, with only a small release margin for finger changes.

**Acceptance Scenarios**:

1. **Given** a whole-note chord at 60 BPM (required 4000 ms), **When** the player holds it for 3200 ms (80%), **Then** the chord is validated as correct.
2. **Given** the same chord, **When** the player releases at 3100 ms (< 80%), **Then** it is recorded as `early-release` and does not advance.
3. **Given** any chord whose required hold is large, **When** the player holds it to ≥ (required − 1500 ms), **Then** it is validated; the margin never exceeds 1500 ms.

### User Story 2 - Metronome Arms When Score Practice Starts (Priority: P1)

Starting Score Practice while the metronome is already ticking must stop and defer (arm) it so it waits for the first played note, rather than continuing to tick or stopping without re-arming.

**Acceptance Scenarios**:

1. **Given** the metronome is active (ticking) before the Practice button is pressed, **When** the user starts Score Practice, **Then** the metronome becomes armed (not ticking) and shows the armed state.
2. **Given** the armed metronome from scenario 1, **When** the user plays the first note, **Then** the metronome starts in sync with the first note.

## Requirements

### Functional Requirements

- **FR-001**: The hold-acceptance margin MUST be 20% of the required duration, capped at 1500 ms (feature 099). A hold reaching `required − min(0.20 × required, 1500)` MUST be accepted.
- **FR-002**: Genuine early releases (below the margin) MUST still record `early-release` and block advancement.
- **FR-003**: The metronome `arm()` MUST evaluate the engine's live active state, not a stale render-synced snapshot, so a just-stopped engine can be armed in the same tick.
- **FR-004**: Starting Score Practice with an active metronome MUST result in an armed (deferred) metronome that starts on the first played note.

## Success Criteria

- **SC-001**: All hold-acceptance contract tests reflect the 20% / 1500 ms rule and pass.
- **SC-002**: A regression test proves `arm()` arms a just-stopped engine (live-state read).
- **SC-003**: Score Practice with an active metronome shows the armed state immediately after pressing Practice, and the first note starts it.

## Known Issues

### Issue #1: Chord hold margin too high

**Discovered**: 2026-09-03 during post-merge review (feature 098). The 25% / 1500 ms margin accepted a whole-measure chord a full beat early — too lenient for accurate practice.

**Root Cause**: `EARLY_ACCEPTANCE_RATIO = 0.25` / `EARLY_ACCEPTANCE_CAP_MS = 1500` in `holdDuration.ts` gave an oversized release window.

**Resolution**: Set to `0.20` / `1500` ms (80% hold requirement). Tests updated in `holdDuration.test.ts`, `useHoldProgress.test.ts`, `usePracticeMidi.test.ts`, `practiceEngine.test.ts`.

### Issue #2: Metronome not armed when starting Score Practice while active

**Discovered**: 2026-09-03 during tablet testing.

**Symptom**: With the metronome ticking, pressing the Practice button leaves the metronome stopped but NOT armed — it does not resume on the first note.

**Root Cause**: In `metronomeContext.ts`, `arm()` checked `engineStateRef.current.active` (a render-synced snapshot). `onSessionStart` calls `toggle()` (→ `engine.stop()`) then `arm()` synchronously; `engineStateRef.current` is still `active: true` until the next render, so `arm()` skipped `setArmed(true)`.

**Resolution**: `arm()` now reads the engine's live state via `engine.getState().active`. Regression test in `metronomeContext.test.ts`.

## Assumptions

- The 20% / 1500 ms margin is a single tunable pair of constants (`EARLY_ACCEPTANCE_RATIO`, `EARLY_ACCEPTANCE_CAP_MS`) for easy adjustment.
- Only Score Practice is affected by the metronome-arming fix; Free Practice already arms correctly.
