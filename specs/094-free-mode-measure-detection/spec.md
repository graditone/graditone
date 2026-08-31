# Feature Specification: Free Mode Measure Detection

**Feature Branch**: `free-mode-fixes`  
**Created**: 2026-08-30  
**Status**: Draft  
**Input**: User description: "in the free mode in the plugin practice view if we set the tempo as 4/4 (4 ticks in a measure, 1/4 note time duration per tick -> black note) and I play in the piano 8 notes following metronome ticks, each note lasting until the next tick, the free mode must detect two complete measures, with 4 black notes (1/4) in each.  If I do it now in one iteration it detects 5 notes in the first measure (1/4, 1/8, 1/8, 1/8, 1/4 -> which is wrong because it misses a 1/8 to complete the measure) and in the second measure 3 notes and a rest (1/4, 1/8, 1/8, rest 1/16 -> which is wrong because it does not complete the measure). Let's focus on this scenario to create a robust logic for it and then test in more complex performances."

## Clarifications

### Session 2026-08-30

- Q: What is the ground truth for the beat grid used to quantize measures and durations — the metronome's actual tick times or reconstruction from note onsets? → A: Always onset-reconstructed (Option B); the metronome is never a clock source. Detection must be identical whether the metronome is on or off — the metronome is only a reference for verifying the logic. When the metronome is on and the user follows it, onset-reconstruction equals metronome-locked detection.
- Q: What is the finest note value the detector must reliably detect and render? → A: 1/16 (sixteenth) is the finest detectable value; shorter played durations quantize to 1/16. Only quarters, eighths, and sixteenths need reliable, artifact-free detection.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Complete Measures from Beat-Aligned Quarter Notes (Priority: P1)

