# Tasks: Strict Tempo Mode for Metronome Practice

**Feature Branch**: `101-strict-tempo-mode`
**Input**: Design documents from `/specs/101-strict-tempo-mode/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Included. The project constitution (Principle V) and `plan.md` require test-first development for the pure timing helper, reducer, scoring, results UI, toolbar, and orchestrator behavior. Every test task below is written before the implementation task it covers.

**Organization**: Tasks are grouped by user story so each story has its own goal, independent test, implementation slice, and checkpoint.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with the other tasks in the same group (different files, no dependency on an incomplete peer task).
- **[Story]**: `[US1]`, `[US2]`, or `[US3]`; setup, foundational, and polish tasks have no story label.
- Every task includes an exact file path in backticks.

## Path Conventions

This is a frontend-only, brownfield feature. All paths are relative to the repository root:

- Source: `frontend/plugins/practice-view-plugin/`, `frontend/src/plugin-api/`, `frontend/src/services/`, `frontend/src/i18n/locales/`
- Tests live beside the source in the same directories.
- Documentation: `specs/101-strict-tempo-mode/`, `FEATURES.md`, `frontend/plugins/practice-view-plugin/ARCHITECTURE.md`
- No Rust/WASM, backend, database, or new storage key is touched.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the existing frontend toolchain and test baseline before changing code. No project scaffold or runtime dependency is added by this feature.

- [X] T001 [P] Establish the pre-change frontend baseline: from `frontend/`, run `npm run typecheck`, `npm run lint`, and `npm test -- --run`; record any pre-existing failures in this file's task notes, and confirm `@testing-library/react` exports `renderHook` for the persistence test. Path: `frontend/package.json`.
  - Note any baseline failures here before starting T002.
  - Recorded: `npm install` was needed in this checkout; typecheck passes; lint has 0 errors with 17 pre-existing warnings; full Vitest run 153 files / 2280 tests pass, 0 failures. `@testing-library/react` exports `renderHook`.
  - Do not add dependencies; the feature is frontend-only and uses the existing Vitest, React Testing Library, happy-dom, and Tone.js.

**Checkpoint**: The baseline is recorded; no new dependency or backend change is required.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pure timing math, strict state/action types, and reducer transitions that all three user stories depend on. Do not start any user story until the focused helper and reducer tests pass.

**⚠️ CRITICAL**: This phase blocks all user story work.

- [X] T002 [P] Write the failing helper unit tests in `frontend/plugins/practice-view-plugin/strictTempo.test.ts` (new file). Cover:
  - `computeStrictWindowMs`: gaps `0, 100, 300, 500, 750, 1000, 2000` ms → windows `60, 60, 60, 100, 150, 150, 150`; non-finite and negative gaps → `60`; integer rounding.
  - `evaluateStrictOnset` with `anchor: null`: `isGrace === true`, `onBeat === true`, `deltaMs === 0`, and the returned anchor equals the supplied expected/response times.
  - A judged note computes `round((responseTimeMs - anchor.responseTimeMs) - (expectedTimeMs - anchor.expectedTimeMs))`, including positive and negative deltas, and returns the input anchor unchanged.
  - The boundary is inclusive on both sides (`|delta| === window` is on time); a note just outside is off-beat.
  - A grace note never increments a failure; a constant lag is caught by a later note; a catch-up note can be on the grid even when its interval delta is large.
  - Keep the helper free of React, storage, audio, and `practiceEngine.types.ts` runtime imports (type-only imports are allowed).

- [X] T003 [P] Write the failing reducer tests in `frontend/plugins/practice-view-plugin/practiceEngine.test.ts`. Add `describe` blocks for:
  - `START` with `strictTempo: true` → `strictMode`, count `0`, anchor `null`, pending `false`; `START` without it → all strict fields off.
  - First accepted note (anchor `null`) is a grace note: `outcome='correct'`, `strictFailure` false/absent, `beatDeltaMs=0`; the anchor is set.
  - An in-time judged note resets the count to `0`; an off-beat judged note increments it and records `correct-late` + `strictFailure: true` + `beatDeltaMs`; the third consecutive failure enters `tempo-stopped`.
  - A wrong pitch changes neither the count nor the anchor; a grace note never changes the count, and it establishes the anchor when the current anchor is `null` (or after a documented grace point).
  - Early release records `early-release` + `strictFailure: true`, increments once, nulls the anchor, and stays on the same note; a retry after early release is a grace note for onset timing and does not duplicate the result; a repeated early release increments again.
  - `STRICT_ENABLE` / `STRICT_DISABLE` clear count/anchor/pending and preserve already-recorded result flags; `REANCHOR` while holding sets `strictReanchorPending` without changing the in-progress hold’s anchor, and the following note is grace.
  - `LOOP_RESTART` and `SEEK` clear the anchor/pending but preserve the count; `STOP` resets all strict fields.
  - An accepted final note with the third failure still records the result and enters `tempo-stopped`; an early-release final note with the third failure enters `tempo-stopped` and never `complete`.
  - With `strictMode=false`, the existing 500 ms `correct-late` classification, advancement, and completion behavior are unchanged.
  - Add/update any existing test fixtures so the new required `PracticeState` fields are present; do not weaken existing assertions.

- [X] T004 Implement `frontend/plugins/practice-view-plugin/strictTempo.ts` (new file) to pass T002. Export:
  - Constants `STRICT_WINDOW_RATIO = 0.20`, `STRICT_WINDOW_MIN_MS = 60`, `STRICT_WINDOW_MAX_MS = 150`, `STRICT_FAILURE_LIMIT = 3`.
  - `StrictAnchor` (`expectedTimeMs`, `responseTimeMs`) and `StrictEvaluation` (`anchor`, `deltaMs`, `windowMs`, `isGrace`, `onBeat`).
  - `computeStrictWindowMs(expectedGapMs: number): number` using `round(clamp(0.20 * gap, 60, 150))`, with the floor for non-finite/negative gaps.
  - `evaluateStrictOnset({ anchor, responseTimeMs, expectedTimeMs, expectedGapMs })` per `contracts/strict-tempo-engine-contract.md`.
  - Keep this module self-contained and pure; no runtime cycle with `practiceEngine.types.ts`.

- [X] T005 Extend `frontend/plugins/practice-view-plugin/practiceEngine.types.ts`:
  - Add `'tempo-stopped'` to `PracticeMode`.
  - Add to `PracticeState`: `strictMode: boolean`, `strictFailureCount: number`, `strictAnchor: StrictAnchor | null`, `strictReanchorPending: boolean`; import `StrictAnchor` with `import type` from `./strictTempo`.
  - Initialise the four fields in `INITIAL_PRACTICE_STATE` (`false`, `0`, `null`, `false`).
  - Add optional `beatDeltaMs?: number` and `strictFailure?: boolean` to `PracticeNoteResult`; leave `NoteOutcome` unchanged.
  - Add optional `strictTempo?: boolean` to the `START` action; add `{ type: 'STRICT_ENABLE' }`, `{ type: 'STRICT_DISABLE' }`, and `{ type: 'REANCHOR' }` to `PracticeAction`.
  - Do not add `stopReason` here; that is the US1 data-model change in T008.
  - Keep every new field additive and serializable; old results/state fixtures must remain valid.

- [X] T006 Integrate the strict transitions into `frontend/plugins/practice-view-plugin/practiceEngine.ts` to pass T003. Use `strictTempo.ts` for all timing math and preserve the existing legacy behavior when `strictMode` is false:
  - `START`: set `strictMode = !!action.strictTempo`, count `0`, anchor `null`, pending `false`.
  - `STRICT_ENABLE` / `STRICT_DISABLE`: only in `waiting`, `active`, or `holding`; clear count/anchor/pending; existing results keep their flags.
  - `REANCHOR`: only while strict and in a running mode; if `holding`, set `strictReanchorPending = true` and keep the in-progress hold’s anchor; otherwise set anchor `null` and pending `false`; preserve the count.
  - `CORRECT_MIDI` (no hold): compute the legacy `relativeDeltaMs` exactly as today; if strict, call `evaluateStrictOnset` with the current anchor and the gap from the previous result. Grace → `correct`/`beatDeltaMs: 0`; on-beat → `correct`/signed delta; off-beat → `correct-late`/`strictFailure: true`/signed delta and count + 1. Store the returned anchor. At count `3` set `mode='tempo-stopped'`; otherwise complete or advance as today. A non-holding note clears `strictReanchorPending`.
  - `HOLD_COMPLETE`: preserve the existing early-release retry path (no duplicate result; if the anchor is `null` and pending is false, set the retry anchor as grace; if pending, leave the anchor `null` for the next note; count unchanged). Otherwise evaluate the hold’s onset using `holdResponseTimeMs` / `holdExpectedTimeMs`; apply grace/on-beat/off-beat rules; at count `3` set `tempo-stopped` even on the last index (the orchestrator decides complete vs partial); otherwise complete/advance. If `strictReanchorPending` was set, clear the anchor and pending after evaluating so the next note is grace.
  - `EARLY_RELEASE`: if `isHoldAccepted`, delegate to `HOLD_COMPLETE`; otherwise record `early-release` + `strictFailure: true` + `beatDeltaMs` (or `0` when no anchor), increment once, set anchor `null`, clear pending, and stay on the same note; at count `3` set `tempo-stopped`.
  - `WRONG_MIDI`: no strict change.
  - `LOOP_RESTART` / `SEEK`: clear anchor and pending, preserve the count.
  - `STOP`: reset all four strict fields.
  - Do not advance or complete on the third failure; `tempo-stopped` is terminal for the reducer.

**Checkpoint**: `npm test -- --run plugins/practice-view-plugin/strictTempo.test.ts plugins/practice-view-plugin/practiceEngine.test.ts` and `npm run typecheck` pass from `frontend/`; no user story work has begun.

---

## Phase 3: User Story 1 — Strict tempo evaluation stops after three consecutive misses (Priority: P1) 🎯 MVP

**Goal**: Score Practice with the metronome enabled judges every note on the strict grid; three consecutive onset failures or early releases stop the session immediately, stop/re-arm the metronome, and open the results window with the tempo-stop reason.

**Independent Test**: Start Score Practice with the metronome armed. Play the first note in time, then play three consecutive notes clearly outside the window. The session stops after the third note, no further note is required, the metronome stops, and the results overlay opens with the tempo-stop reason. Repeat with in-time notes: the session continues normally. Repeat with the metronome off: the 500 ms legacy classification remains and no tempo stop occurs.

### Tests for User Story 1

- [X] T007 [P] [US1] Add failing integration tests in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.test.tsx` using the existing behavioral metronome mock and `vi.setSystemTime`. Cover:
  - Starting Score Practice while the metronome is armed passes `strictTempo: true` to `START`; the first accepted note is a grace note (not judged) and the session continues.
  - Two off-beat notes followed by an in-time note reset the count; no stop occurs.
  - Three consecutive off-beat notes stop immediately after the third; `lifecycle.onSessionEnd` stops/re-arms the metronome, the score player stops, the results overlay opens with the tempo banner title/hint, and no further note is needed.
  - A wrong pitch between two failures does not count and does not reset the consecutive count.
  - Three consecutive early releases stop the session; the retry after an early release is grace for onset timing and the early release itself is the single failure.
  - Starting with the metronome off passes `strictTempo: false`; a note beyond 500 ms is still `correct-late`, advances normally, and never produces a tempo stop.
  - An accepted final note with the third failure produces complete results, not a tempo-stop partial; an early-release final note with the third failure produces the tempo-stop partial.
  - The tempo-stop side effects run once (no duplicate `STOP`/`onSessionEnd`/overlay), and the score seeks to the loop start or `0`.
  - Keep the existing `PracticeViewPlugin` tests passing; do not replace the behavioral metronome mock with a constant one.

