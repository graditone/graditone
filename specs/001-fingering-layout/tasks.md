# Tasks: Fingering Support from MusicXML to Scores Layout

**Feature**: `001-fingering-layout` | **Branch**: `001-fingering-layout`  
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)  
**Generated**: 2026-03-22

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other [P] tasks in the same phase (different files, no mutual dependency)
- **[Story]**: Which user story this task belongs to (US1 = P1, US2 = P2, US3 = P3)
- Exact file paths included in every description

---

## Phase 1: Setup

**Purpose**: Establish a clean baseline before making any changes.

- [X] T001 Verify baseline from `backend/` with `cargo test` and confirm all existing tests pass before any code changes

**Checkpoint**: All existing tests pass — safe to proceed with new code

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Test file + core data structures shared by ALL three user stories. MUST be complete before any user story work begins.

**⚠️ CRITICAL**: No user story implementation can begin until this phase is complete. T002 is the test-first gate required by Constitution Principle V.

- [X] T002 Create `backend/tests/fingering_layout_test.rs` with three failing integration tests: (1) `test_parse_fingering_from_les_fleurs_sauvages` asserting `<fingering>` elements are extracted from `backend/music/Les Fleurs Sauvages.musicxml`; (2) `test_fingering_glyphs_in_layout_output` asserting `FingeringGlyph` entries appear in `GlobalLayout` JSON; (3) `test_no_regression_score_without_fingering` asserting a score without `<fingering>` elements produces identical layout output
- [X] T003 [P] Add `#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)] pub struct FingeringAnnotation { pub digit: u8, pub above: bool }` to `backend/src/domain/events/note.rs`
- [X] T004 [P] Add `#[serde(default, skip_serializing_if = "Vec::is_empty")] pub fingering: Vec<FingeringAnnotation>` field to `NoteData` in `backend/src/domain/importers/musicxml/types.rs`

**Checkpoint**: `cargo test` still passes (no regressions); `cargo test fingering` reports failing tests — confirming the test-first gate is active and tests exercise real code paths

---

## Phase 3: User Story 1 — Fingering Numbers Visible in Rendered Score (Priority: P1) 🎯 MVP

**Goal**: Parse `<fingering>` elements from MusicXML, carry each digit + placement preference through the full data pipeline (`NoteData → Note → NoteEvent`), compute `FingeringGlyph` positions in the Rust layout engine, serialise them in the `GlobalLayout` JSON, and render them as SVG `<text>` numerals in the frontend.

**Independent Test**: `cargo test fingering` — parser extracts fingering digit and placement from `backend/music/Les Fleurs Sauvages.musicxml` and the result appears on the domain `Note`; `cargo test fingering_layout` — `GlobalLayout` JSON contains `FingeringGlyph` entries with correct `(x, y, digit, above)` values for known measures. Visual confirm: load `scores/Chopin_NocturneOp9No2.mxl` in the browser and verify finger numerals appear adjacent to the expected noteheads.

### Implementation for User Story 1

