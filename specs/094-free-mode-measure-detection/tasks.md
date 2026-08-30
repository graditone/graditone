# Tasks: Free Mode Measure Detection

**Input**: Design documents from `/specs/094-free-mode-measure-detection/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are INCLUDED per Constitution Principles V & VII (Test-First is non-negotiable). The regression test for Issue #1 MUST be authored RED (failing) before the fix.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Repos**: `frontend/` (React PWA), backend (not touched)
- **Feature code**: `frontend/plugins/practice-view-plugin/`
- **Shared/contract types**: `frontend/src/plugin-api/`, `frontend/src/services/`
- File paths below are absolute-from-repo-root relative.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Nothing new to scaffold — pure TypeScript functions in an existing plugin. This phase = establish test tooling contract so all story work starts uniform.

- [x] T001 [P] Verify Vitest runs for the existing practice-view-plugin tests (e.g. `npx vitest run frontend/plugins/practice-view-plugin/useFreePractice.test.ts`) and report the baseline pass state in `specs/094-free-mode-measure-detection/tasks.md` Notes
- [x] T002 Confirm `frontend/plugins/practice-view-plugin/freePractice.helpers.ts` has no React imports (hexagonal purity — Principle II) and CI lint (eslint) passes for the plugin dir

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The pure onset-derived detection core that US1–US3 all depend on. MUST be complete (with its RED regression test) before any story phase.

**⚠️ CRITICAL**: Single source of truth for measure detection (research D5). All stories consume this.

- [x] T003 Write the RED regression test reproducing Issue #1 in `frontend/plugins/practice-view-plugin/freePractice.helpers.test.ts`: eight on-beat quarter notes at 80 BPM (timestamps 0,750,1500,2250,3000,3750,4500,5250, each durationMs 750) MUST produce exactly two complete measures of four quarter notes (8 notes, zero rests, each measure summing to 16 steps). Run it and CONFIRM it FAILS against the current `finalizeMeasureNotes` (Principle VII)
- [x] T004 Iterate the regression test to run against the NEW `detectMeasures(events, bpm)` contract (import the helper before it exists, driving the interface from contracts/free-mode-detection.md) — test still fails (function missing) — RED
- [x] T005 [P] Implement `computeNoteValue(steps)` in `frontend/plugins/practice-view-plugin/freePractice.helpers.ts` (steps→'1/16'|'1/8'|'1/4'|'half'|'whole' per contract; pure)
- [x] T006 [P] Implement `quantizeNote(relMs, msPerBeat)` in `frontend/plugins/practice-view-plugin/freePractice.helpers.ts`: startStep=clamp(round(rel/(msPerBeat/4)),0,15); durationSteps=clamp(round(durationMs/(msPerBeat/4)),1,16-startStep)
- [x] T007 Implement `detectMeasures(events, bpm)` in `frontend/plugins/practice-view-plugin/freePractice.helpers.ts`: first-onset anchor (measures[0].startMs=events[0].timestampMs), beat=60000/bpm, per-measure 16-step grid, onset→measure mapping, durationSteps clamp, `complete` flag (exactly-16-steps), rests ONLY for genuine ≥1-beat gaps (R-006), at most one trailing partial measure (FR-006), empty events→[]
- [x] T008 [P] Implement `freeModeToPluginNotes(measures, bpm)` in `frontend/plugins/practice-view-plugin/freePractice.helpers.ts` (Grid-position → PluginNoteEvent[]; identical staff/save/replay timestamps; FR-007, SC-005)
- [x] T009 Extend `freePractice.helpers.test.ts` with unit coverage for `detectMeasures`/`quantizeNote`/`computeNoteValue`/`freeModeToPluginNotes`: empty events (→[]), single measure partial (FR-006), rests ≥1 beat (SC-003), ties across bar line (acrossBarLine flag, sums still exact — FR-009), chord (two onsets same cell → one step, FR-010)

**Checkpoint**: Foundation is complete — US1–US3 can begin. Regression test T003 is GREEN.

---

## Phase 3: User Story 1 — Complete Measures from Beat-Aligned Quarter Notes (Priority: P1) 🎯 MVP

**Goal**: The reported 8-on-beat-quarters scenario renders as two complete 4×1/4 measures on the live staff, in the saved record, and in replay.

**Independent Test**: `npx vitest run frontend/plugins/practice-view-plugin/freePractice.helpers.test.ts` green for the SC-001 regression; manual Scenario A in quickstart.md.

### Tests for User Story 1 (REQUIRED — Principle V/VII)

- [x] T010 [P] [US1] Add SC-001 acceptance test in `frontend/plugins/practice-view-plugin/freePractice.helpers.test.ts`: quantify measure-complete sums (each measure 16 steps), note-value only quarters, zero rests (mirrors T003 but as behavior-level assertions across bpm 60/80/120)
- [x] T011 [P] [US1] Add metronome-agnostic assertion in `frontend/plugins/practice-view-plugin/freePractice.helpers.test.ts`: `detectMeasures` takes NO metronome state and returns identical structure given the same events (SC-007), documenting API contract

### Implementation for User Story 1

- [x] T012 [P] [US1] Add `buildDetectedMeasures`/`detectMeasures` export surface + `MEASURE_NUMERATOR=4`, `STEPS_PER_SPECIAL=16`, `MIN_REST_STEPS=4` constants in `frontend/plugins/practice-view-plugin/freePractice.helpers.ts` (replaces `FREE_STEPS_PER_MEASURE` usage; keep backward-compat export if US1 tests/other files import it)
- [x] T013 [US1] Rewire `useFreePractice.ts` in `frontend/plugins/practice-view-plugin/useFreePractice.ts`: remove the wall-clock `freeMeasureIntervalRef` measure timer and `finalizeMeasureNotes` per-window quantization; on Stop (and replay path) call `detectMeasures(freeMidiEventsRef.current, effectiveBpm)` then `freeModeToPluginNotes` to produce the `freeDisplayNotes`/record events (FR-001, FR-007). Preserve effective-BPM logic (Feature 093).
- [x] T014 [US1] Update live-staff incremental path in `useFreePractice.ts`: keep raw onsets in a buffer; on each attack, re-derive display notes from `detectMeasures` on the buffer (cheap O(n), R-008) so the staff always shows the onset-derived grid, not a wall-clock window
- [x] T015 [US1] Wire `PracticeViewPlugin.tsx` (frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx): pass `bpm={freeEffectiveBpmRef.current}` and `timestampOffset` to `context.components.StaffViewer` for the free-practice staff so WASM layout renders the corrected measure grid (no layout-engine change — Principle VI)
- [x] T016 [US1] Update `useFreePractice.test.ts` — the Feature 093 contract tests must remain green after T013 (mock `detectMeasures` or assert preserved effective-bpm behavior); add a scenario where Stop yields `freeMidiRecord.noteCount === 8` for the 8-quarter input

**Checkpoint**: US1 independently functional — Scenario A (metronome on AND off) passes end-to-end.

---

## Phase 4: User Story 2 — Measure Detection for General Beat-Aligned Input (Priority: P2)

**Goal**: Mixed beat-aligned input (halves + quarters; eighth runs; 1/16 runs) produces complete measures at every tempo in 20–300 BPM.

**Independent Test**: Manual Scenario B/C in quickstart.md + unit-level SC-002/SC-004/SC-008 in `freePractice.helpers.test.ts`.

### Tests for User Story 2

- [x] T017 [P] [US2] Add SC-002 test in `frontend/plugins/practice-view-plugin/freePractice.helpers.test.ts`: 2×half + 4×quarter spanning 2 measures → both complete, correct values
- [x] T018 [P] [US2] Add SC-004 tempo-invariance test: identical input at 20 / 60 / 120 / 240 / 300 BPM → identical measure structure (onsets scaled by msPerBeat)
- [x] T019 [P] [US2] Add SC-008 test: 1/16 run over a measure → all 1/16 values; assert no value finer than 1/16 in any output
- [x] T020 [US2] Ensure `detectMeasures` handles eighth/16th runs and holds (subdivision steps 2 and 1) with correct `computeNoteValue` mapping, and that durSteps ≥ 1 rounding never creates overwidth measures at any tempo — extend `freePractice.helpers.ts` if gaps found by T017–T019

### Implementation for User Story 2

- [x] T021 [US2] Generalize `detectMeasures` to be tempo-agnostic: verify all division uses integer 1/16 steps; add clamp guards so rounding at extreme tempos (240/300 BPM, cell ≈ 39–42 ms) cannot collapse two distinct onsets into one cell incorrectly (tie-bias earlier on half; R-003)
- [x] T022 [US2] Add performance benchmark assertion: `detectMeasures` over 500 synthetic events completes < 100 ms (R-008) — a small Vitest perf guard in `freePractice.helpers.test.ts`

**Checkpoint**: US1 and US2 both independently functional.

---

## Phase 5: User Story 3 — Robustness Under Imperfect and Complex Performances (Priority: P3)

**Goal**: Imperfect human timing, deliberate rests, ties across the bar line, chords, and mid-measure stop all keep the measure grid truthful.

**Independent Test**: Manual Scenario C/D in quickstart.md + SC-006/SC-003 unit tests; edge cases in spec.md Edge Cases list.

### Tests for User Story 3

- [x] T023 [P] [US3] Add SC-006 jitter test in `frontend/plugins/practice-view-plugin/freePractice.helpers.test.ts`: 8 quarter notes with attacks ±25%-of-beat jitter and holds short/long (e.g. 600–900 ms) → still 2 complete 4×1/4 measures, zero rests
- [x] T024 [P] [US3] Add rest-only-on-genuine-silence test (SC-003): legato stream (gaps < 1 beat) → no rests; a 1-beat deliberate gap → one 1/4 rest; 2-beat gap → one half rest
- [x] T025 [P] [US3] Add bar-line carry test (FR-009): whole note starting on beat 3 held 4 beats → sits in attack measure, spans boundary, no phantom 1/16 rest, both adjacent measures complete
- [x] T026 [P] [US3] Add chord-on-one-beat test (FR-010): three simultaneous pitches at one onset → single startStep, measure still complete
- [x] T027 [P] [US3] Add trailing-partial test (FR-006): 5 quarter notes → measure 1 complete, measure 2 partial (no auto-fill rests)
- [x] T028 [P] [US3] Add resume-after-pause test (FR-012): silence across a measure boundary then re-play → partial tail measure + re-anchored fresh measure
- [x] T029 [P] [US3] Add tempo-change-mid-session test (FR-011): onsets before/after a tempo change; keep pre-change positions, apply new msPerBeat post-change

### Implementation for User Story 3

- [x] T030 [US3] Implement greedy largest-first rest decomposition for ≥1-beat gaps producing ordinary rest values (whole/half/quarter/8th/16th) in `freePractice.helpers.ts` (R-006; absorb sub-beat gaps, never emit < 1/16)
- [x] T031 [US3] Implement acrossBarLine handling: detection clamps durations to the attack measure (FR-003), display layer renders full span — coordinate via the existing `PluginStaffViewer` WASM path (no layout-engine change; Principle VI) by emitting the note with durationSteps beyond measure end ONLY in the display payload
- [x] T032 [US3] Handle overlapping/re-triggered same-cell onsets and chord onsets as single grid positions in `detectMeasures` (no double beat-count; FR-010)
- [x] T033 [US3] Integrate pause re-anchor: detect a gap ≥ 1 measure-length of silence and start a new anchored segment for resumes, preserving the trailing partial measure (FR-012); and tempo-change re-derivation using the stored effective BPM (FR-011)
- [x] T034 [US3] Run the full `frontend/plugins/practice-view-plugin/` test suite; verify no regression in `useFreePractice.test.ts` (Feature 093) and `PracticeViewPlugin.test.tsx`

**Checkpoint**: All user stories independently functional and green.

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Consistency, documentation, and validation across all stories.

- [x] T035 [P] Update `frontend/plugins/practice-view-plugin/ARCHITECTURE.md` — document that free-practice measure detection is onset-derived and metronome-agnostic (D1/D2), replacing the wall-clock quantization description
- [ ] T036 [P] Run `specs/094-free-mode-measure-detection/quickstart.md` manual scenarios A–D on the tablet PWA; record pass/fail in the quickstart Notes
  > **Status**: Automated portion (SC-001…SC-008) covered by unit suite — passed. Manual tablet/PWA scenarios A–D require a physical device with MIDI input and are **pending user verification** (quickstart.md → Validation Notes).
- [x] T037 Remove now-dead code: confirm no references to `finalizeMeasureNotes` per-window quantization and the wall-clock `freeMeasureIntervalRef` remain (grep `frontend/plugins/practice-view-plugin/`); delete leftover exports
- [x] T038 Run the repo CI gates: `npx vitest run` for the plugin, eslint, and TypeScript typecheck; ensure all green (Constitution Quality Gates)
- [x] T039 Update the specification's Known Issues section once the fix lands: mark Issue #1 resolved with the regression test reference (Principle VII documentation currency)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational
  - US1 (P1) → US2 (P2) → US3 (P3) sequential; each independently testable checkpoint
- **Polish (Final)**: Depends on all stories complete

### User Story Dependencies

- **User Story 1 (P1)**: Depends only on Foundational — the MVP; includes the RED-regression acceptance
- **User Story 2 (P2)**: Depends on US1 (reuses `detectMeasures` generality; no new files)
- **User Story 3 (P3)**: Depends on US1 + US2 (adds robustness sub-features to `detectMeasures`)

### Within Each User Story

- Tests (REQUIRED here) MUST be written and FAIL before implementation (T010/T011 before T012–T016, etc.)
- Models/services before integration; story complete before next priority

### Parallel Opportunities

- Phase 1: T001, T002 in parallel
- Foundational: T005, T006, T008 in parallel; T003→T004→T007 sequence
- US1 tests (T010, T011) in parallel; US2 tests (T017–T019) parallel; US3 tests (T023–T029) parallel
- After Foundational, stories can be worked by different developers sequentially in priority order

---

## Parallel Example: Foundational + User Story 1

```bash
# RED regression + theory in parallel:
# T003 (write failing regression)  →  T004 (retarget to new contract) → T005/T006/T008 (pure helpers, parallel) → T007 (detectMeasures) → T009 (fill unit coverage)