### Implementation for User Story 1

- [X] T008 [P] [US1] Add the stop-reason type to `frontend/plugins/practice-view-plugin/practiceEngine.types.ts`: export `type PracticeStopReason = 'manual' | 'tempo'` and add `readonly stopReason?: PracticeStopReason` to `PartialPerformanceRecord`. This is the US1 data-model addition; do not add `SavedPerformanceData.stopReason` yet (T021).

- [X] T009 [P] [US1] In `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx`, in the `START` dispatch inside `handlePracticeToggle`, pass `strictTempo: metronomeStateRef.current.active || metronomeStateRef.current.armed`. Free Practice already returns earlier in this handler and must remain untouched. Repractice also calls `handlePracticeToggle`, so it naturally starts a strict session when the metronome is still enabled/armed.

- [X] T010 [US1] Add the once-guarded `tempo-stopped` effect in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx` (depends on T008 and T009). When `practiceState.mode === 'tempo-stopped'`, exactly once per session:
  - Capture the current notes, results, wrong-note events, BPM, and tempo multiplier.
  - Decide complete vs partial: if the last result is an accepted note (`correct` or `correct-late`) and it is the accepted final note of the final loop iteration, set a complete `PerformanceRecord` and clear the partial record. Otherwise set a `PartialPerformanceRecord` with `stopReason: 'tempo'` and clear any stale complete record. An `early-release` last result is never a complete result.
  - Use the existing loop state (`loopRegionRef`, `remainingLoopsRef`, `loopIterationRef`, and the same final-index logic used by `usePracticeLoop`/`handlePracticeToggle`) to identify the final iteration; do not treat a loop-end failure as complete when loops remain.
  - Show the results overlay, dispatch `STOP`, call `lifecycle.onSessionEnd()`, call `context.scorePlayer.stop()`, and seek to `loopRegionRef.current?.startTick ?? 0`.
  - Guard the effect with a ref (for example `tempoStopHandledRef`) so React re-renders or Strict Mode do not repeat the side effects; reset the guard when a new session starts.
  - Do not infer failures from silence or add notes; the reducer signals only on detected attempts.

- [X] T011 [P] [US1] Add the minimal tempo-stop banner to `frontend/plugins/practice-view-plugin/ResultsOverlay.tsx` and the two required keys to `frontend/src/i18n/locales/en.json` and `frontend/src/i18n/locales/es.json` (depends on T008). In the partial branch:
  - When `partialPerformanceRecord?.stopReason === 'tempo'`, render `<div className="practice-results__tempo-stop" data-testid="tempo-stop-banner" role="status">` containing the title `practice.results.tempo_stopped` and hint `practice.results.tempo_stopped_hint`. The three-failure list is US2 (T020); this task only needs the reason visible.
  - Keep the existing `practice.results.stopped_at` badge for manual partials and old records without `stopReason`.
  - Use the English/Spanish strings from `contracts/ui-contract.md`; the `locales.test.ts` parity check must pass.

- [X] T012 [P] [US1] Add the base tempo-banner styles to `frontend/plugins/practice-view-plugin/PracticeViewPlugin.css`: `.practice-results__tempo-stop`, `.practice-results__tempo-stop-title`, and `.practice-results__tempo-stop-hint`. Use the existing theme variables, warning tint, border, radius, and readable light/dark contrast; do not change score layout. The full banner list/action styles are US2 (T022).

**Checkpoint**: User Story 1 works end-to-end: three consecutive strict failures stop the session, the metronome stops, the results overlay opens with the tempo reason, and metronome-off Score Practice is unchanged. This is the MVP; stop here and validate independently before starting US2.

---

## Phase 4: User Story 2 — Understand why the practice stopped (Priority: P2)

**Goal**: A tempo stop explains itself: the results window states that the metronome was not followed, lists the three failing notes with signed onset delays or early-release amounts, shows the timing table and delay chart for the partial session, scores strict failures as errors, and persists the stop reason through save/load.

**Independent Test**: Trigger a tempo stop with known errors (for example +220 ms late, -180 ms early, and an early release). Verify the results window shows the tempo-stop reason and those three errors, the timing table/chart are marked, and the strict failures reduce the score as errors. Choose Repractice and verify a new strict session with the count reset; save and reload the partial and verify the tempo reason survives. A manual partial with one or two strict failures remains a normal partial.

### Tests for User Story 2

- [X] T013 [P] [US2] Add failing scoring tests in `frontend/src/plugin-api/computePracticeScore.test.ts`:
  - Strict `correct-late` and strict `early-release` results (`strictFailure: true`) earn zero credit and are counted by `strictFailureCount`.
  - Legacy `correct-late` / `early-release` without the flag keep 0.5 credit; `correct` keeps full credit.
  - Mixed strict/legacy/correct/wrong results produce the expected score, with the wrong-attempt penalty and 0–100 clamp unchanged.
  - A session with only in-time notes still scores 100; empty input still returns `null`.
  - Update existing expectations to include the new `strictFailureCount` field.

- [X] T014 [P] [US2] Add failing tests in `frontend/plugins/practice-view-plugin/PracticeTimingDetails.test.tsx` (new file):
  - The table renders the existing columns (note number, expected, played, status, wrong tries, timing delta) and preserves the existing classes/`aria-label` used by the current results tests.
  - The timing value is `beatDeltaMs ?? relativeDeltaMs`; zero/undefined grace values render the existing dash where the current UI does.
  - A strict onset failure row has `practice-results__row--strict-failure` in addition to its outcome class and shows the signed delta.
  - A strict early release shows `Released {ms} ms early` using `requiredHoldMs - holdDurationMs`; a legacy early release keeps `formatStateLabel(relativeDeltaMs)`.
  - The delay chart renders when at least two results exist; strict failure points are marked with `data-strict-failure="true"` or an equivalent class, legacy late points keep the warning style, and normal points stay neutral.
  - The table and chart remain inside the existing collapsible details sections and the table remains horizontally scrollable.

- [X] T015 [P] [US2] Add failing results-overlay tests in `frontend/plugins/practice-view-plugin/ResultsOverlay.test.tsx`:
  - A tempo-stop partial with three strict failures shows the banner title/hint and exactly three `data-testid="tempo-stop-failure"` items with the correct note numbers and signed values (late, early, and early-release amount).
  - A conditional `data-testid="strict-fail-count"` stat appears when `strictFailureCount > 0` and is hidden for a clean complete session; verify both complete and tempo-stop partial overlays as appropriate.
  - The partial overlay renders `PracticeTimingDetails` (table/chart) and marks the three failing notes.
  - Tempo-stop actions: Repractice calls `onRepractice`, Save calls `onSave` when provided and is disabled when `isSaved`, Session calls `onReturnToSession` when provided, and the save error is shown.
  - Partial-over-stale-complete: when both `performanceRecord` and a tempo-stop `partialPerformanceRecord` are present and the mode is `inactive`, the tempo partial wins; the complete overlay does not mask it.
  - A manual partial with one or two strict failures keeps the existing stopped-at badge, shows no tempo banner and no tempo action row, but still marks strict rows in the details.
  - An old saved partial without `stopReason` uses the manual presentation.
  - The complete overlay has no tempo banner and remains unchanged for a non-strict session.

- [X] T016 [P] [US2] Add the save/load regression in `frontend/plugins/practice-view-plugin/useSavedPracticeManager.test.ts` (new file):
  - Mock `frontend/src/services/savedPracticeStorage.ts` (`listSavedPractices` → `[]`, `savePracticeToIndexedDB` and `loadPracticeFromIndexedDB` captured, `addSavedPracticeIndex`/`deletePracticeFromIndexedDB` no-ops) and render the hook with `renderHook` using a minimal `PluginContext` stub, a `t` stub, and the required refs/state.
  - Saving a tempo-stop partial writes `completionStatus: 'partial'` and `performanceData.stopReason: 'tempo'`.
  - Saving a manual partial writes `'manual'`.
  - Loading a partial with `stopReason: 'tempo'` retains it in `pendingSavedPracticeRef.current.performanceData`; a legacy partial without it remains undefined/manual.
  - Assert the complete save path does not add a required stop reason; old complete records remain valid.

- [X] T017 [P] [US2] Add the full results localization keys to `frontend/src/i18n/locales/en.json` and `frontend/src/i18n/locales/es.json`: `practice.results.tempo_failures`, `practice.results.tempo_failure_item` (with `{note}` and `{delta}`), and `practice.results.released_early` (with `{ms}`). Use the strings in `contracts/ui-contract.md`; `frontend/src/i18n/locales.test.ts` must pass with identical key sets.

### Implementation for User Story 2

- [X] T018 [P] [US2] Update `frontend/src/plugin-api/computePracticeScore.ts` to pass T013 (depends on T013):
  - Add optional `strictFailure?: boolean` to `ScorableNoteResult`.
  - Add `strictFailureCount: number` to `PracticeScoreBreakdown`.
  - Count `strictFailureCount = results.filter(r => r.strictFailure === true).length`.
  - Compute half credit only for `correct-late` / `early-release` results whose `strictFailure !== true`; keep `lateCount` and `earlyReleaseCount` as all rows with those outcomes.
  - Keep the existing wrong-attempt penalty, rounding, clamp, empty-input `null`, and informational `tempoMultiplier`.
  - Return the new field from every non-null breakdown.

- [X] T019 [P] [US2] Create `frontend/plugins/practice-view-plugin/PracticeTimingDetails.tsx` and replace the inline table/chart in `frontend/plugins/practice-view-plugin/ResultsOverlay.tsx` with it (depends on T014):
  - Export `PracticeTimingDetails` with a `results: ReadonlyArray<PracticeNoteResult>` prop (add only the props needed by the tests).
  - Move the existing table and SVG delay chart out of `ResultsOverlay.tsx`, preserving the existing DOM classes, `aria-label`s, collapsible details, and test selectors; add the `practice-results__chart` class required by the UI contract.
  - Use `beatDeltaMs ?? relativeDeltaMs` for the timing column and chart points. Add `practice-results__row--strict-failure` to strict rows in addition to `practice-results__row--${outcome}`.
  - Strict early release status: `Released {ms} ms early` using `requiredHoldMs - holdDurationMs`; strict onset failure: `formatStateLabel(beatDeltaMs ?? relativeDeltaMs)`; legacy early release: existing `formatStateLabel(relativeDeltaMs)`.
  - Mark strict failure chart dots with `data-strict-failure="true"` or a dedicated class; keep legacy late dots warning and normal dots neutral.
  - Render `<PracticeTimingDetails results={practiceReport.results} />` in the complete branch and `<PracticeTimingDetails results={partialReport.results} />` in the non-zero-progress partial branch below the time comparison. The partial overlay must no longer stop at score/stats/time comparison.
  - Keep the component presentational; no storage, audio, or reducer imports.

- [X] T020 [US2] Update `frontend/plugins/practice-view-plugin/ResultsOverlay.tsx` to pass T015 and complete the tempo-stop explanation (depends on T015, T017, T018, T019):
  - In the partial branch, compute `isTempoStop = partialPerformanceRecord?.stopReason === 'tempo'`; when true, extend the existing tempo banner from T011 with `lastThreeFailures = partialReport.results.filter(r => r.strictFailure).slice(-3)` as exactly three `data-testid="tempo-stop-failure"` list items, keeping the title/hint and `role="status"`. Use `formatFailure(r)` per the UI contract: early release with `requiredHoldMs > 0` → `practice.results.released_early` with `Math.round(requiredHoldMs - holdDurationMs)`; otherwise `formatStateLabel(beatDeltaMs ?? relativeDeltaMs)`.
  - Add the conditional `data-testid="strict-fail-count"` stat when `strictFailureCount > 0` (complete and partial); keep the existing Notes/Correct/Off-beat/Wrong stats and wrap the stats row.
  - Add the tempo-stop action row after the details: Repractice (`handleRepractice`), Save (`onSave` when provided, disabled when `isSaved`, show `saveError`), and Session (`onReturnToSession` when provided). Do not show this row for manual partials.
  - Change `showComplete` to `resultsOverlayVisible && practiceReport && (practiceState.mode === 'complete' || (practiceState.mode === 'inactive' && !!performanceRecord && !partialPerformanceRecord))` so a stale complete record cannot mask a tempo-stop partial.
  - Preserve the zero-progress branch, the existing manual partial behavior, and the complete overlay for non-strict sessions.
  - Use `practice.results.tempo_stopped`, `tempo_stopped_hint`, `tempo_failures`, `tempo_failure_item`, and `released_early` through `t(...)`; no hard-coded user-facing strings.

- [X] T021 [P] [US2] Carry `stopReason` through saved practice in `frontend/src/services/savedPractice.types.ts`, `frontend/plugins/practice-view-plugin/useSavedPracticeManager.ts`, and `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx` (depends on T016):
  - Add `readonly stopReason?: PracticeStopReason` to `SavedPerformanceData` in `frontend/src/services/savedPractice.types.ts` (import the type from the practice engine types).
  - In `frontend/plugins/practice-view-plugin/useSavedPracticeManager.ts`, include `stopReason: partialPerformanceRecord.stopReason ?? 'manual'` in the partial `performanceData`; leave the complete path without it.
  - In the saved-practice apply path in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx` (the effect that builds `partialPerformanceRecord` from `saved.performanceData`), set `stopReason: saved.performanceData.stopReason ?? 'manual'`.
  - Do not add a new IndexedDB store, localStorage key, or migration. Old records without the field load as manual.

