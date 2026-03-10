---
description: "Task list for 043-score-rests: Render rest symbols for all standard durations"
---

# Tasks: Rest Symbols in Scores

**Feature**: `043-score-rests`
**Branch**: `043-score-rests`
**Input**: Design documents from `/specs/043-score-rests/`
**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ ✅

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no incomplete-task dependencies)
- **[Story]**: Which user story this task belongs to ([US1], [US2], [US3])
- File paths are relative to the repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the MusicXML test fixture that all three user story checkpoints depend on.

- [X] T001 Create MusicXML test fixture with one measure per rest type (whole, half, quarter, eighth, 16th, 32nd, 64th) in `backend/tests/fixtures/rest_types.xml`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Domain entity, importer pipeline, and DTO contract changes that MUST be complete before any layout work begins. Rests must flow from MusicXML through to `ScoreDto` JSON before the layout engine can render them.

**⚠️ CRITICAL**: No user story layout work can begin until this phase is complete.

- [X] T002 Create `RestEvent` domain entity (id, start_tick, duration_ticks, note_type, voice, staff) with `new()` validating `duration_ticks > 0` in `backend/src/domain/events/rest.rs`
- [X] T003 [P] Add `pub mod rest` and re-export `RestEvent` in `backend/src/domain/events/mod.rs`
- [X] T004 Add `rest_events: Vec<RestEvent>` with `#[serde(default, skip_serializing_if = "Vec::is_empty")]` to `Voice` struct in `backend/src/domain/voice.rs`
- [X] T005 [P] Add `note_type: Option<String>` field to `RestData` struct in `backend/src/domain/importers/musicxml/types.rs`
- [X] T006 Copy `note_type: note.note_type.clone()` when constructing `RestData` from the note branch in `backend/src/domain/importers/musicxml/parser.rs`
- [X] T007 Convert each `MeasureElement::Rest(rest_data)` to `RestEvent` and push to `voice.rest_events` instead of discarding in `backend/src/domain/importers/musicxml/converter.rs`
- [X] T008 Bump `SCORE_SCHEMA_VERSION` from 4 to 5 and add `rest_events: Vec<RestEventDto>` to the serialized voice in `backend/src/adapters/dtos.rs`

**Checkpoint**: Domain rests flow MusicXML → `Voice` → `ScoreDto` JSON. Layout user-story work can now begin in parallel.

---

## Phase 3: User Story 1 — Visible Rest Symbols in Imported Scores (Priority: P1) 🎯 MVP

**Goal**: Every rest in an imported MusicXML score is rendered as the correct SMuFL symbol at the correct horizontal and vertical position on the staff.

**Independent Test**: Import `rest_types.xml` fixture. Verify that `GlobalLayout` output contains exactly one glyph per rest, each with the expected SMuFL codepoint (U+E4E3–U+E4E9) and an x-position within its measure's bounds.

### Tests for User Story 1

> **Write these tests FIRST and confirm they FAIL before implementing T010–T015.**

- [X] T009 [P] [US1] Write unit tests T-REST-01 through T-REST-05 (glyph codepoint selection for all 7 durations, single-voice x-position from beat offset, middle-line y-position for quarter/eighth, line-1 y for whole, line-3 y for half) in `backend/src/layout/positioner.rs` `#[cfg(test)]` block

### Implementation for User Story 1

- [X] T010 [US1] Add `rests: Vec<RestEvent>` field to `VoiceData` and parse the `rest_events` JSON array in `extract_instruments()` in `backend/src/layout/mod.rs`
- [X] T011 [US1] Add `rest_durations: &[u32]` parameter to `compute_measure_width()` and process rest durations identically to note durations in `backend/src/layout/spacer.rs`
- [X] T012 [P] [US1] Implement `rest_glyph_codepoint(note_type: Option<&str>, duration_ticks: u32) -> char` mapping to SMuFL codepoints `\u{E4E3}`–`\u{E4E9}` with quarter-rest fallback for unknown types in `backend/src/layout/positioner.rs`
- [X] T013 [P] [US1] Implement `rest_y(duration_ticks: u32, voice_number: usize, staff_voices: usize, units_per_space: f32) -> f32` with only base-y logic (no voice offset) in `backend/src/layout/positioner.rs`
- [X] T014 [US1] Implement `position_rests_for_staff(voice_data, staff_bounds, config) -> Vec<Glyph>` using `rest_glyph_codepoint()` and `rest_y()`, x-position from beat offset (non-full-measure path only) in `backend/src/layout/positioner.rs`
- [X] T015 [US1] Call `position_rests_for_staff()` inside `position_glyphs_for_staff()` and append returned glyphs to the output vec in `backend/src/layout/mod.rs`
- [X] T016 [P] [US1] Add Playwright snapshot tests rendering each of the 7 rest duration glyphs from the `rest_types.xml` fixture and commit reference images in `frontend/tests/visual/rest-symbols.spec.ts`

