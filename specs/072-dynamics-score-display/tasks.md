# Tasks: Music Dynamics Score Display

**Input**: Design documents from `/specs/072-dynamics-score-display/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

> ⚠️ **Constitution Principle V (Test-First)**: Tests MUST be written before implementation.
> Backend tests use `cargo test`; frontend tests use Vitest.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- File paths are relative to the worktree root (`worktrees/072-dynamics-score-display/`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Extend Bravura metadata and layout type system — shared prerequisites for all user stories.

- [X] T001 [P] Add 8 dynamic glyph bounding box entries to `backend/assets/bravura_metadata.json` (dynamicPPP, dynamicPP, dynamicPiano, dynamicMP, dynamicMF, dynamicForte, dynamicFF, dynamicFFF with bbox values from data-model.md Bravura Metadata Extension section)
- [X] T002 [P] Add `DynamicGlyph` struct to `backend/src/layout/types.rs` with fields: `codepoint: String`, `label: String`, `x: f32`, `y: f32`, `font_size: f32`, `bounding_box: BoundingBox`; derive `Serialize, Deserialize, Debug, Clone`
- [X] T003 [P] Add `HairpinLayout` struct to `backend/src/layout/types.rs` with fields: `direction: HairpinDirection`, `x_start: f32`, `x_end: f32`, `y_center: f32`, `opening: f32`, `continues_left: bool`, `continues_right: bool`; add `HairpinDirection` enum (`Crescendo`, `Diminuendo`); derive `Serialize, Deserialize, Debug, Clone`
- [X] T004 Add `dynamic_glyphs: Vec<DynamicGlyph>` and `hairpin_layouts: Vec<HairpinLayout>` fields to `Staff` struct in `backend/src/layout/types.rs` with `#[serde(default, skip_serializing_if = "Vec::is_empty")]`
- [X] T005 [P] Add `DynamicGlyph` and `HairpinLayout` TypeScript interfaces to `frontend/src/wasm/layout.ts` matching the Rust types (per data-model.md TypeScript section), and add optional `dynamic_glyphs?: DynamicGlyph[]` and `hairpin_layouts?: HairpinLayout[]` fields to the `Staff` interface

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the `dynamics.rs` module skeleton and wire it into the layout pipeline. Must complete before any user story implementation.

- [X] T006 Create `backend/src/layout/dynamics.rs` module file with `pub(crate) fn render_dynamics()` stub returning empty `DynamicsResult { dynamic_glyphs: vec![], hairpin_layouts: vec![] }`; define `DynamicsResult` struct in the same file; add `pub(crate) mod dynamics;` to `backend/src/layout/mod.rs`
- [X] T007 Call `dynamics::render_dynamics()` in the per-staff loop in `backend/src/layout/mod.rs` after `render_annotations()`, passing `staff_data`, tick range, `staff_vertical_offset`, `units_per_space`, `note_positions` reference, and system geometry (`system_end_x`, `left_margin`); attach returned `dynamic_glyphs` and `hairpin_layouts` to the `Staff` struct being assembled

**Checkpoint**: `cargo test` passes — all existing tests green, no dynamic output yet (empty vecs, skipped in JSON).

---

## Phase 3: User Story 1 — Static Dynamic Markings Visible in Score (Priority: P1) 🎯 MVP

**Goal**: ppp through fff symbols rendered as SMuFL glyphs below the staff at correct beat positions.

**Independent Test**: Render any MusicXML score containing `<dynamics>` direction elements and confirm corresponding symbols (p, mf, ff, etc.) appear in `Staff.dynamic_glyphs` at correct x/y positions.

### Tests for User Story 1

> **Write these tests FIRST and verify they FAIL before implementing.**

