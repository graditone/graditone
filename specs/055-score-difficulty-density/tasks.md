---
description: "Task list for Score Difficulty Rate for Note Density"
---

# Tasks: Score Difficulty Rate for Note Density

**Input**: Design documents from `/specs/055-score-difficulty-density/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅ quickstart.md ✅
**Tests**: Included (TDD required — Constitution Principle V: Test-First Development)
**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with the adjacent task(s) (different files, no dependencies)
- **[Story]**: Which user story this task belongs to — US1, US2, US3 (maps to spec.md)
- Exact file paths are included in every description

---

## Phase 1: Setup

**Purpose**: Verify branch state and validate clean build baseline before any new code is written.

- [X] T001 Confirm active branch is `055-score-difficulty-density` and `cargo check` passes in `backend/`
- [X] T002 [P] Confirm `npm run build` passes with no errors in `frontend/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core domain types required by all three user stories. MUST be complete before US1, US2, or US3 work can begin.

**⚠️ CRITICAL**: No user story tasks can begin until T003–T007 are done.

- [X] T003 Create `backend/src/domain/difficulty/level.rs` with `DifficultyLevel` Rust enum (`Easy = 1`, `Medium = 2`, `Hard = 3`) and `DifficultyRating` struct (`density_rate: f64`, `level: DifficultyLevel`) with `serde` derives
- [X] T004 Create `backend/src/domain/difficulty/mod.rs` as module root (`pub use level::{DifficultyLevel, DifficultyRating}; pub mod density;`) and add `pub mod difficulty;` export to `backend/src/domain/mod.rs`
- [X] T005 Add `difficulty_rating: Option<DifficultyRating>` field to the `Score` struct in `backend/src/domain/score.rs`; ensure default is `None` in any `Score::new()` constructors
- [X] T006 [P] Add `DifficultyLevel` (`1 | 2 | 3`) and `DifficultyRating` TypeScript interfaces to `frontend/src/types/score.ts`; add `difficulty_rating?: DifficultyRating` to the `Score` interface

**Checkpoint**: Domain types exist in both Rust and TypeScript — user story implementation can now begin in parallel across backend (US2) and frontend (US1/US3).

---

## Phase 3: User Story 2 — Difficulty Computed Automatically on Score Load (Priority: P1)

**Goal**: When a score is loaded for the first time, the system computes its note-density difficulty rating synchronously within the WASM parse pipeline and stores it in the cached `ScoreDto`. Subsequent loads read the cached value with no recomputation.

**Independent Test**: Run `cargo test` in `backend/` — all tests in `backend/tests/difficulty_test.rs` pass; build the WASM package and confirm `parse_musicxml()` returns a `ScoreDto` with a populated `difficulty_rating` field for a known MusicXML fixture.

