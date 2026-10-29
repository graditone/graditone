# Phase 0 Research: Strict Tempo Mode for Metronome Practice

**Feature**: `101-strict-tempo-mode` | **Date**: 2026-10-28 | **Spec**: [spec.md](./spec.md)

This document resolves the design choices behind the strict tempo mode. The feature is frontend-only; there are no `NEEDS CLARIFICATION` items in the Technical Context.

---

## D1. Where strict evaluation lives

**Decision**: Put the timing math in a new pure module, `frontend/plugins/practice-view-plugin/strictTempo.ts`, and the session state in the existing pure practice reducer (`practiceEngine.ts`). The MIDI hook supplies onset/expected/hold times it already computes; the UI only reflects state.

**Rationale**:
- The practice engine is already the single source of truth for note outcomes, failure counts, hold behavior, and loop transitions. Splitting strict counting into the UI would create two state machines.
- A pure helper is unit-testable without React, fake timers, MIDI, or the metronome.
- The MIDI callback remains a thin dispatcher; no audio/MIDI work is added to the timing evaluation.

**Alternatives considered**:
- *Evaluate in `usePracticeMidi`*: rejected because hold completion and early release are completed in the reducer, not in the MIDI hook, and the hook does not know the full result history.
- *Evaluate in `PracticeViewPlugin.tsx` from `noteResults`*: rejected because it duplicates reducer transitions, races with batched state, and is hard to test deterministically.
- *Put it in the shared plugin API*: rejected because the rule is specific to Score Practice and the public API does not need a new timing service.

---

## D2. Absolute tempo grid, not interval-to-interval

**Decision**: Anchor a segment at a grace note with `{ expectedTimeMs, responseTimeMs }`. For every later note in the segment, compute

```text
beatDeltaMs = round((responseTimeMs - anchor.responseTimeMs)
                  - (expectedTimeMs - anchor.expectedTimeMs))
```

and compare `|beatDeltaMs|` with the tolerance. Do **not** update the anchor on a successful note. Re-anchor only at the declared grace points.

**Rationale**:
- The existing `relativeDeltaMs` measures the interval since the previous note. A player who is consistently 200 ms behind the click has near-zero interval deviation, so the old rule can score well while the player is not following the tempo. The feature exists to catch exactly that.
- Keeping the anchor fixed for the whole segment also catches slow cumulative drift; re-anchoring on every accepted note would hide it.
- The first accepted note establishes the segment origin, which cancels a constant input latency as long as it is stable. Input calibration is out of scope.

**Alternatives considered**:
- *Reuse `relativeDeltaMs` with a tighter threshold*: rejected; it cannot detect constant lag or drift.
- *Compare against the score’s absolute tick time without an anchor*: rejected; the first note’s input latency would be counted as an error and the first note would not be a usable grace note.
- *Re-anchor on every in-time note*: rejected; it reintroduces drift tolerance.

---

## D3. Tolerance formula

**Decision**: `windowMs = round(clamp(0.40 × expectedGapMs, 120 ms, 300 ms))`, where `expectedGapMs` is the expected time between the current note and the previous practice note. A note is on the beat when `|beatDeltaMs| <= windowMs`. *(Revised after user testing: the ratio and clamps were doubled from 0.20 / 60–150 ms — the original window made an average performance nearly impossible to play correctly.)*

**Rationale**:
- 40% scales naturally from slow to fast tempos: at 60 BPM a quarter-note gap is 1000 ms → 300 ms (ceiling); at 120 BPM 500 ms → 200 ms; at 240 BPM 250 ms → 120 ms (floor).
- The 60 ms floor is wider than the metronome’s documented ≤50 ms timing error (feature 085), avoiding false stops from the click itself.
- The 150 ms ceiling avoids an unrealistically loose window at very slow tempos.
- Inclusive comparison matches the legacy `> 500 ms` late rule (boundary is on time).

**Alternatives considered**:
- *Fixed ±120 ms*: rejected; too loose at fast tempos, too strict at slow tempos.
- *Percentage of the beat rather than the gap*: rejected; rests and long notes would make the window unrelated to the note the player must catch.
- *Per-note configured tolerance*: rejected; no settings surface and no user request for configurability in this feature.

---

## D4. Grace-note policy

**Decision**: A note is a grace note — it sets the segment anchor and is not judged — in these cases:
1. The first accepted note of a session.
2. The first accepted note after mid-session metronome activation.
3. The first note whose onset occurs after a tempo change. If a sustained note is in progress when the tempo changes, that note is judged on the grid it started on and the following note is the grace note.
4. The first accepted note of each loop iteration.
5. A retry after an early release (same note).
6. The first accepted note after a seek.

A grace note does not change the consecutive-failure count. A successful retry after an early release also does not reset the count; only a later in-time judged note does.

