# Implementation Plan: Strict Tempo Mode for Metronome Practice

**Branch**: `101-strict-tempo-mode` | **Date**: 2026-10-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/101-strict-tempo-mode/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add session-scoped strict tempo evaluation to Score Practice whenever the metronome is enabled. A pure strict-tempo helper evaluates every accepted note against an absolute tempo grid anchored at the first accepted note (and re-anchored at documented grace points). Each note is judged against a tempo-relative window: 40% of the expected gap to the previous practice note, clamped to 120–300 ms. Three consecutive timing failures — including early releases — stop the session immediately, stop/re-arm the metronome, and open the Practice Results window. The results explain the tempo stop, list the three failing notes with signed timing errors, expose the per-note timing table and delay chart for partial results, and score strict failures as errors. Free Practice and metronome-off Score Practice are unchanged. The work is frontend-only, adds no runtime dependencies, and is implemented test-first.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), React 19  
**Primary Dependencies**: React 19, Vite 7, Vitest 4, `@testing-library/react` 16, happy-dom, Tone.js 14 (existing metronome), Web MIDI API; existing Rust/WASM score engine unchanged  
**Storage**: Existing IndexedDB/localStorage saved-practice service; additive optional fields only (`stopReason`, `beatDeltaMs`, `strictFailure`); no new keys, stores, or migrations  
**Testing**: Vitest + React Testing Library + happy-dom; fake timers and `vi.setSystemTime` for deterministic onset timing; Playwright smoke coverage where already present  
**Target Platform**: PWA tablet (iPad/Surface/Android tablets) with modern browsers; offline-capable  
**Project Type**: Web frontend (`frontend/`); the Rust/WASM backend is not touched  
**Performance Goals**: O(1) strict evaluation per note; no perceptible input latency added to the MIDI callback; live practice remains 60 fps; results rendering remains responsive for sessions with thousands of results  
**Constraints**: No new runtime dependencies; no change to metronome timing accuracy (feature 085) or the 500 ms legacy threshold when strict mode is off; strict mode is Score Practice only; no score-layout changes; state is session-only and not persisted across sessions  
**Scale/Scope**: Practice sessions up to thousands of notes; strict state is a small fixed-size addition; results table/chart already handle full-session result sets

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence / plan |
|-----------|--------|-----------------|
| I. Domain-Driven Design | PASS | New domain concepts are named consistently — Strict Tempo Session, Tempo Grid, Tempo Failure, grace note — and modelled in the pure practice engine. No UI or framework concepts leak into the timing rules. |
| II. Hexagonal Architecture | PASS | The strict-tempo helper and reducer are pure TypeScript with no framework, storage, or audio dependencies. The metronome and score remain behind the existing plugin context adapters. No backend change. |
| III. Progressive Web Application Architecture | PASS | Entirely client-side, offline-capable, and uses the existing bundler and metronome. No new network or dependency. |
| IV. Precision & Fidelity | PASS | Score timing remains 960 PPQ and integer-based. Strict evaluation uses the existing performance-clock `responseTimeMs` / `expectedTimeMs` values in milliseconds; `beatDeltaMs` is rounded to an integer for display/storage. No floating-point score timing is introduced. |
| V. Test-First Development | PASS | New pure helper, reducer transitions, scoring, overlay, toolbar, and orchestrator behavior are written as failing tests first. Test files are listed in Project Structure and Phase A–D. |
| VI. Layout Engine Authority | PASS | No score geometry is calculated in the frontend. The results delay chart is a data visualization of timing values, not a layout engine, and it does not derive score coordinates. |
| VII. Regression Prevention | PASS | Regression tests cover metronome-off Score Practice (500 ms classification, no stop), Free Practice with the metronome on, manual stop with 1–2 failures, loop boundaries, Repractice, and the two reported failure modes (slow-tempo short notes; fast-tempo late notes accepted). |
| VIII. User Profile Awareness | PASS | No new user-specific storage, settings, or localStorage key. Saved-practice additions are optional fields in the existing profile-scoped store. The profile icon remains in the toolbar. |

**Post-design re-check (Phase 1)**: All gates still pass. The design adds no dependencies, no new storage scope, no score layout logic, and no backend work. The `Complexity Tracking` table is therefore not required.

## Project Structure

### Documentation (this feature)

```text
specs/101-strict-tempo-mode/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── strict-tempo-engine-contract.md
│   ├── practice-data-contract.md
│   └── ui-contract.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created here)
```

### Source Code (repository root)

