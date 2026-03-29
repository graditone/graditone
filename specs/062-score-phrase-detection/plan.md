# Implementation Plan: Score Phrase Detection

**Branch**: `062-score-phrase-detection` | **Date**: 2026-03-29 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/062-score-phrase-detection/spec.md`

## Summary

Detect musical phrases in scores during MusicXML import using a heuristic algorithm based on slur chains (primary signal), structural markers (hard boundaries), rest patterns, and regular grouping fallback. Phrases are stored in the Score data model as `PhraseRegion` structs and served to the frontend. The frontend renders phrase visualization as semi-transparent alternating color bands when the user toggles a "Phrases" button in the toolbar. Selected phrases set the active loop region usable in both play and practice views.

## Technical Context

**Language/Version**: Rust (latest stable) for backend phrase detection; TypeScript + React 18 for frontend visualization  
**Primary Dependencies**: serde (serialization), wasm-bindgen (WASM bindings), React (frontend UI)  
**Storage**: Phrases are computed during import and stored in-memory in the Score struct. Cached in IndexedDB along with the score via existing schema versioning (v10 → v11).  
**Testing**: `cargo test` for Rust backend; `vitest` + `@testing-library/react` for frontend  
**Target Platform**: Tablet devices (iPad/Surface/Android), browser via PWA + WASM  
**Project Type**: Web (Rust backend via WASM + React frontend)  
**Performance Goals**: Phrase detection < 100ms during import (WASM operations constraint). Phrase visualization toggle < 16ms (60fps target).  
**Constraints**: 960 PPQ integer arithmetic for all tick calculations. Phrases aligned to measure boundaries. Backend is sole source of phrase computation (Constitution VI — Layout Engine Authority).  
**Scale/Scope**: Support scores with 10,000+ events. 7 preloaded classical scores as validation targets.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Domain-Driven Design | ✅ PASS | `PhraseRegion` is a first-class domain entity using ubiquitous language (phrase, boundary, measure index). Phrases are modeled in the Score aggregate root. |
| II. Hexagonal Architecture | ✅ PASS | Phrase detection logic lives in domain layer (`backend/src/domain/`). WASM binding is an adapter. Frontend is a pure consumer. |
| III. PWA Architecture | ✅ PASS | Phrase data computed via WASM in-browser. No network dependency. Cached in IndexedDB via schema versioning. Offline-capable. |
| IV. Precision & Fidelity | ✅ PASS | All tick values use 960 PPQ integer arithmetic. Phrase boundaries aligned to measure boundaries via `measure_end_ticks`. |
| V. Test-First Development | ✅ PASS | Tests planned for: phrase detection algorithm (Rust unit), WASM integration (fixture-based), frontend visualization (vitest+RTL). |
| VI. Layout Engine Authority | ✅ PASS | Phrase regions are measure-index-based data, not spatial geometry. The frontend only maps phrase data to color bands using existing measure positions from the layout engine. No spatial calculations in frontend. |
| VII. Regression Prevention | ✅ PASS | Will document any errors discovered during implementation in spec.md Known Issues section with regression tests. |

**Gate result: ALL PASS — proceed to Phase 0.**

## Project Structure

### Documentation (this feature)

```text
specs/062-score-phrase-detection/
├── spec.md              # Feature specification (completed)
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── wasm-contract.md # WASM binding contract + serialization
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── domain/
│   │   ├── score.rs                          # Add PhraseRegion struct + phrases field to Score
│   │   ├── phrases.rs                          # NEW: PhraseRegion struct + detect_phrases() + sub-functions
│   │   └── importers/musicxml/converter/
│   │       └── mod.rs                         # Call detect_phrases() after score construction
│   ├── adapters/
│   │   ├── dtos.rs                            # Add phrases to ScoreDto, bump schema v11
│   │   └── wasm/bindings.rs                   # Call detect_phrases() in parse_musicxml()
│   └── lib.rs                                 # Register phrase module
├── tests/
│   └── phrase_detection_test.rs               # NEW: Phrase detection integration tests