- [X] T022 [P] [US2] Add the full results styles to `frontend/plugins/practice-view-plugin/PracticeViewPlugin.css`:
  - `.practice-results__tempo-stop-list` for the three failing notes; keep the list compact and readable.
  - `.practice-results__row--strict-failure` with a visible left rule or tinted background that does not rely on color alone (the status/delta text carries the meaning).
  - `.practice-results__stats { flex-wrap: wrap; }` for the conditional fifth stat.
  - `.practice-results__actions--partial` for the tempo-stop action row.
  - Strict chart point styling if T019 uses a CSS class instead of an inline fill.
  - Respect the existing theme variables and light/dark themes; do not change score layout.

**Checkpoint**: User Stories 1 and 2 work independently and together: a tempo stop explains the reason, the three errors, the timing table/chart, the error scoring, the Repractice/Save/Session actions, and the saved/reloaded stop reason. A manual partial remains a normal partial.

---

## Phase 5: User Story 3 — Know the rules before the stop, and stay in control (Priority: P3)

**Goal**: The practice view shows that strict mode is enforcing the metronome and the current 0/3–2/3 count; off-beat notes show their signed timing error live; turning the metronome off leaves strict mode, turning it on mid-session starts strict from the next grace note; tempo changes, loops, Repractice, and Free Practice behave as specified.

