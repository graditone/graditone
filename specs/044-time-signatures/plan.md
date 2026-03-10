# Implementation Plan: Time Signatures

**Branch**: `044-time-signatures` | **Date**: 2026-03-10 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/044-time-signatures/spec.md`

## Summary

All scores currently display with 4/4 measure boundaries due to two hardcoded assumptions: (1) the MusicXML converter discards the parsed time signature and re-inserts a default 4/4 event, and (2) the Rust layout engine hardcodes 3840 ticks (= 4 × 960 PPQ) as the ticks-per-measure constant. The fix is purely in the Rust backend — patch the converter to forward the parsed time signature, then replace the hardcoded 3840 in the layout engine with a formula-derived value. The frontend already correctly reads and forwards the time signature; no frontend changes are needed.

## Technical Context

**Language/Version**: Rust 1.93.0 (backend/WASM); TypeScript 5.9 / React 19 (frontend)  
**Primary Dependencies**: wasm-bindgen 0.2, serde-json 1.0, wasm-pack (WASM build); Vite 7 / Vitest 4 (frontend testing); Playwright 1.58 (E2E)  
**Storage**: N/A — WASM client-side processing, no persistence changes  
**Testing**: `cargo test` (Rust unit + integration), `vitest` (TypeScript unit), `playwright` (E2E)  
**Target Platform**: Tablet PWA — Rust logic compiled to WASM, executed client-side in browser  
**Project Type**: Web application — `backend/` (Rust domain + WASM) + `frontend/` (React PWA)  
**Performance Goals**: Layout computation < 100ms for typical scores (Constitution Principle III); no regression on existing scores  
**Constraints**: Integer arithmetic only — no floating-point timing (Constitution Principle IV); TypeScript MUST NOT calculate spatial geometry (Constitution Principle VI)  
**Scale/Scope**: All preloaded scores (Arabesque 2/4, Für Elise 3/4, Canon 4/4, Nocturne 6/8); all standard time signatures (2/4, 3/4, 4/4, 3/8, 6/8, 9/8, 12/8)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

[Gates determined based on constitution file]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Domain-Driven Design | ✅ PASS | `TimeSignatureEvent` is an existing domain entity; `ticks_per_measure` is domain logic in the Rust layout engine |
| II. Hexagonal Architecture | ✅ PASS | Data flow: MusicXML adapter (converter) → domain model (Score) → WASM adapter (layout engine). No leakage across layers |
| III. PWA / Client-Side | ✅ PASS | All changes are in WASM-compiled Rust; frontend is a passthrough |
| IV. Precision & Fidelity (960 PPQ, integer arithmetic) | ✅ PASS | Formula `(960 × 4 × numerator) / denominator` — all integer. Denominator is always a power of 2; 3840 divides cleanly |
| V. Test-First Development | ✅ PASS | Tests must be written before each implementation change (tracked in tasks) |
| VI. Layout Engine Authority | ✅ PASS | `ticks_per_measure` computed in Rust WASM, not TypeScript. Frontend already delegates fully to WASM |
| VII. Regression Prevention | ✅ PASS | Existing 4/4 unit tests stay; must add tests for 2/4 and compound before changing code |

**Gate result**: PASS — no violations. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/044-time-signatures/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── time-signature-layout-input.ts
└── tasks.md             # Phase 2 output (speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── domain/
│   │   ├── events/
│   │   │   └── time_signature.rs          # Existing — TimeSignatureEvent (no changes needed)
│   │   └── importers/musicxml/
│   │       ├── converter.rs               # CHANGE: forward parsed time sig instead of hardcoding 4/4
│   │       └── types.rs                   # Existing — TimeSignatureData {beats, beat_type} (no changes)
│   └── layout/
│       └── mod.rs                         # CHANGE: replace hardcoded 3840 with ticks_per_measure formula
└── tests/
    └── (integration tests — time sig import verification)

frontend/
└── src/
    └── components/layout/
        └── LayoutView.tsx                 # NOT CHANGED — already reads and forwards time signature correctly
```

**Structure Decision**: Web application (Option 2). Backend-only changes; frontend is a pass-through that already works correctly. All spatial calculations remain in the Rust/WASM layout engine (Principle VI).