frontend/
├── src/
│   ├── types/score.ts                         # Add PhraseRegion interface + phrases field
│   ├── components/
│   │   ├── ScoreViewer.tsx                    # Add Phrases toggle button to toolbar
│   │   └── PhraseOverlay.tsx                  # NEW: Phrase color band visualization component
│   └── hooks/
│       └── usePhraseState.ts                  # NEW: Phrase toggle/selection/navigation state
├── tests/
│   ├── unit/
│   │   └── PhraseOverlay.test.tsx             # NEW: Phrase visualization unit tests
│   └── components/
│       └── ScoreViewer.phrases.test.tsx        # NEW: Phrase toolbar integration tests
```

**Structure Decision**: Web application (Rust backend + React frontend existing monorepo). Phrase detection logic is a new domain module in the Rust backend. Frontend adds visualization as a component within the existing ScoreViewer, not as a plugin — phrase visualization is a core score viewer capability, not an optional plugin.

## Complexity Tracking

> No constitution violations. No complexity justifications needed.

---

## Constitution Re-Check (Post-Design)

*After Phase 0 research and Phase 1 design completion.*

| Principle | Status | Post-Design Notes |
|-----------|--------|-------------------|
| I. Domain-Driven Design | ✅ PASS | `PhraseRegion` struct uses ubiquitous language. `detect_phrases()` is a domain service operating on the Score aggregate. Research confirmed algorithm aligns with music theory (slur-based phrasing). |
| II. Hexagonal Architecture | ✅ PASS | Detection logic in `domain/phrases.rs` (core). WASM bindings call it as an adapter. Frontend consumes via `ScoreDto` serialized through `serde-wasm-bindgen`. No new ports needed — phrase data flows through existing Score → ScoreDto serialization path. |
| III. PWA Architecture | ✅ PASS | All computation in WASM, no network calls. Phrases cached in IndexedDB via schema version bump (v10 → v11). Offline-capable by design. |
| IV. Precision & Fidelity | ✅ PASS | `start_tick` and `end_tick` derived from `measure_end_ticks` (integer u32). No floating-point in phrase boundaries. All tick arithmetic uses 960 PPQ integers. |
| V. Test-First Development | ✅ PASS | Data model defines clear testable contracts. Quickstart documents test commands. Integration tests planned with preloaded fixture scores (Burgmuller, Bach, etc.). |
| VI. Layout Engine Authority | ✅ PASS | **Key design decision**: Phrase color bands are rendered as visual overlays using the layout engine's existing spatial data (System bounding boxes and tick ranges). The frontend maps phrase tick ranges to screen coordinates using the layout engine's geometry — it does NOT compute its own spatial layout. This is analogous to how CSS background colors or selection highlights work: the layout engine provides geometry, the frontend applies visual styling. No TypeScript spatial calculations are created. |
| VII. Regression Prevention | ✅ PASS | Test fixtures will include scores with known phrase structures. Any errors found during implementation will get regression tests before fixes. |

**Post-design gate result: ALL PASS.**

---

## Generated Artifacts

### Phase 0
- [research.md](research.md) — 8 research tasks resolved (slur chains, pipeline insertion, phrase boundaries, slur walking, structural boundaries, rest boundaries, color band rendering, fallback grouping)

### Phase 1
- [data-model.md](data-model.md) — PhraseRegion entity (Rust + TypeScript), Score modifications, schema version bump, module structure
- [contracts/wasm-contract.md](contracts/wasm-contract.md) — WASM binding contract, serialization flow, schema versioning, backward compatibility, plugin integration
- [quickstart.md](quickstart.md) — Development setup, build/test commands, key files to edit, validation steps

### Phase 2 (next)
- Run `/speckit.tasks` to generate `tasks.md` with implementation tasks