- [X] T007 [US2] Write failing Rust unit tests for `DifficultyLevel::from_density_rate()` in `backend/tests/difficulty_test.rs`: boundary cases at 0.0 (Easy), 1.9 (Easy), 2.0 (Medium), 4.0 (Medium), 4.01 (Hard)
- [X] T008 [US2] Implement `DifficultyLevel::from_density_rate(rate: f64) -> DifficultyLevel` in `backend/src/domain/difficulty/level.rs`; verify T007 tests pass
- [X] T009 [US2] Write failing Rust unit tests for note counting and density formula in `backend/tests/difficulty_test.rs`: 4-note chord counted as 4 pitches; tied continuations excluded; grace notes excluded; single-bar density = pitches / bar_duration_s; multi-bar `0.7 × avg + 0.3 × peak` formula; multi-instrument pick-max
- [X] T010 [US2] Implement `count_pitches_in_bar(instrument, bar_start, bar_end) -> u32` and `compute_instrument_density(score, instrument, measure_count) -> Option<DifficultyRating>` in `backend/src/domain/difficulty/density.rs`; use `score.get_tempo_at(tick)` for BPM (fallback 120), tick formula `(ticks × 60.0) / (960.0 × bpm)`, skip bars with zero duration
- [X] T011 [US2] Implement `compute_difficulty(score: &Score) -> Option<DifficultyRating>` in `backend/src/domain/difficulty/density.rs`; iterate instruments, collect `Option<DifficultyRating>`, take max by `level`; return `None` if no instrument yields a rating; verify T009 tests pass
- [X] T012 [US2] Add `DifficultyRatingDto { density_rate: f64, level: u8 }` (with `serde` derives and `skip_serializing_if = "Option::is_none"` on parent) to `backend/src/adapters/dtos.rs`; bump `SCORE_SCHEMA_VERSION` from `9` to `10`; add `difficulty_rating: Option<DifficultyRatingDto>` to `ScoreDto`; update `From<&Score> for ScoreDto` to map `difficulty_rating`
- [X] T013 [US2] Call `compute_difficulty(&score)` inside `parse_musicxml()` in `backend/src/adapters/wasm/bindings.rs`; assign returned `Option<DifficultyRating>` to `score.difficulty_rating` before building the returned `WasmImportResult`; run `cargo test` to confirm all tests pass

---

## Phase 4: User Story 1 — See Difficulty Tag When Choosing a Score (Priority: P1)

**Goal**: Each score entry in the load score dialog displays an Easy, Medium, or Hard badge. Scores without a stored rating show no badge. Applies to both the preloaded catalog list and the user-uploaded score list.

**Independent Test**: Run `npm run dev` in `frontend/`; open the load score dialog; preloaded scores each show a colored difficulty badge; a user score imported before this feature (schema v9) shows no badge (stale schema forces re-parse on next load, new rating appears after re-import).

- [X] T014 [US1] Write failing Vitest unit tests for `DifficultyTag` component in `frontend/tests/unit/DifficultyTag.test.tsx`: `undefined` prop → component renders nothing; `1` → renders text "Easy"; `2` → renders text "Medium"; `3` → renders text "Hard"
- [X] T015 [US1] Implement `DifficultyTag` React component in `frontend/src/components/load-score/DifficultyTag.tsx` accepting `{ level: DifficultyLevel | undefined }`; return `null` when `level` is `undefined`; render a styled badge span with text and `aria-label` for accessibility; verify T014 tests pass
- [X] T016 [US1] Integrate `DifficultyTag` into `frontend/src/components/load-score/PreloadedScoreList.tsx` — import component and pass `score.difficulty_rating?.level` as the `level` prop alongside each score entry
- [X] T017 [US1] Extend the `UserScore` index shape in `frontend/src/services/userScoreIndex.ts` with `difficulty_level?: DifficultyLevel`; update the import pipeline writer (where `UserScore` entries are created/updated) to populate `difficulty_level` from the parsed `ScoreDto.difficulty_rating?.level`
- [X] T018 [US1] Integrate `DifficultyTag` into `frontend/src/components/load-score/UserScoreList.tsx` — import component and pass `userScore.difficulty_level` as the `level` prop alongside each user score entry

---

## Phase 5: User Story 3 — Correct Difficulty Level Mapping Validation (Priority: P2)

**Goal**: Confirm the three difficulty thresholds (< 2 → Easy, 2–4 → Medium, > 4 → Hard) produce human-plausible results for the bundled reference scores. Any threshold mismatch surfaces as a failing test that documents the decision.

**Independent Test**: Run `cargo test` in `backend/` targeting difficulty reference tests — all reference score assertions pass and match human-perceived difficulty expectations.

- [X] T019 [US3] Write Rust integration tests in `backend/tests/difficulty_test.rs` that parse each bundled reference MusicXML file and assert the expected level: `Fur_Elise.mxl` → Easy; `Arabesque.mxl` → Medium; `Chopin_NocturneOp9No2.mxl` → Medium; `Bach_InventionNo1.mxl` → Medium; `Pachelbel_CanonD.mxl` → Easy
- [X] T020 [US3] Run `cargo test` for T019 assertions; if any expected level is wrong, record the actual computed `density_rate` in `specs/055-score-difficulty-density/research.md` under a new "Reference Score Calibration" section, revise the test expectation to match reality, and note the rationale (do not change the threshold constants without explicit product decision)