**Rationale**:
- The user cannot be expected to hit a grid that was just interrupted by a tempo change, loop restart, seek, or metronome toggle.
- The early-release retry is necessarily later than the original expected onset; judging it would create a cascading false failure. The early release itself is already the failure.
- Not resetting the count on a grace note keeps “three in a row” honest: the player has not yet demonstrated an in-time judged note.

**Alternatives considered**:
- *Judge the first note after every boundary*: rejected; produces unavoidable failures and feels punitive.
- *Reset the count on every grace note*: rejected; the player could escape a two-failure streak by changing tempo or looping.
- *Treat the in-progress hold as the tempo-change grace note*: rejected; its onset predates the change and its expected time was computed on the old grid, so the next note would be judged against a scaled grid and could fail spuriously.

---

## D5. Failure semantics

**Decision**:
- Each note attempt contributes at most one failure.
- An off-beat onset is a failure. An early release is a failure. If both occur on the same attempt, the result is one early-release failure (the onset delta is still recorded for the table).
- A wrong pitch never increments or resets the count; it continues to behave as today.
- An `auto-advanced`/skipped result is not a user attempt: it does not change the count or the anchor.
- A judged note within the window resets the count to zero.
- A grace note leaves the count unchanged.
- Three consecutive failures stop the session immediately after the failing note.
- The failure count is session-only and is cleared on `STOP`, `START`, `STRICT_ENABLE`, and `STRICT_DISABLE`.

**Rationale**:
- The user explicitly chose “only timing errors” and “three in a row.”
- Counting wrong pitches would mix pitch accuracy with tempo accuracy and violate the chosen rule.
- A single attempt producing two failures would make the count depend on how many problems one note had; one attempt, one failure is predictable.

**Alternatives considered**:
- *Count wrong pitches*: rejected by the user decision.
- *Three total failures, non-consecutive*: rejected by the user decision.
- *Count early release as a separate failure in addition to an off-beat onset*: rejected; one attempt, one failure.

---

## D6. Stop semantics and final-note precedence

**Decision**: Add `mode: 'tempo-stopped'` to the practice engine. It means “the third failure has been recorded; the orchestrator must stop the session and present results.” The reducer does not perform side effects. A once-guarded `PracticeViewPlugin` effect observes this mode and:
- captures a `PartialPerformanceRecord` with `stopReason: 'tempo'` (or a complete `PerformanceRecord` if this was an accepted final note of the final iteration);
- shows the results overlay;
- dispatches `STOP`;
- calls `lifecycle.onSessionEnd()` so the metronome stops and re-arms if enabled;
- stops the score player and seeks to the loop start.

An accepted final note with the third failure produces complete results (FR-020); an early release on the final note that is the third failure produces tempo-stop partial results because the practice did not complete.

**Rationale**:
- The reducer stays pure and testable; side effects live in the orchestrator, consistent with `usePracticeLoop` and `handleStop`.
- `tempo-stopped` prevents `usePracticeLoop` from auto-restarting a loop on a third failure at a loop boundary.
- A dedicated mode avoids overloading `complete`, which means “the segment/practice completed normally” and triggers the loop hook.

**Alternatives considered**:
- *Set `complete` and infer the stop from the count*: rejected; the loop hook would restart the loop before the stop effect could intervene.
- *Perform side effects inside the reducer*: rejected; violates the pure-engine principle.
- *Show complete results on every third failure*: rejected by FR-020; a failed note before the end is not a completion.
- *Show partial results on a third failure on the final accepted note*: rejected; the practice did reach the end; the note is marked off-beat and the complete results still show the score impact.

---

## D7. Scoring and data compatibility

**Decision**:
- Keep the `NoteOutcome` union unchanged. Add optional `strictFailure?: boolean` and `beatDeltaMs?: number` to `PracticeNoteResult`.
- In strict mode, a strict onset failure is stored with `outcome: 'correct-late'` and `strictFailure: true` (even if the legacy relative delta is below 500 ms). An early-release failure is stored with `outcome: 'early-release'` and `strictFailure: true`. A grace or in-time strict note is `correct`, even if the legacy relative delta is large.
- `computePracticeScore` adds `strictFailureCount`. Results with `strictFailure` earn zero credit; legacy `correct-late` / `early-release` without the flag keep their existing 0.5 credit.
- Add optional `stopReason?: 'manual' | 'tempo'` to `PartialPerformanceRecord` and `SavedPerformanceData`.
- No new IndexedDB store, key, or migration. Old saved practices lack the new fields and behave exactly as before.

**Rationale**:
- Adding a new outcome value would widen a type exported through `SavedPerformanceData`, potentially breaking external consumers that switch exhaustively. Optional fields are additive and backward compatible.
- The score must not give half credit for a note that just caused a strict stop; otherwise the results contradict the stop.
- The partial record needs the reason so a saved/reopened tempo stop still explains itself. A manual partial keeps the existing badge.

