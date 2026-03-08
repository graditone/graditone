# Tasks: Repeat Barlines (041)

**Input**: Design documents from `/specs/041-repeat-barlines/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `backend/src/`, `backend/tests/`
- **Frontend**: `frontend/src/`, `frontend/plugins/`

---

## Phase 1: Setup

**Purpose**: Register new Rust module so all downstream tasks can import from it

- [X] T001 Register `mod repeat;` in `backend/src/domain/mod.rs` — expose the new `repeat` module path for use by `score.rs` and the layout engine

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core domain types that MUST exist before any user story can compile or be tested

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 [P] Create `backend/src/domain/repeat.rs` — define `RepeatBarlineType { Start, End, Both }` enum and `RepeatBarline { measure_index: u32, start_tick: u32, end_tick: u32, barline_type: RepeatBarlineType }` struct, both with `#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]`
- [X] T003 Extend `backend/src/domain/score.rs` — add `#[serde(default)] pub repeat_barlines: Vec<RepeatBarline>` field to `Score` struct; add `use crate::domain::repeat::RepeatBarline;` import (depends on T002)
- [X] T004 [P] Extend `frontend/src/types/score.ts` — add `RepeatBarlineType = 'Start' | 'End' | 'Both'` type alias; add `RepeatBarline { measure_index, start_tick, end_tick, barline_type }` interface; add `repeat_barlines?: RepeatBarline[]` optional field to `Score` interface

**Checkpoint**: Foundation ready — Rust `Score` has `repeat_barlines`, TypeScript `Score` has `repeat_barlines?`. User story implementation can begin.

---

## Phase 3: User Story 1 — Playback Follows Repeat Sections (Priority: P1) 🎯 MVP

**Goal**: Scores with repeat barlines play back all sections in the correct order. La Candeur produces exactly 39 sounded measures.

**Independent Test**: Import La Candeur, press Play, verify the playback duration matches 39 measures (not 23). Unit-test `RepeatNoteExpander` with fixture `RepeatBarline` objects — no full import pipeline required.

### Implementation for User Story 1

- [X] T005 [US1] Create `frontend/src/services/playback/RepeatNoteExpander.ts` — implement `export function expandNotesWithRepeats(notes: Note[], repeatBarlines: RepeatBarline[] | undefined): Note[]`; pair `End` markers with nearest preceding `Start` (or tick 0); iterate sections in order with running `tick_offset` accumulator; copy section notes with offset applied for each pass; return identity array when `repeatBarlines` is empty/undefined; all tick arithmetic uses integer operations per contract in `specs/041-repeat-barlines/contracts/typescript-repeat-note-expander.md`
- [X] T006 [P] [US1] Update `frontend/src/components/ScoreViewer.tsx` — import `expandNotesWithRepeats` from `../services/playback/RepeatNoteExpander`; apply it to `rawNotes` before passing to `usePlayback(allNotes, initialTempo)` using `score.repeat_barlines` (depends on T005)
- [X] T007 [P] [US1] Update `frontend/plugins/score-player/scorePlayerContext.ts` — same pattern as T006: import `expandNotesWithRepeats`, call before `usePlayback()` with `score.repeat_barlines` (depends on T005)

**Checkpoint**: `RepeatNoteExpander` unit tests pass. La Candeur playback produces 39 measures end-to-end (requires US3 import data; can validate with fixture data before US3 is done).

---

## Phase 4: User Story 2 — Repeat Barlines Rendered in Score (Priority: P2)

**Goal**: La Candeur displays three distinct repeat barline types (start-repeat, end-repeat) at the correct measure boundaries, each with the standard thick bar and two dots.

**Independent Test**: Load a JSON score fixture with `repeat_barlines` hardcoded, verify the layout output contains `BarLine` entries with `bar_type: 'RepeatEnd'` / `'RepeatStart'` and non-empty `dots` arrays. Visually inspect La Candeur in the browser.

### Implementation for User Story 2 — Rust Layout Engine

