# Implementation Plan: Music Dynamics Score Display

**Branch**: `072-dynamics-score-display` | **Worktree**: `../worktrees/072-dynamics-score-display` | **Date**: 2026-04-04 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/072-dynamics-score-display/spec.md`

## Summary

Dynamics data (`DynamicMarking` and `GradualDynamic`) is already parsed from MusicXML and passed through the DTO pipeline to the frontend for audio playback. No data-model changes are needed. The gap is entirely in the layout engine (Rust/WASM) and the SVG renderer (TypeScript): the layout engine must compute `(x, y)` coordinates for every dynamic symbol and hairpin, and the renderer must draw them. Dynamic symbols are rendered as SMuFL glyphs using the existing Bravura font; hairpins are drawn as SVG line paths. The Bravura metadata file (`backend/assets/bravura_metadata.json`) must be extended with dynamic glyph bounding boxes.

## Technical Context

**Language/Version**: Rust (stable), TypeScript (strict)  
**Primary Dependencies**: wasm-bindgen, serde_json (Rust); React 18, SVG DOM (TypeScript)  
**Storage**: N/A — layout is computed on-demand from in-memory score data  
**Testing**: `cargo test` (Rust unit + integration), Vitest (TypeScript unit), Playwright (e2e)  
**Target Platform**: Tablet PWA (iPad, Surface, Android tablets); Chrome 57+, Safari 11+  
**Project Type**: Web (backend/ Rust WASM + frontend/ React PWA)  
**Performance Goals**: Layout computation ≤100ms for typical scores (constitution §III); rendering at 60fps  
**Constraints**: Layout engine is sole authority over all (x, y) coordinates (Principle VI). Frontend renderer MUST NOT calculate or derive spatial coordinates for dynamics. 1 staff space = 20 logical units. Font size 80pt = 4 staff spaces = 1em (SMuFL standard).  
**Scale/Scope**: Affects all scores that contain dynamics (majority). New fields added to `Staff` struct in `GlobalLayout` output — backward-compatible (optional array fields with `#[serde(default)]`).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Gate Assessment

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Domain-Driven Design** | ✅ PASS | `DynamicMarking` and `GradualDynamic` are existing domain entities. Feature adds layout representations, not new domain concepts. |
| **II. Hexagonal Architecture** | ✅ PASS | New `dynamics.rs` layout module is core domain; frontend renderer is the adapter. No framework dependencies introduced. |
| **III. PWA Architecture** | ✅ PASS | Dynamics layout computed in WASM (client-side); no network calls. Offline-capable by construction. |
| **IV. Precision & Fidelity** | ✅ PASS | Tick-based positions used for horizontal placement (960 PPQ). No floating-point timing introduced. |
| **V. Test-First Development** | ⚠️ REQUIRED | All new layout logic must be tested before implementation. Unit tests for `render_dynamics()` must be written first, then implementation. |
| **VI. Layout Engine Authority** | ✅ PASS | All (x, y) for dynamic symbols and hairpin endpoints are computed in the Rust layout engine. Frontend renderer receives pre-computed geometry and draws only. |
| **VII. Regression Prevention** | ✅ PASS | Existing scores without dynamics must not be affected. Integration test added to verify zero-dynamics scores unchanged. |

**Verdict**: GATE PASSES. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/072-dynamics-score-display/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── layout-output.md
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
# Backend (Rust WASM layout engine)
backend/
├── src/
│   └── layout/
│       ├── mod.rs                         # ADD: call render_dynamics() per staff in pipeline
│       ├── dynamics.rs                    # NEW: dynamic symbol and hairpin layout computation
│       ├── types.rs                       # ADD: DynamicGlyph, HairpinLayout structs + Staff fields
│       └── metrics.rs                     # UPDATE: extend bravura_metadata.json with dynamic glyph bboxes
├── assets/
│   └── bravura_metadata.json              # UPDATE: add dynamic glyph bounding box entries
└── tests/
    └── dynamics_layout_test.rs            # NEW: integration tests for dynamic layout

# Frontend (React PWA renderer)
frontend/
├── src/
│   ├── wasm/
│   │   └── layout.ts                      # ADD: DynamicGlyph, HairpinLayout interfaces + Staff fields
│   └── components/
│       └── renderer/
│           └── RenderingPipeline.ts       # ADD: renderDynamics() called from renderStaff()
└── src/
    └── components/
        └── renderer/
            └── RenderingPipeline.test.ts  # ADD: tests for dynamic symbol and hairpin rendering
```

## Constitution Check — Post-Design Re-evaluation

*Checked after Phase 1 design completion. All gates continue to pass.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Domain-Driven Design** | ✅ PASS | `DynamicGlyph` and `HairpinLayout` are layout types, not domain leakage. Domain entities unchanged. |
| **II. Hexagonal Architecture** | ✅ PASS | `dynamics.rs` has zero external dependencies. WASM binding is the adapter layer. |
| **III. PWA Architecture** | ✅ PASS | `bravura_metadata.json` embedded at compile time via `include_str!`. No network calls. |
| **IV. Precision & Fidelity** | ✅ PASS | Tick-based `note_positions` map used for x-positioning. No floating-point timing. |
| **V. Test-First Development** | ✅ PASS per design | Six backend contract tests and four frontend unit tests required before implementation. Defined in contracts/layout-output.md and quickstart.md. |
| **VI. Layout Engine Authority** | ✅ PASS | TypeScript contract document explicitly forbids coordinate derivation in renderer. All (x, y) from Rust. |
| **VII. Regression Prevention** | ✅ PASS | `#[serde(default, skip_serializing_if = "Vec::is_empty")]` ensures zero-dynamics scores are byte-identical before and after this feature. |

**Post-design verdict: PASSES.** No violations to justify in Complexity Tracking.
