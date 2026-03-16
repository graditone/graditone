# Tasks: Tied Notes Support

**Input**: Design documents from `/specs/051-tied-notes/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to
- Tests follow TDD: write failing test first, then implement

---

## Phase 1: Setup (Test Fixtures)

**Purpose**: Create synthetic MusicXML fixtures that all layers depend on for deterministic assertions.

- [X] T001 [P] Create tests/fixtures/musicxml/tied_notes_basic.musicxml with 3 tie cases: (a) two notes same measure, (b) cross-barline, (c) three-note chain
- [X] T002 [P] Create tests/fixtures/musicxml/tied_notes_chord.musicxml with a chord where only one pitch is tied

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Domain model and parser changes that ALL user stories depend on. No user story task can begin until this phase is complete.

**⚠️ CRITICAL**: US1 (layout/render), US2 (playback), and US3 (practice) all require the parsed tie data and Note fields produced here.

- [X] T003 [P] Add `TieType` enum (Start/Continue/Stop) and `TiePlacement` enum (Above/Below) and `tie_type: Option<TieType>` + `tie_placement: Option<TiePlacement>` fields to `NoteData` in backend/src/domain/importers/musicxml/types.rs
- [X] T004 [P] Add `tie_next: Option<NoteId>` and `is_tie_continuation: bool` fields to `Note` struct in backend/src/domain/events/note.rs
- [X] T005 Parse `<tie type="start|continue|stop">` element in `parse_note()` in backend/src/domain/importers/musicxml/parser.rs (depends on T003)
- [X] T006 Parse `<notations><tied type="..." placement="...">` element in `parse_notations()` in backend/src/domain/importers/musicxml/parser.rs (depends on T003)
- [X] T007 Implement tie chain resolution post-pass in `MusicXMLConverter` in backend/src/domain/importers/musicxml/converter.rs: for each NoteData with tie_type=Start/Continue, find adjacent same-pitch note with tie_type=Stop/Continue, set `tie_next` and `is_tie_continuation` (depends on T003, T004, T005, T006)
- [X] T008 [P] Add `tie_next?: string` and `is_tie_continuation?: boolean` fields to `Note` interface, and `tie_arcs: TieArc[]` + `TieArc` interface to `LayoutStaff` in frontend/src/types/score.ts (depends on T003, T004)

**Checkpoint**: Foundation complete — parser produces `Note` objects with tie chain links; TypeScript types reflect new fields. All user story phases can now begin.

---

## Phase 3: User Story 1 — Visual Display of Tied Notes (Priority: P1) 🎯 MVP

**Goal**: Users viewing any score with tied notes see a correct curved arc (tie) rendered between each pair of tied noteheads. Cross-barline ties display correctly. Chord partial ties show arcs only on tied pitches.

**Independent Test**: Load `Chopin_NocturneOp9No2.mxl` in the app → SVG contains `.tie-arc` `<path>` elements positioned between the correct noteheads.

### Tests for User Story 1

> **Write these FIRST — they must FAIL before implementation starts**

- [X] T009 [P] [US1] Write failing integration test `test_tied_notes_parsed()` in backend/tests/integration/test_tied_notes.rs: parse `tied_notes_basic.musicxml` → assert `note[0].tie_next == Some(note[1].id)`, `note[1].is_tie_continuation == true`, `staff.tie_arcs.len() == 3`
- [X] T010 [P] [US1] Write failing unit test in frontend/tests/unit/NotationRenderer.test.tsx: render a staff mock with one `tieArc` entry → assert `<path class="tie-arc">` present in SVG output

### Implementation for User Story 1

- [X] T011 [P] [US1] Add `TieArc` struct `{ start: Point, end: Point, cp1: Point, cp2: Point, above: bool, note_id_start: NoteId, note_id_end: NoteId }` to backend/src/layout/types.rs, and add `pub tie_arcs: Vec<TieArc>` field to `Staff` layout struct in backend/src/layout/types.rs
- [X] T012 [US1] Implement `compute_tie_arcs()` in backend/src/layout/mod.rs: for each `Note` with `tie_next`, look up continuation note position, compute cubic Bézier geometry using span-proportional arc height `clamp(span_x * 0.15, 4.0, 30.0)`, determine `above` from stem direction, push `TieArc` to `staff.tie_arcs` (depends on T011)
- [X] T013 [US1] Add tie arc `<path>` render loop to `frontend/src/components/notation/NotationRenderer.tsx`: iterate `staff.tieArcs`, render `<path d="M {start.x},{start.y} C {cp1.x},{cp1.y} {cp2.x},{cp2.y} {end.x},{end.y}" fill="none" stroke="currentColor" strokeWidth={1.5} className="tie-arc" />` (depends on T008, T011, T012)
- [X] T014 [US1] Write E2E test in frontend/tests/e2e/tied-notes.spec.ts: load app with Chopin score → assert `.tie-arc` SVG path elements are present (depends on T013)

**Checkpoint**: User Story 1 complete — tie arcs visible in all scores. Verify: `cargo test`, `npm run test`, Playwright sees `.tie-arc` elements.

---

## Phase 4: User Story 2 — Correct Playback Duration (Priority: P2)

**Goal**: Playing back a score with tied notes produces a single sustained sound for the combined duration, with no re-attack at the tie boundary.

**Independent Test**: Play back `tied_notes_basic.musicxml` in the app → the tied note pair (2 quarter notes = 2 beats) produces exactly one `triggerAttackRelease` call with `durationTicks = 480`, not two calls with `durationTicks = 240` each.

### Tests for User Story 2

> **Write these FIRST — they must FAIL before implementation starts**

- [X] T015 [P] [US2] Write failing unit test in frontend/tests/unit/TieResolver.test.ts: given two tied quarter notes → `resolveTiedNotes()` returns one `ResolvedNote` with `combinedDurationTicks = 480`; given a 3-note chain → one entry with sum of all three durations; given a chord with partial tie → tied pitch merges, untied pitches pass through as-is

### Implementation for User Story 2

- [X] T016 [US2] Implement `TieResolver.ts` in frontend/src/services/playback/TieResolver.ts: export `function resolveTiedNotes(notes: Note[]): ResolvedNote[]` that filters continuation notes and accumulates duration across the tie chain (depends on T008)
- [X] T017 [US2] Update `PlaybackScheduler.ts` in frontend/src/services/playback/PlaybackScheduler.ts: call `resolveTiedNotes()` on the sorted note list before scheduling, use `combinedDurationTicks` for the note onset duration, skip notes where `isTieContinuation === true` (depends on T016)

**Checkpoint**: User Story 2 complete — playback produces no double-attacks on tied notes. Verify with `npm run test` (TieResolver unit test passes) and manual playback of Chopin score.

---

## Phase 5: User Story 3 — Practice Mode Interaction (Priority: P3)

**Goal**: In practice mode, tied note groups count as a single note event. Stepping through a score with ties never requires the user to press a key for a continuation note.

**Independent Test**: Enter practice mode on `tied_notes_basic.musicxml` → navigating through the first tie (two quarter notes, same pitch) advances the cursor from note 0 to note 2, skipping the continuation note at index 1.

### Tests for User Story 3

> **Write this FIRST — it must FAIL before implementation starts**

- [X] T018 [US3] Write failing unit test in frontend/tests/unit/PracticeNoteExtraction.test.ts: given a note list with a 3-note tie chain — `extractPracticeNotes()` returns a sequence with 1 entry (the tie-start note), not 3 entries

### Implementation for User Story 3

- [X] T019 [US3] Add `!note.isTieContinuation` filter to the practice note extraction function in frontend/plugins/practice-view-plugin/ (scorePlayerContext.ts or practiceEngine.ts — confirm file by inspecting the extractor function): exclude continuation notes from the practice sequence so the engine only steps through independently-attacked notes (depends on T008)

**Checkpoint**: All three user stories complete. Full pipeline: parse → domain → layout → render → playback → practice all handle tied notes correctly.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T020 [P] Run `cargo fmt` and `cargo clippy --all-targets -- -D warnings` in backend/ and fix any warnings introduced by new tie fields
- [X] T021 [P] Update FEATURES.md to document tied notes support (visual arcs, playback merging, practice mode) under the score display/playback section
- [X] T022 Update Status field in specs/051-tied-notes/spec.md from "Draft" to "Implemented"

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Fixtures)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 fixtures for tests; BLOCKS all user story phases
- **Phase 3 (US1 Visual)**: Depends on Phase 2 complete
- **Phase 4 (US2 Playback)**: Depends on Phase 2 complete — can run in parallel with Phase 3
- **Phase 5 (US3 Practice)**: Depends on Phase 2 complete — can run in parallel with Phase 3 and 4
- **Phase 6 (Polish)**: Depends on all desired user story phases complete

### User Story Dependencies

- **US1 (P1)**: Phase 2 complete → layout types (T011) → compute_tie_arcs (T012) → renderer (T013)
- **US2 (P2)**: Phase 2 complete → TieResolver (T016) → PlaybackScheduler update (T017)
- **US3 (P3)**: Phase 2 complete → practice extraction filter (T019)
- US2 and US3 have **no dependency on US1** — they can be developed in parallel with the visual layer

### Parallel Opportunities Per Story

**Phase 1 (Setup)**:
```
T001 (basic fixture) ──┐
                       ├─→ Phase 2 begins