**Checkpoint**: User Story 1 complete — all standard rest symbols are visible in any imported score.

---

## Phase 4: User Story 2 — Full-Measure Rest Centered in Measure (Priority: P2)

**Goal**: A rest whose `duration_ticks == numerator * (3840 / denominator)` is rendered as a whole rest symbol centered horizontally within its measure's bounds.

**Independent Test**: Import a MusicXML file with a 4/4 full-measure rest. Verify the rest glyph x-position equals `start_x + (end_x - start_x - REST_GLYPH_WIDTH) / 2.0`.

### Tests for User Story 2

> **Write these tests FIRST and confirm they FAIL before implementing T018–T019.**

- [X] T017 [P] [US2] Write unit tests T-REST-06 through T-REST-08 (full-measure rest detection formula for 4/4, 3/4, 6/8; centered x-position returned; non-full-measure rest x unchanged) in `backend/src/layout/positioner.rs` `#[cfg(test)]` block

### Implementation for User Story 2

- [X] T018 [US2] Implement `is_full_measure_rest(duration_ticks: u32, time_numerator: u8, time_denominator: u8) -> bool` using `numerator * (3840 / denominator)` in `backend/src/layout/positioner.rs`
- [X] T019 [US2] Extend `position_rests_for_staff()` to call `is_full_measure_rest()` per rest and compute centered x-position `start_x + (end_x - start_x - REST_GLYPH_WIDTH) / 2.0` when true in `backend/src/layout/positioner.rs`
- [X] T020 [US2] Add Rust integration test parsing a full-measure rest fixture and asserting the output glyph x equals the measure center in `backend/tests/rest_layout.rs`

**Checkpoint**: User Story 2 complete — full-measure rests are horizontally centered within their measures.

---

## Phase 5: User Story 3 — Rest Symbols in Multi-Voice Staves (Priority: P3)

**Goal**: In staves with multiple voices, Voice 1 rests shift up by `units_per_space` and Voice 2 rests shift down by `units_per_space`, producing distinct non-overlapping vertical positions.

**Independent Test**: Import a MusicXML file with two voices sharing one staff, each with a rest at the same beat. Verify Voice 1 glyph y < middle_y and Voice 2 glyph y > middle_y.

### Tests for User Story 3

> **Write these tests FIRST and confirm they FAIL before implementing T022–T023.**

- [X] T021 [P] [US3] Write unit tests T-REST-09 through T-REST-12 (Voice 1 y-offset is −units_per_space, Voice 2 y-offset is +units_per_space, single-voice staff has zero offset, simultaneous Voice 1 and Voice 2 rests produce non-overlapping y-values) in `backend/src/layout/positioner.rs` `#[cfg(test)]` block

### Implementation for User Story 3

- [X] T022 [US3] Extend `rest_y()` to compute `voice_offset = if voice_number % 2 == 1 { -units_per_space } else { +units_per_space }` when `staff_voices > 1`, add to base-y in `backend/src/layout/positioner.rs`
- [X] T023 [US3] Pass `voice_number` and `staff_voices` count into every `rest_y()` call within `position_rests_for_staff()` in `backend/src/layout/positioner.rs`
- [X] T024 [US3] Add Rust integration test for a two-voice staff fixture asserting Voice 1 glyph y < Voice 2 glyph y for simultaneous rests in `backend/tests/rest_layout.rs`

