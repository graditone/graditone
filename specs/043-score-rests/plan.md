# Implementation Plan: Rest Symbols in Scores

**Branch**: `043-score-rests` | **Date**: 2026-03-10 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/043-score-rests/spec.md`

## Summary

Render rest symbols on the score for all rest durations (whole through 64th) parsed from MusicXML. Currently `RestData` is parsed but immediately discarded after advancing timing — no glyph is produced. The approach adds a `RestEvent` domain entity, extends `Voice` to carry `rest_events`, propagates them through the JSON contract to the Rust/WASM layout engine, and generates `Glyph` outputs using the existing SMuFL font and spacer infrastructure.

## Technical Context

**Language/Version**: Rust 1.93 (edition 2024) + TypeScript 5.9  
**Primary Dependencies**: wasm-bindgen 0.2, serde 1.0, serde_json 1.0, React 19, Vite 7  
**Storage**: N/A (stateless rendering pipeline)  
**Testing**: `cargo test`, vitest (frontend), Playwright (E2E)  
**Target Platform**: Tablet PWA — Chrome 57+, Safari 11+, Edge 16+ (WASM in-browser)  
**Project Type**: Web (backend/ = Rust domain + WASM adapter, frontend/ = React PWA)  
**Performance Goals**: Scroll ≥30 fps on 10-staff, 100-measure rest-heavy score  
**Constraints**: Layout geometry computed exclusively in Rust/WASM (Principle VI); no coordinate calculations in TypeScript  
**Scale/Scope**: All 7 standard rest durations (whole, half, quarter, eighth, 16th, 32nd, 64th)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Domain-Driven Design | ✅ PASS | `RestEvent` is a first-class domain entity with ubiquitous language (start_tick, duration_ticks). |
| II. Hexagonal Architecture | ✅ PASS | Core domain (`RestEvent`, `Voice`) is framework-free. WASM binding is the adapter. |
| III. PWA Architecture | ✅ PASS | All rest positioning logic runs in Rust/WASM; frontend only renders returned `Glyph` structs. |
| IV. Precision & Fidelity | ✅ PASS | Rest tick positions use 960 PPQ integer arithmetic throughout. No float timing. |
| V. Test-First Development | ✅ PASS | Tests specified per layer (domain, converter, layout, contract) before implementation. |
| VI. Layout Engine Authority | ✅ PASS | Rest x/y coordinates computed exclusively in `positioner.rs`. TypeScript receives `Glyph` data only. |
| VII. Regression Prevention | ✅ PASS | Existing test suite must stay green (SC-005). Any discovered bugs → regression test first. |

**Gate result: PASS — proceed to Phase 0 research.**

*Post-design re-check*: Constitution Check re-evaluated after Phase 1 design artifacts — no violations introduced.

## Project Structure

### Documentation (this feature)

```text
specs/043-score-rests/
├── plan.md              ← This file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/           ← Phase 1 output
│   ├── score-dto-v5.md  ← JSON contract change (schema_version 4 → 5)
│   └── layout-rest-glyph.md ← Layout engine rest glyph output contract
└── tasks.md             ← Phase 2 output (/speckit.tasks command)
```

### Source Code Layout

```text
# Web application (Option 2: backend + frontend)
backend/
├── src/
│   ├── domain/
│   │   ├── events/
│   │   │   ├── note.rs           [EXISTING]
│   │   │   └── rest.rs           [NEW] RestEvent domain entity
│   │   ├── voice.rs              [MODIFY] add rest_events: Vec<RestEvent>
│   │   └── events/mod.rs         [MODIFY] pub mod rest
│   ├── domain/importers/musicxml/
│   │   ├── types.rs              [MODIFY] add note_type: Option<String> to RestData
│   │   ├── parser.rs             [MODIFY] copy note_type when creating RestData
│   │   └── converter.rs          [MODIFY] convert RestData → RestEvent, add to voice
│   ├── adapters/
│   │   └── dtos.rs               [MODIFY] SCORE_SCHEMA_VERSION 4 → 5
│   └── layout/
│       ├── mod.rs                [MODIFY] VoiceData + rests, extract_instruments, position loop
│       ├── positioner.rs         [MODIFY] add position_rests_for_staff(), rest glyph codepoints
│       └── spacer.rs             [MODIFY] include rest durations in compute_measure_widths
├── tests/                        [ADD] integration tests for rest glyphs in layout output
└── Cargo.toml                    [UNCHANGED]

frontend/
├── src/                          [NO CHANGES] — renders Glyph structs without modification
└── tests/                        [ADD] snapshot tests for each rest duration glyph
```

**Structure Decision**: Web application (Option 2). Changes are concentrated in `backend/src/` across four layers (domain model, XML importer, DTO adapter, layout engine). The frontend requires no changes — the renderer already handles any `Glyph` with a valid SMuFL codepoint.

## Complexity Tracking

No constitution violations. No new abstractions beyond the minimum needed (`RestEvent` entity, `position_rests_for_staff` function extending the existing `position_glyphs_for_staff` pattern).