- [X] T005 [P] [US1] Add `fn parse_technical<B: BufRead>(reader: &mut Reader<B>, note: &mut NoteData) -> Result<(), ImportError>` to `backend/src/domain/importers/musicxml/parser.rs` that reads `<fingering>` text content, parses the `placement` attribute (`"above"` → `above=true`, `"below"` → `above=false`, absent → derive from `note.staff` with staff 1 = true, staff ≥ 2 = false), discards non-numeric content silently (FR-008), and pushes `FingeringAnnotation { digit, above }` to `note.fingering`; then add `b"technical" => { parse_technical(reader, note)?; }` arm to `parse_notations`
- [X] T006 [P] [US1] Add `#[serde(default, skip_serializing_if = "Vec::is_empty")] pub fingering: Vec<FingeringAnnotation>` field and `pub fn with_fingering(mut self, fingering: Vec<FingeringAnnotation>) -> Self { self.fingering = fingering; self }` builder method to `Note` in `backend/src/domain/events/note.rs`
- [X] T008 [P] [US1] Add `#[derive(Debug, Clone, Serialize, Deserialize)] pub struct FingeringGlyph { #[serde(serialize_with = "round_f32")] pub x: f32, #[serde(serialize_with = "round_f32")] pub y: f32, pub digit: u8, pub above: bool }` and `#[serde(default, skip_serializing_if = "Vec::is_empty")] pub fingering_glyphs: Vec<FingeringGlyph>` on `Staff` in `backend/src/layout/types.rs`
- [X] T007 [US1] Map fingering through the import pipeline: add `let note = if !note_data.fingering.is_empty() { note.with_fingering(note_data.fingering) } else { note };` in `convert_note()` in `backend/src/domain/importers/musicxml/converter.rs` (depends on T004, T006)
- [X] T009 [US1] Add `pub(crate) fingering: Vec<FingeringAnnotation>` to `NoteEvent` and deserialize from JSON with `fingering: note_item["fingering"].as_array().map(|arr| arr.iter().filter_map(|v| serde_json::from_value(v.clone()).ok()).collect()).unwrap_or_default()` in `backend/src/layout/extraction.rs` (depends on T003, T008)
- [X] T010 [US1] Add `pub(crate) fingering_glyphs: Vec<types::FingeringGlyph>` to `AnnotationResult` and implement `fn render_fingering_glyphs(notes: &[NoteEvent], note_positions: &HashMap<...>, units_per_space: f32) -> Vec<types::FingeringGlyph>` in `backend/src/layout/annotations.rs` using: `x = notehead_x`; `y_above = notehead_y - (1.8 + idx as f32 * 1.5) * units_per_space`; `y_below = notehead_y + (1.8 + idx as f32 * 1.5) * units_per_space` per fingering index; call from `render_annotations` and populate `AnnotationResult.fingering_glyphs` (depends on T008, T009)
- [X] T011 [US1] Wire `fingering_glyphs: ann.fingering_glyphs` into the `Staff { ... }` struct literal in `backend/src/layout/mod.rs` (depends on T010)
- [X] T012 [P] [US1] Add `export interface FingeringGlyph { x: number; y: number; digit: number; above: boolean; }` and `fingering_glyphs?: FingeringGlyph[]` to the `Staff` interface in `frontend/src/wasm/layout.ts` (depends on T008 defining the field names; can proceed once T008 is complete regardless of T009–T011 status)
- [X] T013 [US1] Add `<text>` rendering loop after the `slur_arcs` loop in `frontend/src/components/LayoutRenderer.tsx`: `for (const fg of staff.fingering_glyphs ?? []) { const text = createSVGElement('text'); text.setAttribute('x', fg.x.toString()); text.setAttribute('y', fg.y.toString()); text.setAttribute('text-anchor', 'middle'); text.setAttribute('dominant-baseline', 'middle'); text.setAttribute('font-family', 'Bravura, serif'); text.setAttribute('font-size', (unitsPerSpace * 1.4).toString()); text.setAttribute('fill', config.glyphColor); text.setAttribute('class', 'fingering-glyph'); text.textContent = fg.digit.toString(); staffElement.appendChild(text); }` (depends on T012)

**Checkpoint**: `cargo test fingering` and `cargo test fingering_layout` pass; `npm run build` succeeds; Chopin Nocturne displays finger numerals in the browser; scores without `<fingering>` render identically to before

---

## Phase 4: User Story 2 — Multiple Fingerings on the Same Note (Priority: P2)

**Goal**: Confirm that when a note carries two or more `<fingering>` elements in the MusicXML source, all numerals are rendered without overlap, stacked vertically using the 1.5× spacing interval formula.

**Independent Test**: `cargo test fingering_multi` — load a test fixture (inline XML or `backend/music/Les Fleurs Sauvages.musicxml`) with a note carrying two `<fingering>` elements and assert that the layout output contains exactly two `FingeringGlyph` entries sharing the same `x` but with `y` values offset by 1.5 × `units_per_space`. Visual confirm: Chopin Nocturne measure 29 (known two-fingering note) shows both numerals simultaneously, vertically separated and legible.

### Implementation for User Story 2

- [X] T014 [US2] Verify the stacking formula in `render_fingering_glyphs()` in `backend/src/layout/annotations.rs` iterates over all `FingeringAnnotation` values in `note.fingering` using an indexed loop so each subsequent digit accumulates the `idx * 1.5 * units_per_space` offset; add a `test_fingering_multi_stacking` case to `backend/tests/fingering_layout_test.rs` with a synthetic note having two fingerings and assert both `FingeringGlyph` entries are present with the expected y-values

**Checkpoint**: `cargo test fingering_multi` passes; two-fingering notes in the Chopin Nocturne show both numerals without overlap