**Independent Test**: Enable the metronome, play two off-beat notes, and verify the indicator shows `2/3` and the live overlay shows the signed timing errors. Turn the metronome off and verify the indicator disappears and the session continues normally. Turn it back on and verify strict mode resumes from the next note (grace). Change the tempo and verify the next note is grace; complete a loop and verify the next loop’s first note is grace; play Free Practice with the metronome on and verify no indicator and no stop.

### Tests for User Story 3

- [X] T023 [P] [US3] Add failing toolbar tests in `frontend/plugins/practice-view-plugin/practiceToolbar.test.tsx`:
  - The strict badge is hidden when `strictTempoActive` is false, when the metronome is off, and when `isFreePractice` is true.
  - It is visible at `0/3` when active, updates to `1/3` and `2/3`, and renders the `none`/`warn`/`danger` level classes.
  - It has `data-testid="strict-tempo-indicator"`, `data-failures`, `aria-live="polite"`, the localized title, and is not a focusable button.
  - The existing toolbar tests and layout remain unchanged.

- [X] T024 [P] [US3] Add failing integration tests in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.test.tsx`:
  - Metronome on mid-session while waiting/active dispatches `STRICT_ENABLE`; the next accepted note is a grace note, not judged, and the count starts at zero; notes before activation are not evaluated.
  - Metronome off mid-session with two failures dispatches `STRICT_DISABLE`; the count clears, no tempo stop occurs, and the session continues with legacy behavior.
  - A tempo change during strict mode dispatches `REANCHOR`; the next note is grace and the count is preserved. A tempo change during a sustained note judges the in-progress hold on its original grid and makes the following note grace.
  - A loop restart makes the first accepted note of the new iteration grace; the count carries across iterations; a third failure at the loop end stops and does not auto-restart the loop.
  - A third failure on an accepted final note yields complete results; an early-release final note with the third failure yields tempo-stop partial results.
  - Free Practice with the metronome on never shows the strict badge, never dispatches `STRICT_ENABLE`, and never tempo-stops.
  - Repractice after a tempo stop keeps the metronome enabled/armed, starts a new strict session, resets the count to zero, and shows the badge at `0/3`.
  - Live feedback: a strict onset failure with a legacy `relativeDeltaMs` below 500 ms shows the `beatDeltaMs` value; a strict early release shows the negative early-release shortfall; an in-time strict note does not flash.
  - The indicator updates on the same note as the failure and resets on the next in-time note.
  - Note (T024 record): the loop-restart grace and carriage are verified at the reducer level (practiceEngine LOOP_RESTART tests) and by the T027 usePracticeLoop regression (tempo-stopped never triggers the auto-restart branch); a full task-locked auto-restart integration harness was out of scope.

- [X] T025 [P] [US3] Add the toolbar localization keys to `frontend/src/i18n/locales/en.json` and `frontend/src/i18n/locales/es.json`: `practice.toolbar.strict_tempo` (`Strict {n}/3` / `Estricto {n}/3`) and `practice.toolbar.strict_tempo_title` (the full 3-miss explanation from `contracts/ui-contract.md`). `frontend/src/i18n/locales.test.ts` must pass.

- [X] T026 [P] [US3] Add the toolbar badge styles to `frontend/plugins/practice-view-plugin/PracticeViewPlugin.css`: `.practice-plugin__strict-badge` (compact pill, `white-space: nowrap`, theme accent), `.practice-plugin__strict-badge--warn` (1 failure), and `.practice-plugin__strict-badge--danger` (2+ failures). Keep the badge informational and non-focusable; respect light/dark themes.

- [X] T027 [P] [US3] Add the loop-stop regression in `frontend/plugins/practice-view-plugin/usePracticeLoop.test.ts`: when the practice mode is `tempo-stopped`, the hook must not treat it as `complete`, must not call `onResultsShow` for an auto-restart, and must not consume a remaining loop; when the mode is `complete` with loops remaining, the existing restart behavior still runs. Fix `frontend/plugins/practice-view-plugin/usePracticeLoop.ts` only if the test exposes a real `tempo-stopped` branch.

### Implementation for User Story 3

- [X] T028 [P] [US3] Extend `frontend/plugins/practice-view-plugin/practiceToolbar.tsx` to pass T023 (depends on T023 and T025):
  - Add optional `strictTempoActive?: boolean` and `strictFailureCount?: number` to `PracticeToolbarProps` and the destructured props (defaults `false` and `0`).
  - Render the badge only when `strictTempoActive === true && !isFreePractice`, near the practice progress/metronome controls:
    ```tsx
    <span
      className={`practice-plugin__strict-badge practice-plugin__strict-badge--${level}`}
      data-testid="strict-tempo-indicator"
      data-failures={strictFailureCount}
      aria-live="polite"
      title={t('practice.toolbar.strict_tempo_title', { n: String(strictFailureCount) })}
    >
      {t('practice.toolbar.strict_tempo', { n: String(strictFailureCount) })}
    </span>
    ```
  - `level` is `none` for `0`, `warn` for `1`, `danger` for `2+`; the badge is informational, not a button.
  - Do not change the existing metronome button, practice button, or layout.

- [X] T029 [US3] Wire the strict controls in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx` (depends on T024 and T028):
  - Pass `strictTempoActive={practiceState.strictMode}` and `strictFailureCount={practiceState.strictFailureCount}` to `PracticeToolbar`.
  - In `handleMetronomeToggle`, skip Free Practice. Capture `const wasOn = metronomeStateRef.current.active || metronomeStateRef.current.armed;` and the current running mode; call `lifecycle.onToggle(canArm)`; then, only while the Score Practice mode is `waiting`/`active`/`holding`, dispatch `wasOn ? { type: 'STRICT_DISABLE' } : { type: 'STRICT_ENABLE' }`. The disabled path clears the count and the enabled path makes the next accepted note the grace note. Do not dispatch on inactive/complete/tempo-stopped sessions.
  - In `handleTempoChange`, after applying the new multiplier, dispatch `{ type: 'REANCHOR' }` when `practiceStateRef.current.strictMode` is true and the practice is running; skip Free Practice and inactive sessions. The reducer preserves the count and makes the next note grace; a hold in progress keeps its original grid.
  - Subdivision changes must not dispatch strict actions or change the count/grid.
  - Do not change `usePracticeLoop`; the reducer’s `LOOP_RESTART` clearing already handles the loop grace, and `tempo-stopped` must not trigger its complete/restart branch.

