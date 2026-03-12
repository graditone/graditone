# Implementation Plan: Volta Bracket Playback (Repeat Endings)

**Branch**: `047-repeat-volta-playback` | **Date**: 2026-03-12 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/047-repeat-volta-playback/spec.md`

## Summary

Add volta bracket (first/second ending) support, building on Feature 041 (Repeat Barlines). The system must: (1) parse `<ending>` elements from MusicXML into a new `VoltaBracket` domain entity, (2) skip first-ending measures on the second pass through a repeated section in the playback note expander, and (3) render volta bracket lines and labels via the Rust/WASM layout engine. Three repository scores (La Candeur, Arabesque, Für Elise) serve as acceptance fixtures.

## Technical Context

**Language/Version**: Rust 2024 edition (backend/WASM), TypeScript strict (frontend)  
**Primary Dependencies**: quick-xml 0.31 (MusicXML parsing), serde 1.0 with `default` feature (JSON serialization/deserialization), wasm-bindgen 0.2 (WASM bindings), Tone.js (frontend audio scheduling), Vitest (frontend unit tests)  
**Storage**: `volta_brackets` field added to the `Score` JSON serialized via existing IndexedDB/LocalStorage persistence layer; missing field defaults to `[]` via serde `default`  
**Testing**: `cargo test` (Rust integration + unit tests), `vitest` (TypeScript unit tests)  
**Target Platform**: WASM/PWA (tablet devices); layout engine runs in-browser via wasm-pack  
**Project Type**: Web (monorepo: `backend/` Rust + `frontend/` React TypeScript)  
**Performance Goals**: Sub-16ms UI feedback (60 fps); all tick arithmetic integer-only (960 PPQ, Constitution IV)  
**Constraints**: Layout computation exclusively in Rust/WASM (Constitution VI — no TypeScript coordinate calculations); serde `default` ensures zero-cost backward compatibility for pre-feature scores; no floating-point timing

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Domain-Driven Design | ✅ PASS | `VoltaBracket` is a first-class music domain entity in `domain/repeat.rs`. Uses ubiquitous language (volta, ending, first ending, second ending). |
| II. Hexagonal Architecture | ✅ PASS | Domain change (`VoltaBracket` struct on `Score`) plumbed inward through ports (`IMusicXMLImporter` result) and outward through adapters (DTOs, WASM bindings). No framework leakage into domain. |
| III. PWA Architecture | ✅ PASS | Entirely WASM pipeline. `VoltaBracket` data in score JSON; playback expander runs in-browser TS; layout computed in Rust → WASM. Offline-first maintained. |
| IV. Precision & Fidelity | ✅ PASS | All tick values integer (u32). `VoltaBracket` stores `start_tick`/`end_tick` matching `RepeatBarline` pattern. No float arithmetic introduced. |
| V. Test-First Development | ✅ PASS | Tests written before implementation: Rust integration test for `<ending>` parsing; Vitest unit test for `RepeatNoteExpander` volta skip logic; layout test for bracket output. |
| VI. Layout Engine Authority | ✅ PASS | Volta bracket geometry (x_start, x_end, y, label, closed_right) computed exclusively in Rust layout engine. Frontend receives positioned `VoltaBracketLayout` objects and renders them without coordinate calculations. |
| VII. Regression Prevention | ✅ PASS | Spec has Known Issues section. Any bugs discovered during implementation create a failing test before the fix. |

**Gate decision: PASS — proceed to Phase 0.**

**Post-design re-check (Phase 1 complete): PASS — no new violations.**

All layout coordinates (`x_start`, `x_end`, `y`, `closed_right`) produced exclusively by Rust layout engine and passed as data to the renderer (Principle VI). Domain entity `VoltaBracket` uses ubiquitous language (Principle I). Serde `#[serde(default)]` on `volta_brackets` provides cost-free backward compat with no migration (Principle II port boundary respected). Integer tick fields throughout (Principle IV).

## Project Structure

### Documentation (this feature)

```text
specs/047-repeat-volta-playback/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── volta_bracket.ts
└── tasks.md             # Phase 2 output (/speckit.tasks — not created here)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── domain/
│   │   └── repeat.rs            # ADD: VoltaBracket struct, VoltaEndType enum
│   ├── domain/score.rs          # ADD: volta_brackets field on Score
│   ├── domain/importers/musicxml/
│   │   ├── parser.rs            # MODIFY: parse <ending> elements in parse_barline_content
│   │   ├── types.rs             # ADD: RawEndingInfo intermediate type
│   │   └── mapper.rs            # MODIFY: build VoltaBracket from parsed ending data
│   ├── adapters/
│   │   └── dtos.rs              # MODIFY: add volta_brackets to ScoreDto (schema v7)
│   └── layout/
│       ├── types.rs             # ADD: VoltaBracketLayout struct, add to System
│       └── mod.rs               # MODIFY: parse volta_brackets, compute layout elements
└── tests/
    └── volta_brackets_integration.rs  # NEW: parsing + layout integration tests

frontend/
├── src/
│   ├── types/
│   │   └── score.ts             # ADD: VoltaBracket interface, volta_brackets on Score
│   ├── wasm/
│   │   └── layout.ts            # ADD: VoltaBracketLayout interface, add to System
│   ├── services/playback/
│   │   ├── RepeatNoteExpander.ts          # MODIFY: skip first-ending notes on second pass
│   │   └── RepeatNoteExpander.test.ts     # NEW: unit tests for volta skip logic
│   └── components/notation/
│       └── NotationRenderer.tsx  # MODIFY: render VoltaBracketLayout elements
```

**Structure Decision**: Web (Option 2). The monorepo separates Rust backend/WASM from React frontend. No new top-level directories needed; changes are additive to existing modules.

## Complexity Tracking

No constitution violations. No additional justification needed.
