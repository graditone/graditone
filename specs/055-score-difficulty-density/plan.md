# Implementation Plan: Score Difficulty Rate for Note Density

**Branch**: `055-score-difficulty-density` | **Date**: 2026-03-25 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/055-score-difficulty-density/spec.md`

## Summary

When a score is imported or loaded for the first time, compute a combined difficulty rating based on note density and polyphony, then persist it as part of the score's stored metadata. For each bar, compute `bar_density = pitches_in_bar / bar_duration_beats` (each chord pitch counted individually; per-staff maximum — hardest single hand; rests, tied continuations, and grace notes excluded; tempo-independent using beats = ticks/PPQ). Also compute bar polyphony by sampling the number of simultaneously sounding notes at each note onset tick (per-staff maximum). Aggregate per instrument as `note_density = 0.7 × avg(bar_density) + 0.3 × peak(bar_density)` and `polyphony = 0.7 × avg_polyphony + 0.3 × max_polyphony`. Combine as `final_score = 0.6 × note_density + 0.4 × polyphony`, then take the maximum across all instruments. Map to Easy (< 2.5), Medium (2.5–3.5), or Hard (> 3.5). Persist the rating in the existing `ScoreDto` / IndexedDB cache (schema bump required). Display the tag in the load score dialog alongside each score entry. Rating is cached — recomputed only on re-import or content change.

## Technical Context

**Language/Version**: Rust (stable) — backend computation; TypeScript — frontend display  
**Primary Dependencies**: wasm-bindgen (WASM/JS interop); React 18 + Vitest (frontend); Cargo (Rust testing)  
**Storage**: IndexedDB (`graditone-db`, `scores` store) via `ScoreCache`; `UserScore` index in `localStorage`  
**Testing**: Vitest (frontend unit/integration); `cargo test` (Rust domain unit); Playwright (E2E)  
**Target Platform**: Tablet PWA (Chrome/Safari/Edge); computation runs in WASM in-browser  
**Project Type**: Monorepo — `backend/` (Rust domain + WASM bindings) + `frontend/` (React PWA)  
**Performance Goals**: Difficulty computation MUST complete synchronously within the existing WASM parse call (<100ms total for score parse + density); no additional async round-trips  
**Constraints**: IndexedDB schema version bump required (v9 → v10); stale-schema re-parse path must remain intact; offline-compatible (no network needed for computation)  
**Scale/Scope**: Applied to all scores (preloaded catalog + user-uploaded); typical piano score has 100–1000 bars

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Domain-Driven Design | ✅ PASS | `DifficultyRating` is a named domain concept computed from `Score`; ubiquitous language preserved (bar density, note onset, difficulty level) |
| II. Hexagonal Architecture | ✅ PASS | Computation lives in `backend/src/domain/`; exposed via WASM adapter port; frontend consumes result — no domain logic in frontend |
| III. PWA Architecture | ✅ PASS | Computation is client-side WASM, offline-capable; stored in existing IndexedDB infrastructure |
| IV. Precision & Fidelity | ✅ PASS | Bar duration uses existing tick-based measure boundaries (`measure_end_ticks`); no floating-point timing in pulse arithmetic; duration in seconds computed once from BPM |
| V. Test-First Development | ✅ PASS | Density formula is pure arithmetic — unit-testable in Rust; TypeScript display logic testable with Vitest; TDD approach required |
| VI. Layout Engine Authority | ✅ PASS | This feature has no spatial/layout concerns; no coordinate calculation in frontend |
| VII. Regression Prevention | ✅ PASS | Any bugs found during implementation must produce a failing test before fixing |

**Gate Result: PASS — no violations. Proceed to Phase 0.**

## Constitution Check (Post-Design Re-evaluation)

*Re-evaluated after Phase 1 design artifacts.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Domain-Driven Design | ✅ PASS | `DifficultyLevel`, `DifficultyRating`, `BarDensity` are named domain concepts in `backend/src/domain/difficulty/`; ubiquitous language preserved throughout data model and contracts |
| II. Hexagonal Architecture | ✅ PASS | All computation in `domain/difficulty/`; WASM binding is the adapter layer; `DifficultyTag` in frontend is a pure renderer with no domain logic |
| III. PWA Architecture | ✅ PASS | Computation embedded in the existing `parse_musicxml` WASM call; result persisted in IndexedDB via existing `ScoreCache`; fully offline |
| IV. Precision & Fidelity | ✅ PASS | Tick arithmetic remains integer (`u32`); only the conversion to seconds and density uses `f64`, which is appropriate for non-musical-timing floating-point only at the end of the pipeline |
| V. Test-First Development | ✅ PASS | Quickstart defines tests before implementation for every step (Rust unit tests, Vitest unit tests, E2E); density formula is fully unit-testable |
| VI. Layout Engine Authority | ✅ PASS | No spatial concerns in this feature; `DifficultyTag` renders text only |
| VII. Regression Prevention | ✅ PASS | Any bugs found in implementation must yield a failing test before fixing; test infrastructure confirmed (Vitest + cargo test) |

**Post-design gate result: PASS — design is consistent with all constitution principles.**

## Project Structure

### Documentation (this feature)

```text
specs/055-score-difficulty-density/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── domain/
│   │   ├── score.rs                          # Score struct — add DifficultyRating field
│   │   ├── difficulty/                       # NEW module
│   │   │   ├── mod.rs                        # pub use, module root
│   │   │   ├── density.rs                    # Bar/score density + polyphony computation
│   │   │   └── level.rs                      # Combined score → DifficultyLevel mapping
│   │   └── mod.rs                            # Export difficulty module
│   └── adapters/
│       └── dtos.rs                           # ScoreDto — add difficulty_rating field (schema v10)
└── tests/
    └── difficulty_test.rs                    # Rust unit tests for density + level mapping

frontend/
├── src/
│   ├── types/
│   │   └── score.ts                          # Score interface — add difficulty_rating?: DifficultyRating
│   ├── services/
│   │   └── difficulty/                       # NEW: TypeScript wrapper if needed
│   │       └── difficultyLabel.ts            # DifficultyLevel → "Easy"/"Medium"/"Hard" label
│   └── components/
│       └── load-score/
│           ├── LoadScoreDialog.tsx           # Pass difficulty_rating through to list items
│           ├── PreloadedScoreList.tsx        # Display DifficultyTag per score
│           ├── UserScoreList.tsx             # Display DifficultyTag per score
│           └── DifficultyTag.tsx             # NEW: Easy/Medium/Hard badge component
└── tests/
    └── unit/
        └── difficulty.test.ts                # Vitest unit tests for label mapping + tag rendering
```

**Structure Decision**: Monorepo (Option 2 — web application). Computation in `backend/src/domain/difficulty/`; WASM binding added to `backend/src/adapters/wasm/bindings.rs` if a standalone endpoint is needed, or difficulty is computed inside the existing `parse_musicxml` pipeline and returned as part of `ScoreDto`. Frontend display via new `DifficultyTag` component consumed by existing load score list components.

## Complexity Tracking

No constitution violations — no justification required.