- [X] T030 [US3] Update the live timing feedback effect in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx` (depends on T029):
  - Keep the existing outcome filter (`correct-late` or `early-release`) and the existing replay/free-practice/results-overlay guards.
  - For a strict early release (`last.strictFailure && last.outcome === 'early-release'`), display `formatStateLabel(-(last.requiredHoldMs - last.holdDurationMs))` (the negative shortfall).
  - For any other strict failure (strict onset), display `formatStateLabel(last.beatDeltaMs ?? last.relativeDeltaMs)` even when the legacy `relativeDeltaMs` is below 500 ms.
  - For legacy late/early results, keep `formatStateLabel(last.relativeDeltaMs)` exactly as today.
  - In-time strict notes (`outcome === 'correct'`) do not flash; the existing 1 s auto-dismiss and overlay visibility behavior remain.

**Checkpoint**: All three user stories are independently functional: the indicator and live feedback explain the rule before the stop; the metronome toggle, tempo change, loops, Repractice, and Free Practice behave as specified; the stop and results remain correct.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, full verification, and the manual quickstart. No new feature behavior.

- [X] T031 [P] Document the strict state, grace points, and tempo-stop path in `frontend/plugins/practice-view-plugin/ARCHITECTURE.md`: the pure helper, reducer modes/actions, orchestrator side effects, and the results/persistence fields. Keep the existing architecture style and avoid duplicating the feature spec.

- [X] T032 [P] Add the user-facing strict tempo bullet to `FEATURES.md`, describing that enabling the metronome in Score Practice enforces the tempo, three consecutive timing misses stop the session, and the results explain the three failing notes. Do not mention internal implementation details.

- [X] T033 Run the focused strict-tempo suites from `frontend/` and fix failures before the full run:
  ```bash
  npm test -- --run \
    plugins/practice-view-plugin/strictTempo.test.ts \
    plugins/practice-view-plugin/practiceEngine.test.ts \
    plugins/practice-view-plugin/PracticeTimingDetails.test.tsx \
    plugins/practice-view-plugin/ResultsOverlay.test.tsx \
    plugins/practice-view-plugin/practiceToolbar.test.tsx \
    plugins/practice-view-plugin/PracticeViewPlugin.test.tsx \
    plugins/practice-view-plugin/usePracticeLoop.test.ts \
    plugins/practice-view-plugin/useSavedPracticeManager.test.ts \
    src/plugin-api/computePracticeScore.test.ts
  ```
  Path: `frontend/package.json`. Ensure every new test fails before its implementation and passes after; do not delete or weaken existing assertions.

- [X] T034 Run the full frontend verification from `frontend/`: `npm test -- --run`, `npm run typecheck`, and `npm run lint`. Fix all regressions, including existing results-overlay/toolbar/practice-engine tests, locale parity, and saved-practice compatibility. Path: `frontend/package.json`.

- [ ] T035 Run the manual scenarios in `specs/101-strict-tempo-mode/quickstart.md` at approximately 40 BPM and 120 BPM: in-time passage (no false stop), three off-beat notes (stop after the third, metronome stops, results show the reason and three errors), early release (one failure, retry grace), metronome off/on mid-session, tempo change, loop, Free Practice, Repractice, and save/load of a tempo partial. Also confirm no new dependencies (`git diff -- frontend/package.json frontend/package-lock.json`), no backend/WASM changes, and no new profile-scoped storage key. Path: `specs/101-strict-tempo-mode/quickstart.md`.
  - Note (T035 record, automated part): `git diff -- frontend/package.json frontend/package-lock.json` is empty (no new dependencies), no `backend/` changes (no backend/WASM changes), and no new profile-scoped storage key (only in-record `performanceData.stopReason` was added). The MIDI-keyboard playthrough scenarios require a human at the instrument — remaining for the user.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; starts immediately.
- **Foundational (Phase 2)**: Depends on T001; **blocks all user stories**.
- **User Story 1 (Phase 3)**: Depends on Phase 2; no other story dependency; MVP.
- **User Story 2 (Phase 4)**: Depends on Phase 2 and the US1 stop path (`stopReason` + tempo-stop effect, T008/T010). It is independently testable with seeded partial records and complete results.
- **User Story 3 (Phase 5)**: Depends on Phase 2 and US1’s strict state/stop path. It can be validated independently once US1 exists; the integration test file and `PracticeViewPlugin.tsx` are shared with US1, so coordinate edits or run it after US1.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: No story dependencies. Delivers the core stop flow and the minimal tempo-stop reason. This is the MVP.
- **US2 (P2)**: Builds on US1’s `PartialPerformanceRecord.stopReason` and tempo-stop effect; no new engine behavior is required beyond the strict results already recorded. It can be demonstrated with a seeded tempo-stop partial before US1’s orchestrator is wired, but the end-to-end Repractice/Save path needs US1.
- **US3 (P3)**: Builds on US1’s strict reducer/state. The toolbar badge and live feedback are additive; the mid-session metronome/tempo wiring uses the same reducer actions. It does not require US2’s results redesign, but the shared integration test file is easiest to extend after US1.

### Within Each User Story

- Tests MUST be written and fail before implementation.
- Types/helpers before reducers/services before UI/endpoints.
- Core implementation before integration.
- A story is complete only when its independent test criteria pass and the previous stories still pass.
- Commit after each task or logical group; do not commit generated test output.

### Parallel Opportunities

- **Phase 2**: T002 (helper tests) and T003 (reducer tests) are different files and can run together. T004 follows T002; T005 follows T004; T006 follows T003/T004/T005.
- **US1**: T007 (integration tests), T008 (stop-reason type), T009 (START wiring), and T012 (banner base CSS) can run together after Phase 2. T011 follows T008 (different file); T010 follows T008 and T009 (same `PracticeViewPlugin.tsx` as T009).
- **US2**: T013 (scoring tests), T014 (component tests), T015 (overlay tests), T016 (save/load test), and T017 (full results i18n) are different files and can run together. T018 follows T013; T019 follows T014; T020 follows T015/T017/T018/T019; T021 follows T016 (different files from T018/T019/T022); T022 is CSS-only and can run with T018/T019/T021.
- **US3**: T023 (toolbar tests), T024 (integration tests), T025 (toolbar i18n), T026 (badge CSS), and T027 (loop regression) are different files and can run together. T028 follows T023/T025; T029 follows T024/T028; T030 follows T029 (same plugin file).
- **Polish**: T031 (ARCHITECTURE.md) and T032 (FEATURES.md) are different files and can run together; T033→T034→T035 are sequential verification.

### Parallel Example: User Story 1

```text
# After Phase 2, launch these together:
Task: T007 [P] [US1] Integration tests in frontend/plugins/practice-view-plugin/PracticeViewPlugin.test.tsx
Task: T008 [P] [US1] stopReason type in frontend/plugins/practice-view-plugin/practiceEngine.types.ts
Task: T009 [P] [US1] START strict flag in frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx
Task: T012 [P] [US1] Banner base CSS in frontend/plugins/practice-view-plugin/PracticeViewPlugin.css

