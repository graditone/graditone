# Tasks: Fix Nocturne Op.9 No.2 Layout Defects (M29–M37)

**Input**: Design documents from `/specs/001-fix-nocturne-layout/`
**Branch**: `001-fix-nocturne-layout`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅ quickstart.md ✅

**Format**: `[ID] [P?] [Story?] Description with file path`

---

## Phase 1: Setup

**Purpose**: Inspect the Nocturne MusicXML to confirm the exact measure data for M29–M37, and create the new regression test file skeleton. These are prerequisites the rest of all defect fixes depend on.

- [X] T001 Inspect scores/Chopin_NocturneOp9No2.mxl measures M29–M37 to confirm: double-flat alter value in M29, octave-shift element position for M30, accidentals in M34–M36, voice numbers for rests in M34–M36, slur type/direction in M37, and note density in M32–M34
- [X] T002 [P] Create test file skeleton backend/tests/nocturne_m29_m37_test.rs with `use` imports and one stub `#[test]` per defect (6 tests), verified with `cargo test nocturne_m29_m37 -- --list`
- [X] T003 [P] Create E2E test file skeleton frontend/e2e/nocturne-m29-m37-layout.spec.ts with two placeholder `test.skip` blocks for M29 accidental and M30 8va E2E verification

**Checkpoint**: MXL data confirmed; test skeletons exist and compile; ready to implement defect by defect in priority order

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared Rust test helpers and layout fixture loading needed by all 6 regression tests.

**⚠️ CRITICAL**: All Phase 3–7 test tasks depend on this phase being complete.

- [X] T004 Add a shared helper function `load_nocturne_layout()` in backend/tests/nocturne_m29_m37_test.rs that calls `compute_layout()` on the Nocturne fixture and returns the full `LayoutOutput` — to be used by all 6 regression tests
- [X] T005 [P] Add a shared helper `find_system_for_measure(layout: &LayoutOutput, measure: u32) -> &SystemLayout` in backend/tests/nocturne_m29_m37_test.rs
- [X] T006 [P] Verify `cargo test nocturne_m29_m37` compiles and the two helpers are callable in at least one smoke test

**Checkpoint**: Helpers compile; test harness is ready for per-defect use

---

## Phase 3: User Story 1 — Correct Accidentals in M29 and M34–M36 (Priority: P1) 🎯 MVP

**Goal**: All accidentals in M29–M36 are rendered with their exact correct SMuFL glyph — double-flat where required in M29, and all courtesy accidentals in M34–M36.

**Independent Test**: `cargo test test_nocturne_m29_double_flat_accidental test_nocturne_m34_m36_courtesy_accidentals` both pass; load Nocturne in browser and confirm M29 shows 𝄫, M34–M36 show their required accidentals.

### Regression Tests for User Story 1

> **WRITE THESE TESTS FIRST — they must FAIL before the fix is applied (Principles V & VII)**

- [X] T007 [US1] Write `test_nocturne_m29_double_flat_accidental` in backend/tests/nocturne_m29_m37_test.rs: compute layout, navigate to M29 system, find the AccidentalGlyph on the double-flat note, assert `codepoint == '\u{E264}'` — run with `cargo test test_nocturne_m29_double_flat_accidental` and confirm RED
- [X] T008 [US1] Write `test_nocturne_m34_m36_courtesy_accidentals` in backend/tests/nocturne_m29_m37_test.rs: compute layout, assert all courtesy accidentals encoded in M34–M36 of the MusicXML have corresponding `AccidentalGlyph` entries in the layout output — run and confirm RED

### Implementation for User Story 1

- [X] T009 [US1] In backend/src/layout/positioner.rs (~line 927): replace the `_ => ('\u{E261}', "accidentalNatural")` wildcard in the accidental match arm with explicit arms for all five alter values: `-2 => ('\u{E264}', "accidentalDoubleFlat")`, `-1 => ('\u{E260}', "accidentalFlat")`, `0 => ('\u{E261}', "accidentalNatural")`, `1 => ('\u{E262}', "accidentalSharp")`, `2 => ('\u{E263}', "accidentalDoubleSharp")`, plus a wildcard returning natural as a non-reachable fallback
- [X] T010 [US1] In backend/src/layout/positioner.rs (~lines 730–920): audit the accidental state machine to confirm all comparisons use written pitch (`note.spelling.step`/`note.spelling.alter`) and not display-transposed pitch — inside an ottava region, written pitch must be used consistently so that courtesy accidental decisions in M34–M36 are computed against written (not sounding) octave
- [X] T011 [US1] Run `cargo test test_nocturne_m29_double_flat_accidental` — must pass GREEN; run `cargo test test_nocturne_m34_m36_courtesy_accidentals` — must pass GREEN
- [X] T012 [US1] Run full `cargo test` suite — confirm zero new failures (regression check for M1–M28, M38, and other scores)
- [X] T013 [US1] Document Defect 1 (M29 double-flat) and Defect 3 (M34–M36 courtesy accidentals) in the Known Issues & Regression Tests section of specs/001-fix-nocturne-layout/spec.md

