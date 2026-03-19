# Tasks: Fix Layout Preloaded Scores

**Input**: Design documents from `/specs/050-fix-layout-preloaded-scores/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/review-protocol.md ✅ quickstart.md ✅

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[US1]**: User Story 1 — Musician can review and approve any score's layout
- **[US2]**: User Story 2 — Iterative improvement cycle (find defect → test → fix → re-review)
- **[US3]**: User Story 3 — Consistent layout across all 6 preloaded scores

---

## Phase 1: Setup

**Purpose**: Prepare reference materials, directory structure, and verify the Graditone
rendering pipeline before any review cycle begins.

- [x] T001 Create `specs/050-fix-layout-preloaded-scores/reviews/01-Burgmuller_LaCandeur/` directory
- [x] T002 [P] Create `specs/050-fix-layout-preloaded-scores/reviews/02-Burgmuller_Arabesque/` directory
- [x] T003 [P] Create `specs/050-fix-layout-preloaded-scores/reviews/03-Pachelbel_CanonD/` directory
- [x] T004 [P] Create `specs/050-fix-layout-preloaded-scores/reviews/04-Bach_InventionNo1/` directory
- [x] T005 [P] Create `specs/050-fix-layout-preloaded-scores/reviews/05-Beethoven_FurElise/` directory
- [x] T006 [P] Create `specs/050-fix-layout-preloaded-scores/reviews/06-Chopin_NocturneOp9No2/` directory
- [x] T007 [P] Export Musescore 4 reference PNG (150 DPI) for `scores/Burgmuller_LaCandeur.mxl` → `specs/050-fix-layout-preloaded-scores/references/Burgmuller_LaCandeur.png`
- [x] T008 [P] Export Musescore 4 reference PNG (150 DPI) for `scores/Burgmuller_Arabesque.mxl` → `specs/050-fix-layout-preloaded-scores/references/Burgmuller_Arabesque.png`
- [x] T009 [P] Export Musescore 4 reference PNG (150 DPI) for `scores/Pachelbel_CanonD.mxl` → `specs/050-fix-layout-preloaded-scores/references/Pachelbel_CanonD.png`
- [x] T010 [P] Export Musescore 4 reference PNG (150 DPI) for `scores/Bach_InventionNo1.mxl` → `specs/050-fix-layout-preloaded-scores/references/Bach_InventionNo1.png`
- [x] T011 [P] Export Musescore 4 reference PNG (150 DPI) for `scores/Beethoven_FurElise.mxl` → `specs/050-fix-layout-preloaded-scores/references/Beethoven_FurElise.png`
- [x] T012 [P] Export Musescore 4 reference PNG (150 DPI) for `scores/Chopin_NocturneOp9No2.mxl` → `specs/050-fix-layout-preloaded-scores/references/Chopin_NocturneOp9No2.png`
- [x] T013 Build WASM module: `cd backend && wasm-pack build --target web --out-dir ../frontend/src/wasm/pkg`
- [x] T014 Run `cd frontend && npm run dev`, open all 6 preloaded scores in browser, confirm no rendering errors in console

**Checkpoint**: 6 reference PNGs in `references/`, WASM builds clean, all scores open without errors.

---

## Phase 2: Foundational (Pre-Identified Code Risk Investigation)

**Purpose**: Investigate the specific layout engine and renderer values flagged in
`research.md` before per-score review begins. Document findings in `research.md`
(update the risk table). Apply fixes that are confirmed incorrect without needing a
visual comparison (clear spec violations). Apply visual-comparison-driven fixes during
Phase 3+.

**⚠️ CRITICAL**: Each code fix MUST have a failing regression test written first (Constitution VII).

- [x] T015 Confirm `backend/src/layout/batcher.rs` `extract_glyph_properties()` sets `font_size: 80.0` for all note GlyphRuns — update `research.md` risk table Risk #1 as RESOLVED (confirmed correct)
- [x] T016 Measure `STEM_LENGTH = 35.0` in `backend/src/layout/stems.rs` against SMuFL standard (3.5 staff spaces = 70 units at `units_per_space=20`): document expected vs actual in `research.md`
- [x] T017 [P] Measure `NOTEHEAD_WIDTH = 11.8` in `backend/src/layout/stems.rs` against expected stem attachment point (Bravura notehead right edge at font_size=80 ≈ 23.6 units): document in `research.md`
- [x] T018 [P] Measure `intra_staff_multiplier = 8.0` in `backend/src/layout/mod.rs` against Musescore piano default (~7 staff spaces between treble/bass origins): document in `research.md`
- [x] T019 [P] Measure staff line `stroke-width='1'` in `frontend/src/components/LayoutRenderer.tsx` against Musescore staff line weight standard (~0.12 sp = ~2.4 units at ups=20): document in `research.md`
- [x] T020 Write failing regression test `test_stem_length_standard_note` in `backend/tests/layout_test.rs` asserting isolated note stem height ≥ 70.0 units (3.5 sp) — this MUST fail before T021
- [x] T021 Fix `STEM_LENGTH` in `backend/src/layout/stems.rs` to standard engraving value (3.5 sp = 70 units); run `cargo test` — all tests must pass including T020
- [x] T022 Write failing renderer test `test_staff_line_stroke_width` in `frontend/src/` asserting staff line `stroke-width` attribute ≥ 1.5 (minimum readable on tablet) — MUST fail before T023
- [x] T023 [P] Fix staff line `stroke-width` in `frontend/src/components/LayoutRenderer.tsx` `renderStaff()` method to match Musescore weight; run `vitest` — all tests must pass
- [x] T024 [P] Fix ledger line `stroke-width='1.5'` in `frontend/src/components/LayoutRenderer.tsx` `renderStaff()` method proportionally to staff line fix from T023
- [x] T025 Rebuild WASM: `cd backend && wasm-pack build --target web --out-dir ../frontend/src/wasm/pkg`; run `cd frontend && npm run dev` and capture updated baseline for all 6 scores

**Checkpoint**: Research table updated, STEM_LENGTH correct (70 units), staff line stroke-width updated, all tests green.

---

## Phase 3: User Story 1 — La Candeur (Burgmuller) — Score 1 of 6 🎯 MVP

**Goal**: Complete the first full review → identify → fix → approve cycle, proving the
review workflow end-to-end. Any generic fix in this phase propagates to scores 2–6.

**Independent Test**: Open `scores/Burgmuller_LaCandeur.mxl`, take a side-by-side screenshot vs `references/Burgmuller_LaCandeur.png`. Musician signs off with no blocking or major issues remaining.

- [x] T026 [US1] Create `specs/050-fix-layout-preloaded-scores/reviews/01-Burgmuller_LaCandeur/cycle-01.md` using the template in `data-model.md § cycle-XX.md Format`
- [x] T027 [US1] Capture Graditone screenshot for La Candeur (full first page) → `reviews/01-Burgmuller_LaCandeur/cycle-01-graditone-baseline.png`
- [x] T028 [US1] Perform side-by-side comparison of `references/Burgmuller_LaCandeur.png` vs `cycle-01-graditone-baseline.png`; annotate each discrepancy and classify layer (layout-engine | renderer) per `contracts/review-protocol.md § Layer classification guide`; record in `cycle-01.md`
- [x] T029 [US1] For each `layout-engine` issue found in T028: write a failing regression test in `backend/tests/layout_test.rs` (Constitution VII); record `test_ref` in `cycle-01.md`
- [x] T030 [P] [US1] For each `renderer` issue found in T028: write a failing unit test in `frontend/src/` (Constitution VII); record `test_ref` in `cycle-01.md`
- [x] T031 [US1] Apply all `layout-engine` fixes for La Candeur issues in the appropriate `backend/src/layout/` files; run `cargo test` — all tests must pass
- [x] T032 [P] [US1] Apply all `renderer` fixes for La Candeur issues in `frontend/src/components/LayoutRenderer.tsx`; run `vitest` — all tests must pass
- [x] T033 [US1] For each fix marked `scope: generic` in `cycle-01.md`: verify visually that the remaining 5 scores (T034) still render correctly — re-render each, compare against their baseline screenshots from T010/T025
- [x] T034 [P] [US1] Rebuild WASM and capture updated Graditone screenshot for La Candeur → `reviews/01-Burgmuller_LaCandeur/cycle-01-graditone-after.png`; create side-by-side composite `cycle-01-comparison.png`
- [x] T035 [US1] Present `cycle-01-comparison.png` to musician for approval; if approved update `cycle-01.md` status to `approved` and `approval_status`; if not approved create `cycle-02.md` and iterate from T028

**Checkpoint**: `reviews/01-Burgmuller_LaCandeur/cycle-01.md` (or later cycle) has `[x] Approved`. All generic fixes propagated and verified on scores 2–6.

---

## Phase 4: User Story 2 — Arabesque, Canon, Invention, Für Elise (Scores 2–5)

**Goal**: Apply the iterative improvement cycle (US2) to scores 2–5. Each score goes through
at least one review cycle. Any new generic fix discovered propagates forward immediately.

**Independent Test**: Each score has an approved `cycle-NN.md` document. Running `cargo test`
and `vitest` produces no failures.

### Score 2 — Burgmuller Arabesque

- [x] T036 [US2] Create `specs/050-fix-layout-preloaded-scores/reviews/02-Burgmuller_Arabesque/cycle-01.md`
- [x] T037 [US2] Capture Graditone baseline screenshot → `reviews/02-Burgmuller_Arabesque/cycle-01-graditone-baseline.png`
- [x] T038 [US2] Side-by-side comparison of `references/Burgmuller_Arabesque.png` vs baseline; record issues in `cycle-01.md`; check beaming (Arabesque has many eighth-note runs in 2/4)
- [x] T039 [US2] Write failing tests for each new issue found in T038 in `backend/tests/layout_test.rs` or `frontend/src/` (Constitution VII)
- [x] T040 [P] [US2] Apply fixes for Arabesque issues; propagate any generic fix to scores 3–6; run `cargo test` + `vitest`
- [x] T041 [US2] Capture updated screenshot, create `cycle-01-comparison.png`; present to musician; iterate until approved; update `cycle-01.md`

### Score 3 — Pachelbel Canon in D

- [x] T042 [US2] Create `specs/050-fix-layout-preloaded-scores/reviews/03-Pachelbel_CanonD/cycle-01.md`
- [x] T043 [US2] Capture Graditone baseline screenshot → `reviews/03-Pachelbel_CanonD/cycle-01-graditone-baseline.png`
- [x] T044 [US2] Side-by-side comparison of `references/Pachelbel_CanonD.png` vs baseline; record issues in `cycle-01.md`; check horizontal spacing uniformity across repeated patterns in 4/4
- [x] T045 [US2] Write failing tests for each new issue found in T044 in `backend/tests/layout_test.rs` or `frontend/src/` (Constitution VII)
- [x] T046 [P] [US2] Apply fixes for Canon issues; propagate any generic fix to scores 4–6; run `cargo test` + `vitest`
- [x] T047 [US2] Capture updated screenshot, create `cycle-01-comparison.png`; present to musician; iterate until approved; update `cycle-01.md`

### Score 4 — Bach Invention No. 1

- [X] T048 [US2] Create `specs/050-fix-layout-preloaded-scores/reviews/04-Bach_InventionNo1/cycle-01.md`
- [X] T049 [US2] Capture Graditone baseline screenshot → `reviews/04-Bach_InventionNo1/cycle-01-graditone-baseline.png`
- [X] T050 [US2] Side-by-side comparison of `references/Bach_InventionNo1.png` vs baseline; record issues in `cycle-01.md`; check two-voice spacing (imitative counterpoint runs in both treble and bass) and stem direction consistency
- [X] T051 [US2] Write failing tests for each new issue found in T050 in `backend/tests/layout_test.rs` or `frontend/src/` (Constitution VII)
- [X] T052 [P] [US2] Apply fixes for Invention issues; propagate any generic fix to scores 5–6; run `cargo test` + `vitest`
- [X] T053 [US2] Capture updated screenshot, create `cycle-01-comparison.png`; present to musician; iterate until approved; update `cycle-01.md`

### Score 5 — Beethoven Für Elise

- [X] T054 [US2] Create `specs/050-fix-layout-preloaded-scores/reviews/05-Beethoven_FurElise/cycle-01.md`
- [X] T055 [US2] Capture Graditone baseline screenshot → `reviews/05-Beethoven_FurElise/cycle-01-graditone-baseline.png`
- [X] T056 [US2] Side-by-side comparison of `references/Beethoven_FurElise.png` vs baseline; record issues in `cycle-01.md`; focus on 3/8 compound-meter beaming (`build_beam_groups_from_musicxml()` path in `backend/src/layout/beams.rs`) and note density per beat
- [X] T057 [US2] Write failing tests for each new issue found in T056 in `backend/tests/layout_test.rs` or `frontend/src/` (Constitution VII)
- [X] T058 [P] [US2] Apply fixes for Für Elise issues; propagate any generic fix to score 6; run `cargo test` + `vitest`
- [X] T059 [US2] Capture updated screenshot, create `cycle-01-comparison.png`; present to musician; iterate until approved; update `cycle-01.md`

**Checkpoint**: Scores 2–5 each have an approved `cycle-NN.md`. `cargo test` + `vitest` green.

---

## Phase 5: User Story 3 — Chopin Nocturne + Cross-Score Consistency (Score 6 + Final Check)

**Goal**: Complete review of the most complex score (Chopin) and verify that spacing,
proportions, and typographic conventions are uniform across all 6 approved scores.

**Independent Test**: Open all 6 scores consecutively and confirm uniform staff height,
clef size, spacing proportions, and barline weight. Musician confirms "clean and
professional" for all 6.

### Score 6 — Chopin Nocturne Op. 9 No. 2

- [X] T060 [US3] Create `specs/050-fix-layout-preloaded-scores/reviews/06-Chopin_NocturneOp9No2/cycle-01.md`
- [X] T061 [US3] Capture Graditone baseline screenshot → `reviews/06-Chopin_NocturneOp9No2/cycle-01-graditone-baseline.png`
- [X] T062 [US3] Side-by-side comparison of `references/Chopin_NocturneOp9No2.png` vs baseline; record issues in `cycle-01.md`; focus on: 12/8 beaming (6 eighth-notes per beam group), accidental collision avoidance (`backend/src/layout/positioner.rs`), ornament rendering, E♭ major key signature (3 flats), cross-staff note positioning
- [X] T063 [US3] Write failing tests for each new issue found in T062 in `backend/tests/layout_test.rs` or `frontend/src/` (Constitution VII)
- [X] T064 [P] [US3] Apply fixes for Nocturne issues in appropriate `backend/src/layout/` files or `frontend/src/components/LayoutRenderer.tsx`; run `cargo test` + `vitest`
- [X] T065 [US3] Capture updated screenshot, create `cycle-01-comparison.png`; present to musician; iterate until approved; update `cycle-01.md`

### Cross-Score Consistency Verification

- [x] T066 [US3] Open all 6 approved scores consecutively in Graditone; capture one screenshot per score at equivalent zoom level → `reviews/final-consistency-check/`
- [x] T067 [US3] Compare visual constants across all 6 screenshots: staff line weight, clef size, time-sig size, notehead size relative to staff, stem length, barline weight — record any inconsistency in `reviews/final-consistency-check/consistency-report.md`
- [x] T068 [P] [US3] For any inconsistency found in T067 attributed to `layout-engine`: write failing test in `backend/tests/layout_integration_test.rs`; fix in appropriate `backend/src/layout/` file; run `cargo test`
- [x] T069 [P] [US3] For any inconsistency found in T067 attributed to `renderer`: write failing test in `frontend/src/`; fix in `frontend/src/components/LayoutRenderer.tsx`; run `vitest`
- [x] T070 [US3] Re-capture all 6 screenshots after T068/T069 fixes; present final consistency panel to musician for sign-off; update `consistency-report.md`

**Checkpoint**: All 6 `cycle-NN.md` documents have `[x] Approved`. Consistency report has musician sign-off. `cargo test` + `vitest` pass.

---

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: Finalize known-limitation documentation, run full test suite, and close the feature.

- [x] T071 [P] Document any technical limitation that could not be fixed to full Musescore fidelity in `spec.md § Known Issues & Regression Tests` (FR-006 requirement)
- [x] T072 Run full regression suite: `cd backend && cargo test` — all tests must pass
- [x] T073 [P] Run full frontend test suite: `cd frontend && npm run test` — all tests must pass
- [x] T074 [P] Run E2E smoke test opening all 6 scores: `cd frontend && npx playwright test` (if relevant test exists)
- [x] T075 Verify no previously-approved score regressed: re-open each approved score and compare against its `cycle-NN-comparison.png` approval artifact
- [x] T076 Run quickstart.md validation: follow `specs/050-fix-layout-preloaded-scores/quickstart.md` steps end-to-end on a clean branch clone to verify the review workflow is reproducible

---

## Unplanned Fixes (discovered during review cycles)

Fixes surfaced during Phase 3–5 review cycles that were not in the original plan.

- [x] T077 Add `staccato: bool` and `dot_count: u8` fields to domain `Note` struct (`backend/src/domain/events/note.rs`) with serde skip-if-default attributes
- [x] T078 [P] Parse `<staccato/>` and `<dot/>` elements in `backend/src/domain/importers/musicxml/parser.rs`; propagate through `NoteData` in `types.rs` and `convert_note` in `converter.rs`
- [x] T079 [P] Extend layout engine `NoteEvent` / `NoteData` tuple and `position_glyphs_for_staff` in `backend/src/layout/mod.rs` to generate `notation_dots` output; add `NotationDot` to `backend/src/layout/types.rs` and `Staff` struct
- [x] T080 Add `NotationDot` interface and `notation_dots` field to `Staff` interface in `frontend/src/wasm/layout.ts`; render dots as SVG circles after glyphs in `frontend/src/components/LayoutRenderer.tsx`
- [x] T081 Fix notation dots not appearing: `convertScoreToLayoutFormat` in `frontend/src/components/layout/LayoutView.tsx` was not forwarding `staccato` / `dot_count` fields to the WASM layout engine; add fields to `Note` interface in `frontend/src/types/score.ts` and forward in conversion
- [x] T082 Fix staccato dot positioning: dots were placed on stem side instead of notehead side; swap anchor-note selection and offset direction in `backend/src/layout/mod.rs`
- [x] T083 Fix multi-voice stem direction: `collect_notes()` and `collect_notes_for_staff()` in `backend/src/domain/importers/musicxml/converter.rs` were discarding MusicXML `<voice>` numbers, merging all notes into one flat list; `VoiceDistributor` only split on overlap so `num_voices` was always 1 and `forced_stem_down` never activated; group notes by voice number so multi-voice staves produce separate `Voice` structs
- [x] T084 Add `forced_stem_down: Option<bool>` parameter to `position_noteheads` in `backend/src/layout/positioner.rs`; apply override in chord stem, beam-group direction, and staccato dot placement code paths in `backend/src/layout/mod.rs`; voice 0 → stems up, voice 1+ → stems down
- [x] T085 [P] Add `NotesByVoice` type alias in `backend/src/domain/importers/musicxml/converter.rs` to resolve `clippy::type_complexity` CI error on Rust 1.93.0 (`-D warnings` denies it)
- [x] T086 Fix first system top clipping: `running_y` started at 0.0 in `backend/src/layout/mod.rs` so stems/beams above the first staff extended into negative Y territory, clipped by viewport y=0; add 4-staff-space top margin (`4.0 * units_per_space = 80 units`) matching standard engraving practice; update `backend/tests/contract_test.rs` to check relative staff-line spacing instead of absolute y positions
- [x] T087 Fix Both Clefs practice mode: `mergePracticeNotesByTick` in `PracticeViewPlugin.tsx` missed cross-staff sustained-note pass and duration truncation; bass whole-note chord at tick 0 inflated merged durationTicks to full measure (via `Math.max`), forcing user to hold before advancing; add sustained-note propagation so bass chord appears as `sustainedPitches` at later treble onsets; add duration truncation to cap merged entries to gap before next onset; add `MergePracticeNotes.test.ts` with 6 unit tests
- [x] T088 Fix beam group stem direction: `compute_group_stem_direction` in `backend/src/layout/beams.rs` used majority-rule algorithm (count notes above vs below middle line) which disagrees with standard engraving practice; replace with farthest-note-from-middle rule (Gould, *Behind Bars*, p.17): the note with the greatest distance from the staff middle line determines direction; ties default to Up; add `test_group_stem_direction_farthest_below` test; split `test_group_stem_direction_even_split` into `unequal_spread` and `true_even_split` tests
- [x] T089 Fix excessive beamed stem length: beam group processing in `backend/src/layout/mod.rs` used `STEM_LENGTH` (70 units / 3.5 spaces) for initial beam positioning; this pushed the beam too far from noteheads, causing stems on notes far from the beam side to be excessively long; use `MIN_BEAMED_STEM_LENGTH` (50 units / 2.5 spaces) for initial positioning instead; the beam offset logic already extends stems outward as needed
- [x] T090 Fix staccato dot placement for beamed notes: staccato dots used per-chord stem direction heuristic, ignoring beam group direction; beamed notes with stems forced UP by a distant note in the group could still get staccato placed above instead of below; pre-compute beam group directions as tick→stem_down lookup before staccato placement; priority chain: multi-voice override > beam group direction > per-chord rule
- [x] T091 Fix beam grouping for notes with explicit MusicXML beam annotations but duration > 480 ticks: dotted eighths in beam groups (e.g., Bach Invention No. 1 measure 6 LH) were excluded by the `duration_ticks <= 480` beamable filter; changed 3 filter locations in `backend/src/layout/mod.rs` to include notes with beam_info regardless of duration (`duration_ticks <= 480 || !beam_info.is_empty()`)
- [x] T092 Fix accidental tracking to use per-octave scope: `measure_accidental_state` in `position_note_accidentals` (`backend/src/layout/positioner.rs`) keyed on `pitch_class` (mod 12), so an accidental on G#5 suppressed the accidental on G#4 in the same measure; changed key to full MIDI pitch so accidentals carry only within the same octave (Bach Invention No. 1 measure 14 RH note 9 G#4 was missing its sharp)
- [x] T093 Implement cross-system tie arcs: ties crossing system boundaries (e.g. Bach Invention No. 1 m15→m16 G5 RH) were silently skipped; added outgoing partial arc (note to system right edge) and incoming partial arc (system left edge to target note) in `backend/src/layout/mod.rs`; refactored tie direction logic into shared closure
- [x] T094 Implement slur (phrase mark) rendering: MusicXML `<slur>` elements were not parsed or rendered; added `SlurInfo`/`SlurType` to parser types, `<slur>` parsing in `parse_notations()`, `resolve_slur_chains()` in converter linking `slur_next` on `Note`, slur arc generation in layout engine (same-system, outgoing cross-system, incoming cross-system), `slur_arcs` on `Staff` layout type, and SVG Bézier rendering in `LayoutRenderer.tsx`; 155 slurs across 5 of 6 preloaded scores now render correctly
- [x] T095 Fix cross-system incoming tie/slur arcs: incoming arcs started at `unified_left_margin` which equals or exceeds the first note's x position minus notehead width, creating backward (invisible) arcs; changed start to `unified_left_margin - 3*notehead_half_w` with min-span guarantee so incoming arcs are always visible
- [x] T096 Fix slur rendering quality: endpoints repositioned to notehead edge (Y) and near centre (X); stroked line replaced with tapered filled crescent (two Bézier curves forming a lens shape); control-point X offset reduced from 33% to 20% of span; arc height changed from linear to `3.5*sqrt(span)` clamped [12, 50] for consistent curvature across all span lengths
- [x] T097 Fix slur concavity direction from MusicXML: `<slur placement="above|below">` attribute and `<bezier-y>` sign were not read; added `SlurInfo.placement` field in parser, propagated through `Note.slur_above` → JSON → layout engine; corrected `bezier-y` sign interpretation (MusicXML Y-up: positive = above, negative = below)
- [x] T098 Apply staccato articulation to playback audio: `staccato` field existed on `Note` but was ignored by the playback pipeline; added `staccato?: boolean` to `ResolvedNote` in `TieResolver.ts`, propagated through `scheduleNotes()` mapping in `PlaybackScheduler.ts`, and halved `durationSeconds` for staccato notes in `scheduleWindow()` before `MIN_NOTE_DURATION` floor
- [x] T099 Apply staccato articulation to practice mode: `extractPracticeNotes()` in `scorePlayerContext.ts` now tracks `hasStaccato` per tick-group and halves `durationTicks` for staccato entries (after gap-truncation), reducing the `requiredHoldMs` the practice engine enforces; added unit test for staccato propagation through `resolveTiedNotes()`
- [x] T100 Fix measure boundaries for shortened measures (Für Elise m9): `measure_start_tick()`/`measure_end_tick()` assumed all measures = `ticks_per_measure`; Für Elise m9 (1st ending) is only 2/8 (960 ticks) not 3/8 (1440), causing m10 notes to be assigned to m9; added `measure_end_ticks: Vec<u32>` to `Score`/`ScoreDto` computed from actual MusicXML content in `compute_measure_end_ticks()`; updated layout engine (`mod.rs`) and converter (`converter.rs`) to use actual boundaries with formula fallback; fixed chord note double-counting in both `compute_measure_end_ticks()` and `detect_pickup_ticks()`; added 7 regression tests in `measure_end_ticks_test.rs`; forwarded `measure_end_ticks` through frontend `LayoutView.tsx` and `score.ts` types
- [x] T101 Fix clef placement: correct clef rendering positions for system-start and mid-system clef changes
- [x] T102 Fix accidental state reset: accidental state was not properly reset at measure boundaries
- [x] T103 Fix rest positioning: rests were placed at incorrect vertical positions
- [x] T104 Fix system-start clef (incoming clef) and mid-system clef change positioning: added `get_clef_before_tick()` to `extraction.rs`; modified `structural.rs` to use incoming clefs and position mid-system clef changes after barlines
- [x] T105 Fix beamed chord stem/beam clearance (M25 RH): beam sat directly on noteheads because `BeamableNote` was deduplicated to one per tick; added `chord_y_range` map tracking full vertical extent per tick; Phase 1 stem origin uses `far_side_y`, minimum stem length from `beam_side_y`; beam offset enforces clearance from chord's beam-side notehead
- [x] T106 Fix stem-down chord note displacement direction (M25 LH): current displacement code always moves the upper note of a second pair to the RIGHT regardless of stem direction; standard engraving requires the lower note to be displaced LEFT for stem-down chords; make displacement direction-aware using `chord_stem_down` in `backend/src/layout/note_layout.rs`
- [x] T107 Verify accidental positioning for left-displaced notes: when a note is displaced left, its accidental (flat on Bb3 in M25 LH chord 4) must also shift left automatically; confirm `position_note_accidentals` in `positioner.rs` uses `adjusted_horizontal_offsets` which already includes chord displacement
- [x] T108 Build, test, commit, push: `cargo test`, `cargo clippy`, WASM build, `vitest`, commit and push
- [x] T109 Fix grace note rendering at full size and opacity: `convertScoreToLayoutFormat` in `frontend/src/components/layout/LayoutView.tsx` was not forwarding `is_grace` field to the WASM layout engine; layout engine already computed 60% font_size (48 vs 80) and 0.5 opacity for grace notes, but the frontend conversion dropped the flag; added `is_grace?: boolean` to `Note` interface in `frontend/src/types/score.ts`, added field to `ConvertedScore` note type, and forwarded in conversion; also applied 0.6x scaling and 0.5 opacity to grace note stems (U+0000 thickness 1.5→0.9) and beams (U+0001 thickness 10→6) in `backend/src/layout/note_layout.rs`; updated `cross_score_consistency_test.rs` to exclude grace stems from minimum length check; added `LayoutView.grace.test.ts` and `grace_note_layout_test.rs` (2 tests: noteheads + stems/beams) regression tests (Für Elise M26: F4, A4 grace notes)
- [x] T110 Fix unbeamed eighth/16th-note chord notehead-stem overlap (Für Elise M33 LH): `needs_explicit_stem` only covered quarter/half note chords (duration 960-3840); unbeamed eighth-note chords used a combined glyph (note8thUp) for the anchor note whose built-in stem misaligned with bare noteheads of other chord notes due to `text-anchor=middle` centering the wider combined glyph; expanded `needs_explicit_stem` to cover all durations < 3840 so all chord notes use bare noteheadBlack + explicit stem; added flag glyph generation (U+E240–U+E24F) for chord stems needing flags; added flag bounding boxes to `bravura_metadata.json`; updated `LayoutRenderer.tsx` to use `dominant-baseline=auto` for flag glyphs; added `test_unbeamed_eighth_chord_uses_bare_noteheads_and_explicit_stem` regression test
- [x] T111 Fix slur concavity direction (Für Elise M52): `bezier-y` control-point offset from MusicXML `<slur>` elements was incorrectly used to infer overall slur direction; a small positive `bezier-y` on the start note (3.17) overrode the standard engraving rule (slur opposite stems) and placed the ascending-run slur above instead of below; removed `bezier-y` sign inference from `parser.rs` — only explicit `placement="above|below"` attributes now set `slur_above`; without explicit placement, the layout engine auto-determines direction from note position vs staff middle line (notes below middle → stems up → slur below; notes above middle → stems down → slur above); added `test_slur_above_not_inferred_from_bezier_y` and `test_slur_arcs_present_in_layout` regression tests in `slur_direction_test.rs`
- [x] T112 Fix hidden augmentation dot on chord (Für Elise M63): 4-note dotted chord (E4, G4, Bb4, C#5) rendered only 3 visible dots because Bb4 (on B4 line) and C#5 (in C5 space) both had their dots placed at the same staff space; `shift_dot_to_space()` shifted Bb4's dot up to C5 space while C#5's dot was already there; added chord dot de-collision in `render_notation_dots()` in `backend/src/layout/annotations.rs` — after computing initial dot positions per note, walk top-to-bottom and push any collision down by one staff space; added `test_no_duplicate_dot_positions` and `test_m63_chord_produces_four_distinct_dots` regression tests in `chord_dots_test.rs`

---

## Dependencies

```
T001-T006 (directories) ──► T026, T036, T042, T048, T054, T060 (review docs)
T007-T012 (references)  ──► T028, T038, T044, T050, T056, T062 (comparisons)
T013-T014 (build+verify) ──► T025 (post-fix verification)
T015-T024 (foundational fixes) ──► T025 ──► T027 (baseline captures after fixes)
T027-T035 (La Candeur)  ──► T036+ (generic fixes propagated, scores 2–6 benefit)
T036-T041 (Arabesque)   ──► T042+ (generic fixes propagated)
T042-T047 (Canon)       ──► T048+
T048-T053 (Invention)   ──► T054+
T054-T059 (Für Elise)   ──► T060+
T060-T065 (Nocturne)    ──► T066-T070 (consistency check)
T066-T070 (consistency) ──► T071-T076 (polish + close)
```

## Parallel Execution Per Story

**Phase 1 (Setup)**: T007–T012 (6 PNG exports) all in parallel — independent Musescore operations.

**Phase 2 (Foundational)**: T016–T019 (code investigations) in parallel; T020 before T021; T022 before T023; T023–T024 parallel.

**Phase 3 (La Candeur)**: T029–T030 (tests) in parallel; T031–T032 (fixes) in parallel; T033–T034 in parallel.

**Phase 4 (Scores 2–5)**: NOT parallel — each score depends on generic fixes from the previous score and must confirm propagation. Within each score, test-writing and fix-application can be parallelised across layers (T039/T040, T045/T046, T051/T052, T057/T058).

**Phase 5 (Chopin + Consistency)**: T063–T064 (test + fix in parallel across layers); T068–T069 (consistency fixes parallel across layers).

## Implementation Strategy

**MVP scope**: Phases 1–3 (T001–T035) — La Candeur approved by musician. This proves:
- Review workflow is operational (quickstart.md works)
- Side-by-side comparison methodology established
- At least one round of tests + fixes demonstrates Constitution VII compliance
- Generic fixes benefit scores 2–6 before their reviews start

**Incremental delivery**:
1. Phase 1 + 2 (T001–T025): Infrastructure + foundational fixes → ~1 session
2. Phase 3 (T026–T035): La Candeur review cycle → musician session required
3. Phases 4–5 (T036–T070): Remaining 5 scores → one musician session per score
4. Final Phase (T071–T076): Regression + documentation → automated

**Risk management**: Phases 1–2 resolve pre-identified engine risks regardless of visual comparison outcome. Each subsequent score review starts from a higher baseline quality. The most complex score (Chopin) is last, benefiting from all generic fixes applied to earlier scores.
