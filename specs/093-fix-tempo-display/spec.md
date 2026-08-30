# Feature Specification: Fix Tempo Display on Metronome Slider

**Feature Branch**: `093-fix-tempo-display`  
**Created**: 2026-08-30  
**Status**: Draft  
**Input**: User description: "Let's fix some issues in the practice plugin in the free mode. The first one is that when I modify the tempo for the metronome using the slider, the number with the tempo is not modified."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tempo Number Updates When the Metronome Slider Is Used (Priority: P1)

A musician starts a Free Practice session in the Practice Plugin and opens the metronome. They adjust the tempo by dragging the tempo slider (e.g., from 80 to 120 BPM). The metronome immediately beats at the new tempo, and the numeric BPM readout shown next to the slider updates to match the new value while dragging and after release. The displayed number always corresponds exactly to the tempo the metronome is playing.

**Why this priority**: A tempo control whose readout lies to the user breaks trust in the practice tool. Musicians rely on the displayed BPM to select and confirm their practice tempo; a stale number makes it impossible to know the actual tempo at a glance, forcing them to second-guess the tool during practice.

**Independent Test**: Start a Free Practice session → open the metronome → drag the tempo slider from minimum to maximum and back → verify the displayed BPM number follows the slider in real time and matches the metronome's audible beat at rest.

**Acceptance Scenarios**:

1. **Given** a Free Practice session is active with the metronome open, **When** the user drags the tempo slider from 80 to 120 BPM, **Then** the numeric tempo readout updates to 120 BPM in real time as the slider moves, and reaches the final value by the time the drag ends.
2. **Given** a Free Practice session is active with the metronome running, **When** the user slides the tempo to a new value, **Then** the numeric readout shows the new value immediately and the metronome beats at exactly that tempo, with no mismatch between the shown number and the heard rate.
3. **Given** a Free Practice session is active with the metronome stopped, **When** the user slides the tempo to a new value, **Then** the numeric readout updates immediately, so the current tempo is correct even before the metronome is started.
4. **Given** the user has just released the tempo slider after dragging it, **When** they read the numeric readout, **Then** it displays a whole-number BPM (e.g., "120") consistent with the slider's final position.
5. **Given** the user drags the tempo slider continuously over a wide range, **When** the drag ends, **Then** the displayed BPM equals the final slider position with no lag, skipped updates, or residual stale value.

---

### Edge Cases

- What happens when the slider reaches its minimum or maximum tempo? The readout shows the boundary value and does not exceed the supported range, no matter how far past the end the user drags.
- What happens when the user drags the slider very quickly? The readout tracks the slider without freezes; once the drag stops, the displayed value equals the slider position.
- What happens when the user changes tempo and the metronome is mid-tick? The readout updates immediately; the next ticks follow the new tempo without the display ever drifting from the heard tempo.
- What happens on a touch trade-off during drag (finger slightly below the slider)? The readout still tracks the thumb's effective position, so the shown number always matches the tempo that was selected.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The numeric tempo readout beside the metronome slider MUST update in real time to reflect the tempo value selected by the slider, both continuously while the slider is being dragged and after the drag ends.
- **FR-002**: The displayed tempo value MUST always match the metronome's active tempo after any slider interaction, so the shown number never diverges from the tempo the metronome actually beats.
- **FR-003**: Tempo changes made with the slider MUST keep the metronome's audible beat in sync with the displayed readout; adjusting the slider must never cause the readout and the heard tempo to disagree.
- **FR-004**: When the slider is at the minimum or maximum supported tempo, the readout MUST show that boundary value and MUST NOT display values outside the supported tempo range.
- **FR-005**: The readout MUST display tempo as a whole number (e.g., "120"), rounded consistently with how slider positions translate to tempo values.
- **FR-006**: The readout MUST remain synchronized whether the metronome is running or stopped at the moment the user adjusts the slider.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Adjusting the tempo slider from one end of its range to the other updates the numeric readout in real time with no freeze or lag, and the final displayed value equals the slider's final position 100% of the time.
- **SC-002**: After any tempo adjustment via the slider, the metronome's audible beat rate matches the displayed number with zero observable divergence.
- **SC-003**: Every slider adjustment results in a displayed tempo that is a whole number within the supported range — no out-of-range, missing, or stale readouts in testing.

## Known Issues & Regression Tests *(if applicable)*

<!--
  CONSTITUTION REQUIREMENT: Principle VII (Regression Prevention)
  When bugs are discovered, document here, FAIL FIRST with a reproducing test,
  then fix, then keep the test permanently.
-->

### Issue #1: Tempo Number Does Not Update When Slider Is Moved

**Discovered**: 2026-08-30 during user testing in Free Practice mode

**Symptom**: When the user drags the metronome tempo slider during a Free Practice session, the metronome beats at the new tempo but the numeric tempo readout next to the slider keeps showing the previous value (it is not modified by the slider).

**Root Cause**: The numeric readout in Free Practice mode was bound to `useFreePractice.freeStaffBpm`, a value only written at session boundaries (start/repractice/replay). The slider path updated only `tempoMultiplier` + `scorePlayer.setTempoMultiplier`, which never fed back into the free-practice domain state. Same root cause left the measure-clock quantization grid and the persisted `FreeMidiRecord.bpm` stale.

**Affected Components**: `frontend/plugins/practice-view-plugin/useFreePractice.ts`, `PracticeViewPlugin.tsx` (free practice only).

**Regression Test**:
- `frontend/plugins/practice-view-plugin/PracticeViewPlugin.test.tsx` — T003 (regression): enter free practice → `fireEvent.change` the tempo slider to 1.25 → assert the toolbar readout shows `round(base × 1.25)`; T003b covers a follow-up change (2.0 → 240, back to 1.0 → 120).
- `frontend/plugins/practice-view-plugin/useFreePractice.test.ts` — T002a/b/c: effective-BPM recompute from `setFreeTempo`, floor clamp at 10 BPM, and stop-time `record.bpm` = effective (not base).

**Resolution**: Introduced `freeEffectiveBpm = round(base × tempoMultiplier)` as the single source of truth in `useFreePractice` (base = `freeStaffBpm`). New `setFreeTempo(multiplier)` publishes the recomputed effective BPM; `PracticeViewPlugin.handleTempoChange` invokes it when a free practice session is active. The toolbar readout, StaffViewer `bpm`, measure clock (unrounded effective, no drift) and `FreeMidiRecord.bpm` at stop all derive from it. Multiplier resets to 1.0 on entry, repractice, and replay so slider position and readout stay aligned.

**Lessons Learned**: Free practice has no score, so `playerState.bpm` never mirrors the tempo slider — a display path that only reads a session-boundary snapshot (`freeStaffBpm`) cannot reflect live slider changes. Any per-mode tempo display must be driven by a single effective value that all consumers (readout, timing, persistence) share rather than a cached base.

---

## Assumptions

- The metronome already responds to tempo changes made with the slider (only the numeric readout lags); the fix is scoped to keeping the displayed number synchronized with that same tempo value.
- The tempo slider and readout are part of the Practice Plugin's metronome control, shared by Free Practice and score-based sessions; the fix applies wherever this control is used.
- Tempo values are displayed as whole-number BPM, consistent with the existing metronome behavior in the supported range.