**Checkpoint**: `test_nocturne_m29_double_flat_accidental` and `test_nocturne_m34_m36_courtesy_accidentals` both GREEN; `cargo test` fully passes; M29 and M34–M36 accidentals verified visually in browser

---

## Phase 4: User Story 2 — 8va Bracket Starts at M30 (Priority: P1)

**Goal**: The "8va" bracket begins at measure 30, with correct x_start coordinate, dashed line, and terminal hook.

**Independent Test**: `cargo test test_nocturne_m30_ottava_bracket_starts_at_m30` passes; load Nocturne in browser and confirm the "8va" label appears above the staff at M30 (not M31).

### Regression Test for User Story 2

> **WRITE THIS TEST FIRST — it must FAIL before the fix is applied**

- [X] T014 [US2] Write `test_nocturne_m30_ottava_bracket_starts_at_m30` in backend/tests/nocturne_m29_m37_test.rs: compute layout, find the system containing M30, assert that `system.ottava_bracket_layouts` contains an element with `label == "8va"` and `x_start` ≤ the x-coordinate of the first note of M30 — run and confirm RED

### Implementation for User Story 2

- [X] T015 [US2] In backend/src/domain/importers/musicxml/parser.rs: trace the parsing of `<octave-shift type="down">` elements — confirm the start tick recorded for the ottava region corresponds to the absolute tick position of M30 beat 1, not M31 beat 1; add debug log or unit assertion to verify
- [X] T016 [US2] In backend/src/layout/extraction.rs: confirm `StaffData.octave_shift_regions` is populated using the tick value from the parser without off-by-one; if the start tick is shifted by one measure's worth of ticks (5760 ticks for 12/8), correct the extraction logic
- [X] T017 [US2] In backend/src/layout/mod.rs (~lines 879–920): verify the bracket generation loop uses the corrected `octave_shift_regions` start tick and produces an `OttavaBracketLayout` with `x_start` matching M30's first note x-coordinate
- [X] T018 [US2] Run `cargo test test_nocturne_m30_ottava_bracket_starts_at_m30` — must pass GREEN
- [X] T019 [US2] Run full `cargo test` suite — confirm zero new failures; confirm existing 8va tests (if any) in layout_test.rs still pass
- [X] T020 [US2] Document Defect 2 (M30 missing 8va bracket) in the Known Issues & Regression Tests section of specs/001-fix-nocturne-layout/spec.md

**Checkpoint**: `test_nocturne_m30_ottava_bracket_starts_at_m30` GREEN; `cargo test` passes; "8va" bracket visually confirmed at M30 in browser

---

## Phase 5: User Story 3 — Rests Centred Correctly in M34–M36 (Priority: P2)

**Goal**: All rest glyphs in M34–M36 sit at the correct vertical position for their voice within the staff.

**Independent Test**: `cargo test test_nocturne_m34_m36_rest_centering` passes; load Nocturne in browser and confirm rests in M34–M36 are aligned to standard staff positions.

### Regression Test for User Story 3

> **WRITE THIS TEST FIRST — it must FAIL before the fix is applied**

- [X] T021 [US3] Write `test_nocturne_m34_m36_rest_centering` in backend/tests/nocturne_m29_m37_test.rs: compute layout, navigate to the system(s) covering M34–M36, find all `RestGlyph` elements in those measures, assert each rest's `y` coordinate falls within the expected range for voice 1 (centred, within ±2 staff spaces of B4 equivalent) or voice 2 (displaced downward ≈ 2 staff spaces) — run and confirm RED

### Implementation for User Story 3

- [X] T022 [US3] In backend/src/layout/positioner.rs (~line 1264): locate the `rest_y()` function and its caller — verify whether MusicXML voice numbers (1-based) are used directly as 0-based indices into the Y-offset table; if so, apply `(voice - 1)` to convert before the index lookup
- [X] T023 [US3] Run `cargo test test_nocturne_m34_m36_rest_centering` — must pass GREEN
- [X] T024 [US3] Run full `cargo test` suite — confirm zero new failures; verify no rest positioning regressions in other scores or other Nocturne measures
- [X] T025 [US3] Document Defect 4 (M34–M36 rest misalignment) in the Known Issues & Regression Tests section of specs/001-fix-nocturne-layout/spec.md

**Checkpoint**: `test_nocturne_m34_m36_rest_centering` GREEN; `cargo test` passes; M34–M36 rests visually centred correctly in browser

---

## Phase 6: User Story 4 — Slur Positioned Correctly in M37 (Priority: P2)

