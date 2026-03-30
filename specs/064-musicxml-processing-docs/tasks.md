# Tasks: MusicXML Processing Reference Documentation

**Input**: Design documents from `/specs/064-musicxml-processing-docs/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Not requested — documentation-only feature.

**Organization**: Tasks grouped by user story. Each story produces an independently verifiable documentation increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1, US2, US3)
- Exact file paths included in descriptions

---

## Phase 1: Setup

**Purpose**: Create the document file and establish its skeleton structure

- [x] T001 Create `docs/musicxml-processing.md` with title, purpose statement, and 11 section headings matching data-model.md outline
- [x] T002 Add Mermaid high-level data flow diagram (MusicXML → Import → Domain Model → Layout → Rendering + Playback) in Section 1: Overview of `docs/musicxml-processing.md`
- [x] T003 Add maintenance note referencing `docs/doc-update-checklist.md` in Section 1: Overview of `docs/musicxml-processing.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Write the core pipeline sections that all user stories depend on — a developer cannot trace any feature through the pipeline without these sections existing first

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Write Section 2: MusicXML Import Pipeline — three-layer architecture (Compression → Parser → Converter), module reference table, key intermediate type `MusicXMLDocument`, import result structure, link to `docs/musicxml-importer.md` in `docs/musicxml-processing.md`
- [x] T005 Write Section 3: Domain Model — hierarchy diagram (Score → Instrument → Staff → Voice → Note), inline Rust struct excerpts for Score, Instrument, Staff, Voice, Note, NoteSpelling using verbatim definitions from research.md RT-1, key value objects (Tick, Pitch, BPM, Clef, KeySignature), link to `docs/wasm-engine.md` in `docs/musicxml-processing.md`
- [x] T006 Write Section 4: WASM Bridge — exported function table (12 functions with signatures from research.md RT-2), JSON serialization flow, schema version constant (v12), cache invalidation mechanism, WASM loader initialization, link to `docs/wasm-engine.md` in `docs/musicxml-processing.md`
- [x] T007 Write Section 5: Layout Engine — 11-stage pipeline table, input/output formats (CompiledScore JSON → GlobalLayout JSON), coordinate system description, GlyphRun batching, SMuFL/Bravura font, link to `docs/layout-engine.md` in `docs/musicxml-processing.md`
- [x] T008 Write Section 6: SVG Rendering — two-tier model (Full Render Pass + Incremental Highlight Pass), viewport virtualization, GlyphRun → SVG rendering, click-to-note interaction, link to `docs/svg-renderer.md` in `docs/musicxml-processing.md`
- [x] T009 Write Section 7: Playback Pipeline — pipeline flow (Score → Repeat Expansion → Tie Resolution → Windowed Scheduling → Audio), timing conversion formula, staccato/velocity handling, audio source (Salamander Piano + PolySynth fallback) in `docs/musicxml-processing.md`

**Checkpoint**: Foundation ready — all pipeline stages documented. User story-specific sections can now proceed.

---

## Phase 3: User Story 1 - Developer Looks Up Processing Pipeline for Decision-Making (Priority: P1) 🎯 MVP

**Goal**: A developer can open the reference document and trace the complete data flow for any musical feature through all processing stages, with key files and struct excerpts for quick reference.

**Independent Test**: A developer unfamiliar with the codebase can identify the module responsible for any processing stage within 5 minutes by reading only this document.

### Implementation for User Story 1

- [x] T010 [US1] Write Section 10: Implementation Status Matrix — consolidated table with 18 musical features × 3 pipeline stages (Parsed, Rendered, Played Back) using status data from research.md RT-6 in `docs/musicxml-processing.md`
- [x] T011 [US1] Write Section 11: Key Files Reference — backend files table (module → file path → purpose) and frontend files table (module → file path → purpose) using data from research.md RT-1/RT-2/RT-3 in `docs/musicxml-processing.md`
- [x] T012 [US1] Add cross-reference links to existing docs (architecture.md, musicxml-importer.md, layout-engine.md, svg-renderer.md, wasm-engine.md) throughout all sections of `docs/musicxml-processing.md`

**Checkpoint**: Document is complete as a standalone pipeline reference. A developer can trace any feature through the pipeline and find the relevant source files.

---

## Phase 4: User Story 2 - Developer Navigates from Architecture Overview to Processing Detail (Priority: P2)

**Goal**: A developer reading architecture.md discovers the new processing reference and can navigate to it. The new document links back to component-specific docs.

