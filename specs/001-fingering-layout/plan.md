# Implementation Plan: Fingering Support from MusicXML to Scores Layout

**Branch**: `001-fingering-layout` | **Date**: 2026-03-22 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/001-fingering-layout/spec.md`

## Summary

Parse `<fingering>` elements from MusicXML `<notations><technical>` blocks, carry the digit value and placement preference through the domain pipeline (`NoteData → Note → NoteEvent`), compute `FingeringGlyph` positions in the Rust layout engine, include them in the `GlobalLayout` JSON output, and render them as SVG `<text>` numerals in the frontend renderer. No horizontal spacing changes; fingering only occupies vertical space outside the staff lines.

## Technical Context

**Language/Version**: Rust (stable, Edition 2024) · TypeScript 5.x  
**Primary Dependencies**: `quick-xml` (streaming MusicXML parser), `serde_json` (layout JSON), `wasm-pack` (WASM compilation), React 18, SVG rendering  
**Storage**: N/A — data flows in-memory from MXL file through WASM  
**Testing**: `cargo test` (unit + integration, `backend/tests/`), Vitest (frontend unit)  
**Target Platform**: Tablet PWA (iPad/Surface/Android) via WASM; Rust compiled to `cdylib + rlib`  
**Project Type**: Monorepo — `backend/` (Rust WASM crate `musicore-backend`) + `frontend/` (React PWA)  
**Performance Goals**: Layout pipeline ≤100ms for typical scores (existing constraint, not changed by this feature)  
**Constraints**: Fingering numerals must NOT affect horizontal note spacing; no new crates; no TypeScript layout logic (Principle VI); test-first (Principle V)  
**Scale/Scope**: 9 touch-points across 6 files; 1 new Rust struct; 1 new TypeScript interface; 2–3 new test functions

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Domain-Driven Design | ✅ PASS | `FingeringAnnotation` is a first-class domain concept modelled on `Note`; ubiquitous language used throughout |
| II. Hexagonal Architecture | ✅ PASS | Parser adapter reads MusicXML → domain `Note` carries data → layout module computes geometry → WASM/JSON boundary is the port |
| III. PWA Architecture | ✅ PASS | All computation in Rust/WASM; frontend renderer is pure SVG consumer; offline-capable |
| IV. Precision & Fidelity | ✅ PASS | Fingering is a display annotation; no timing arithmetic involved |
| V. Test-First Development | ✅ PASS | Tests written before implementation (see Phase 1 contracts); parser test, layout output test, no-regression test all defined |
| VI. Layout Engine Authority | ✅ PASS | `FingeringGlyph` positions computed exclusively in Rust layout engine; frontend only draws pre-computed `(x, y, digit, above)` |
| VII. Regression Prevention | ✅ PASS | Zero-regression test (SC-003) ensures existing scores produce identical layout output |

**Gate result: ALL PASS — proceed to Phase 0.**

## Project Structure

### Documentation (this feature)

```text
specs/001-fingering-layout/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── fingering-glyph.rust.md    # Rust struct contracts
│   └── fingering-glyph.ts.md     # TypeScript interface contracts
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code Touch-Points

```text
backend/
├── src/
│   ├── domain/
│   │   ├── importers/musicxml/
│   │   │   ├── types.rs          # Add fingering fields to NoteData
│   │   │   ├── parser.rs         # Add parse_technical() + <fingering> handling
│   │   │   └── converter.rs      # Map NoteData.fingering → Note.fingering
│   │   └── events/
│   │       └── note.rs           # Add fingering: Vec<FingeringAnnotation> to Note
│   └── layout/
│       ├── types.rs              # Add FingeringGlyph struct + Staff.fingering_glyphs
│       ├── extraction.rs         # Add fingering to NoteEvent + JSON deserialization
│       ├── annotations.rs        # Add render_fingering_glyphs() + AnnotationResult field
│       └── mod.rs                # Wire fingering_glyphs into Staff construction
└── tests/
    └── fingering_layout_test.rs  # NEW: parser + layout integration tests

frontend/
└── src/
    ├── wasm/
    │   └── layout.ts             # Add FingeringGlyph interface + Staff.fingering_glyphs
    └── components/
        └── LayoutRenderer.tsx    # Render <text> elements for fingering_glyphs
```

**Structure Decision**: Monorepo Option 2 (backend + frontend). No new modules, crates, or packages created. All changes are additive extensions within existing files, following exact patterns established by `staccato` (boolean annotation) and `NotationDot` (positioned annotation type).
