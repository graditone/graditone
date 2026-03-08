# Implementation Plan: Repeat Barlines (041)

**Branch**: `041-repeat-barlines` | **Date**: 2026-06-25 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/041-repeat-barlines/spec.md`

## Summary

Extend the full Musicore stack to parse, render, and play repeat barlines from MusicXML scores. The Rust backend gains a `RepeatBarline` domain entity and MusicXML parsing for `<barline><repeat.../>` elements. The Rust layout engine generates `RepeatStart`, `RepeatEnd`, and `RepeatBoth` barline types with dot geometry computed entirely in Rust (Principle VI). The TypeScript frontend gains a `RepeatNoteExpander` service that pre-expands the flat note array before `usePlayback`, producing exactly 39 sounded measures for Burgmuller La Candeur (the reference score with 23 raw measures and 3 repeat markers).

## Technical Context

**Language/Version**: Rust (edition 2024, stable toolchain), TypeScript 5, React 18
**Primary Dependencies**: quick-xml (MusicXML streaming parser), wasm-bindgen 0.2, serde-wasm-bindgen 0.6, serde 1.0, ToneJS (scheduling), Vitest (TS tests), cargo test (Rust tests)
**Storage**: N/A — repeat barlines serialized as part of existing score JSON (no new persistence layer)
**Testing**: `cargo test` (Rust unit + integration), `vitest` (TypeScript unit), Playwright (E2E)
**Target Platform**: Tablet PWA, Chrome 57+, Safari 11+
**Project Type**: Web (frontend/ + backend/ monorepo, wasm bridge)
**Performance Goals**: Layout computation <100 ms (WASM budget unchanged); playback scheduling unaffected (note expansion is O(n) pre-pass)
**Constraints**: All 7 Constitution Principles active; Principle VI is critical — repeat dot positions (x, y, radius) MUST be computed in Rust, never in TypeScript; integer 960 PPQ tick arithmetic for all timing (Principle IV)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Domain-Driven Design | ✅ PASS | `RepeatBarline` is a first-class domain entity in `backend/src/domain/repeat.rs`; ubiquitous language (`RepeatBarline`, `RepeatBarlineType`, `RepeatDotPosition`) used throughout all layers |
| II | Hexagonal Architecture | ✅ PASS | Repeat barlines live in the domain core; MusicXML importer is an inbound adapter; WASM + JSON serialisation is an outbound adapter; frontend is a consumer |
| III | PWA Architecture | ✅ PASS | No new network calls; repeat data computed entirely at import time and carried in the existing score JSON; WASM layout runs offline |
| IV | Precision & Fidelity | ✅ PASS | Repeat marker positions stored as `start_tick`/`end_tick` (u32, 960 PPQ); note expansion uses integer tick arithmetic; no floating-point timing |
| V | Test-First Development | ✅ PASS | All implementation tasks require unit tests written before implementation code (TDD): Rust domain/parser/layout tests, TypeScript `RepeatNoteExpander` tests, E2E La Candeur playback assertion |
| VI | Layout Engine Authority | ✅ PASS | Repeat dot positions (x, y, radius) are computed exclusively in `backend/src/layout/mod.rs` (`create_bar_lines`) and emitted as `RepeatDotPosition` values in the WASM output; TypeScript only reads and renders these values — no coordinate calculation in frontend |
| VII | Regression Prevention | ✅ PASS | SC-004 mandates zero regressions on existing scores; the implementation plan covers regression tests for all 5 fixture scores; any bug found during implementation must produce a failing test first |

**Post-design re-check**: ✅ PASS (Phase 1 design adds no new violations — dot geometry remains in Rust; note expansion is a pure TypeScript data-transform with no layout logic)

## Project Structure

### Documentation (this feature)

```text
specs/041-repeat-barlines/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── rust-domain-repeat-barline.md
│   ├── wasm-layout-barline-types.md
│   └── typescript-repeat-note-expander.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── domain/
│   │   ├── repeat.rs                           [NEW] RepeatBarline domain entity + RepeatBarlineType enum
│   │   ├── score.rs                            [MODIFY] Score += repeat_barlines: Vec<RepeatBarline>
│   │   └── importers/musicxml/
│   │       ├── types.rs                        [MODIFY] MeasureData += start_repeat: bool, end_repeat: bool
│   │       ├── parser.rs                       [MODIFY] parse <barline><repeat direction="forward|backward"/></barline>
│   │       └── converter.rs                    [MODIFY] build Score.repeat_barlines from parsed MeasureData flags
│   └── layout/
│       ├── types.rs                            [MODIFY] BarLineType += RepeatStart | RepeatEnd | RepeatBoth; BarLine += dots: Vec<RepeatDotPosition>
│       ├── breaker.rs                          [MODIFY] MeasureInfo += start_repeat: bool, end_repeat: bool
│       └── mod.rs                              [MODIFY] compute_layout reads repeat_barlines from JSON; create_bar_lines generates repeat types + dot geometry
└── tests/
    └── repeat_barlines_integration.rs          [NEW] import La Candeur → assert 3 repeat_barlines, assert 3 repeat barline types in layout

frontend/
├── src/
│   ├── types/
│   │   └── score.ts                            [MODIFY] Score += repeat_barlines?: RepeatBarline[]; add RepeatBarline + RepeatBarlineType types
│   ├── wasm/
│   │   └── layout.ts                           [MODIFY] BarLineType += 'RepeatStart' | 'RepeatEnd' | 'RepeatBoth'; BarLine += dots?: RepeatDot[]
│   ├── services/playback/
│   │   ├── RepeatNoteExpander.ts               [NEW] expandNotesWithRepeats(notes, repeatBarlines) -> Note[]
│   │   └── RepeatNoteExpander.test.ts          [NEW] unit tests: no repeats, single, start+end, La Candeur 39 measures
│   └── components/
│       ├── LayoutRenderer.tsx                  [MODIFY] render dots from barLine.dots
│       └── ScoreViewer.tsx                     [MODIFY] expand notes before usePlayback
└── plugins/
    └── score-player/
        └── scorePlayerContext.ts               [MODIFY] expand notes before usePlayback
```

**Structure Decision**: Web application (frontend/ + backend/ monorepo). No new top-level projects or packages; all changes are within existing source trees.

## Complexity Tracking

> No Constitution Check violations — no entries required.