# Then:
Task: T011 [P] [US1] Minimal banner + en/es keys (after T008)
Task: T010 [US1] Tempo-stop effect (after T008 and T009)
```

### Parallel Example: User Story 2

```text
# Tests and localization, all different files:
Task: T013 [P] [US2] Scoring tests in frontend/src/plugin-api/computePracticeScore.test.ts
Task: T014 [P] [US2] Component tests in frontend/plugins/practice-view-plugin/PracticeTimingDetails.test.tsx
Task: T015 [P] [US2] Overlay tests in frontend/plugins/practice-view-plugin/ResultsOverlay.test.tsx
Task: T016 [P] [US2] Save/load test in frontend/plugins/practice-view-plugin/useSavedPracticeManager.test.ts
Task: T017 [P] [US2] Results localization in frontend/src/i18n/locales/en.json and es.json

# Implementation, different files unless noted:
Task: T018 [P] [US2] Scoring in frontend/src/plugin-api/computePracticeScore.ts (after T013)
Task: T019 [P] [US2] PracticeTimingDetails + ResultsOverlay extraction (after T014; then T020 follows)
Task: T021 [P] [US2] Persistence in frontend/src/services/savedPractice.types.ts, useSavedPracticeManager.ts, PracticeViewPlugin.tsx (after T016)
Task: T022 [P] [US2] Full CSS in frontend/plugins/practice-view-plugin/PracticeViewPlugin.css
Task: T020 [US2] ResultsOverlay banner/stats/actions (after T015, T017, T018, T019)
```

### Parallel Example: User Story 3

```text
# Tests/localization/CSS, all different files:
Task: T023 [P] [US3] Toolbar tests in frontend/plugins/practice-view-plugin/practiceToolbar.test.tsx
Task: T024 [P] [US3] Integration tests in frontend/plugins/practice-view-plugin/PracticeViewPlugin.test.tsx
Task: T025 [P] [US3] Toolbar localization in frontend/src/i18n/locales/en.json and es.json
Task: T026 [P] [US3] Badge CSS in frontend/plugins/practice-view-plugin/PracticeViewPlugin.css
Task: T027 [P] [US3] Loop-stop regression in frontend/plugins/practice-view-plugin/usePracticeLoop.test.ts

