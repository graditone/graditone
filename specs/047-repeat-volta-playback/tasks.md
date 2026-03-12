# Tasks: Volta Bracket Playback (Repeat Endings)

**Input**: Design documents from `/specs/047-repeat-volta-playback/`  
**Branch**: `047-repeat-volta-playback`  
**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · contracts/ ✅

## Format: `[ID] [P?] [Story?] Description with file path`

- **[P]**: Can run in parallel (different files, no incomplete task dependencies)
- **[US#]**: User story label (US1–US4 map to spec.md priorities P1–P4)

---

## Phase 1: Setup

**Purpose**: Create required new files so all subsequent edit tasks have an existing target.

- [x] T001 Create `backend/tests/volta_brackets_integration.rs` with module declaration, TODO marker, and `use musicore_backend::domain::repeat::VoltaBracket;` import stub

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the `VoltaBracket` domain entity and updated `Score` model in both Rust and TypeScript. No user story can compile or run until this phase is complete.

**⚠️ CRITICAL**: All story phases (3–6) depend on this phase being complete.

- [x] T002 Add `VoltaEndType` enum and `VoltaBracket` struct (with `number`, `start_measure_index`, `end_measure_index`, `start_tick`, `end_tick`, `end_type` fields) to `backend/src/domain/repeat.rs`
- [x] T003 [P] Add `VoltaEndType` type alias and `VoltaBracket` TypeScript interface mirroring the Rust struct, and add `volta_brackets?: VoltaBracket[]` to the `Score` interface in `frontend/src/types/score.ts`
- [x] T004 Add `volta_brackets: Vec<VoltaBracket>` field to the `Score` struct and `volta_brackets: Vec::new()` to `Score::new()` in `backend/src/domain/score.rs`
- [x] T005 Add `#[serde(default)] pub volta_brackets: Vec<VoltaBracket>` to `ScoreDto`, update the `From<&Score> for ScoreDto` impl to map `volta_brackets`, and bump `SCORE_SCHEMA_VERSION` from 6 to 7 in `backend/src/adapters/dtos.rs`

**Checkpoint**: `cargo check` passes — all Rust types compile. `tsc --noEmit` passes in `frontend/`.

---

## Phase 3: User Story 1 — Playback Skips First Ending on Repeat (Priority: P1) 🎯 MVP

**Goal**: `expandNotesWithRepeats` skips notes inside a first-ending bracket on the second pass, and the call sites pass `volta_brackets` from the score.

**Independent Test**: `cd frontend && npm run test -- RepeatNoteExpander` — all tests pass including `volta bracket - first ending skipped on second pass`.

- [x] T006 [US1] Create `frontend/src/services/playback/RepeatNoteExpander.test.ts` with failing unit tests covering: (a) first-ending notes absent from expanded output on second pass, (b) first-ending notes present on first pass, (c) no change when `voltaBrackets` is undefined (SC-004 regression guard)
- [x] T007 [US1] Extend `expandNotesWithRepeats` in `frontend/src/services/playback/RepeatNoteExpander.ts` to accept an optional third parameter `voltaBrackets?: VoltaBracket[]`, detect the first-ending bracket per repeat section, skip first-ending notes on `pass === 1`, and apply `tickOffset` compression by `firstEndingDuration` so post-section notes remain correctly positioned
- [x] T008 [P] [US1] Update `frontend/src/components/ScoreViewer.tsx` to pass `score.volta_brackets` as the third argument to `expandNotesWithRepeats`
- [x] T009 [P] [US1] Update all `expandNotesWithRepeats` call sites in `frontend/src/plugin-api/scorePlayerContext.ts` to pass `scoreObject.volta_brackets` as the third argument

**Checkpoint**: `npm run test -- RepeatNoteExpander` — US1 tests green. SC-004 regression guard green. US1 is independently deliverable and testable.

---

## Phase 4: User Story 2 — Second Ending Plays Correctly After Jump (Priority: P2)

**Goal**: After the first-ending skip, notes in the second-ending bracket are heard at the correct virtual tick positions on the second pass.

**Independent Test**: `cd frontend && npm run test -- RepeatNoteExpander` — new US2 test cases pass in addition to all US1 tests.

- [x] T010 [US2] Add failing unit tests for second-ending continuation to `frontend/src/services/playback/RepeatNoteExpander.test.ts`: (a) second-ending notes present at correct ticks on second pass, (b) second-ending notes absent from first pass, (c) `discontinue` end-type does not trigger an extra jump (US2 scenario 3)
- [x] T011 [US2] Verify that the tick-offset compression implemented in T007 correctly repositions second-ending notes (`start_tick >= firstEnding.end_tick` on second pass gets `offset - fe_dur`); add any missing compressed-offset logic to `frontend/src/services/playback/RepeatNoteExpander.ts`

**Checkpoint**: All US1 + US2 tests green. First and second endings now sound correctly for any score that has inline `volta_brackets` data.

---

## Phase 5: User Story 3 — Volta Brackets Rendered Visually (Priority: P3)

**Goal**: The Rust layout engine outputs positioned `VoltaBracketLayout` objects per system; the React renderer draws the bracket line, label, and optional closing stroke.

**Independent Test**: Load Burgmuller Arabesque in the browser — "1." and "2." bracket lines appear above measures 10 and 11 with correct open/closed right ends. (Requires US4 import to be complete for real score data, or a mock score with inline `volta_brackets` for a unit test.)

- [x] T012 [P] [US3] Add `VoltaBracketLayout` struct (`number: u8`, `label: String`, `x_start: f32`, `x_end: f32`, `y: f32`, `closed_right: bool`) and add `pub volta_bracket_layouts: Vec<VoltaBracketLayout>` to the `System` struct in `backend/src/layout/types.rs`
- [x] T013 [P] [US3] Add `VoltaBracketLayout` TypeScript interface and `volta_bracket_layouts?: VoltaBracketLayout[]` to the `System` interface in `frontend/src/wasm/layout.ts`
- [x] T014 [US3] In `backend/src/layout/mod.rs`, extract `volta_brackets` from the score JSON (mirroring the existing `repeat_barlines` extraction pattern), compute x/y coordinates for each bracket's system span, and populate `system.volta_bracket_layouts` for every system the bracket overlaps
- [x] T015 [US3] In `frontend/src/components/notation/NotationRenderer.tsx`, map over `system.volta_bracket_layouts` to render each bracket as: a horizontal `<line>` at `y`, a left-side vertical stroke, a `<text>` label ("1." / "2.") near the left end, and a right-side vertical closing stroke only when `closed_right === true`

**Checkpoint**: WASM rebuild (`wasm-pack build`) succeeds. Load Arabesque in `npm run dev` — brackets visible. US3 visually testable.

---

## Phase 6: User Story 4 — MusicXML Ending Elements Imported (Priority: P4)

**Goal**: `<ending>` elements in MusicXML barlines are parsed and materialised as `VoltaBracket` values in the score's `volta_brackets` collection.

**Independent Test**: `cd backend && cargo test --test volta_brackets_integration` — all tests green.

- [X] T016 [P] [US4] Add private `EndingParseType` enum (`Start`, `Stop`, `Discontinue`), `RawEndingData` struct (`number: u8`, `end_type: EndingParseType`), and `ParsedBarlineResult` struct (`start_repeat: bool`, `end_repeat: bool`, `ending: Option<RawEndingData>`) to `backend/src/domain/importers/musicxml/parser.rs`
- [X] T017 [P] [US4] Add failing integration tests to `backend/tests/volta_brackets_integration.rs`: (a) La Candeur imports exactly 1 volta bracket (number=1, measure_index=15, end_type=Stop), (b) Arabesque imports 4 volta brackets across 2 repeat sections, (c) a score with no `<ending>` elements produces `volta_brackets.len() == 0`
- [X] T018 [US4] Refactor `parse_barline_content` in `backend/src/domain/importers/musicxml/parser.rs` to return `ParsedBarlineResult` instead of `(bool, bool)`, parsing `<ending>` child elements and populating `ending: Some(RawEndingData { .. })` when present; update all call sites of the old signature
- [X] T019 [US4] In `backend/src/domain/importers/musicxml/mapper.rs`, read `ParsedBarlineResult.ending` from each measure's left and right barline results, accumulate `Start` events into a scratch map keyed by `number`, merge matching `Stop`/`Discontinue` events, and push the completed `VoltaBracket` onto `score.volta_brackets` with correct `start_tick`/`end_tick` derived from measure tick boundaries

**Checkpoint**: `cargo test --test volta_brackets_integration` — all 3 test cases green. Full pipeline from MusicXML → `volta_brackets` on `Score` now works.

---

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: Backward compatibility regression guard and end-to-end sounded-measure count verification.

- [X] T020 [P] Add SC-004 backward compat test to `frontend/src/services/playback/RepeatNoteExpander.test.ts`: call `expandNotesWithRepeats(notes, repeatBarlines, undefined)` and assert the output is identical to the pre-feature behaviour (no volta logic applied when `voltaBrackets` is omitted)
- [X] T021 [P] Add SC-001 end-to-end expansion test to `frontend/src/services/playback/RepeatNoteExpander.test.ts`: construct inline `repeatBarlines` and `voltaBrackets` matching La Candeur's structure (measures 1–16 as section, first-ending at measure 16), expand 38 synthetic notes (one per raw measure × 2 passes minus the skipped first-ending), and assert the expanded note array contains exactly 38 notes

---

## Dependency Graph (User Story Completion Order)

```
T001 (stub)
  └─ T017 (failing tests use stub file)

T002 (Rust VoltaBracket type)
  └─ T004 (Score struct)
       └─ T005 (ScoreDto v7)            ← needed before US4 round-trips work
            └─ T019 (mapper output)

T003 (TS VoltaBracket type)             ← parallel with T002
  └─ T006 (TS tests — needs type shape)
       └─ T007 (expander implementation)
            ├─ T008 [P], T009 [P]       ← US1 complete
            ├─ T010 (US2 tests)
            │    └─ T011                ← US2 complete
            ├─ T020 [P] (backward compat)
            └─ T021 [P] (38-measure SC-001)

T012 [P] (Rust layout type)
  └─ T014 (layout computation)
       └─ (layout WASM rebuild)

T013 [P] (TS layout type)               ← parallel with T012
  └─ T015 (renderer)                   ← US3 complete

T016 [P] (parser private types)
  └─ T018 (parse_barline_content refactor)
       └─ T019 (mapper VoltaBracket emission) ← US4 complete
```

---

## Parallel Execution — Phase-by-Phase

| Phase | Parallel group A | Parallel group B |
|-------|-----------------|-----------------|
| 2 Foundational | T002, T003 together | then T004 → T005 in sequence |
| 3 US1 | T006 → T007, then T008 + T009 together | — |
| 4 US2 | T010 → T011 in sequence | — |
| 5 US3 | T012 + T013 together | then T014 → T015 in sequence |
| 6 US4 | T016 + T017 together | then T018 → T019 in sequence |
| Polish | T020 + T021 together | — |

---

## Implementation Strategy

**MVP scope (US1 only)**: T001 → T002 + T003 → T004 → T005 → T006 → T007 → T008 + T009 → T020  
After MVP: T010–T011 (US2), then T012–T015 (US3), then T016–T019 (US4), then T021.

The four user stories can be treated as independent vertical slices after Phase 2 is complete:
- US1 (P1) delivers playback correctness for La Candeur immediately
- US2 (P2) extends US1 to handle scores with second endings (Arabesque, Für Elise)
- US3 (P3) adds visual bracket rendering — playback already correct from US1/US2
- US4 (P4) provides real MusicXML data; US1/US2 can be validated with inline test fixtures first