```text
frontend/
├── plugins/practice-view-plugin/
│   ├── strictTempo.ts                    # NEW: pure window/delta/grace evaluation
│   ├── strictTempo.test.ts               # NEW: unit tests for the helper
│   ├── practiceEngine.types.ts           # Strict state fields, optional result fields, actions
│   ├── practiceEngine.ts                 # Strict transitions, stop mode, anchor lifecycle
│   ├── practiceEngine.test.ts            # Reducer tests (strict + regression)
│   ├── PracticeViewPlugin.tsx            # START flag, metronome strict actions, tempo re-anchor, tempo-stop effect
│   ├── PracticeViewPlugin.test.tsx       # Orchestrator/integration tests
│   ├── practiceToolbar.tsx               # Strict indicator badge
│   ├── practiceToolbar.test.tsx          # Indicator rendering tests
│   ├── ResultsOverlay.tsx                # Tempo banner, strict stats, partial details/actions
│   ├── ResultsOverlay.test.tsx           # Results overlay tests
│   ├── PracticeTimingDetails.tsx          # NEW: extracted table + chart, shared by complete/partial
│   ├── PracticeTimingDetails.test.tsx     # NEW: table/chart/strict marking tests
│   ├── PracticeViewPlugin.css            # Badge, banner, strict row, stats wrap
│   ├── useSavedPracticeManager.ts        # Save partial stopReason
│   ├── ARCHITECTURE.md                   # Document the strict state and stop path
│   └── usePracticeMidi.ts                # Unchanged; already supplies response/expected/hold times
├── src/plugin-api/
│   ├── computePracticeScore.ts           # strictFailureCount + zero-credit strict failures
│   └── computePracticeScore.test.ts      # Scoring tests
├── src/services/
│   └── savedPractice.types.ts            # Optional stopReason in SavedPerformanceData
├── src/i18n/locales/
│   ├── en.json                           # New keys
│   ├── es.json                           # New keys (parity test)
└── ...

FEATURES.md                               # Add the user-facing feature bullet after implementation
```

**Structure Decision**: The strict-tempo rules belong beside the existing pure practice engine, not in the MIDI hook or UI. `strictTempo.ts` owns the timing math; `practiceEngine.ts` owns the session state machine; `PracticeViewPlugin.tsx` only wires side effects (metronome, score player, results). The results table/chart are extracted from `ResultsOverlay.tsx` so complete and partial results share one tested implementation. Saved-practice changes are additive optional fields in the existing service.

## Implementation Phases

### Phase A — Pure strict-tempo evaluation (tests first)

1. Create `strictTempo.ts` with exported constants (`STRICT_WINDOW_RATIO = 0.2`, `STRICT_WINDOW_MIN_MS = 60`, `STRICT_WINDOW_MAX_MS = 150`, `STRICT_FAILURE_LIMIT = 3`), `computeStrictWindowMs(expectedGapMs)`, and `evaluateStrictOnset({ anchor, responseTimeMs, expectedTimeMs, expectedGapMs })`.
2. Written first: `strictTempo.test.ts` covering window floor/ratio/ceiling, signed deltas, grace behavior, inclusive boundary, negative/zero gaps, rounding, and the constant-lag case.
3. Define `StrictAnchor` in `strictTempo.ts` and import it type-only into `practiceEngine.types.ts`, keeping the pure helper self-contained and avoiding a runtime cycle.

### Phase B — Practice engine state and reducer

1. Extend `PracticeState` with `strictMode`, `strictFailureCount`, `strictAnchor`, and `strictReanchorPending`; extend `INITIAL_PRACTICE_STATE`, `STOP`, and `START` (optional `strictTempo`).
2. Add actions `STRICT_ENABLE`, `STRICT_DISABLE`, and `REANCHOR`; keep `NoteOutcome` unchanged.
3. Extend `PracticeNoteResult` with optional `beatDeltaMs` and `strictFailure` (additive, serializable).
4. Add a `tempo-stopped` mode. Set it when the failure count reaches three, whether the failing note is an accepted note or an early release. The orchestrator decides complete-vs-partial presentation.
5. Integrate strict evaluation into `CORRECT_MIDI`, `HOLD_COMPLETE`, and `EARLY_RELEASE`; implement grace anchoring, early-release retry grace, count reset on in-time notes, wrong-pitch no-op, tempo-change re-anchor (including during a hold), loop and seek re-anchor, and final-note state.
6. Written first: reducer tests for every transition and the regression cases in `practiceEngine.test.ts`.

### Phase C — Orchestrator wiring