# Implementation:
Task: T028 [P] [US3] Toolbar badge in frontend/plugins/practice-view-plugin/practiceToolbar.tsx (after T023, T025)
Task: T029 [US3] Plugin wiring in frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx (after T024, T028)
Task: T030 [US3] Live feedback in frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx (after T029)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (strict helper, types, reducer) — this is mandatory.
3. Complete Phase 3: User Story 1 (stop flow + minimal tempo reason).
4. **STOP and VALIDATE**: run T007’s integration tests and the metronome-off regression. Deploy/demo the strict stop and results window if ready.
5. Do not start US2/US3 until US1’s independent test criteria pass.

### Incremental Delivery

1. Setup + Foundational → strict engine ready.
2. US1 → strict stop and results reason (MVP).
3. US2 → explanation, scoring, table/chart, Repractice/Save/Session, persistence.
4. US3 → indicator, live feedback, mid-session metronome/tempo control, loops, Free Practice.
5. Polish → docs, focused/full verification, manual quickstart.

### Parallel Team Strategy

- One developer completes Setup + Foundational (the shared reducer/helper).
- After Foundational:
  - Developer A: US1 (required first for the shared stop path).
  - Developer B: US2’s scoring, `PracticeTimingDetails`, and save/load tests can start in parallel with US1’s UI; wire the overlay after US1’s `stopReason` exists.
  - Developer C: US3’s toolbar tests/badge/CSS can start in parallel; wire the plugin after US1’s state and US2’s shared `PracticeViewPlugin.tsx` edits are coordinated.