- [X] T008 [P] [US2] Extend `backend/src/layout/types.rs` — add `RepeatStart`, `RepeatEnd`, `RepeatBoth` variants to `BarLineType` enum; add `RepeatDotPosition { x: f32, y: f32, radius: f32 }` struct with serde derives; add `pub dots: Vec<RepeatDotPosition>` field to `BarLine` struct (default `vec![]` for existing non-repeat types)
- [X] T009 [P] [US2] Extend `backend/src/layout/breaker.rs` — add `pub start_repeat: bool` and `pub end_repeat: bool` fields to `MeasureInfo` struct, both defaulting to `false`
- [X] T010 [US2] Update `compute_layout()` in `backend/src/layout/mod.rs` — after extracting `measures`, read `score["repeat_barlines"]` JSON array; for each entry, look up the corresponding `MeasureInfo` by `measure_index` and set `start_repeat`/`end_repeat` flags; update `MeasureInfo` construction to include the new boolean fields (depends on T009)
- [X] T011 [US2] Update `create_bar_lines()` in `backend/src/layout/mod.rs` — inspect `measure_infos[i].end_repeat` and `measure_infos[i+1].start_repeat` at each boundary; produce `RepeatBoth` when both flags are set, `RepeatEnd` for end only, `RepeatStart` for start only; compute `RepeatDotPosition` values using staff-space geometry per contract in `specs/041-repeat-barlines/contracts/wasm-layout-barline-types.md` (`dot_radius = 0.25 * staff_space`; `x_offset = 0.6 * staff_space`; two dots at `y = staff_top + 1.0 * staff_space` and `y = staff_top + 3.0 * staff_space` per staff); populate `BarLine.dots` (depends on T008, T010)

### Implementation for User Story 2 — TypeScript Frontend

- [X] T012 [P] [US2] Extend `frontend/src/wasm/layout.ts` — add `'RepeatStart' | 'RepeatEnd' | 'RepeatBoth'` to `BarLineType` union; add `RepeatDot { x: number; y: number; radius: number }` interface; add `dots?: RepeatDot[]` optional field to `BarLine` interface
- [X] T013 [US2] Update `frontend/src/components/LayoutRenderer.tsx` — in `renderBarLine()`, for `bar_type` values `'RepeatStart'`, `'RepeatEnd'`, `'RepeatBoth'`, iterate `barLine.dots` and render an SVG `<circle>` at `(dot.x, dot.y)` with `r={dot.radius}` per coordinate values from layout output; do NOT recalculate dot positions in TypeScript (Constitution Principle VI) (depends on T012)

**Checkpoint**: Layout output for La Candeur contains `BarLine` entries with `bar_type: 'RepeatEnd'` (×2) and `'RepeatStart'` (×1), each with 2 dot entries. Browser shows correct repeat barline visuals at measure boundaries 8, 9, and 16.

---

## Phase 5: User Story 3 — MusicXML Repeat Barlines Imported (Priority: P3)

**Goal**: Importing La Candeur's MusicXML file produces `score.repeat_barlines` with exactly 3 entries at measure indices 7, 8, and 15 with the correct `barline_type` values.

**Independent Test**: Rust integration test imports La Candeur and asserts `repeat_barlines` contents. No frontend or layout code is required.

### Implementation for User Story 3

- [X] T014 [P] [US3] Extend `backend/src/domain/importers/musicxml/types.rs` — add `pub start_repeat: bool` and `pub end_repeat: bool` fields to `MeasureData` struct, both defaulting to `false` (update `Default` impl or `..Default::default()` usages)
- [X] T015 [US3] Update `backend/src/domain/importers/musicxml/parser.rs` — inside the `<measure>` parsing loop, handle `<barline>` elements; for `location="left"` + child `<repeat direction="forward"/>` set `current_measure.start_repeat = true`; for `location="right"` + child `<repeat direction="backward"/>` set `current_measure.end_repeat = true`; ignore all other `<barline>` content without error (depends on T014)
- [X] T016 [US3] Update `backend/src/domain/importers/musicxml/converter.rs` — after measures are parsed, iterate `MeasureData` slice with index; for each measure with `start_repeat || end_repeat`, compute `start_tick = index * ticks_per_measure` and `end_tick = start_tick + ticks_per_measure`; push the appropriate `RepeatBarline` entry per contract in `specs/041-repeat-barlines/contracts/rust-domain-repeat-barline.md`; assign the populated `Vec<RepeatBarline>` to `Score.repeat_barlines` (depends on T015, T003)
- [X] T017 [US3] Create `backend/tests/repeat_barlines_integration.rs` — load and parse `scores/Burgmuller_LaCandeur.mxl`; assert `score.repeat_barlines.len() == 3`; assert entries at `measure_index` 7 (`End`), 8 (`Start`), 15 (`End`) with correct `start_tick`/`end_tick` values (26880/30720, 30720/34560, 57600/61440) per SC-003 (depends on T016)

**Checkpoint**: `cargo test --test repeat_barlines_integration` passes. La Candeur import produces exactly 3 repeat barlines. End-to-end flow (import → layout → playback) is now fully functional for all three stories.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Regression validation and full-stack end-to-end verification

