# Research: Practice Note Duration Validation

**Feature**: 042-practice-note-duration  
**Date**: 2026-03-09  
**Branch**: `042-practice-note-duration`

---

## R-001: Score Note Duration Availability

**Question**: Does the score data model already carry note durations that can be passed to the plugin?

**Decision**: Yes — `duration_ticks: number` is already present on every note in `frontend/src/types/score.ts` (lines 107, 204). The `expandedNotesByStaff` array used inside `extractPracticeNotes()` contains the full note model including `duration_ticks`.

**Rationale**: No WASM or backend changes are required. The duration value is already available in the TypeScript layer at the point where `extractPracticeNotes` builds `PluginPracticeNoteEntry` objects.

**Evidence**:
- `frontend/src/types/score.ts:107` — `duration_ticks: number`
- `frontend/src/plugin-api/scorePlayerContext.ts:392–403` — currently uses `note.start_tick`, `note.pitch`, `note.id` but **discards** `note.duration_ticks`

**Alternatives considered**:
- Adding a WASM API call to retrieve durations separately — rejected; data is already on the JS side.
- Computing duration from adjacent tick positions — rejected; `duration_ticks` is explicit and correct.

---

## R-002: MIDI Note-Off / Release Events in the Plugin

**Question**: Are MIDI note-off (key release) events already available to the plugin, or does a new subscription need to be created?

**Decision**: Already available. The `context.midi.subscribe` callback already receives events with `type: 'attack' | 'release'`. `PracticeViewPlugin.tsx` already subscribes and handles `event.type === 'release'` to relay audio and clear visual highlights (line 458). No new MIDI infrastructure is needed — the release handler just needs hold-timing logic added to it.

**Rationale**: Extending the existing release branch of the subscription is the minimal-change approach. The plugin receives the MIDI note number and timestamp on both attack and release events.

**Evidence**:
- `frontend/src/plugin-api/types.ts:103` — `type?: 'attack' | 'release'` on `PluginMidiEvent`
- `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx:458` — existing `if (event.type === 'release')` branch

**Alternatives considered**:
- Polling approach (periodic timer checking which keys are still pressed) — rejected; more complex and less accurate than event-driven.

---

## R-003: BPM Slider as Sole Source of Hold Duration

**Question**: Which BPM value should be used to convert `durationTicks` to `requiredHoldMs`?

**Decision**: `playerState.bpm`, which is already the combined value of `scoreTempo × tempoMultiplier` (the slider). This is the same BPM already used for all other timing calculations in `PracticeViewPlugin.tsx` (lines 361–363, 512–514).

**Formula**:
```
requiredHoldMs = (durationTicks / ((bpm / 60) * 960)) * 1000
```

This is the existing tick-to-ms conversion formula already used in the plugin.

**Rationale**:
- Consistent with all other timing in the plugin.
- If the user slows the session (lower BPM via slider), the required hold extends proportionally — musically correct.
- Already resolved in spec clarification Q3: BPM slider is the sole source of truth; mid-score tempo events embedded in the score are ignored for hold duration.

**Alternatives considered**:
- Score's written tempo at note position — rejected per spec clarification A-005.
- Capping requiredHoldMs at a maximum — rejected; no evidence current users play at tempos where holds become impractical.

---

## R-004: Practice Engine State Machine Design for Hold

**Question**: How should the hold state map to the existing `PracticeMode` state machine?

**Decision**: Add a new `'holding'` mode to `PracticeMode`. The engine transitions as follows:

```
inactive / waiting
    → waiting         (START action)
    → holding         (CORRECT_MIDI on score-based note with durationTicks > 0)
    → active          (CORRECT_MIDI on no-duration note, or backward compat)
  holding
    → active          (HOLD_COMPLETE action — dispatched by React timer)
    → holding         (EARLY_RELEASE action — note recorded, stay on same index, user can retry)
  active
    → holding/active  (next CORRECT_MIDI depending on next note's durationTicks)
    → complete        (last note reached)
```

A note with `durationTicks === 0` (e.g., derived from random mode or a future edge case) skips the `holding` state entirely and advances immediately, preserving backward compatibility.

**Rationale**: Making `holding` an explicit mode is cleaner than tracking hold state as a side-channel. It makes the state machine readable, testable, and exhaustive. The `mode === 'holding'` guard in handlers prevents double-dispatch.

**Alternatives considered**:
- Implicit hold tracking via a `holdStartTimeMs` field without a dedicated mode — rejected; creates ambiguity about whether hold is active.
- Advancing immediately and tracking hold separately outside the engine — rejected; violates the pure-reducer pattern already established.

---

## R-005: Hold Timer and Visual Indicator Implementation

**Question**: What mechanism should drive the 60 fps hold progress indicator and fire the `HOLD_COMPLETE` action at 90% of `requiredHoldMs`?

**Decision**: Use `requestAnimationFrame` (rAF) loop in the React component.

Flow:
1. When the engine enters `holding` mode (after CORRECT_MIDI is dispatched), a rAF loop starts.
2. Each frame: compute `elapsed = now - holdStartMs` and `progress = elapsed / requiredHoldMs`.
3. Update a React state variable `holdProgress: number` (0.0–1.0) from the rAF loop — this drives the visual indicator.
4. When `progress >= 0.90`: cancel the loop, dispatch `HOLD_COMPLETE`.
5. When a `EARLY_RELEASE` is dispatched (MIDI release event): cancel the loop, set `holdProgress` to 0.
6. On mode change away from `'holding'`: cancel the loop as cleanup.