- Because `PracticeViewPlugin.tsx`, `ResultsOverlay.tsx`, and `PracticeViewPlugin.test.tsx` are shared, avoid simultaneous edits to the same file; the safe default is sequential P1→P2→P3.

---

## Independent Test Criteria Summary

- **US1**: Start Score Practice with the metronome armed; first note in time; three consecutive off-beat notes stop after the third, with the metronome stopped and the results overlay showing the tempo reason. In-time notes prevent a stop; wrong pitches are neutral; early releases count; metronome-off Score Practice keeps the 500 ms behavior and never tempo-stops.
- **US2**: Trigger a tempo stop with known +220 ms late, -180 ms early, and early-release errors; the results show the tempo reason and exactly those three errors, the table/chart are marked, strict failures score as errors, Repractice starts strict with count zero, and a saved/reloaded tempo partial retains its reason. A manual partial with 1–2 strict failures remains a normal partial.
- **US3**: With the metronome on, the badge shows `0/3`, `1/3`, `2/3`; off-beat notes show signed live timing errors; metronome off clears the indicator and continues normally; metronome on mid-session makes the next note grace; tempo changes and loops make the next note grace while preserving the count; Free Practice has no badge and no stop; Repractice resets the count.

## Suggested MVP Scope

**User Story 1 only** (Phase 1 + Phase 2 + Phase 3). The MVP includes the pure strict helper, reducer, types, orchestrator stop effect, and the minimal tempo-stop reason. US2 (explanation/scoring/persistence) and US3 (indicator/live feedback/mid-session controls) are additive increments.

## Format Validation

All tasks use the required `- [ ] TXXX [P?] [US?] Description with file path` form:

- Setup/foundational/polish tasks have no story label; every US1/US2/US3 task has its story label.
- `[P]` appears only on tasks that can run in parallel with their peers (different files, no incomplete peer dependency).
- Every task names an exact repository path in backticks.
- Task IDs are sequential in execution order; no sample tasks remain from the template.

## Notes

- The feature is frontend-only. Do not add dependencies, backend/WASM changes, new IndexedDB stores, or new profile-scoped storage keys.
- `NoteOutcome` is unchanged: strict onset failures use `correct-late` + `strictFailure`; early-release failures use `early-release` + `strictFailure`.
- The strict grid is anchored only at grace notes and is not updated by successful notes, so constant lag and drift are caught.
- The 60 ms floor is intentionally wider than the metronome’s documented accuracy; do not tune it without a new spec/decision.
- Regression obligations from `plan.md` are covered by T003 (legacy 500 ms / reducer), T007 (metronome-off orchestrator, early release, final note), T016 (old saved partial), T024 (Free Practice, mid-session controls, loops), and T027 (loop auto-restart vs tempo stop).
- The two reported failure modes are covered by T002/T003 (window/constant-lag behavior at slow and fast tempos) and T035 (manual 40/120 BPM scenarios).