---

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: Full regression pass, accessibility check, and E2E smoke test.

- [X] T021 Run `cargo test` in `backend/` — verify all tests pass with no regressions introduced by schema v10 change
- [X] T022 [P] Run `npm run test` in `frontend/` — verify all Vitest tests pass with no regressions
- [X] T023 [P] Confirm `DifficultyTag` renders an accessible `aria-label` (e.g. `aria-label="Difficulty: Easy"`) in `frontend/src/components/load-score/DifficultyTag.tsx`; update T014 tests to assert the attribute is present
- [X] T024 Write Playwright E2E smoke test in `frontend/e2e/difficulty-tag.spec.ts`: open the load score dialog; assert at least one preloaded score entry contains an element with text "Easy", "Medium", or "Hard"; assert no score entry shows a blank or "Unknown" tag

---

## Phase 6: Polyphony Enhancement & Calibration

**Purpose**: Add polyphony as a secondary difficulty factor alongside note density. Switch to tempo-independent notes-per-beat formula. Recalibrate thresholds. Update preloaded difficulty map.

**Prerequisite**: All Phase 1–5 tasks complete (T001–T024).

- [X] T025 [US2] Change `count_pitches_in_bar()` in `backend/src/domain/difficulty/density.rs` from summing across staves to per-staff maximum (hardest single hand)
- [X] T026 [US2] Change density formula from notes-per-second to notes-per-beat (tempo-independent): replace `bar_duration_s = (ticks × 60.0) / (960.0 × bpm)` with `bar_duration_beats = ticks / 960.0`; remove `DEFAULT_BPM` constant
- [X] T027 [US2] Implement `compute_bar_polyphony(instrument, bar_start, bar_end) -> (f64, f64)` in `backend/src/domain/difficulty/density.rs`: sample polyphony at each note onset tick, per-staff maximum, return (avg, max)
- [X] T028 [US2] Implement combined formula in `compute_instrument_difficulty()`: `note_density = 0.7×avg + 0.3×peak`, `polyphony = 0.7×avg_poly + 0.3×max_poly`, `combined = 0.6×density + 0.4×polyphony`
- [X] T029 [US3] Calibrate thresholds in `backend/src/domain/difficulty/level.rs`: `< 2.5 → Easy`, `2.5–3.5 → Medium`, `> 3.5 → Hard`; verify reference scores: Pachelbel=Easy, La Candeur=Easy, Arabesque=Medium, Bach=Medium, Fur Elise=Hard, Nocturne=Hard
- [X] T030 [US2] Update unit tests in `backend/tests/difficulty_test.rs`: threshold boundary tests (2.4→Easy, 2.5→Medium, 3.5→Medium, 3.51→Hard); density computation tests with correct combined-formula expected values
- [X] T031 [US3] Update reference test assertions in `backend/tests/difficulty_reference_test.rs` to match new levels: Bach→Medium, Fur Elise→Hard, Arabesque→Medium, La Candeur→Easy, Nocturne→Hard, Pachelbel→Easy
- [X] T032 [US1] Update `PRELOADED_DIFFICULTY_LEVELS` in `frontend/src/data/preloadedScores.ts` with calibrated levels: bach=2, fur-elise=3, arabesque=2, la-candeur=1, nocturne=3, pachelbel=1
- [X] T033 Remove debug `eprintln!` logging from `backend/src/domain/difficulty/density.rs`
- [X] T034 [P] Update spec docs: `spec.md` (polyphony formula, new thresholds), `data-model.md` (BarPolyphony, updated thresholds), `research.md` (calibration table, new decisions D-009/D-010), `plan.md` (summary formula)
- [X] T035 Run full regression: `cargo test` (453 passed, 0 failed), `npx vitest run` (1664 passed, 0 failed), `npx tsc --noEmit` (no errors)