vitest: "npx vitest run frontend/plugins/practice-view-plugin/freePractice.helpers.test.ts"
# US1 after Foundation:
# T010/T011 (tests) → T012 (exports) → T013/T014 (useFreePractice rewire) → T015 (PracticeViewPlugin wiring) → T016 (updated useFreePractice tests)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup (verify Vitest baseline)
2. Phase 2: Foundational (T003 RED regression → `detectMeasures` core → T009) — **CRITICAL, blocks all**
3. Phase 3: User Story 1 (rewire display/save/replay to the onset-derived core)
4. **STOP and VALIDATE**: Scenario A (metronome on AND off) + unit SC-001/SC-007
5. This is the deployable MVP: it fixes the reported 8-quarter-note scenario end-to-end

### Incremental Delivery

1. Foundation (onset-derived `detectMeasures` + regression green)
2. Add US1 → the reported bug fixed → Deploy/Demo (MVP!)
3. Add US2 → general beat-aligned input + tempo invariance → Deploy/Demo
4. Add US3 → human timing robustness, rests, bar-line carry, pause, mid-measure stop → Deploy/Demo

### Parallel Team Strategy

With multiple developers: after Foundational, Developer A on US1, Developer B on US2 prep (tests only), Developer C on US3 tests — integrations land in priority order.

---

## Notes

- **[P] tasks** = different files, no dependencies
- **[Story] label** maps task to user story for traceability
- Tests required per Constitution Principles V & VII — every story test task must FAIL before its implementation task is started
- Commit after each task or logical group
- Avoid: same-file conflicts (T013/T014 touch `useFreePractice.ts` — serialize them), cross-story dependencies breaking independence
- Baseline state of the existing suite is recorded in T001; do not treat pre-existing failures as in-scope