**Rationale**:
- rAF is the standard web API for 60 fps animation loops.
- No `setInterval` drift; rAF fires at the display refresh rate.
- The 90% threshold dispatch is a one-shot cancel-and-dispatch, consistent with the way the existing phantom-tempo timer works in the plugin.
- `holdProgress` is a unitless percentage (0–1), satisfying Principle VI (no pixel arithmetic).

**Alternatives considered**:
- `setTimeout` at 90% of the required duration — could work for the timer but doesn't support the smooth progress indicator.
- A separate `useInterval` hook — rejected; unnecessary abstraction for one-off usage.

---

## R-006: Chord Hold Termination Condition

**Question**: For chords, when does the "hold" end — when any pitch is released, or when all pitches are released?

**Decision**: The hold ends when **any** required pitch is released. This matches the spec (FR-006: "the hold ends as soon as any one active pitch is released") and is consistent with the existing `ChordDetector` which detects when all pitches are pressed — the inverse behaviour applies on release.

**Implementation**: In the existing MIDI release handler, check if the released `event.midiNote` is in the currently-held chord's `midiPitches`. If yes and the engine is in `holding` mode, dispatch `EARLY_RELEASE`.

**Rationale**: A chord is an atomic musical unit. Releasing any note of the chord breaks the musical duration.

---

## R-007: Scoring Formula for early-release

**Question**: How does `early-release` contribute to the session score? (Resolved in spec clarification Q1.)

**Decision**: `early-release` is treated identically to `correct-late` — 0.5 credit. The existing score formula:

```
score = ((correct + late × 0.5) / total) × 100 − min(wrongAttempts × 2, 30)
```

becomes:

```
score = ((correct + (late + earlyRelease) × 0.5) / total) × 100 − min(wrongAttempts × 2, 30)
```

The results screen already classifies outcomes per note. `early-release` is a new outcome label that renders the same half-credit explanation as `correct-late`.

**Evidence**: Scoring formula from `specs/037-practice-view-plugin/spec.md` and `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx:791`.

---

## R-008: Retry Behaviour After Early Release

**Question**: Can the user re-press the note after an early release, and how does the engine handle it? (Resolved in spec clarification Q1.)

**Decision**: Yes. After `EARLY_RELEASE`:
- The engine stays on the same note index.
- The `early-release` is recorded immediately and is final (half-credit, cannot be upgraded).
- The user may re-press — the CORRECT_MIDI handler fires again for the same note, entering `holding` mode again.
- When the retry hold completes (`HOLD_COMPLETE`), the engine advances. However, the `noteResults` array already has an entry for this index from the early release. 

The engine must handle a second `CORRECT_MIDI` for the same `currentIndex` after an `EARLY_RELEASE`. Since the hold tracking is separate from the pitch result, the state machine should accept the retry and transition to `holding` without adding a duplicate `noteResults` entry for the pitch check — the early-release entry is the permanent record.

**Implementation note**: The `HOLD_COMPLETE` action advances the index. The `EARLY_RELEASE` action records the result but stays at the same index. A subsequent `CORRECT_MIDI` on the same index enters `holding` again without adding another result entry — it only resets the hold start time.

---

## R-009: Plugin API Version

**Question**: Does adding `durationTicks` to `PluginPracticeNoteEntry` require a plugin API version bump?

**Decision**: Yes — a minor version bump (v6 → v7). `durationTicks` is an additive field. Existing consumers that don't use it are unaffected. The field comment in the type should document that `durationTicks === 0` means no duration checking.

**Alternatives considered**:
- Optional field `durationTicks?: number` — rejected; would require optional-chaining at every usage site. A mandatory `0`-default is cleaner and documents the "no duration" case explicitly.

---

## R-010: No Backend / WASM Changes Required

**Question**: Does this feature require any Rust or WASM changes?

**Decision**: No. All required data (`duration_ticks`) is already available in the TypeScript score model. The practice engine and its hold-duration logic are entirely within the TypeScript plugin layer. The Rust/WASM pipeline is not touched.

**Rationale**: The `extractPracticeNotes` function in `scorePlayerContext.ts` already reads from `expandedNotesByStaff`, which carries the full score note model including `duration_ticks`. Simply including this field in the returned `PluginPracticeNoteEntry` is sufficient.

---

## Summary of All Decisions

| ID | Decision |
|----|----------|
| R-001 | `durationTicks` already available in TypeScript score model; no backend change |
| R-002 | MIDI release events already subscribed in plugin; extend existing handler |
| R-003 | `playerState.bpm` (slider value) is the sole BPM source for hold duration |
| R-004 | Add `'holding'` mode to `PracticeMode`; explicit state machine transitions |
| R-005 | `requestAnimationFrame` loop for 60 fps indicator; cancel on HOLD_COMPLETE/EARLY_RELEASE |
| R-006 | Any required pitch release terminates the chord hold |
| R-007 | `early-release` = 0.5 credit (same as `correct-late`) in score formula |
| R-008 | Retry allowed after early release; early-release result is final and unupgradable |
| R-009 | Plugin API bumped to v7 (additive, backward compatible) |
| R-010 | No Rust/WASM changes required |