---

## Phase 5: User Story 3 — Fingering Coexists with Other Annotations (Priority: P3)

**Goal**: Confirm that fingering numerals are simultaneously visible alongside slur arcs and staccato dots with no element obscuring another.

**Independent Test**: `cargo test fingering_coexistence` — a note with both `slur_next = true` and a `FingeringAnnotation` produces both a `TieArc` and a `FingeringGlyph` in the layout output; assert the `FingeringGlyph.y` does not fall within the y-range of the slur arc endpoints. `cargo test fingering_staccato` — a note with `staccato = true` and a `FingeringAnnotation` produces both a `NotationDot` and a `FingeringGlyph`; assert their y-positions differ by at least 0.5 × `units_per_space`.

### Implementation for User Story 3

- [X] T015 [US3] Add `test_fingering_staccato_coexistence` to `backend/tests/fingering_layout_test.rs`: create a note with both `staccato = true` and one `FingeringAnnotation`; run through layout; assert the `NotationDot.y` and `FingeringGlyph.y` do not overlap (staccato offset is 1.2 × units_per_space; fingering base offset is 1.8 × — verify the margin is sufficient; if a test failure reveals collision, increase the base offset constant in `backend/src/layout/annotations.rs`)
- [X] T016 [US3] Add `test_fingering_slur_coexistence` to `backend/tests/fingering_layout_test.rs`: create a note with `slur_next = true` and one `FingeringAnnotation`; run through layout; assert the `FingeringGlyph.y` (above notehead) does not fall within the y-range of the computed `slur_arc` endpoints; if a test failure reveals overlap, increase fingering offset or add slur-aware clearance in `render_fingering_glyphs()` in `backend/src/layout/annotations.rs`

**Checkpoint**: All three user story test categories pass; `cargo test fingering` succeeds in full; combined annotations (fingering + slur, fingering + staccato) are visually non-overlapping

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Full regression pass, acceptance criteria sign-off, and SC verification.

- [X] T017 Run `cargo test` from `backend/` and confirm zero failures — validates SC-003 (zero regression for all existing scores), SC-004 (no layout artifacts), FR-007 (scores without `<fingering>` unchanged)
- [X] T018 [P] Run `npm run test` from `frontend/` and confirm zero failures — validates TypeScript types and renderer changes
- [X] T019 [P] Execute the `quickstart.md` acceptance checklist end-to-end: build WASM with `wasm-pack build --target web --out-dir ../frontend/src/wasm/pkg` from `backend/`, start the frontend, load `scores/Chopin_NocturneOp9No2.mxl`, and visually confirm (a) fingering numerals appear on all expected noteheads (SC-001), (b) no numeral overlaps its notehead (SC-002), (c) no layout artifacts in any measure (SC-004), (d) performance is not measurably slower (SC-005)
- [X] T020 Verify FR-007 zero-regression: load `scores/Bach_InventionNo1.mxl` (a score with no `<fingering>` elements) and confirm the layout output JSON contains no `fingering_glyphs` field anywhere under any `Staff` entry

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — run immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — **BLOCKS all user story phases**
- **User Story 1 (Phase 3)**: Depends on Phase 2 — all 9 touch-points must be completed
- **User Story 2 (Phase 4)**: Depends on Phase 3 — stacking formula is inside `render_fingering_glyphs()` built in T010
- **User Story 3 (Phase 5)**: Depends on Phase 3 — coexistence offsets build on working glyph positions
- **Polish (Phase 6)**: Depends on all user story phases desired for the release

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Phase 2 — no dependency on US2 or US3
- **User Story 2 (P2)**: Depends on US1 Phase 3 (stacking validates on top of single-fingering support)
- **User Story 3 (P3)**: Depends on US1 Phase 3 (coexistence validates on top of working glyph positions); US2 and US3 are independent of each other

### Within Phase 3 (User Story 1 sequence)

```
T003 ─┬─→ T005 (parser)
      ├─→ T006 (note.rs)
      └─→ T008 (layout/types) ─→ T009 (extraction) ─→ T010 (annotations) ─→ T011 (mod.rs)
                              └─→ T012 (layout.ts) ─→ T013 (LayoutRenderer)
T004 ─┬─→ T005 (parser)
      └─→ T007 (converter, depends on T004 + T006)
```