---

## Dependencies

Story completion order (implementation dependency, not just spec priority):

```
T001–T002 (Setup)
    └─▶ T003–T006 (Foundational: Rust + TS domain types)
             ├─▶ T007–T013 (US2: Compute + pipeline + schema)
             │        └─▶ T019–T020 (US3: Reference score validation)
             └─▶ T014–T018 (US1: Display in dialog)
                      └─▶ T021–T024 (Polish: Regression + E2E)
```

**Key dependency constraints**:
- T005 must precede T012 (`Score.difficulty_rating` field must exist before `ScoreDto` conversion is updated)
- T012 must precede T013 (schema and DTO must exist before WASM wiring)
- T013 must precede T019 (T019 integration tests require the full pipeline to be wired)
- T006 must precede T014 (TypeScript types must exist before component tests can import them)
- T017 must precede T018 (`UserScore` index shape must be extended before `UserScoreList` can read `difficulty_level`)
- US2 (T007–T013) and US1 (T014–T018) can be developed in parallel once Phase 2 is complete

---

## Parallel Execution Examples

### Two-developer split after Phase 2

| Developer A (Backend) | Developer B (Frontend) |
|-----------------------|------------------------|
| T007 Write DifficultyLevel tests | T014 Write DifficultyTag tests |
| T008 Implement from_density_rate() | T015 Implement DifficultyTag component |
| T009 Write density computation tests | T016 Wire DifficultyTag into PreloadedScoreList |
| T010 Implement count_pitches_in_bar() | T017 Extend UserScore index |
| T011 Implement compute_difficulty() | T018 Wire DifficultyTag into UserScoreList |
| T012 Schema v10 + DifficultyRatingDto | *(wait for T013)* |
| T013 Wire WASM pipeline | *(merge point)* |
| T019–T020 Reference score validation | T021–T024 Polish + E2E |

### Single-developer fast path (MVP: US2 + US1)

```
T001 → T002 → T003 → T004 → T005 → T006
                                    ↓
T007 → T008 → T009 → T010 → T011 → T012 → T013
                                            ↓
T014 → T015 → T016 → T017 → T018 → T021 → T022
```

US3 (T019–T020) and Polish (T023–T024) can follow after MVP is verified.

---

## Implementation Strategy

### MVP First (US2 + US1)

1. Complete Phase 1: Setup (T001–T002)
2. Complete Phase 2: Foundational (T003–T006)
3. Complete Phase 3: US2 — computation pipeline (T007–T013)
4. **CHECKPOINT**: `cargo test` passes; WASM output includes `difficulty_rating`
5. Complete Phase 4: US1 — UI display (T014–T018)
6. **STOP and VALIDATE**: Open load score dialog — difficulty tags visible for all preloaded scores
7. Deploy or demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US2 done → Backend computes and persists difficulty (no visible change in UI yet)
3. US1 done → Tags appear in dialog → **MVP ready for release**
4. US3 done → Reference score calibration validated → Quality gate passed
5. Polish done → Accessibility and regression coverage complete

---

## Notes

- `[P]` tasks operate on different files with no inter-task dependencies — safe for parallel execution
- `[USN]` label maps each task to a specific user story for traceability
- Tests MUST fail before the corresponding implementation task is started (TDD)
- Schema version bump (9→10) automatically triggers stale-cache re-parse for any existing user score — the difficulty rating will be populated on first load after the upgrade with no migration needed
- The `UserScore` localStorage index extension (T017) is required to display tags for user-uploaded scores without loading the full `Score` from IndexedDB on every dialog open
- Commit after each phase checkpoint for clean rollback points
- Reference score `.mxl` files are in `scores/` at the repository root
