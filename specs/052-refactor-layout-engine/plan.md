# Implementation Plan: Refactor Layout Engine

**Branch**: `052-refactor-layout-engine` | **Date**: 2026-03-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/052-refactor-layout-engine/spec.md`

## Summary

Decompose the 5,012-line `backend/src/layout/mod.rs` into 6 focused sibling modules (`extraction.rs`, `note_layout.rs`, `barlines.rs`, `structural.rs`, `staff_groups.rs`, `assembly.rs`), move `LayoutConfig` into `types.rs`, slim `compute_layout` to delegating calls, distribute tests per-module, and update the layout README with a mermaid architecture diagram — all with zero regressions across the existing 160 tests.

## Technical Context

**Language/Version**: Rust 1.93.0 (stable)  
**Primary Dependencies**: `serde_json` (JSON parsing), `serde` (Serialize/Deserialize) — no new dependencies introduced  
**Storage**: N/A (pure computation module)  
**Testing**: `cargo test` — 160 tests passing at baseline (unit + integration)  
**Target Platform**: WebAssembly (via `wasm.rs` adapter) + Linux server binary; no platform changes  
**Project Type**: Monorepo — only `backend/src/layout/` is modified  
**Performance Goals**: Zero latency regression — pure structural refactoring, no logic changes  
**Constraints**: Zero-regression constraint (all 160 tests must pass); public API surface (`compute_layout`, `GlobalLayout`, all re-exported types) must not change; no new dependencies; Clippy clean  
**Scale/Scope**: Single module directory (`backend/src/layout/`), 5,012-line file reduced to ~600-line orchestrator + 6 new focused modules

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Evaluation | Status |
|-----------|-----------|--------|
| I. Domain-Driven Design | Refactoring preserves all domain entities (`NoteEvent`, `InstrumentData`, `StaffData`); no renaming or conceptual changes | ✅ PASS |
| II. Hexagonal Architecture | Layout engine remains the sole domain computation layer; `wasm.rs` adapter unchanged; no infrastructure coupling introduced | ✅ PASS |
| III. Progressive Web Application Architecture | WASM binding layer (`wasm.rs`) untouched; public API surface unchanged; no frontend changes | ✅ PASS |
| IV. Precision & Fidelity | No arithmetic changes; all 960 PPQ integer calculations preserved verbatim | ✅ PASS |
| V. Test-First Development | All 160 existing tests must pass before and after; per-module tests are distributed (not removed) | ✅ PASS |
| VI. Layout Engine Authority | Refactoring strengthens the Rust layout engine; no TypeScript layout logic introduced; single source of truth maintained | ✅ PASS |
| VII. Regression Prevention | Baseline of 160 passing tests documented; any regressions during refactoring require a failing test before fix | ✅ PASS |

**Gate Result**: ✅ All principles pass. No violations. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/052-refactor-layout-engine/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
backend/src/layout/
├── mod.rs               # MODIFIED: orchestrator only (~600 lines, down from 5,012)
├── types.rs             # MODIFIED: add LayoutConfig (moved from mod.rs)
├── extraction.rs        # NEW: data extraction + internal types (~750 lines)
├── note_layout.rs       # NEW: note/chord/beam positioning (~900 lines)
├── barlines.rs          # NEW: barlines, segments, repeat dots (~350 lines)
├── structural.rs        # NEW: clef/key/time-sig glyphs (~300 lines)
├── staff_groups.rs      # NEW: multi-staff spacing, collision, brackets (~200 lines)
├── assembly.rs          # NEW: staff lines, bounding box, system assembly (~150 lines)
├── annotations.rs       # NEW: ties, slurs, dots, ledger lines (~400 lines)
├── README.md            # MODIFIED: updated architecture + mermaid diagram
├── batcher.rs           # UNCHANGED
├── beams.rs             # UNCHANGED
├── breaker.rs           # UNCHANGED
├── metrics.rs           # UNCHANGED
├── positioner.rs        # UNCHANGED
├── spacer.rs            # UNCHANGED
├── stems.rs             # UNCHANGED
├── wasm.rs              # UNCHANGED
```

**Structure Decision**: Single project (backend Rust crate). Only `backend/src/layout/` is touched. The 5,012-line `mod.rs` is decomposed into 7 new focused sibling files; 8 existing files are left untouched.

## Complexity Tracking

> No constitution violations to justify.

## Constitution Check — Post-Design Re-Evaluation

*Re-check after Phase 1 design, per workflow requirement.*

| Principle | Post-Design Evaluation | Status |
|-----------|----------------------|--------|
| I. Domain-Driven Design | Data model confirms all domain entities (`NoteEvent`, `InstrumentData`, etc.) move verbatim to `extraction.rs` with no renaming. Ubiquitous language unchanged. | PASS |
| II. Hexagonal Architecture | New modules are all within the layout domain layer. `wasm.rs` remains the only adapter. Module DAG confirmed acyclic — no new coupling to infrastructure. | PASS |
| III. Progressive Web Application Architecture | Public WASM API (`compute_layout -> GlobalLayout`) confirmed unchanged. Frontend/WASM contract stable. | PASS |
| IV. Precision & Fidelity | Tick helper functions (`measure_start_tick`, etc.) move verbatim to `extraction.rs`. No arithmetic changes. Integer PPQ integrity maintained. | PASS |
| V. Test-First Development | 26 test functions distributed to 5 modules per research decision. `cargo test` baseline of 160 tests passes. All tests preserved and relocatable. | PASS |
| VI. Layout Engine Authority | Design strengthens the Rust layout engine's internal structure. No TypeScript layout logic candidates introduced. WASM boundary unchanged. | PASS |
| VII. Regression Prevention | Incremental-per-module extraction strategy requires `cargo test` after every step. Any failure triggers test-first diagnosis before proceeding. | PASS |

**Post-Design Gate**: All principles pass. No new violations introduced by the Phase 1 design. Approved to proceed to `/speckit.tasks`.

## Artifacts Produced

| Artifact | Status | Path |
|----------|--------|------|
| `research.md` | Complete | `specs/052-refactor-layout-engine/research.md` |
| `data-model.md` | Complete | `specs/052-refactor-layout-engine/data-model.md` |
| `contracts/module-contracts.md` | Complete | `specs/052-refactor-layout-engine/contracts/module-contracts.md` |
| `quickstart.md` | Complete | `specs/052-refactor-layout-engine/quickstart.md` |
| Agent context | Updated | `.github/agents/copilot-instructions.md` |

**Next step**: Run `/speckit.tasks` to generate the actionable task list.