- [X] T018 [P] Run `cargo test` in `backend/` — assert all pre-existing tests remain green; no regressions in layout, importer, or domain tests per SC-004
- [X] T019 [P] Run `npm test` in `frontend/` — assert all pre-existing Vitest tests pass; `RepeatNoteExpander` identity case (no repeats) returns unchanged array
- [X] T020 Run end-to-end validation per `specs/041-repeat-barlines/quickstart.md` — complete all 4 verification steps: (1) La Candeur has 3 repeat barlines in parsed model, (2) 3 repeat barline visuals visible at correct boundaries, (3) playback produces 39 sounded measures, (4) all 5 pre-existing fixture scores play back and render unchanged

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — **BLOCKS** all user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2 completion
- **User Story 2 (Phase 4)**: Depends on Phase 2 completion
- **User Story 3 (Phase 5)**: Depends on Phase 2 completion
- **Polish (Phase 6)**: Depends on all desired user stories complete

### User Story Dependencies

| Story | Depends on | Can start after | Independent? |
|---|---|---|---|
| US1 — Playback (P1) | Phase 2 only | T003, T004 | ✅ Unit-testable with fixture data |
| US2 — Rendering (P2) | Phase 2 only | T003, T004 | ✅ Unit-testable with JSON fixture |
| US3 — Import (P3) | Phase 2 only | T003 | ✅ Fully independent Rust test |

> **Note**: US3 is P3 in the spec but is the **data source** for US1 and US2. The full end-to-end flow requires US3 complete. US1 and US2 can be developed and unit-tested in isolation using fixture `RepeatBarline` objects before US3 is done.

### Within Each Phase

- Models/types before services
- Services before integration points
- `create_bar_lines()` (T011) requires both `BarLineType` extension (T008) and `MeasureInfo` flags (T009 → T010)
- `LayoutRenderer.tsx` (T013) requires TypeScript mirror types (T012) and rebuilt WASM output from T011

### Parallel Opportunities

**Phase 2 — Foundational**:
- T002 (Rust domain) and T004 (TypeScript types) can run in parallel — different languages, different files
- T003 is sequential after T002

**Phase 4 — US2 Rendering**:
- T008 (layout/types.rs) and T009 (layout/breaker.rs) can run in parallel — different files
- T012 (frontend/wasm/layout.ts) can run in parallel with T008–T011 — different repository layer

**Phase 3 and Phase 4**:
- US1 (Phase 3) and US2 (Phase 4) can run in parallel once Phase 2 is complete — no code dependencies between them

---

## Parallel Execution Example: User Story 1

```
AFTER Phase 2 complete:
  Developer A: T005 (RepeatNoteExpander.ts)
    → T006 (ScoreViewer.tsx) + T007 (scorePlayerContext.ts) [parallel pair]

  Wall time: 2 sequential steps (T005 → T006+T007)
```

## Parallel Execution Example: User Story 2

```
AFTER Phase 2 complete:
  Developer A: T008 (layout/types.rs) + T009 (layout/breaker.rs) [parallel pair]
    → T010 (compute_layout mod.rs, after T009)
    → T011 (create_bar_lines mod.rs, after T008 + T010)

  Developer B (frontend): T012 (wasm/layout.ts) [fully parallel with T008-T011]
    → T013 (LayoutRenderer.tsx, after T012)

  Wall time: 4 sequential steps on critical path (T008/T009 → T010 → T011 → T013)
  With parallel frontend work, T012+T013 overlaps with T008→T010→T011
```

---

## Implementation Strategy

### MVP First (User Story 1 — Playback)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002–T004)
3. Complete Phase 3: User Story 1 (T005–T007)
4. **STOP and VALIDATE**: Test playback with fixture data; verify `RepeatNoteExpander` produces correct tick-expanded note arrays
5. Proceed to US2 or US3 depending on team priority

### Incremental Delivery

1. **Foundation** (T001–T004) → types in place for all stories
2. **US1 Playback** (T005–T007) → can be unit-tested with fixture data immediately
3. **US2 Rendering** (T008–T013) → layout engine emits repeat types + dots; renderer draws them
4. **US3 Import** (T014–T017) → full pipeline complete; end-to-end La Candeur test passes
5. **Polish** (T018–T020) → regression validation + quickstart walkthrough

### Parallel Team Strategy

With two developers, once Phase 2 is complete:
- **Developer A**: US1 (T005 → T006 + T007)
- **Developer B**: US2 (T008 + T009 → T010 → T011) + US3 (T014 → T015 → T016 → T017)

---

## Notes

- [P] tasks = different files, no shared dependencies — safe to run simultaneously
- Each user story is independently completable and testable using fixture/hardcoded `RepeatBarline` data
- US3 (P3) is the data source that enables full end-to-end integration for US1 and US2
- Constitution Principle VI: **never** compute dot coordinates in TypeScript — read `barLine.dots` from WASM output only
- All tick arithmetic uses integer operations (960 PPQ); no floating-point timing values
- Commit after each task or logical group; stop at each **Checkpoint** to validate independently