**Alternatives considered**:
- *New `'off-beat'` outcome*: semantically clean, but a wider public type change; rejected to keep the plugin data contract additive.
- *Reset earlier strict failures to half credit when the metronome is turned off*: rejected; the notes were recorded under strict evaluation, and the spec says they remain errors. Turning the metronome off stops future strict counting, not history.
- *Store the failure count in saved data*: rejected; it is derivable from the last three `strictFailure` results and is session-only.

---

## D8. UI surfaces

**Decision**:
- **Toolbar**: a compact `♩ Strict tempo` badge next to the practice progress, only when strict mode is active and not Free Practice. The visible label is static; the failure count (0/1/2) is conveyed by the none/warn/danger level classes, `data-failures`, and the `aria-label`/`title`. `aria-live="polite"`.
- **Live feedback**: reuse `TimingFeedbackOverlay`. In strict mode, show `beatDeltaMs` for onset failures (even below 500 ms) and the early-release shortfall (`-(requiredHoldMs - holdDurationMs)`) for early releases.
- **Results overlay**: extract the timing table and delay chart into `PracticeTimingDetails`, reused by complete and partial overlays. A tempo-stop partial shows a banner (“Tempo not followed — stopped after 3 consecutive misses”) with the three failing notes and their signed errors, plus the table/chart and Repractice/Save/Session actions. A conditional “Tempo fails” stat appears in both complete and partial overlays. Strict failure rows and chart dots are visually marked.
- **Overlay precedence**: an active partial record wins over a stale complete record, so a tempo stop always presents the partial/tempo reason. The tempo-stop effect also clears the stale complete record.
- **Localization**: new English and Spanish keys; the existing parity test must pass.

**Rationale**:
- The badge makes the stricter rule predictable before the stop.
- The live overlay is the immediate learning signal; the results banner and details are the post-stop explanation the user asked for.
- The partial overlay currently lacks the table/chart and action row; the feature requires both for tempo stops.
- Extracting the details avoids a second, divergent implementation of the chart/table.

**Alternatives considered**:
- *Only show the reason in the results, no live indicator*: rejected; the user would not know strict mode is active until the stop.
- *A separate settings toggle*: rejected by the user decision that the metronome activates the mode.
- *Reuse the complete overlay for tempo stops*: rejected; the complete overlay implies a finished performance and has no tempo-stop banner or Repractice action in the existing partial design.
- *Add a second chart implementation for partial results*: rejected; duplication and drift risk.

---

## D9. Testing strategy

**Decision**:
1. **Pure helper** (`strictTempo.test.ts`): window floor/ratio/ceiling, signed deltas, grace, inclusive boundary, zero/negative gaps, rounding, constant lag.
2. **Reducer** (`practiceEngine.test.ts`): START strict flag, grace anchor, in-time reset, consecutive failures, stop at 3, wrong-pitch neutrality, early release, retry grace, tempo re-anchor (including during hold), loop/seek re-anchor, mid-session enable/disable, final-note behavior, legacy 500 ms regression.
3. **Scoring** (`computePracticeScore.test.ts`): strict failures zero credit, legacy half credit preserved, mixed results, `strictFailureCount`, empty input.
4. **Details component** (`PracticeTimingDetails.test.tsx`): table rows, status/delta for strict onset and early release, failing-row mark, chart points/dots, grace row.
5. **Results overlay** (`ResultsOverlay.test.tsx`): tempo banner, three failing notes, table/chart present, “Tempo fails” stat, Repractice/Save actions, partial-over-stale-complete precedence, existing late/early tests.
6. **Toolbar** (`practiceToolbar.test.tsx`): badge visibility, count, warning levels, no badge in Free Practice.
7. **Orchestrator** (`PracticeViewPlugin.test.tsx`): behavioral metronome mock + `vi.setSystemTime`; start armed, 3 failures, 2+1 reset, wrong pitch, early release, mid-session on/off, tempo change, loop boundary, final note, Repractice, Free Practice, metronome-off regression.

**Rationale**: The split matches the existing test layout and the constitution’s test-first/regression requirements. Deterministic wall-clock control is already used by the plugin tests (features 096/100), so no new test infrastructure is needed.

**Alternatives considered**:
- *End-to-end Playwright only*: rejected; timing determinism and failure-path coverage are better in unit/integration tests. Playwright remains a smoke check if the suite is available.
- *Snapshot tests for the overlay*: rejected; behavior-focused queries are already the project style and survive styling changes.

---

## D10. Explicit non-goals

- No automatic failure for silence/missed attacks. The spec’s “metronome armed, no note played” edge case says the session waits; strict mode reacts to detected attempts. The early-release path covers short holds that are detected.
- No input latency calibration.
- No user-configurable window, failure limit, or strict toggle.
- No changes to the metronome engine, its timing accuracy, or the 500 ms legacy threshold.
- No re-evaluation of historical saved results under the new strict rules.
- No backend, WASM, or plugin API version change.
