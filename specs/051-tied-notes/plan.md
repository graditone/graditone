# Implementation Plan: Tied Notes Support

**Branch**: `051-tied-notes` | **Date**: 2026-03-16 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/051-tied-notes/spec.md`

## Summary

Add full support for tied notes across the entire pipeline — from MusicXML parsing through the Rust/WASM layout engine to frontend rendering and playback. A tie is a curved arc connecting two noteheads of the same pitch, indicating the second note is a continuation (no re-attack) rather than a new attack. Implementation spans six layers: parser (extract `<tie>` / `<notations><tied>` elements), domain model (add tie relationship to `Note`), layout engine (compute Bézier arc geometry), SVG renderer (render `<path>` elements), playback scheduler (merge tied durations before scheduling), and practice engine (skip continuation notes). All 7 preloaded scores contain ties and serve as regression targets.

## Technical Context

**Language/Version**: Rust (latest stable) — backend domain, layout engine, WASM bindings; TypeScript 5 (strict) + React 18 — frontend PWA
**Primary Dependencies**: `quick-xml` (MusicXML SAX parsing), `wasm-pack` + `wasm-bindgen` (WASM bindings), Tone.js (playback synthesis), Bravura/SMuFL font (notation glyphs), Vitest (frontend unit), Playwright (e2e)
**Storage**: N/A — in-memory score graph; preloaded `.mxl` bundles in `scores/`
**Testing**: `cargo test` (Rust unit + integration), `vitest` (TypeScript unit), Playwright (e2e browser)
**Target Platform**: Tablet PWA — Chrome 57+, Safari 11+, Edge 16+; Rust music engine compiled to WASM
**Project Type**: Web application — `backend/` (Rust WASM module) + `frontend/` (React TypeScript PWA)
**Performance Goals**: Layout computation ≤100ms for typical scores; 60fps SVG rendering; WASM bundle remains <500KB gzipped
**Constraints**: Rust/WASM is the **sole** permitted layout engine (Constitution VI — TypeScript coordinate calculations prohibited); tie arc Bézier positions must originate from Rust layout engine; offline-first capability unchanged
**Scale/Scope**: Affects all 7 preloaded scores (Chopin, Beethoven, Burgmüller ×2, Pachelbel, Bach, clef); full 6-layer pipeline

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Domain-Driven Design | ✅ PASS | `Tie` and `TiedNoteChain` are first-class domain concepts; tie resolution in domain converter, not infrastructure |
| II. Hexagonal Architecture | ✅ PASS | MusicXML parsing in importer adapter; layout in domain layout module; renderer is pure infrastructure |
| III. PWA Architecture | ✅ PASS | All tie logic runs in WASM; no network dependency; offline-first preserved |
| IV. Precision & Fidelity | ✅ PASS | Tied duration = sum of `duration_ticks` (integer arithmetic, 960 PPQ — no floating-point timing) |
| V. Test-First Development | ✅ PASS | Failing tests written for each layer before implementation |
| VI. Layout Engine Authority | ✅ PASS | Tie arc Bézier geometry computed in Rust layout engine; frontend renderer simply draws `<path>` — no coordinate calculations in TypeScript |
| VII. Regression Prevention | ✅ PASS | Chopin/Beethoven/Burgmüller fixtures provide regression baselines; test for each layer |

**Constitution Check result: ALL PASS — no violations. Proceed to Phase 0.**

## Project Structure

### Documentation (this feature)

```text
specs/051-tied-notes/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── wasm-output.md   # Layout TieArc type contract
│   └── typescript.md    # Frontend Note/Score type contract
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── domain/
│   │   ├── events/
│   │   │   └── note.rs                  # Add: tie_next / is_tie_continuation fields + TieType enum
│   │   └── importers/
│   │       └── musicxml/
│   │           ├── types.rs             # Add: TieType, TiePlacement enums, tie fields in NoteData
│   │           ├── parser.rs            # Add: <tie> and <notations><tied> parsing
│   │           └── converter.rs         # Add: tie chain resolution post-pass
│   └── layout/
│       ├── types.rs                     # Add: TieArc struct; tie_arcs field on Staff
│       └── mod.rs                       # Add: compute_tie_arcs() function
└── tests/
    ├── fixtures/musicxml/
    │   ├── tied_notes_basic.musicxml    # New: 3 tie cases (within-measure, cross-barline, chain-of-3)
    │   └── tied_notes_chord.musicxml   # New: chord with partial ties
    └── integration/
        └── test_tied_notes.rs           # Integration: MusicXML → domain → layout → arcs

frontend/
├── src/
│   ├── types/
│   │   └── score.ts                     # Add: tieNext, isTieContinuation on Note; TieArc on LayoutStaff
│   ├── components/notation/
│   │   └── NotationRenderer.tsx         # Add: <path> rendering loop for tieArcs
│   └── services/playback/
│       ├── PlaybackScheduler.ts         # Update: call TieResolver before scheduling
│       └── TieResolver.ts               # New: resolve tied chains → merged duration events
├── plugins/practice-view-plugin/
│   └── (scorePlayerContext.ts or practiceEngine.ts)  # Add: filter isTieContinuation notes
└── tests/
    ├── unit/
    │   ├── TieResolver.test.ts          # Unit: tie chain grouping + duration merging
    │   └── NotationRenderer.test.tsx   # Snapshot: <path class=tie-arc> present
    └── e2e/
        └── tied-notes.spec.ts           # E2E: Chopin score → .tie-arc elements in SVG
```

**Structure Decision**: Web application (Option 2). Backend (`backend/`) handles all music domain logic, tie chain resolution, and layout in Rust; frontend (`frontend/`) is a pure rendering/interaction layer. WASM bindings via serde auto-propagate updated types (TieArc, Note tie fields) to TypeScript — no manual type file changes beyond consuming new fields.

## Complexity Tracking

> No Constitution violations — this section is not required.