- [X] T008 [US1] Write failing Rust test in `backend/tests/dynamics_layout_test.rs`: a score with a single `p` marking at a known tick produces one `DynamicGlyph` in the correct staff with `codepoint = "\u{E520}"`, `x` matching `note_positions[start_tick]`, `y = staff_vertical_offset + 6 * units_per_space`, `font_size = 80.0`
- [X] T009 [P] [US1] Write failing Rust test in `backend/tests/dynamics_layout_test.rs`: a score with two consecutive dynamics (p and ff in the same measure) produces two `DynamicGlyph` entries sorted by ascending `x`
- [X] T010 [P] [US1] Write failing Rust test in `backend/tests/dynamics_layout_test.rs`: a score with no dynamic markings produces empty `dynamic_glyphs` vec in `Staff` and no errors
- [X] T011 [P] [US1] Write failing Rust test in `backend/tests/dynamics_layout_test.rs`: every emitted `DynamicGlyph.y` equals exactly `staff_vertical_offset + 6 * units_per_space` (contract test #5 from layout-output.md)
- [X] T012 [P] [US1] Write failing Vitest test in `frontend/src/components/renderer/RenderingPipeline.test.ts`: a `DynamicGlyph` with valid codepoint `"\uE520"` renders an SVG `<text>` element with Bravura font-family, `font-size = 80`, and `dominant-baseline="auto"`

### Implementation for User Story 1

- [X] T013 [US1] Implement static dynamic glyph positioning in `backend/src/layout/dynamics.rs`: parse `dynamics` array from score JSON for the current staff and tick range, look up `x` from `note_positions` map (floor-scan for ticks between notes), compute `y = staff_vertical_offset + 6 * units_per_space`, resolve `codepoint` from `DynamicLevel` enum via SMuFL mapping table (research.md §1), look up `bounding_box` from Bravura metrics via `get_glyph_bbox()`, set `font_size = 80.0`, `label = ""`, emit `DynamicGlyph` entries sorted by ascending `x`
- [X] T014 [US1] Add `renderDynamics()` private method to `frontend/src/components/renderer/RenderingPipeline.ts`: iterate `staff.dynamic_glyphs ?? []`, for each glyph with non-empty `codepoint` create SVG `<text>` element at `(x, y)` with `font-family: Bravura`, `font-size = font_size`, `dominant-baseline="auto"`, text content = `codepoint`; call `renderDynamics(staff, group)` from `renderStaff()` after existing element rendering

**Checkpoint**: T008–T012 all pass. Scores with static dynamics show ppp–fff glyphs below the staff. Scores without dynamics render unchanged.

---

## Phase 4: User Story 2 — Hairpin Crescendo and Decrescendo Visible in Score (Priority: P2)

**Goal**: Crescendo and diminuendo wedge graphics rendered below the staff, including correct split across system line breaks.

**Independent Test**: Render a MusicXML score containing `<wedge>` direction elements and confirm hairpin graphics appear in `Staff.hairpin_layouts` with correct start/end positions and directions.

### Tests for User Story 2

> **Write these tests FIRST and verify they FAIL before implementing.**

- [X] T015 [US2] Write failing Rust test in `backend/tests/dynamics_layout_test.rs`: a crescendo spanning two measures produces one `HairpinLayout` with `direction = Crescendo`, `x_start < x_end`, `y_center = staff_vertical_offset + 6 * units_per_space`, `opening = units_per_space`, `continues_left = false`, `continues_right = false`
- [X] T016 [P] [US2] Write failing Rust test in `backend/tests/dynamics_layout_test.rs`: a diminuendo hairpin produces `HairpinLayout` with `direction = Diminuendo` and correct open/close geometry
- [X] T017 [P] [US2] Write failing Rust test in `backend/tests/dynamics_layout_test.rs`: a hairpin spanning a system line break produces exactly 2 `HairpinLayout` entries — first segment with `continues_right = true`, second segment with `continues_left = true`
- [X] T018 [P] [US2] Write failing Vitest test in `frontend/src/components/renderer/RenderingPipeline.test.ts`: a crescendo `HairpinLayout` renders exactly two SVG `<line>` elements — top arm from `(x_start, y_center)` to `(x_end, y_center - opening/2)` and bottom arm from `(x_start, y_center)` to `(x_end, y_center + opening/2)`, with `stroke-width = 1.5`
- [X] T019 [P] [US2] Write failing Vitest test in `frontend/src/components/renderer/RenderingPipeline.test.ts`: a diminuendo `HairpinLayout` renders two SVG `<line>` elements with arms converging from open start to point end per contracts/layout-output.md formulas

### Implementation for User Story 2

- [X] T020 [US2] Implement hairpin layout computation in `backend/src/layout/dynamics.rs`: parse `gradual_dynamics` array from score JSON for the current staff and tick range, compute `x_start` from `note_positions[start_tick]`, `x_end` from `note_positions[stop_tick]` + notehead width (~20 units), `y_center = staff_vertical_offset + 6 * units_per_space`, `opening = units_per_space`; detect system-break overlap by comparing `stop_tick` against the system's tick range and split into two `HairpinLayout` segments setting `continues_right = true` on segment 1 and `continues_left = true` on segment 2; clip `x_end` to `system_end_x` for continued segments
- [X] T021 [US2] Add hairpin rendering to `renderDynamics()` in `frontend/src/components/renderer/RenderingPipeline.ts`: iterate `staff.hairpin_layouts ?? []`, for each entry compute the two SVG `<line>` arm endpoints per the crescendo/diminuendo formulas in contracts/layout-output.md, set `stroke = config.staffLineColor`, `stroke-width = 1.5`, `fill = none`

**Checkpoint**: T015–T019 all pass. Scores with hairpins show wedge graphics below the staff. Cross-system hairpins split correctly across systems.

---

## Phase 5: User Story 3 — Dynamics Consistent Between Visual Score and Audio Playback (Priority: P3)

**Goal**: Verify that the visual dynamics in the score and the velocity changes produced during audio playback are derived from the same `DynamicMarking` / `GradualDynamic` data source.

**Independent Test**: Compare dynamic markings visible in the rendered score against the velocity changes produced during playback for the same score.

### Tests for User Story 3

- [X] T022 [US3] Write integration test in `backend/tests/dynamics_layout_test.rs` (or Playwright e2e) that loads a score with a `ff` at a known measure, verifies `Staff.dynamic_glyphs` contains a `ff` entry at the correct tick, and verifies `DynamicsResolver` (playback pipeline) produces the corresponding velocity value at the same tick — confirming both visual layout and audio playback read from the same `DynamicMarking` data in `ScoreDto`

### Implementation for User Story 3

No new implementation code — US3 is a verification story. If T022 fails, it indicates a data-source divergence that must be traced and fixed in the existing DTO pipeline (not expected given Research item #6 confirmed shared `ScoreDto` data).

**Checkpoint**: T022 passes. Visual and audio dynamics are provably consistent.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T023 [P] Implement fallback rendering for unrecognised dynamics (FR-010) across three files: (a) update MusicXML importer to forward unknown dynamic strings to `ScoreDto` as `unknown_dynamics: Vec<UnknownDynamicMarking>` with tick + staff + raw string fields, (b) update `render_dynamics()` in `backend/src/layout/dynamics.rs` to read `unknown_dynamics` and emit `DynamicGlyph` with `codepoint = ""` and `label = "dyn"` for each entry, (c) update `renderDynamics()` in `frontend/src/components/renderer/RenderingPipeline.ts` to render italic `<text>` when `codepoint === ""` using `font-style: italic`, `font-family: serif`, `font-size: font_size * 0.5`, text content = `label`
- [X] T024 [P] Write failing Vitest test in `frontend/src/components/renderer/RenderingPipeline.test.ts`: a `DynamicGlyph` with `codepoint = ""` and `label = "dyn"` renders an italic serif `<text>` element with content "dyn" at `font-size = 40`
- [X] T025 [P] Write failing Rust integration test in `backend/tests/dynamics_layout_test.rs`: a score containing no dynamics and no hairpins produces a `GlobalLayout` JSON output with no `dynamic_glyphs` or `hairpin_layouts` keys present (regression test, Principle VII — backward compatibility via `skip_serializing_if`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1** (Setup): No prior dependencies — start immediately
- **Phase 2** (Foundational): Depends on T002–T004 (types defined)
- **Phase 3** (US1 — P1 MVP): Depends on Phase 2 completion (T006–T007)
- **Phase 4** (US2 — P2): Depends on Phase 2 completion; **can run in parallel with Phase 3** (different data paths: `DynamicMarking` vs `GradualDynamic`, different output fields)
- **Phase 5** (US3 — P3): Depends on Phase 3 completion (needs visible dynamics to compare against playback)
- **Phase 6** (Polish): T023 depends on Phase 3 completion (renderer must be working); T024–T025 are independent

### Within Each User Story

- **Test tasks** (T008–T012, T015–T019) must be written and confirmed **failing** before implementation tasks (T013–T014, T020–T021)
- Implementation tasks make the tests pass

### Parallel Opportunities

**Phase 1**: T001, T002, T003, T005 are all independent files — run all 4 in parallel. T004 depends on T002+T003 (types must exist before `Staff` references them).

**Phase 3 + Phase 4 (US1 + US2)**: Once Phase 2 is done, both can proceed in parallel:
- Static dynamics and hairpins read different score data arrays
- They populate different `Staff` fields (`dynamic_glyphs` vs `hairpin_layouts`)
- Frontend rendering is additive (independent loops within `renderDynamics()`)

**Phase 6**: T023, T024, T025 are all independent and parallelizable.

---

## Implementation Strategy

**MVP**: Phase 1 + Phase 2 + Phase 3 (US1 only) = **14 tasks**. Static dynamic markings (ppp–fff) visible in score. Delivers immediate value.

**Full feature**: MVP + Phase 4 (hairpins) + Phase 5 (consistency) + Phase 6 (fallback + regression) = **25 tasks total**.

**Suggested order**: 1 → 2 → 3 → 4 → 5 → 6 (sequential by phase, parallel within phases where marked `[P]`).