- **T005, T006, T008** can start in parallel as soon as T003 and T004 are both done
- **T007** follows T006 and T004
- **T009** follows T008 (and T003 for the type reference)
- **T010** follows T008 and T009
- **T011** follows T010
- **T012** can start as soon as T008 is done (independent of T009–T011)
- **T013** follows T012

---

## Parallel Execution Examples

### Phase 2: Foundational (after T002)

```bash
# T003 and T004 can be launched together (different files):
Task T003: "Add FingeringAnnotation struct to backend/src/domain/events/note.rs"
Task T004: "Add NoteData.fingering field to backend/src/domain/importers/musicxml/types.rs"
```

### Phase 3: User Story 1 (Batch 1 — after T003 + T004)

```bash
# T005, T006, T008 can be launched together:
Task T005: "Add parse_technical() to backend/src/domain/importers/musicxml/parser.rs"
Task T006: "Add Note.fingering + with_fingering() to backend/src/domain/events/note.rs"
Task T008: "Add FingeringGlyph struct + Staff.fingering_glyphs to backend/src/layout/types.rs"
```

### Phase 3: User Story 1 (Batch 2 — after T005 + T006 + T008)

```bash
# T007 and T009 and T012 can be launched together:
Task T007: "Map NoteData.fingering → Note.fingering in backend/src/domain/importers/musicxml/converter.rs"
Task T009: "Add NoteEvent.fingering + deserialization to backend/src/layout/extraction.rs"
Task T012: "Add FingeringGlyph interface to frontend/src/wasm/layout.ts"
```

### Phase 6: Polish (after all user stories)

```bash
# T017, T018, T019 can be launched together:
Task T017: "cargo test from backend/ — full regression pass"
Task T018: "npm run test from frontend/ — TypeScript test suite"
Task T019: "Acceptance checklist end-to-end with Chopin Nocturne"
```

---

## FR Traceability

| Functional Requirement | Implementing Tasks |
|------------------------|--------------------|
| FR-001: Parse every `<fingering>` element | T005 |
| FR-002: Carry fingering through full pipeline | T006, T007, T009 |
| FR-003: Compute position with placement priority | T005 (parse placement attr), T010 (render_fingering_glyphs) |
| FR-004: Layout output contains discrete fingering elements | T008, T010, T011 |
| FR-005: Multiple fingerings on one note, all legible | T010 (stacking formula), T014 |
| FR-006: Visually distinct rendering as small numerals | T013 (SVG `<text>`, Bravura font, 1.4× size) |
| FR-007: No regression for scores without `<fingering>` | T003–T004 (`skip_serializing_if`), T011, T017, T020 |
| FR-008: Discard invalid/non-numeric fingering silently | T005 (non-numeric → discard in parse_technical) |
| FR-009: Works for all instruments, no filtering | T005 (no instrument filtering in parse_technical) |
| FR-010: No horizontal spacing changes | T010 (x = notehead x, no spacing mutation), T008 (no x-impact) |
| FR-011: Visible in both score viewer and practice mode | T013 (renders in all contexts, no mode condition) |

---

## Implementation Strategy

**MVP Scope**: Phase 1 + Phase 2 + Phase 3 (US1 only). This delivers the complete end-to-end fingering pipeline for the most common case (single fingering per note). The Chopin Nocturne will display finger numerals — this is a fully demonstrable, shippable increment.

**Incremental Delivery**:
1. ✅ **After Phase 3** → Chopin Nocturne shows finger numerals throughout (SC-001 verifiable, SC-002 visually confirmed)
2. ✅ **After Phase 4** → Multi-fingering notes (e.g., measure 29, thumb crossings) correctly stacked (US2 acceptance criteria met)
3. ✅ **After Phase 5** → Full spec compliance; slur and staccato coexistence verified (US3 acceptance criteria met)

**Test-First Gate (Principle V)**: T002 creates three failing integration tests BEFORE any implementation task in Phase 3 begins. No US1 task (T005–T013) may be marked complete unless T002 exists and `cargo test fingering` reports failures. The gate enforces that tests exercise real code paths, not dead code.

**Constitution Principle VI Invariant**: No TypeScript in `frontend/src/components/LayoutRenderer.tsx` or `frontend/src/wasm/layout.ts` may compute or modify `(x, y)` coordinates. T013 only reads pre-computed values from the Rust layout engine (`fg.x`, `fg.y`, `fg.digit`, `fg.above`) and passes them directly to SVG attributes.