T002 (chord fixture) ──┘
```

**Phase 2 (Foundational)**:
```
T003 (types.rs) ──┬─→ T005 (parse <tie>)    ─┐
                  └─→ T006 (parse <tied>)    ─┴─→ T007 (converter) ─→ T008 (TS types)
T004 (note.rs) ───────────────────────────────→ T007 (converter)
```

**Phase 3 (US1) — once Phase 2 complete**:
```
T009 (int test skeleton) ─┐
T010 (renderer test)  ────┤
T011 (TieArc types)   ────┼─→ T012 (compute arcs) ─→ T013 (renderer) ─→ T014 (E2E)
```

**Phases 4 and 5 — parallel with Phase 3**:
```
Phase 3 (US1): T009 → T010 → T011 → T012 → T013 → T014
Phase 4 (US2): T015 → T016 → T017
Phase 5 (US3): T018 → T019
```

---

## Implementation Strategy

**MVP Scope (Phase 1 → Phase 3 only)**: Delivering User Story 1 (visual tie arcs) provides immediate, visible value to all users — broken scores like Chopin and Beethoven will display correctly. This is the recommended first delivery target.

**Incremental delivery**:
1. **Sprint 1**: Phase 1 + Phase 2 + Phase 3 → Tie arcs visible in all scores
2. **Sprint 2**: Phase 4 → Correct playback; Phase 5 → Correct practice mode
3. **Sprint 3**: Phase 6 → Polish and documentation

**Task count summary**:
- Total tasks: 22 (T001–T022)
- Phase 1 (Setup): 2 tasks
- Phase 2 (Foundational): 6 tasks
- Phase 3 (US1 Visual): 6 tasks
- Phase 4 (US2 Playback): 3 tasks
- Phase 5 (US3 Practice): 2 tasks
- Phase 6 (Polish): 3 tasks
