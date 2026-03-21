# Implementation Plan: Final Preloaded Scores Layout Checks

**Branch**: `001-preloaded-scores-checks` | **Date**: 2026-03-21 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-preloaded-scores-checks/spec.md`

## Summary

A final acceptance-gate review of all 6 preloaded scores to confirm that every layout fix from the `050-fix-layout-preloaded-scores` cycle and the in-progress Nocturne M29–M37 fixes (`001-fix-nocturne-layout`) are correctly in place, all regression tests pass, and the musician provides explicit sign-off per score. No new features are introduced — this phase is pure verification, targeted remediation, and sign-off documentation.

## Technical Context

**Language/Version**: Rust (latest stable) + TypeScript 5.x, React 18  
**Primary Dependencies**: wasm-pack, cargo test, vitest, playwright  
**Storage**: N/A (no persistence changes; approval records are markdown files in `specs/`)  
**Testing**: `cargo test` (Rust layout/regression), `vitest` (frontend units), `playwright` (e2e visual)  
**Target Platform**: Tablet devices (iPad/Surface/Android) — PWA, Chrome 57+, Safari 11+  
**Project Type**: Web application (Rust/WASM backend + React frontend monorepo)  
**Performance Goals**: Score render deterministic; 60fps interaction; no performance regression  
**Constraints**: Read-only pass for previously approved scores; any new fix must not regress others  
**Scale/Scope**: 6 preloaded scores; ~30 regression tests already in suite

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Domain-Driven Design | PASS | No new domain entities; review artifacts use existing music domain vocabulary |
| II. Hexagonal Architecture | PASS | No architecture changes; layout engine remains Rust/WASM; renderer remains TypeScript |
| III. PWA Architecture | PASS | No PWA changes; scoring, service worker, and offline behavior untouched |
| IV. Precision & Fidelity | PASS | No timing changes; 960 PPQ resolution unchanged |
| V. Test-First Development | **GATE** | Any issue found during final review MUST have a failing test written first before the fix is applied (FR-004) |
| VI. Layout Engine Authority | **GATE** | Any remediation fix MUST keep spatial geometry in Rust/WASM; no coordinate calculations may be added to TypeScript renderer |
| VII. Regression Prevention | **GATE** | Every discovered issue = test first → fix → verify; regression test suite must pass before musician review begins |

**Pre-Phase-0 verdict**: PASS — no violations. All three GATE principles simply require discipline during execution, not design changes.

**Post-Phase-1 constitution re-check**: Confirmed PASS. This feature introduces no new code structures — only verification, targeted fixes (with tests), and approval documentation.

## Project Structure

### Documentation (this feature)

```text
specs/001-preloaded-scores-checks/
├── plan.md              # This file
├── research.md          # Phase 0 output — test suite inventory, open issues, fix scope
├── data-model.md        # Phase 1 output — approval record schema
├── quickstart.md        # Phase 1 output — how to run the final review session
├── contracts/           # Phase 1 output — review protocol contract
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── domain/importers/musicxml/    # Nocturne M29-M37 fixes (converter, parser, types)
│   ├── layout/                       # Layout engine (annotations, extraction, positioner)
│   └── ...
└── tests/
    ├── cross_score_consistency_test.rs   # Key: all-6-scores consistency
    ├── slur_direction_test.rs            # Slur fix (Für Elise M52)
    ├── chord_dots_test.rs                # Dot de-collision (Für Elise M63)
    ├── grace_note_layout_test.rs         # Grace notes (Für Elise M26)
    ├── notation_dots_test.rs             # Augmentation dots
    ├── layout_test.rs                    # Stem length standard
    ├── nocturne_m29_m37_test.rs          # Nocturne M29-M37 (new, untracked)
    └── debug_m2_slur_test.rs             # M2 slur (untracked)

frontend/
├── src/components/
│   ├── LayoutRenderer.tsx                # Staff/ledger line stroke widths
│   └── layout/
│       ├── LayoutView.tsx                # Ottava bracket rendering
│       └── LayoutView.grace.test.ts      # Grace note regression (Für Elise M26)
├── e2e/
│   └── nocturne-m29-m37-layout.spec.ts  # Nocturne M29-M37 e2e (new, untracked)
└── tests/unit/
    └── LayoutRenderer.test.tsx           # Staff line stroke width regression

specs/001-preloaded-scores-checks/
└── reviews/                              # Per-score final approval records (created during tasks)
    ├── 01-LaCandeur-final.md
    ├── 02-Arabesque-final.md
    ├── 03-CanonD-final.md
    ├── 04-Invention-final.md
    ├── 05-FurElise-final.md
    └── 06-Nocturne-final.md
```

**Structure Decision**: Option 2 (Web application monorepo). Backend layout fixes live in `backend/`, frontend rendering fixes in `frontend/`. Approval documentation lives in `specs/001-preloaded-scores-checks/reviews/`. No new source directories needed.

## Complexity Tracking

> No Constitution Check violations — this section is N/A.