**Independent Test**: Clicking the link in architecture.md reaches the new document; clicking cross-reference links in the new document reaches the existing component detail pages.

### Implementation for User Story 2

- [x] T013 [US2] Add row for "MusicXML Processing Pipeline" to the Components table in `docs/architecture.md` with description and link to `musicxml-processing.md`
- [x] T014 [US2] Add link to `musicxml-processing.md` in the See Also section of `docs/architecture.md`

**Checkpoint**: Bidirectional navigation works — architecture.md → new document → component detail docs.

---

## Phase 5: User Story 3 - Developer Uses Document for Accidentals or Reproduction Decision (Priority: P3)

**Goal**: A developer tasked with accidental rendering or music reproduction improvements can find the complete data flow — from MusicXML parsing through domain storage, layout, rendering, and playback — for accidentals and dynamics/velocity specifically.

**Independent Test**: Using only the reference document (no source code), a developer can correctly describe (a) how accidental data flows from MusicXML to SVG, and (b) how note velocity is computed from dynamics markings and delivered to audio output.

### Implementation for User Story 3

- [x] T015 [P] [US3] Write Section 8: Musical Feature Focus — Accidentals — MusicXML parsing (`<pitch>`, `<accidental>`), domain storage (Note.pitch, Note.spelling, Note.has_explicit_accidental), layout (SMuFL codepoints U+E260/E261/E262), rendering, and playback impact in `docs/musicxml-processing.md`
- [x] T016 [P] [US3] Write Section 9: Musical Feature Focus — Dynamics & Velocity — MusicXML parsing (`<direction><dynamics>`, `<wedge>`), domain storage (DynamicMarking, GradualDynamic with inline struct excerpts), velocity computation (DynamicLevel → MIDI velocity mapping), gradual interpolation, and playback delivery (Note.velocity → Tone.Sampler gain) in `docs/musicxml-processing.md`

**Checkpoint**: Accidentals and dynamics/velocity deep-dive sections complete. A developer can plan implementation changes using only the reference document.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [x] T017 Verify all 6 cross-reference links resolve to existing files in docs/ within `docs/musicxml-processing.md`
- [x] T018 Verify inline Rust struct excerpts in Sections 3/5/8/9 match current source code field names in `docs/musicxml-processing.md`
- [x] T019 Verify Mermaid diagram in Section 1 renders correctly in GitHub markdown preview for `docs/musicxml-processing.md`
- [x] T020 Run quickstart.md validation checklist against completed `docs/musicxml-processing.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup (T001 creates the file)
- **US1 (Phase 3)**: Depends on Foundational (needs pipeline sections to exist for cross-refs and status matrix context)
- **US2 (Phase 4)**: Depends on Setup (T001 creates the file that architecture.md will link to) — can run in parallel with Phase 2/3
- **US3 (Phase 5)**: Depends on Foundational (needs domain model section for struct references) — can run in parallel with Phase 3
- **Polish (Phase 6)**: Depends on all previous phases

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational (Phase 2) — no dependency on other stories
- **US2 (P2)**: Can start after Setup (Phase 1) — only edits architecture.md
- **US3 (P3)**: Depends on Foundational (Phase 2) — no dependency on other stories

### Parallel Opportunities

- T015 and T016 in US3 are parallelizable (different document sections, no shared dependencies)
- US2 (Phase 4) can run in parallel with Phases 2/3/5 (edits a different file: architecture.md)
- Within Phase 2, T004–T009 could be parallelized (different sections of the same file, but sequential recommended for coherent narrative flow)

---

## Implementation Strategy

### MVP (User Story 1 only)

Phases 1 + 2 + 3 deliver a fully functional pipeline reference document. A developer can trace any feature through the complete processing pipeline and find the relevant source files.

**MVP task count**: 12 tasks (T001–T012)

### Full Implementation

All 20 tasks across 6 phases. Adds architecture.md integration (US2) and accidentals/dynamics deep-dives (US3).

### Suggested Execution Order

1. T001 → T002 → T003 (Setup)
2. T004 → T005 → T006 → T007 → T008 → T009 (Foundational — sequential for narrative flow)
3. T013 + T014 in parallel with step 2 (US2 — different file)
4. T010 → T011 → T012 (US1 — status matrix, files reference, cross-refs)
5. T015 + T016 in parallel (US3 — independent sections)
6. T017 → T018 → T019 → T020 (Polish — sequential validation)