**Goal**: The slur arc in M37 begins and ends at the correct note heads, curves in the correct direction, does not collide with other notation, and uses system-relative coordinates.

**Independent Test**: `cargo test test_nocturne_m37_slur_coordinates` passes; load Nocturne in browser and confirm M37 slur arc connects the correct notes without visual overlap.

### Regression Test for User Story 4

> **WRITE THIS TEST FIRST — it must FAIL before the fix is applied**

- [X] T026 [US4] Write `test_nocturne_m37_slur_coordinates` in backend/tests/nocturne_m29_m37_test.rs: compute layout, find the `SlurArc` associated with M37's slur group, assert `start.x < end.x`, assert `start.x >= 0.0` (within system bounds), assert `end.x <= system_width`, and assert `is_cross_system` is correctly set (true iff M37 slur spans a system break) — run and confirm RED

### Implementation for User Story 4

- [X] T027 [US4] In backend/src/layout/annotations.rs (~line 642): audit the slur arc generation function — determine if M37's slur spans a system break by checking whether the start note's system index differs from the end note's system index
- [X] T028 [US4] In backend/src/layout/annotations.rs: if the slur is cross-system, set `is_cross_system = true` and compute `start.x` relative to the first system's coordinate space and `end.x` relative to the second system's coordinate space; emit two `SlurArc` entries (open-right and open-left) instead of one; if same-system, confirm coordinates are system-relative
- [X] T029 [US4] Run `cargo test test_nocturne_m37_slur_coordinates` — must pass GREEN
- [X] T030 [US4] Run full `cargo test` suite — confirm zero new failures; verify no slur regressions in other scores (Für Elise slur tests, tied-notes E2E)
- [X] T031 [US4] Document Defect 5 (M37 slur positioning) in the Known Issues & Regression Tests section of specs/001-fix-nocturne-layout/spec.md

**Checkpoint**: `test_nocturne_m37_slur_coordinates` GREEN; `cargo test` passes; M37 slur visually correct in browser

---

## Phase 7: User Story 5 — No Notation Overlaps at M32–M34 Measure Boundaries (Priority: P3)

**Goal**: All notation elements at the M32/M33 and M33/M34 barlines have sufficient horizontal clearance so no two distinct elements visually overlap.

**Independent Test**: `cargo test test_nocturne_m32_m34_no_overlaps` passes; load Nocturne in browser and confirm clean visual separation at all three measure boundaries.

### Regression Test for User Story 5

> **WRITE THIS TEST FIRST — it must FAIL before the fix is applied**

- [X] T032 [US5] Write `test_nocturne_m32_m34_no_overlaps` in backend/tests/nocturne_m29_m37_test.rs: compute layout, for measure boundaries M32→M33 and M33→M34 find the right-most x of the last element of each measure and the left-most x of the first element of the next measure, assert `(first_x_next - last_x_current) >= MIN_BARLINE_CLEARANCE` (use 4.0 as the minimum, in layout units) — run and confirm RED

### Implementation for User Story 5

- [X] T033 [US5] In backend/src/layout/positioner.rs: add function `enforce_measure_boundary_clearance(measures: &mut [MeasureLayout], min_clearance: f32)` that iterates consecutive measure pairs, checks the gap between the last element of measure N and the first element of measure N+1, and shifts all elements in measure N+1 rightward by `(min_clearance - gap)` when the gap is below the threshold
- [X] T034 [US5] In backend/src/layout/mod.rs or the measure positioning entry point: call `enforce_measure_boundary_clearance()` after per-measure element positioning is complete and before system-level layout is emitted — apply only when gap is below threshold to avoid global refow
- [X] T035 [US5] Run `cargo test test_nocturne_m32_m34_no_overlaps` — must pass GREEN
- [X] T036 [US5] Run full `cargo test` suite — confirm zero new failures; pay particular attention to system-break tests and the `test_chopin_nocturne_38_measures_fits_in_fifteen_systems` test in backend/tests/layout_test.rs to ensure the boundary-clearance pass does not cause system overflow
- [X] T037 [US5] Document Defect 6 (M32–M34 boundary overlaps) in the Known Issues & Regression Tests section of specs/001-fix-nocturne-layout/spec.md

**Checkpoint**: `test_nocturne_m32_m34_no_overlaps` GREEN; `cargo test` (including system-count test) passes; M32–M34 boundaries visually clean in browser

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: E2E visual tests for the two highest-severity defects, full validation run, and documentation closure.

