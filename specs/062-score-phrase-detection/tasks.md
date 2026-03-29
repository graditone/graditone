# Tasks: Score Phrase Detection

**Input**: Design documents from `/specs/062-score-phrase-detection/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Constitution Principle V (Test-First Development, NON-NEGOTIABLE) mandates tests for all implementation. Test tasks included per-phase.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1, US2, US3)
- Exact file paths included in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Register the new phrase module and extend Score data model

- [X] T001 Register phrase module with `pub mod phrases;` in backend/src/domain/mod.rs
- [X] T002 Create PhraseRegion struct in backend/src/domain/phrases.rs per data-model.md
- [X] T003 Add `phrases: Vec<PhraseRegion>` field with serde defaults to Score struct in backend/src/domain/score.rs
- [X] T004 Initialize `phrases: Vec::new()` in `Score::new()` in backend/src/domain/score.rs
- [X] T005 Add PhraseRegionDto struct and `From<&PhraseRegion>` impl in backend/src/adapters/dtos.rs
- [X] T006 Add `phrases: Vec<PhraseRegionDto>` field with serde defaults to ScoreDto in backend/src/adapters/dtos.rs
- [X] T007 Add `phrases` mapping in `From<&Score> for ScoreDto` impl in backend/src/adapters/dtos.rs
- [X] T008 Bump SCORE_SCHEMA_VERSION from 10 to 11 with version comment in backend/src/adapters/dtos.rs
- [X] T009 Add PhraseRegion TypeScript interface in frontend/src/types/score.ts
- [X] T010 Add `phrases?: PhraseRegion[]` field to Score TypeScript interface in frontend/src/types/score.ts

**Checkpoint**: Data model complete — PhraseRegion flows from Rust domain → DTO → WASM → TypeScript. Schema v11 invalidates cached scores.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement the core phrase detection algorithm that all user stories depend on

**⚠️ CRITICAL**: No user story work can begin until phrase detection produces correct results

- [X] T011 Implement `collect_hard_boundaries(score: &Score) -> BTreeSet<usize>` in backend/src/domain/phrases.rs that collects measure indices from repeat_barlines, volta_brackets, time signature changes (tick > 0), and key signature changes (tick > 0)
- [X] T012 Implement `detect_slur_phrases(instrument: &Instrument, measure_end_ticks: &[u32], hard_boundaries: &BTreeSet<usize>) -> Vec<PhraseRegion>` in backend/src/domain/phrases.rs that walks slur_next chains in staff 0 / voice 0, merges adjacent slurs, and splits at hard boundaries
- [X] T013 Implement `detect_rest_boundaries(instrument: &Instrument, measure_end_ticks: &[u32]) -> BTreeSet<usize>` in backend/src/domain/phrases.rs that finds measures where all voices end with rests
- [X] T014 Implement `apply_fallback_grouping(start_measure: usize, end_measure: usize, time_sig_numerator: u32, time_sig_denominator: u32) -> Vec<(usize, usize)>` in backend/src/domain/phrases.rs that groups ungrouped measure ranges into 4-measure or 8-measure phrases based on time signature
- [X] T015 Implement `detect_phrases(score: &Score) -> Vec<PhraseRegion>` public entry point in backend/src/domain/phrases.rs that orchestrates: collect hard boundaries → detect slur phrases → detect rest boundaries → apply fallback grouping → compute start_tick/end_tick from measure_end_ticks → return sorted Vec<PhraseRegion>
- [X] T016 Implement pickup measure handling in detect_phrases: include pickup measure (measure 0 when pickup_ticks > 0) as part of the first phrase in backend/src/domain/phrases.rs
- [X] T017 Implement whole-score fallback in detect_phrases: when no phrases detected for an instrument, return single PhraseRegion spanning all measures in backend/src/domain/phrases.rs
- [X] T018 Call `detect_phrases(&score)` and assign result to `score.phrases` in parse_musicxml() after compute_difficulty() in backend/src/adapters/wasm/bindings.rs

### Tests for Phase 2 (Constitution V — mandatory)

> **Write these tests FIRST, ensure they FAIL before implementation**

- [X] T019 [P] Unit test for `collect_hard_boundaries`: score with repeat barlines, volta brackets, time sig changes → expected boundary set, in backend/tests/phrase_detection_test.rs
- [X] T020 [P] Unit test for `detect_slur_phrases`: instrument with slur chains spanning 4 measures → single phrase region, slur split at hard boundary → two phrase regions, in backend/tests/phrase_detection_test.rs
- [X] T021 [P] Unit test for `detect_rest_boundaries`: instrument with rests across all voices at measure 4 → boundary at measure 4, in backend/tests/phrase_detection_test.rs
- [X] T022 [P] Unit test for `apply_fallback_grouping`: 16-measure range in 4/4 → four 4-measure phrases; 16-measure range in 2/4 → two 8-measure phrases, in backend/tests/phrase_detection_test.rs
- [X] T023 Unit test for `detect_phrases` end-to-end: fixture score with mixed signals (slurs + repeats + fallback) → expected sorted Vec<PhraseRegion>, in backend/tests/phrase_detection_test.rs
- [X] T024 Unit test for pickup measure handling: score with pickup_ticks > 0 → measure 0 included in first phrase, in backend/tests/phrase_detection_test.rs
- [X] T025 Unit test for whole-score fallback: score with no boundaries → single phrase spanning all measures, in backend/tests/phrase_detection_test.rs
- [X] T026 Integration test: parse Burgmuller_Arabesque.mxl → ScoreDto contains non-empty phrases field with valid measure indices, in backend/tests/phrase_detection_test.rs
- [X] T027 Verify `cargo test` passes with all existing + new tests after phrase detection integration in backend/

**Checkpoint**: Phrase detection works end-to-end with full test coverage. Parsing any MusicXML now produces phrase data in the serialized ScoreDto.

---

## Phase 3: User Story 1 — View Detected Phrases on Score (Priority: P1) 🎯 MVP

**Goal**: User presses "Phrases" button in toolbar → score displays semi-transparent alternating color bands for each detected phrase with sequential labels.

**Independent Test**: Load Burgmuller_Arabesque.mxl → press Phrases button → verify colored phrase bands appear overlaid on score notation with "Phrase 1", "Phrase 2", etc. labels.

### Tests for User Story 1 (Constitution V — mandatory)

> **Write these tests FIRST, ensure they FAIL before implementation**

- [X] T028 [P] [US1] Unit test for PhraseOverlay: renders correct number of colored rectangles for 3 phrases across 2 systems, in frontend/tests/unit/PhraseOverlay.test.tsx
- [X] T029 [P] [US1] Unit test for PhraseOverlay: alternates between 2 colors for adjacent phrases, in frontend/tests/unit/PhraseOverlay.test.tsx
- [X] T030 [P] [US1] Unit test for usePhraseState: toggles phrasesVisible on/off, in frontend/tests/unit/usePhraseState.test.ts

### Implementation for User Story 1

- [X] T031 [US1] Create usePhraseState hook in frontend/src/hooks/usePhraseState.ts with `phrasesVisible` boolean toggle and `phrases` array from score data
- [X] T032 [US1] Create PhraseOverlay component in frontend/src/components/PhraseOverlay.tsx that renders semi-transparent alternating color bands (2 colors) positioned using layout engine System bounding boxes and tick ranges
- [X] T033 [US1] Implement phrase-to-system mapping in PhraseOverlay: for each phrase, find overlapping Systems via tick_range, compute x-range within each System's bounding_box, render rectangle in frontend/src/components/PhraseOverlay.tsx
- [X] T034 [US1] Add sequential phrase labels ("Phrase 1", "Phrase 2", ...) at the start of each phrase band in frontend/src/components/PhraseOverlay.tsx
- [X] T035 [US1] Add "Phrases" toggle button to toolbar in frontend/src/components/ScoreViewer.tsx following existing toolbar button pattern (disabled when score has no phrases)
- [X] T036 [US1] Wire usePhraseState hook into ScoreViewer and render PhraseOverlay behind score content when phrasesVisible is true in frontend/src/components/ScoreViewer.tsx
- [X] T037 [US1] Verify phrase toggle shows/hides color bands instantly (cached, no re-detection) by confirming phrasesVisible only controls overlay rendering in frontend/src/components/ScoreViewer.tsx

**Checkpoint**: User Story 1 complete — users can see and toggle phrase visualization on any loaded score.

---

## Phase 4: User Story 2 — Select a Phrase as Practice Region (Priority: P2)

**Goal**: User taps a phrase color band → that phrase's measure range becomes the active loop region for both play and practice views.

**Independent Test**: Enable phrases → tap on "Phrase 2" → verify loop region start/end ticks match that phrase's start_tick/end_tick → start playback → verify it loops within the phrase.

### Tests for User Story 2 (Constitution V — mandatory)

> **Write these tests FIRST, ensure they FAIL before implementation**

- [X] T038 [P] [US2] Unit test for usePhraseState.selectPhrase: sets selectedPhraseIndex and calls setPinnedStart/setLoopEnd with correct ticks, in frontend/tests/unit/usePhraseState.test.ts
- [X] T039 [P] [US2] Unit test for PhraseOverlay: selected phrase has distinct visual style (increased opacity or border), in frontend/tests/unit/PhraseOverlay.test.tsx

### Implementation for User Story 2

- [X] T040 [US2] Add `selectedPhraseIndex: number | null` state and `selectPhrase(index)` handler to usePhraseState in frontend/src/hooks/usePhraseState.ts
- [X] T041 [US2] Add click/tap handler on phrase band regions in PhraseOverlay to call `selectPhrase(index)` in frontend/src/components/PhraseOverlay.tsx
- [X] T042 [US2] Visually distinguish the selected phrase (e.g., increased opacity or border highlight) in frontend/src/components/PhraseOverlay.tsx
- [X] T043 [US2] On phrase selection, call `scorePlayer.setPinnedStart(phrase.start_tick)` and `scorePlayer.setLoopEnd(phrase.end_tick)` via plugin context in frontend/src/hooks/usePhraseState.ts
- [X] T044 [US2] When user taps a different phrase, update loop region to the new phrase's tick range in frontend/src/hooks/usePhraseState.ts

**Checkpoint**: User Story 2 complete — tapping a phrase sets the loop region for play/practice.

---

## Phase 5: User Story 3 — Navigate Between Phrases (Priority: P3)

**Goal**: User presses "Next Phrase" / "Previous Phrase" controls → viewport scrolls to adjacent phrase and cursor moves to its first beat.

**Independent Test**: Enable phrases → press "Next Phrase" repeatedly → verify viewport scrolls to each successive phrase start → wraps at end.

### Tests for User Story 3 (Constitution V — mandatory)

> **Write these tests FIRST, ensure they FAIL before implementation**

- [X] T045 [P] [US3] Unit test for usePhraseState: goToNextPhrase from index 0 → index 1; goToPreviousPhrase from index 1 → index 0; wrap-around from last → first and first → last, in frontend/tests/unit/usePhraseState.test.ts

### Implementation for User Story 3

- [X] T046 [US3] Add `currentPhraseIndex` state and `goToNextPhrase()` / `goToPreviousPhrase()` methods to usePhraseState in frontend/src/hooks/usePhraseState.ts
- [X] T047 [US3] Implement wrap-around logic: next from last phrase goes to first, previous from first goes to last in frontend/src/hooks/usePhraseState.ts
- [X] T048 [US3] Add "Next Phrase" and "Previous Phrase" navigation buttons to toolbar (visible only when phrasesVisible is true) in frontend/src/components/ScoreViewer.tsx
- [X] T049 [US3] On phrase navigation, scroll viewport to the System containing the target phrase's start_tick in frontend/src/components/ScoreViewer.tsx
- [X] T050 [US3] On phrase navigation, move playback cursor to the first beat of the target phrase (phrase.start_tick) in frontend/src/hooks/usePhraseState.ts

**Checkpoint**: User Story 3 complete — users can step through phrases sequentially with viewport following.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, performance, and documentation

- [X] T051 [P] Handle edge case: scores shorter than 2 measures produce a single whole-score phrase in backend/src/domain/phrases.rs
- [X] T052 [P] Handle edge case: score with no slurs, no repeats, no rests uses fallback grouping only in backend/src/domain/phrases.rs
- [X] T053 [P] Handle edge case: phrase toggle debounce for rapid on/off taps in frontend/src/hooks/usePhraseState.ts
- [X] T054 [P] Handle edge case: long phrases (16+ measures) render correctly across multiple systems in frontend/src/components/PhraseOverlay.tsx
- [X] T055 [P] Verify all 7 preloaded scores (Arabesque, LaCandeur, FurElise, InventionNo1, CanonD, NocturneOp9No2, clef.mxl) produce reasonable phrases by manual inspection, including multi-voice scores (CanonD) to validate primary-voice-only detection
- [X] T056 [P] Validate SC-001: phrase toggle responds within 2 seconds on preloaded scores
- [X] T057 [P] Validate SC-003: select phrase and begin practice within 3 taps from score viewer
- [X] T058 [P] Validate SC-004: all preloaded scores longer than 8 measures produce at least 2 phrases
- [X] T059 [P] Validate SC-006: phrase navigation moves viewport to correct phrase within 1 second
- [X] T060 [P] Run quickstart.md validation: cargo test, npm run test, manual Arabesque verification, IndexedDB cache invalidation check
- [X] T061 [P] Update docs/architecture.md or relevant documentation to mention phrase detection as a Score analysis step

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup (Phase 1) completion — BLOCKS all user stories. Tests (T019-T025) written FIRST per Constitution V.
- **US1 (Phase 3)**: Depends on Foundational (Phase 2) — can start once phrase detection works. Tests (T028-T030) written FIRST.
- **US2 (Phase 4)**: Depends on US1 (Phase 3) — requires phrase visualization to exist for tap targets. Tests (T038-T039) written FIRST.
- **US3 (Phase 5)**: Depends on US1 (Phase 3) — requires phrase state hook and toolbar integration. Tests (T045) written FIRST.
- **Polish (Phase 6)**: Can be interleaved with later phases; T051-T052 can be done during Phase 2

### User Story Dependencies

- **US1 (P1)**: Depends only on Foundational — fully independent
- **US2 (P2)**: Depends on US1 (needs PhraseOverlay and usePhraseState to exist). Independent of US3.
- **US3 (P3)**: Depends on US1 (needs usePhraseState and toolbar). Independent of US2.

### Within Each User Story

- Models/types before services/hooks
- Hooks before components
- Components before toolbar integration
- Core rendering before interaction handlers

### Parallel Opportunities

**Phase 1** (Setup):
```
Parallel group A (backend):  T001, T002, T003, T004
Parallel group B (DTO):      T005, T006, T007, T008  (after group A)
Parallel group C (frontend):  T009, T010              (independent of backend)
```

**Phase 2** (Foundational):
```
Tests FIRST:      T019-T025 (parallel, all in phrase_detection_test.rs)
Parallel group D: T011, T013 (hard boundaries and rest boundaries are independent)
Sequential:       T012 (needs T011), T014 (independent), T015 (needs T011-T014)
Sequential:       T016, T017 (extend T015), T018 (integration), T026 (fixture test), T027 (verification)
```

**Phase 3** (US1):
```
Tests FIRST:  T028, T029, T030 (parallel)
Sequential:   T031 → T032 → T033 → T034 → T035 → T036 → T037
```

**Phase 4** (US2):
```
Tests FIRST:  T038, T039 (parallel)
Sequential:   T040 → T041 → T042 → T043 → T044
```

**Phase 5** (US3):
```
Tests FIRST:  T045
Sequential:   T046 → T047 → T048 → T049 → T050
```

**Phase 6** (Polish):
```
All [P] tasks can run in parallel
```

---

## Implementation Strategy

### MVP Scope

**User Story 1 (View Detected Phrases)** = Minimum Viable Product

With Phases 1 + 2 + 3 complete:
- Backend detects phrases during import
- Frontend shows phrase color bands with toggle
- Schema v11 invalidates stale caches
- Users understand musical structure visually

### Incremental Delivery

1. **Increment 1** (Phases 1-3): Phrase detection + visualization — delivers MVP (T001-T037)
2. **Increment 2** (Phase 4): Phrase selection → practice region — delivers core "practice with musicality" goal (T038-T044)
3. **Increment 3** (Phase 5): Sequential phrase navigation — convenience feature (T045-T050)
4. **Increment 4** (Phase 6): Polish, edge cases, and success criteria validation — hardening (T051-T061)