**Checkpoint**: User Story 3 complete — multi-voice rests appear at correct non-overlapping vertical positions.

---

## Final Phase: Polish & Cross-Cutting Concerns

- [X] T025 Run full `cargo test` suite and resolve any failures to confirm SC-005 (zero regressions in note rendering, beaming, playback, layout) in `backend/`
- [ ] T026 [P] Run Playwright snapshot tests and approve all 7 rest duration reference images so CI baseline is committed (SC-006) in `frontend/tests/visual/`
- [ ] T027 [P] Profile scroll rendering on a rest-heavy fixture (≥50% rest slots, 10 staves, 100 measures) and verify ≥30 fps frame rate (SC-004)

---

## Dependencies

```
Phase 1 (Setup)
  T001 (rest_types.xml fixture)

Phase 2 (Foundational) — no dependencies on Phase 1
  T002 (domain/events/rest.rs)
  ├── T003 [P] (events/mod.rs)       can run alongside T005
  └── T004 (voice.rs)                requires T002, T003

  T005 [P] (types.rs)                can run alongside T002, T003
  └── T006 (parser.rs)               requires T005

  T007 (converter.rs)                requires T002, T004, T006
  T008 (dtos.rs)                     requires T004

Phase 3 (US1) — requires Phase 2 complete
  T009 [P] (tests T-REST-01..05)     write first; must FAIL initially
  T010 (VoiceData + extract_instruments) requires T008
  T011 (spacer.rs)                   independent; can run alongside T010, T012, T013
  T012 [P] (rest_glyph_codepoint)    independent of T010, T011, T013
  T013 [P] (rest_y basic)            independent of T010, T011, T012
  T014 (position_rests_for_staff)    requires T012, T013
  T015 (wire up in mod.rs)           requires T010, T011, T014
  T016 [P] (snapshot tests)          requires T015

Phase 4 (US2) — requires Phase 3 complete
  T017 [P] (tests T-REST-06..08)     write first; must FAIL initially
  T018 (is_full_measure_rest)        independent of T017
  T019 (extend position_rests)       requires T018
  T020 (integration test)            requires T019

Phase 5 (US3) — requires Phase 3 complete; independent of Phase 4
  T021 [P] (tests T-REST-09..12)     write first; must FAIL initially
  T022 (extend rest_y with offset)   requires T013 complete
  T023 (pass voice_number)           requires T022
  T024 (integration test)            requires T023

Final Phase — requires Phase 4 and Phase 5 complete
  T025 (cargo test suite)
  T026 [P] (snapshot reference commit)
  T027 [P] (performance profiling)
```

---

## Parallel Execution Examples

### Phase 2 — Two workers

```
Worker A:  T002 → T003 → T004 → T007 → T008
Worker B:  T005 → T006 ↗ (merges at T007)
```

### Phase 3 — Four workers

```
Worker A:  T009 (write failing tests first)
Worker B:  T010 → T015
Worker C:  T011 (spacer, fully independent)
Worker D:  T012 → T014 → T015 (joins Worker B)
Worker E:  T013 → T014 (joins Worker D)
After T015: T016 (snapshot tests)
```

### Phase 4 + Phase 5 — Can run concurrently after Phase 3

```
Worker A (US2):  T017 → T018 → T019 → T020
Worker B (US3):  T021 → T022 → T023 → T024
```

---

## Implementation Strategy

**MVP Scope**: Phase 1 + Phase 2 + Phase 3 (User Story 1 only). This renders rest symbols for all 7 standard durations and turns a broken-looking score into a readable one.

**Incremental Delivery**:

1. **Phase 2 complete** → rests propagate through the pipeline (no visible output yet, but the data is present in `ScoreDto`)
2. **Phase 3 complete** → all rest types rendered for any score → **Demo-able milestone**
3. **Phase 4 complete** → full-measure rests correctly centered → **Orchestral scores look correct**
4. **Phase 5 complete** → multi-voice piano/choral scores correct → **Feature complete**

**Key Constraint**: `positioner.rs` changes are incremental across stories — US1 creates the function, US2 adds full-measure branching, US3 adds voice offsetting. Implement in story order to avoid conflicts on the same function body.