- [X] T038 [P] Implement E2E test `'M29 double-flat note shows glyph U+E264'` in frontend/e2e/nocturne-m29-m37-layout.spec.ts: load Nocturne score, navigate to M29 system, query the rendered SVG/canvas for the accidental glyph adjacent to the double-flat note, assert text content equals `'\uE264'`
- [X] T039 [P] Implement E2E test `'M30 8va bracket starts at M30'` in frontend/e2e/nocturne-m29-m37-layout.spec.ts: load Nocturne, locate the "8va" label element in the DOM/SVG, assert its x-position is no greater than the x-position of the first note in M30
- [X] T040 Build WASM from the fixed backend and serve the frontend: `cd backend && wasm-pack build --target web` and verify no build errors before running E2E
- [X] T041 Run all new E2E tests: `npx playwright test frontend/e2e/nocturne-m29-m37-layout.spec.ts` — all must pass
- [X] T042 Run full E2E suite: `npx playwright test` — confirm zero regressions against all existing E2E tests (m21-flat-check.spec.ts, tied-notes.spec.ts, and others)
- [X] T043 Run the MusicXML inspection script from quickstart.md to confirm no raw MXL data was changed during the fix — `python3` extraction snippet from quickstart.md section 6
- [X] T044 [P] Update FEATURES.md if any feature description for the Nocturne or notation rendering (accidentals, 8va, slurs) has changed
- [X] T045 [P] Update README.md in backend/ if any layout engine behaviour is described there and now differs
- [X] T046 Perform final visual review per quickstart.md Section 2 checklist: M29 𝄫, M30 8va, M34–M36 accidentals, M34–M36 rests centred, M37 slur, M32–M34 no overlaps — all 6 defects resolved

**Checkpoint**: All E2E tests pass; full test suite clean; documentation current; visual review complete

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (MXL data confirmed, test skeleton exists)
- **US1 — Accidentals (Phase 3)**: Depends on Phase 2 (test helpers available); **P1 — implement first**
- **US2 — 8va Bracket (Phase 4)**: Depends on Phase 2; **P1 — implement concurrently with or immediately after Phase 3**
- **US3 — Rests (Phase 5)**: Depends on Phase 2; can start after Phase 4 if capacity allows (P2)
- **US4 — Slur (Phase 6)**: Depends on Phase 2; can run in parallel with Phase 5 (P2, different files)
- **US5 — Overlaps (Phase 7)**: Depends on Phase 3 (accidental fixes may relieve some overlap); P3 — do last
- **Polish (Phase 8)**: Depends on all user story phases complete

### User Story Dependencies

- **US1 (P1)**: Independent — only needs Phase 2 helpers
- **US2 (P1)**: Independent — only needs Phase 2 helpers; parser/extraction/mod.rs are disjoint from US1 files
- **US3 (P2)**: Independent — `rest_y()` is disjoint from accidental and 8va code
- **US4 (P2)**: Independent — `annotations.rs` is disjoint from positioner.rs and mod.rs ottava
- **US5 (P3)**: Soft dependency on US1 (fixing accidentals may change horizontal spacing, potentially resolving some overlaps naturally); implement last

### Parallel Opportunities per Story

#### Phase 3 (US1): T007 and T008 can be written in parallel (both are test stubs); T009 and T010 are sequential (fix match arm first, then audit state machine)

#### Phase 4 (US2): T015 and T016 can run in parallel (parser.rs and extraction.rs are independent files); T017 depends on both

#### Phases 5 & 6 (US3 & US4): Entirely parallel — `positioner.rs rest_y()` and `annotations.rs` slur code are independent files/functions

#### Phase 8 (Polish): T038 and T039 (E2E test implementation) can run in parallel; T044 and T045 (documentation) can run in parallel

```bash
# Parallel execution example — US3 and US4 (after Phase 2 and Phase 3 complete):
# Terminal 1 — US3
cargo test test_nocturne_m34_m36_rest_centering  # RED → fix rest_y() → GREEN

# Terminal 2 — US4 (simultaneously)
cargo test test_nocturne_m37_slur_coordinates    # RED → fix annotations.rs → GREEN
```

---

## Implementation Strategy

**MVP Scope**: Phase 1 + Phase 2 + Phase 3 (US1) — corrects the most musically critical defect (wrong accidental type causes wrong notes). Independently deployable: a musician can read M29 correctly after just this phase.

**Increment 2**: Add Phase 4 (US2) — fixes the 8va bracket, completing both P1 defects. At this point M29 and M30 are both correct.

**Increment 3**: Add Phases 5 & 6 in parallel (US3 + US4) — rest centering and slur positioning, completing all P2 defects.

**Full Delivery**: Add Phase 7 (US5) + Phase 8 — boundary overlap fix and full E2E/documentation closure.

**Total tasks**: 46  
**Test tasks** (Rust regression): 6 (T007, T008, T014, T021, T026, T032)  
**E2E test tasks**: 2 (T038, T039)  
**Fix tasks**: 18 (T009–T012, T015–T019, T022–T023, T027–T030, T033–T035)  
**Validation/documentation tasks**: 20 (all remaining)
