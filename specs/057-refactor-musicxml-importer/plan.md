# Implementation Plan: Refactor MusicXML Importer

**Branch**: `057-refactor-musicxml-importer` | **Date**: 2025-03-25 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/057-refactor-musicxml-importer/spec.md`

## Summary

Decompose two oversized Rust modules in the MusicXML importer — `parser.rs` (~1,100 lines) and `converter.rs` (~1,300 lines) — into focused sub-modules with single responsibilities, while maintaining 100% behavioral parity verified by 70+ existing integration tests. No new features; purely structural refactor targeting ≤400 lines per file and improved unit-test isolation.

## Technical Context

**Language/Version**: Rust (latest stable), Cargo workspace  
**Primary Dependencies**: quick-xml (streaming XML parser), zip (MXL decompression), wasm-bindgen (WASM interop)  
**Storage**: N/A (stateless import pipeline — file in, domain Score out)  
**Testing**: `cargo test` — 70+ integration tests in `backend/tests/musicxml_import_test.rs`, 8 unit tests in `timing.rs`  
**Target Platform**: Native (CLI, REST API) + WASM (browser import via wasm-pack)  
**Project Type**: Web (monorepo: `backend/` Rust + `frontend/` React)  
**Performance Goals**: Import within 100ms for typical scores (Constitution: WASM Operations constraint)  
**Constraints**: ≤5% performance degradation post-refactor; zero behavioral regressions; public trait interface unchanged  
**Scale/Scope**: ~4,000 lines of domain code across 8 files in `backend/src/domain/importers/musicxml/`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Assessment |
|-----------|--------|------------|
| **I. Domain-Driven Design** | ✅ PASS | Refactor preserves ubiquitous language (NoteData, MeasureData, ImportContext). Sub-module names will use music domain terminology. No new abstractions violate bounded contexts. |
| **II. Hexagonal Architecture** | ✅ PASS | Public port (`IMusicXMLImporter` trait) unchanged. Internal decomposition stays within the domain layer. No new adapter dependencies introduced. Dependency rule preserved (core domain has zero external deps). |
| **III. Progressive Web Application** | ✅ PASS | No changes to WASM bindings or PWA infrastructure. The importer's WASM-compatible path (`import_content`) is unaffected by internal restructuring. |
| **IV. Precision & Fidelity** | ✅ PASS | 960 PPQ resolution and integer arithmetic in `timing.rs` unchanged. Lossless fraction-based timing calculations preserved. No floating-point timing introduced. |
| **V. Test-First Development** | ✅ PASS | All 70+ existing integration tests serve as regression safety net. New unit tests will be added for extracted sub-modules (voice distribution, timing, parsing). |
| **VI. Layout Engine Authority** | ✅ PASS | N/A — refactor is entirely within the import pipeline, no layout engine code involved. |
| **VII. Regression Prevention** | ✅ PASS | Integration test suite provides comprehensive regression coverage. Any issues discovered during refactoring will follow the test-first bug fix workflow (document → failing test → fix → verify). |

**Gate Result**: ✅ ALL PRINCIPLES PASS — No violations. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/057-refactor-musicxml-importer/
├── spec.md              # Feature specification
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── domain/
│   │   └── importers/
│   │       └── musicxml/
│   │           ├── mod.rs              # Module orchestrator, ImportContext, MusicXMLImporter service (~350 lines)
│   │           ├── types.rs            # Intermediate data structures (~400 lines)
│   │           ├── errors.rs           # Error types, warnings, severity (~150 lines)
│   │           ├── compression.rs      # .mxl ZIP extraction (~150 lines)
│   │           ├── mapper.rs           # MusicXML value → domain enum mapping (~150 lines)
│   │           ├── timing.rs           # Lossless fraction-based PPQ conversion (~200 lines)
│   │           ├── parser.rs           # Parser orchestrator + re-exports (~1,100 lines → REFACTOR TARGET)
│   │           └── converter.rs        # Converter orchestrator + re-exports (~1,300 lines → REFACTOR TARGET)
│   ├── ports/
│   │   └── importers.rs               # IMusicXMLImporter trait (~80 lines, UNCHANGED)
│   ├── adapters/
│   │   └── api/
│   │       └── import.rs              # REST API endpoint (~250 lines, UNCHANGED)
│   └── bin/
│       └── musicore-import.rs          # CLI binary (~150 lines, UNCHANGED)
└── tests/
    ├── musicxml_import_test.rs         # 70+ integration tests (~800 lines, UNCHANGED)
    └── test_tempo_from_musicxml.rs     # Tempo tests (~150 lines, UNCHANGED)
```

**Structure Decision**: Web application (backend Rust + frontend React monorepo). This refactor only touches `backend/src/domain/importers/musicxml/`. All other directories are unchanged. The parser and converter files will be decomposed into sub-modules within the existing directory.

## Complexity Tracking

No Constitution violations detected. This section is intentionally empty.

## Post-Design Constitution Re-Check

*Re-evaluated after Phase 1 design completion.*

| Principle | Status | Post-Design Notes |
|-----------|--------|-------------------|
| **I. DDD** | ✅ PASS | Sub-module names use domain terminology: note, measure, staff, voice, ties, structure |
| **II. Hexagonal** | ✅ PASS | All changes within domain layer; ports/adapters/bin unchanged |
| **III. PWA** | ✅ PASS | No WASM or frontend changes |
| **IV. Precision** | ✅ PASS | TimingContext relocated but functionally identical; no new floating-point math |
| **V. Test-First** | ✅ PASS | 70+ integration tests as safety net; new unit tests planned for extracted components |
| **VI. Layout Engine** | ✅ PASS | N/A — import pipeline only |
| **VII. Regression Prevention** | ✅ PASS | Any bugs discovered during refactoring will follow test-first fix protocol |

**Post-Design Gate Result**: ✅ ALL PRINCIPLES PASS — Ready for task generation.