A musician starts a free practice session in the Practice plugin (no score, per Feature 092), sets the metronome/tempo to 4/4, and plays eight quarter notes on the piano, attacking each note exactly on a metronome tick and holding it until the next tick. The free mode must interpret this performance as two complete measures, each containing exactly four quarter notes ("black notes"). Today it mis-detects: measure 1 comes out as five notes (1/4, 1/8, 1/8, 1/8, 1/4 — an eighth's worth of time is missing, so the measure is short), and measure 2 comes out as three notes plus a spurious 1/16 rest (the measure is not complete).

**Why this priority**: This is the exact reported defect and the foundation of free-mode correctness. Free practice has no score to validate against; the measure grid IS the structure, so a musician must be able to trust it while following the metronome. Nothing else builds on top of this until this scenario works.

**Independent Test**: Start a free practice session (4/4 at any tempo), play eight quarter notes on-tick held until each next tick, then stop. The recorded/displayed performance shows exactly two complete measures of four quarter notes each — eight notes, no missing time, no rests.

**Acceptance Scenarios**:

1. **Given** a free practice session in 4/4, **When** the user plays eight quarter notes aligned to the metronome beats (each held until the next tick), **Then** the performance is detected as exactly two complete measures, each containing four quarter notes; the note durations in every measure sum exactly to the measure length and no subdivisions or rests are introduced.
2. **Given** the same input, **When** the live staff display is reviewed, **Then** measure 1 contains exactly four quarter notes (not five notes with missing time) and measure 2 contains exactly four quarter notes (not three notes plus a rest).
3. **Given** the same input, **When** the user stops and reviews the results overlay, **Then** the total note count is 8 and the measure structure matches what was displayed live.
4. **Given** the user plays the same eight quarter notes once with the metronome off and once with it on, **When** each session is stopped, **Then** detection yields the identical result (two complete measures of four quarter notes) in both sessions.

---

### User Story 2 - Measure Detection for General Beat-Aligned Input (Priority: P2)

A musician follows the metronome but mixes note lengths — half notes, quarter-note runs, eighth-note runs — always starting each note on a beat or subdivision and holding it until the next intended attack. Across multiple measures and at any tempo in the supported range, free mode must produce complete measures whose detected durations correctly account for every beat, with no time invented and no beat lost.

**Why this priority**: Once the basic quarter-note scenario works, the same logic must generalise to all beat-grid-aligned input so a musician can freely improvise subdivisions while keeping the measure grid truthful. This is where the robustness the user asks for is proven.

**Independent Test**: Play a two-measure pattern with mixed values (e.g., two half notes plus four quarter notes), and separately a pattern with eighth-note runs. Stop and verify every measure is complete (durations sum to the measure length) with the correct note count.

**Acceptance Scenarios**:

1. **Given** a free practice session in 4/4, **When** the user plays notes of varying beat-aligned durations whose total spans exactly N measures, **Then** every measure up to the final one is complete: the detected note durations sum exactly to the measure's length (4 beats), with no missing or surplus time.
2. **Given** the same session, **When** the user plays an eighth-note run in time with the metronome's subdivisions, **Then** each note is detected at the correct subdivision (1/8) and every measure remains complete.
3. **Given** a tempo anywhere in the supported range (20–300 BPM), **When** the user plays beat-aligned notes at that tempo, **Then** measure detection produces complete measures with the same correctness as at 60 BPM.

---

### User Story 3 - Robustness Under Imperfect and Complex Performances (Priority: P3)

Real performances are not metronomic: attacks land slightly early or late, notes are held longer or shorter than the beat, deliberate rests introduce silence, chords sound simultaneous pitches, and notes are sometimes held across a measure boundary. Free mode must keep the measure grid truthful in all these cases: quantize attacks to the nearest grid position within a tolerance, produce rests only for genuine silence of a full beat or more, keep every measure complete, and carry notes honestly across bar lines.

**Why this priority**: This is the user's stated next step — "then test in more complex performances." It converts the correct-behaviour baseline (P1/P2) into a real-world-robust detection path and directly guards against the current failure mode where human timing jitter fractures a beat into spurious eighth notes and a 1/16 rest.

**Independent Test**: Play the eight-quarter-note scenario with deliberately imperfect timing (attacks tens of ms off-grid, holds slightly short/long); then a pattern containing a deliberate one-beat rest; then a pattern with a note held across a measure boundary. Each test must still produce complete measures with musically correct note values and rests only where silence was genuine.

**Acceptance Scenarios**:

1. **Given** eight quarter notes played with small timing imperfections around the beats, **When** the user stops, **Then** the performance is still detected as two complete measures of four quarter notes — attacks are quantized to the nearest beat without altering the count or creating spurious rests.
2. **Given** a performance containing a genuine silence of a full beat or more, **When** the user stops, **Then** a rest of the corresponding note value appears at that position and the surrounding measures remain complete.
3. **Given** a performance where a note is held across a measure boundary, **When** the user stops, **Then** the note is placed in its attack measure with its full duration carried across the bar line, and it is not truncated into spurious smaller values.
4. **Given** a performance where the user stops mid-measure before completing it, **When** the user stops, **Then** the trailing partial measure is preserved and displayed honestly, reflecting the beats actually played.
5. **Given** chords (two or more simultaneous pitches on one beat), **When** the user stops, **Then** the chord counts as a single beat/duration unit and does not split or over-fill the measure.

---

### Edge Cases

- Note attacked between ticks beyond the tolerance: quantized to the nearest grid position; when ambiguous, the earlier beat is chosen so no beat time is invented.
- Playing resumes after a silent pause mid-session: the beat grid re-anchors to the resumed playing so the silence does not create a phantom starting measure or an invented incomplete measure.
- Session stopped exactly on a beat boundary vs. halfway through holding a note: the trailing partial measure reflects the beats actually played and the held note's position.
- Very fast (≥ 240 BPM) and very slow (≤ 30 BPM) tempos: quantization tolerance scales with beat length so slow tempos do not produce jitter fractures and fast tempos do not collapse distinct subdivisions.
- Two attacks landing in the same grid slot (overlapping or re-triggered notes): resolved as a single musical position without double-counting beats.
- Tempo (slider) change mid-session: the beat grid reprojects immediately for subsequently played notes; previously detected notes keep their musical positions.
- Subdivisions played faster than 1/16: shortest values are quantized up to the 1/16 grid; they are never rendered as finer values that could imply sub-1/16 timing the performer may not have intended.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: In a free practice session (fixed 4/4), the system MUST segment the recorded performance into measures by musical beats (time-signature numerator), deriving the beat grid ALWAYS from the recorded note onsets — never from the metronome clock and never from a free-running wall-clock timer. Detection MUST be identical whether the metronome is on or off.
- **FR-002**: When the user plays a note on a beat and holds it until the next beat, the system MUST detect that note as a single quarter note (1/4) — the note's duration MUST NOT be fractured into smaller subdivisions and MUST NOT spill time out of its attacking measure.
- **FR-003**: When the recorded performance covers exactly N beats, the system MUST detect exactly the measures covered by those beats, where every measure except a trailing partial one is COMPLETE — containing exactly the numerator's worth of beats, with detected note durations summing exactly to the full measure length (no missing time, no surplus time).
- **FR-004**: The system MUST quantize note attacks and durations to the musical grid within a tolerance proportional to the beat length; attacks slightly before or after a beat MUST map to the intended beat without changing the note's detected value or measure position.
- **FR-005**: The system MUST generate rests ONLY where genuine musical silence of at least one beat occurs; sub-beat gaps between a note's end and the next attack (legato/staccato breaks) MUST NOT generate rests.
- **FR-006**: A partial measure remaining at the end of a session (user stops without completing it) MUST be preserved as an honest trailing partial measure reflecting the beats actually played; the system MUST NOT auto-fill it with rests.
- **FR-007**: The detected measure structure (measure count, boundaries, note values, rests) MUST be identical across the live staff display, the saved practice record, and replay of the same performance.
- **FR-008**: The detection logic MUST produce correct complete measures at all tempos in the supported range (20–300 BPM) and MUST NOT regress any previously working detection behaviour at normal tempos (60–180 BPM).
- **FR-009**: When a note is held across a measure boundary, the system MUST place the note in its attacking measure with its full duration carried across the bar line, and MUST NOT truncate it into spurious subdivisions that misbalance the surrounding measures.
- **FR-010**: Simultaneous pitches on the same beat (chords) MUST count as a single beat/duration unit in the measure and MUST NOT double the measure's beat count.
- **FR-011**: When the tempo (BPM) is changed during a session, the system MUST recompute the beat grid immediately so subsequently played notes are detected against the new grid while previously detected notes keep their musical positions.
- **FR-012**: When playing resumes after a silent pause, the system MUST re-anchor the beat grid to the resumed playing so the silence does not produce a phantom starting measure or an invented incomplete measure.
- **FR-013**: The system MUST reliably detect note values down to 1/16 (sixteenth) as the finest subdivision; any shorter played duration MUST quantize on the grid to 1/16, and the system MUST NOT emit finer artifact values (e.g., a spurious 1/16 or 1/32) that would misrepresent the player's intent.

### Key Entities *(include if feature involves data)*

- **Free Practice Session**: Score-less practice session (Feature 092) with a fixed 4/4 time signature, adjustable tempo, and a recorded list of performance events (pitch, attack time, hold duration).
- **Beat Grid**: The musical time reference derived from the time signature and tempo; measure boundaries and note positions are expressed as beats. It MUST ALWAYS be reconstructed from the recorded note onsets — the metronome clock and wall-clock timers are never sources for it.
- **Measure**: A segment bounded by the time-signature numerator (4 beats in 4/4). A measure is COMPLETE when its detected content sums exactly to the numerator; otherwise it is a trailing PARTIAL measure.
- **Detected Note**: A recorded note assigned a musical position (beat) and a detected duration value (e.g., 1/4, 1/8); the unit of measure accounting.
- **Rest**: A detected silence with duration of one beat or more, rendered as a rest symbol; the ONLY mechanism permitted to represent time between played notes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In the target scenario (4/4; eight quarter notes played on-tick and held until each next tick), the system detects exactly two complete measures, each with exactly four quarter notes — 8 detected notes, 0 sub-beat subdivisions, 0 spurious rests, and each measure's durations summing to exactly 4 beats — in 100% of runs.
- **SC-002**: 100% measure-completeness for beat-aligned input: any performance whose total spans a whole number of measures is detected with every measure complete (durations summing exactly to the measure length), with no missing or surplus time.
- **SC-003**: Zero spurious rests: no rest (including fractional rests such as a 1/16 rest) is produced for continuous legato input where every gap is shorter than a full beat; rests appear only for genuine silence of a full beat or more.
- **SC-004**: Detection correctness is maintained across the full supported tempo range (20–300 BPM); measure completion and note-value detection are invariant to tempo choice, with zero regressions at 60–180 BPM.
- **SC-005**: The staff display, saved practice, and replay for the same performance always agree — same measure count, measure boundaries, note values, and rests — in 100% of tests.
- **SC-006**: The eight-quarter-note scenario still produces two complete measures of four quarter notes under realistic human timing (attacks up to roughly ±6% of a beat off-grid, normal holds) in 100% of runs. *Note (Issue #7): ±25%-of-beat drift is intentionally no longer claimed — at that spread the quarter-note gaps (0.6–1.4 beats) are indistinguishable from an eighth-note run (0.5 beat), so no positional detector can classify the values reliably.*
- **SC-007**: Detection is metronome-agnostic: the same performance recorded with the metronome on and with it off yields identical measure structure, note values, and rests in 100% of runs — the metronome is never a source of timing.
- **SC-008**: The detector reliably resolves note values down to 1/16 (sixteenth) without artifact: a run of sixteenth notes is detected as sixteenths, and no detected value is finer than 1/16 in 100% of tests.

## Assumptions

- Free-practice sessions always use a fixed 4/4 time signature (Feature 092); the measure numerator is 4 for this feature. User-configurable time signatures are out of scope.
- "Black note" equals a quarter note; in 4/4 each metronome tick equals one quarter-note beat. This feature considers 4/4 only.
- The musical beat grid is ALWAYS reconstructed from the recorded note onsets — onsets define the beat positions. The metronome clock and any wall-clock timer play no role in detection; this is why a wall-clock-derived measure clock is the wrong anchor. Detection is metronome-agnostic: identical whether the metronome is on or off.
- Timing tolerance is proportional to beat length, targeted at roughly ±25% of a beat for hold-splitting decisions. Exact values are calibrated in tests (Test-First Development, Constitution Principle V) and documented in the plan before implementation.
- The finest note value the detector must reliably detect is 1/16 (sixteenth). Only quarters, eighths, and sixteenths require artifact-free detection; shorter played durations quantize to 1/16.
- The reported mis-detection is a defect (Constitution Principle VII): it MUST be reproduced by a failing regression test BEFORE the fix, and that test MUST permanently remain in the suite.
- Detection correctness is judged on: complete measures, correct note-value assignment, rests only for genuine silence, and consistency across display/save/replay.

## Known Issues & Regression Tests *(if applicable)*

### Issue #1: Free Mode Fractures Beat-Aligned Quarter Notes into Subdivisions and a Spurious Rest

**Discovered**: 2026-08-30 during manual testing of free practice in the Practice plugin.

**Symptom**:
- Musical input: 4/4 free practice; eight quarter notes, each attacked on a metronome tick and held until the next tick (each note is one beat).
- Expected: two complete measures, each with four quarter notes (8 notes, no rests).
- Actual (measure 1): five detected notes — 1/4, 1/8, 1/8, 1/8, 1/4. The detected time does not sum to 4 beats; an eighth's worth of time is missing, so the measure is not complete.
- Actual (measure 2): three detected notes — 1/4, 1/8, 1/8 — followed by a phantom 1/16 rest. The measure is not complete (time missing) and a spurious sub-beat rest appears despite continuous playing.

**Root Cause** (hypothesis to be confirmed in plan/research): measure boundaries and note positions are computed from a free-running wall-clock interval anchored at the first attack and quantized per measure with rounding; the resulting grid does not align with the user's musical beat positions, so beat-aligned quarter notes land off-grid and get cut into subdivisions, missing time, and producing phantom rests.

**Affected Components**:
- Free-practice measure-clock and quantization path (free-practice recording hook and helpers).
- Free-practice staff display (StaffViewer conversion: note/rest decomposition, rest-gap handling, measure-boundary gap filling).

**Regression Test**: `frontend/plugins/practice-view-plugin/freePractice.helpers.test.ts` — "produces exactly two complete measures of four quarters, zero rests, sums of 16" (SC-001). Written RED before the fix; remains in the suite permanently (Constitution Principles V & VII).

**Resolution**: Replaced the wall-clock per-measure quantization (`finalizeMeasureNotes`) with onset-derived measure detection (`detectMeasures` in `frontend/plugins/practice-view-plugin/freePractice.helpers.ts`). The beat grid is reconstructed from note onsets (first onset anchors measure 1); note values are inferred from held duration vs. next onset; rests only for genuine ≥1-beat silence; live staff / saved record / replay share the same derived view. `useFreePractice.ts` no longer runs a wall-clock measure clock. Status: **RESOLVED** (2026-08-30).

**Lessons Learned**: Wall-clock-derived measure clocks are not a reliable anchor for musical measure boundaries when the user is following a metronome; the beat grid must be derived from musical positions. Fractional rests are a symptom of an unaligned grid, not a genuine performance feature. Raw-onset-plus-derived-measures storage keeps one source of truth for display, save, and replay.

---

### Issue #2: Free Practice Measure Detection Fails at Non-Default Metronome BPMs (Double-Applied Tempo Multiplier)

**Discovered**: 2026-08-30 during manual testing of free practice with the Focus exercise at 30 BPM.

**Symptom**:
- Musical input: 4/4 free practice; tempo slider set to 30 BPM; eight quarter notes played on the metronome ticks and held until each next tick.
- Expected: two complete measures, each with four quarter notes (identical to the 120-BPM result).
- Actual: detection produces a single incomplete measure where all eight notes are detected as 1/16 subdivisions — no complete measures.

**Root Cause**: A Feature 093 bookkeeping interaction, not a detection-algorithm failure (the algorithm is tempo-invariant). The metronome reports the **effective** BPM (scoreTempo × multiplier). When the user changes the tempo slider to readout 30 at default 120 base (multiplier 0.25), the metronome follows and reports 30. Pressing ▶ (start) then re-seeded: `seedFreeTempo(30, preserveMultiplier=true)` treated 30 as the *nominal base* and re-applied the multiplier — `computeEffectiveBpm(30, 0.25) = round(7.5) = 8 → floored to ABSOLUTE_BPM_FLOOR (10)`. Detection then used a 6000-ms beat while the user played 2000-ms (30-BPM) notes, collapsing all eight into 1/16 fragments in one measure. Verified numerically (10-BPM grid + 2000-ms onsets → `M0 complete=false notes=1/16×8`).

**Affected Components**:
- Free-practice session-start tempo seeding (`seedFreeTempo`, `handleFreeToggle` start branch in `useFreePractice.ts`).

**Regression Test**: `frontend/plugins/practice-view-plugin/useFreePractice.test.ts` — `T-NEW-1` (metronome 30 at multiplier 0.25 → effective stays 30, record 30), `T-NEW-2` (multiplier 1.5 → effective 180), `T-NEW-3` (metronome off → slider effective preserved). Written RED (T-NEW-1 got 10, T-NEW-2 got 270) before the fix; remain in the suite permanently.

**Resolution**: `seedFreeTempo` now recovers the nominal base when preserving the multiplier for an effective source (`nominal = source / multiplier`, e.g. 30 ÷ 0.25 = 120 → effective 30). `handleFreeToggle` start re-seeds from the metronome only when it is actually running (`bpm > 0`); when off, the existing `base × multiplier` is preserved. Status: **RESOLVED** (2026-08-30).

**Lessons Learned**: Whenever a stored/reported BPM already includes a multiplier, treating it as a nominal tempo and re-applying the multiplier double-scales the effective tempo. Any "effective" BPM source (metronome, readout, persisted record) must be divided by the multiplier before it can serve as a base.

---

### Issue #3: Free Repractice Desyncs the Readout from the Metronome Tempo

**Discovered**: 2026-08-30 during manual testing of free practice (tempo set to 30, then Repractice).

**Symptom**:
- Precondition: 4/4 free practice at 30 BPM (slider multiplier 0.25 of base 120), session stopped, results overlay showing.
- Pressing the Repractice button starts the new session at **120 BPM** while the tempo readout still shows **30**.

**Root Cause**: Two compounding resets on free Repractice:
1. The orchestrator's `handleRepractice` free branch called `context.scorePlayer.setTempoMultiplier(1.0)`, which set the scorePlayer effective tempo back to `scoreTempo (120) × 1.0 = 120` and the metronome (which follows scorePlayer) started ticking at 120.
2. `handleFreeRepractice` re-derived the tempo from the (stale/effective) metronome BPM while resetting the multiplier to 1.0, producing a free effective tempo of 30 while the metronome clicked at 120 — the label said 30 but the actual beat (and thus detection) ran at 120.

**Affected Components**:
- Free-practice Repractice tempo handling (`handleRepractice` in `PracticeViewPlugin.tsx`, `handleFreeRepractice` in `useFreePractice.ts`).

**Regression Test**:
- `frontend/plugins/practice-view-plugin/useFreePractice.test.ts` — `T-NEW-4`: a session finished at effective 30 then Repracticed keeps `freeEffectiveBpm === 30` (not a 120 fallback) and persists `record.bpm === 30` after the next stop. Written RED (got 120) before the fix.
- `frontend/plugins/practice-view-plugin/PracticeViewPlugin.test.tsx` — `T-NEW-5`: after free start→stop at readout 30, clicking Repractice keeps the readout at 30 and does NOT call `scorePlayer.setTempoMultiplier`. Written RED (readout returned 120) before the fix.

**Resolution**: Repractice now continues at the tempo the user just practiced at:
- `handleFreeRepractice` no longer re-seeds tempo from the metronome and no longer resets the multiplier — the `base × multiplier` effective tempo is preserved.
- The orchestrator's `handleRepractice` free branch no longer resets `scorePlayer.setTempoMultiplier(1.0)`, so the metronome stays in agreement with the free readout and detection grid. Status: **RESOLVED** (2026-08-30).

**Lessons Learned**: A "redo" action (Repractice) must keep the same tempo context as the finished session; resetting any of the three tempo representations in the system — the free effective readout, the multiplier/slider, or the scorePlayer-driven metronome — in isolation desyncs the user's perception (audible metronome) from the engine's measurements (onset grid). All tempo outputs must be updated together or not at all.

---

### Issue #4: Exit + Re-enter Free Practice Desyncs the Readout from the Metronome (Nominal-Base Capture Bug)

**Discovered**: 2026-08-30 during manual testing of free practice (tempo set to 30, Back out, then re-enter free mode).

**Symptom**:
- Precondition: free practice at 30 BPM (slider multiplier 0.25) with the metronome running at 30.
- Exiting the free-practice view (Back) and returning (Free Practice again) shows the readout **30** while the metronome audibly plays at **120**.

**Root Cause**: A structural inconsistency between the free practice "base" and the scorePlayer-driven metronome:
- The metronome is driven by scorePlayer's effective BPM = `scoreTempo (120) × multiplier`. Its reported BPM is therefore an *effective* value.
- Entering free practice seeded the free **base** directly from that (effective) metronome BPM (30) and reset the multiplier to 1.0. On re-entry, `onFreePractice` also force-reset `scorePlayer.setTempoMultiplier(1.0)` (metronome → 120), while `handleFreePractice` seeded the base from the *stale* metronome BPM (30). Result: base 30 → readout 30, but the metronome jumped to 120. Any subsequent slider move also diverged (free `30 × m` vs metronome `120 × m`).

**Resolution (unified tempo model)** — the free nominal base is now ALWAYS `FREE_NOMINAL_BPM = 120`, and every metronome-derived tempo is realized through the **multiplier**:
- `computeFreeBpmMultiplier(metBpm)` → `metBpm / 120` (or `1.0` when inactive), shared between the hook and the orchestrator.
- `handleFreePractice`, `handleFreeToggle` (▶ start), `handleFreeReplay`, and `loadSavedFreePractice` all seed with `seedFreeTempo(FREE_NOMINAL_BPM, multiplier)` — so the effective tempo always equals the audible metronome (e.g. 30 → multiplier 0.25 → effective 30).
- `onFreePractice` (orchestrator) syncs the slider + `scorePlayer.setTempoMultiplier` to the SAME derived multiplier instead of hard-coding 1.0, keeping readout, slider, and metronome in agreement on entry and re-entry.
- Slider moves already propagate `setTempoMultiplier(m)` → free `120 × m` == metronome `120 × m`. Status: **RESOLVED** (2026-08-30).

**Regression Test**:
- `frontend/plugins/practice-view-plugin/useFreePractice.test.ts` — `T-NEW-6`: re-entering free practice with a live metronome at 30 keeps the nominal base `freeStaffBpm === 120` (pre-fix captured base 30), effective 30, and `setFreeTempo(1.5)` → 180 (nominal scaling).
- `frontend/plugins/practice-view-plugin/PracticeViewPlugin.test.tsx` — `T-NEW-7`: entering free practice while the metronome reports 30 calls `scorePlayer.setTempoMultiplier(0.25)` (pre-fix hard-coded 1.0 → metronome 120), with the readout at 30.

**Lessons Learned**: When a subsystem (the metronome) exposes an *effective* tempo that embeds a multiplier, treating that value as a *nominal* base and re-applying the multiplier (or resetting the multiplier independently) breaks every derived output. The robust rule: keep ONE nominal base (the scorePlayer default), represent tempo changes only through the multiplier, and update the readout, slider, and metronome from the same multiplier on every transition.

---

### Issue #5: Free Mode Metronome Does Not Start on First Note and Does Not Stop with the Practice

**Discovered**: 2026-08-30 during manual testing of free practice.

**Symptom**:
- In Free Mode, toggling the metronome on started it **immediately** (standalone), even before any note was played — unlike Score (Partiture) Practice Mode, where the metronome is deferred and starts only when the **first note is played**.
- Once running, the metronome kept ticking when the free practice was **stopped** (and when exiting free mode), so it never stopped with the practice.

**Root Cause**: The metronome lifecycle logic was score-practice-only:
- `handleMetronomeToggle` decided "practice running?" from the score `practiceState.mode`. In free mode `practiceState` is never `waiting/active/holding`, so the toggle fell through to the immediate-start branch.
- The deferred-start handler `onFirstNoteAttack` was wired only into `usePracticeMidi` (score practice), never into the free-practice MIDI path.
- Nothing stopped the metronome when a free session stopped or the free view was exited.

**Affected Components**:
- Free-practice metronome lifecycle (`handleMetronomeToggle`, `stopFreeMetronome`, `onFirstNoteAttack` wiring in `PracticeViewPlugin.tsx`; `onFreeNoteAttackRef` in `useFreePractice.ts`).

**Regression Test**:
- `frontend/plugins/practice-view-plugin/PracticeViewPlugin.test.tsx` — `T-NEW-8`: in free mode, toggling the metronome arms it (no `toggle` call), the first MIDI onset starts it (1 call), and stopping the session stops it (2 calls) and clears the armed state.
- `frontend/plugins/practice-view-plugin/PracticeViewPlugin.test.tsx` — `T-NEW-9`: exiting free practice via Back stops a running metronome (1 call).

**Resolution** (Feature 083 parity):
- `handleMetronomeToggle` is now free-aware: in free mode it **arms** the metronome (deferred) instead of starting it, and a press on an active metronome stops it.
- `useFreePractice` accepts an `onFreeNoteAttackRef` invoked on every MIDI attack during an active session; the orchestrator points it at the existing `onFirstNoteAttack` deferred-start handler, so the metronome begins on the **first played note**.
- New `stopFreeMetronome` un-arms and stops the metronome; it is invoked when the free session is stopped (Start/Stop toggle), when navigating Back, and when dismissing results — so the metronome always stops with the practice.
- Starting a free session while a standalone metronome is already running stops it and re-arms it so it re-aligns to the first played note (mirrors score practice). Status: **RESOLVED** (2026-08-30).

**Lessons Learned**: Any deferred/auto behavior that must mirror across modes (score vs. free) has to be driven from a mode-agnostic signal, not a mode-specific one. The metronome lifecycle is now keyed off the actual recording state each mode owns (score `practiceState.mode` vs. free `freeSessionActive`), reusing the same first-note trigger for both.
---

### Issue #6: Metronome Was Not Re-Used in the Next Free Practice After a Stop

**Discovered**: 2026-08-30 during manual testing of free practice.

**Symptom**:
- The metronome was toggled ON during a free practice and the session was stopped.
- Pressing Repractice started the new practice with the metronome **off**; it had to be toggled on again manually. It should start active (waiting until the first note) because it was on when the previous practice stopped.

**Root Cause**: `stopFreeMetronome` stopped the metronome and cleared the armed flag but did not retain the user's metronome-on intent, and `handleRepractice` (free branch) never re-armed it. The "metronome enabled" state was not persisted across a stop → Repractice cycle.

**Affected Components**:
- Free-practice metronome lifecycle (`handleMetronomeToggle`, `handleRepractice`, `stopFreeMetronome` in `PracticeViewPlugin.tsx`).

**Regression Test**:
- `frontend/plugins/practice-view-plugin/PracticeViewPlugin.test.tsx` — `T-NEW-10`: arm the metronome in a free session, first note starts it, stop the session (metronome stops), click Repractice → the metronome is re-armed (armed button, no immediate toggle), and the first note of the new session starts it again.

**Resolution**:
- New `freeMetronomeEnabledRef` tracks whether the user wants the metronome ON in free practice: set when armed in a free session, cleared when toggled off, and cleared on exiting free practice (Back / results dismiss).
- `stopFreeMetronome` stops the engine and clears the armed flag but **preserves** the enabled intent.
- `handleRepractice` (free branch) re-arms the metronome (`metronomeArmedRef = true`) when `freeMetronomeEnabledRef` is true, so the next practice starts active in waiting mode until the first note. Status: **RESOLVED** (2026-08-30).

**Lessons Learned**: Stopping a timed guide (metronome) must distinguish "turn the engine off because the session ended" from "the user no longer wants it". Persisting the user's intent separately from the live engine state lets a redo action restore the same practice context — matching how score practice keeps its metronome toggle through restarts.

---

### Issue #7: Accurate Eighth-Note Runs Detected as Quarters and "Chords"

**Discovered**: 2026-08-30 during manual playing of the first two measures of La Candeur (Burgmüller) in free mode with the metronome at 60.

**Symptom**:
- Musical input: 4/4 free practice; the melody of La Candeur M1–M2 (eight eighth notes per measure, quarter-note beat); played accurately with the metronome.
- Expected: two complete measures, each with **eight 1/8 notes**.
- Actual: "mostly black notes (1/4), chords of two black notes (should be two consecutive 1/8), and some 1/8" — i.e. consecutive eighth attacks are collapsed onto the same beat position as a two-note chord, and most values come out as quarters.

**Root Cause**: The note-value inference used **time-to-next ratios with a hard 0.5-beat boundary**. Any eighth whose gap (or held length capped by it) edged just above half a beat (`gap > 500ms` at 60 BPM) was classified as a quarter; quarter-valued notes then snapped to the beat grid (`round(rawStep/4)*4`), which collapsed two consecutive eighths onto the same beat position — producing the "chords of two black notes". Reproduced numerically: a realistic ±40ms human-jitter eighth run yielded 7 quarters and stacked same-step notes.

**Affected Components**:
- `detectSegment` note-value inference + position snapping in `frontend/plugins/practice-view-plugin/freePractice.helpers.ts`.

**Regression Test**:
- `frontend/plugins/practice-view-plugin/freePractice.helpers.test.ts` — `T-NEW-11` (two measures of jittered eighths → all 1/8, 8 per measure, no shared grid slots, complete), `T-NEW-12` (eighths held slightly longer than the gap → still all 1/8), `T-NEW-13` (mixed bar quarter+eighths+half → values `1/4,1/8,1/8,half`). SC-006 was re-scoped to realistic ±6% drift (see SC-006 note).

**Resolution**: **Position-based detection** — note values are now derived from grid positions, not time ratios:
- Every onset is snapped to the 16th-step grid (±half a cell ≈ half of a 1/8), and onsets sharing a slot merge into a chord.
- A note's value = the grid-step distance to the next onset, **capped by its held duration** (`min(heldSteps, gapSteps)`). The cap distinguishes "long note" from "note + rest" (both position the next onset identically), so rests are still produced only for genuine ≥1-beat silence.
- No per-note subdivision grid: the 16th grid is the single position graph, so accurate eighths (2 steps apart) and quarters (4 steps) both fall out correctly with no cross-boundary flipping. Status: **RESOLVED** (2026-08-30).

**Lessons Learned**: Onset timing alone is ambiguous between adjacent subdivisions (a ±25%-beat-drifted quarter run is indistinguishable from eighths). The reliable decomposition is: (1) snap positions to the finest grid, (2) derive value from grid gaps, (3) use held duration only as a cap to split "long note" from "note + rest". Time-ratio thresholds are the wrong tool.

---

### Issue #8: Measure-Crossing Eighth Played Slightly Early Renders as Three Notes

**Discovered**: 2026-08-30 during manual playing of La Candeur M1–M2 in free mode.

**Symptom**:
- While the rhythm detection is now largely accurate, occasionally **three notes appear where two eighths should be** — specifically at/or near a measure boundary. Reproduced: the first eighth of the second measure played ~60ms early (just before the barline) rendered as `1/8, 1/16, 1/16` at the end of measure 1 and shifted measure 2's first note.

**Root Cause**: Measure attribution used `Math.floor(rel / measureMs)` — the raw time floor. An onset just before the exact boundary produced `relInM ≈ 15.76` cells, which `Math.round` snapped to 16 and was then **clamped to step 15 of the previous measure**. The final beat got an extra 16th at step 15, the real 8th at step 14 became a 1/16, and the next measure's first note was pushed off-grid.

**Affected Components**:
- `buildOnsetSpots` measure/step attribution in `frontend/plugins/practice-view-plugin/freePractice.helpers.ts`.

**Regression Test**:
- `frontend/plugins/practice-view-plugin/freePractice.helpers.test.ts` — `T-NEW-14`: 16 eighths with the first note of measure 2 played 60ms early → 2 complete measures, exactly 8 notes each, all `1/8`, one note per grid step, no 16th-split artifacts.

**Resolution**: Measure and step are now derived from the **rounded grid cell** (`snappedCell = round(rel/cell); mIdx = floor(snappedCell/16); step = snappedCell − mIdx·16`) instead of the raw time floor. An onset within half a cell of the boundary snaps to the nearer measure's grid position, so an early first-of-next-measure note lands on step 0 of the next measure rather than splitting the previous measure's final beat. Status: **RESOLVED** (2026-08-30).

**Lessons Learned**: Grid-snapping and measure attribution must be a single, consistent operation. Computing the measure from raw time and the step from rounded time produces an inconsistency right at the boundary; the boundary belongs to the nearest *grid*, not the nearest *time*.