1. `PracticeViewPlugin.tsx`: pass `strictTempo` to `START` from `metronomeStateRef.current.active || armed`; dispatch `STRICT_ENABLE` / `STRICT_DISABLE` on a metronome toggle during a running score practice (skip Free Practice); dispatch `REANCHOR` on a tempo change when strict mode is active.
2. Add a once-guarded effect for `practiceState.mode === 'tempo-stopped'`: capture the record, determine whether this is the accepted final note of the final iteration, set a complete `PerformanceRecord` (and clear any partial) or a `PartialPerformanceRecord` with `stopReason: 'tempo'` (and clear any stale complete record), show the results overlay, dispatch `STOP`, call `lifecycle.onSessionEnd()`, stop the score player, and seek to the loop start.
3. Pass `strictTempoActive` and `strictFailureCount` to the toolbar; pass the partial `stopReason` into the overlay.
4. Written first: integration tests in `PracticeViewPlugin.test.tsx` using the behavioral metronome mock and `vi.setSystemTime` (start armed, 3 failures, reset, wrong pitch, early release, mid-session on/off, tempo change, loop, free practice, metronome-off regression).

### Phase D — Results, scoring, and persistence

1. `computePracticeScore.ts`: add `strictFailureCount`; count results with `strictFailure` as zero credit; keep 0.5 credit for legacy `correct-late` / `early-release` without the flag. Add tests first.
2. `PracticeTimingDetails.tsx`: extract the existing table and chart from `ResultsOverlay.tsx`; use `beatDeltaMs ?? relativeDeltaMs` for the displayed timing value, mark `strictFailure` rows/dots, and render both details sections in complete and partial overlays.
3. `ResultsOverlay.tsx`: add the tempo-stop banner with the three failing notes and their signed onset delays or early-release amounts; add a conditional “Tempo fails” stat; add Repractice/Save/Session actions to tempo-stop partials; make the complete overlay win only when no partial record is active.
4. `savedPractice.types.ts` + `useSavedPracticeManager.ts` + the load path: carry `stopReason` through save/load; old records without it default to manual/unknown.
5. Written first: `ResultsOverlay.test.tsx`, `PracticeTimingDetails.test.tsx`, `computePracticeScore.test.ts`, and a save/load regression where the existing test infrastructure permits.

### Phase E — Localization, styling, documentation

1. Add English and Spanish keys: strict toolbar badge, tempo-stop title/hint, “Tempo fails”, failure item, and released-early amount. The `locales.test.ts` parity check must pass.
2. Add CSS for the strict badge (0/1/2 states), tempo-stop banner, strict failure rows, and wrap the stats row.
3. Update `frontend/plugins/practice-view-plugin/ARCHITECTURE.md` (strict state/stop path) and `FEATURES.md` (user-facing bullet) as part of the completion criteria.

### Phase F — Verification

1. Run the focused suites first, then `npm test -- --run`, `npm run typecheck`, and `npm run lint` from `frontend/`.
2. Run the quickstart manual scenarios at slow (≈40 BPM) and fast (≈120 BPM) tempos.
3. Confirm no new dependencies, no backend diff, and no new profile-scoped storage keys.

## Risks and Mitigations

- **False stops from metronome/input jitter**: the 60 ms floor is wider than the metronome’s documented ≤50 ms error (feature 085). The window uses the expected gap and is tested at slow and fast tempos. The grace-note policy prevents boundary artifacts at tempo changes, loops, seeks, and mid-session activation.
- **Constant lag passing strict mode**: the grid is anchored at the grace note and is not re-anchored on every accepted note; the delta is absolute from the segment origin. The constant-lag regression test is explicit.
- **Early-release retry compounding failures**: the retry is a grace note for onset timing, so the same note cannot fail twice for being late on the retry. The early release itself remains the single failure.
- **Tempo change during a sustained note**: the in-progress hold is judged on the grid it started on; the next onset is the grace note. `strictReanchorPending` prevents a scaled-grid false failure.
- **Loop-boundary ambiguity**: the engine signals `tempo-stopped` on the third failure even at a loop end; the orchestrator stops the loop instead of restarting it. An accepted final note of the final iteration still produces complete results.
- **Stale complete record masking a tempo stop**: the overlay prioritizes an active partial record and the tempo-stop effect clears the stale complete record.
- **Public data compatibility**: no new `NoteOutcome` value is introduced. Additive optional fields preserve old saved practices and external consumers; the sessions plugin receives the same score event with a lower score for strict failures.
- **Missed attacks are not inferred from silence**: consistent with the spec’s “metronome armed, no note played” edge case, strict mode reacts to detected attempts; it does not invent a failure when no input arrives. The early-release path handles short holds that are detected.

## Complexity Tracking

> No constitution violations. No new projects, dependencies, services, or storage scopes are introduced.
