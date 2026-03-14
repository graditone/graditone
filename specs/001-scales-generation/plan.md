# Implementation Plan: Scales Generation

**Branch**: `001-scales-generation` | **Date**: 2026-03-14 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/001-scales-generation/spec.md`

## Summary

Generate 48 MusicXML (`.mxl`) scale files (24 major + 24 natural minor, across C4 and C5 starting octaves) into a new `scores/scales/` subfolder using a Python generator script. Extend the load score dialog to display a collapsible "Scales" group sourced from those files, ordered by circle of fifths, alongside the existing ungrouped preloaded scores. No backend changes required.

## Technical Context

**Language/Version**: TypeScript ~5.9 (frontend), Python 3.x (generation script)  
**Primary Dependencies**: React 19, Vite 7, Vitest 4 (frontend); Python stdlib only — `zipfile`, `xml.etree.ElementTree` (generator)  
**Storage**: Static `.mxl` files committed to `scores/scales/` and served via existing `frontend/public/scores → ../../scores` symlink  
**Testing**: Vitest + Testing Library (frontend component/unit tests); Python `unittest` (generator script tests)  
**Target Platform**: Tablet devices (PWA, offline-capable) — Chrome 57+, Safari 11+  
**Project Type**: Web application (frontend-only change + generator script at repo root)  
**Performance Goals**: Score group renders in <16ms; all 48 scale files are small (<10KB each) and load via the same `fetch → Blob → WASM` path as existing scores  
**Constraints**: Offline-first — scale files must be statically bundled (no runtime generation); dialog must not regress existing preloaded scores UX  
**Scale/Scope**: 48 new static files; ~4 TypeScript files modified; 1 new Python generator script

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Domain-Driven Design | ✅ PASS | `ScoreGroup` is a new first-class domain entity in the catalog |
| II. Hexagonal Architecture | ✅ PASS | Generation script is a developer tool (not runtime); frontend reads static assets |
| III. PWA Architecture | ✅ PASS | Scale files served statically via existing symlink, offline-capable |
| IV. Precision & Fidelity | ✅ PASS | No timing changes; scale pitches use correct musical intervals |
| V. Test-First Development | ✅ REQUIRED | Write tests before implementation for all component and data changes |
| VI. Layout Engine Authority | ✅ PASS | No spatial calculations; pure data + UI toggle only |
| VII. Regression Prevention | ✅ PASS | No known bugs; tests will prevent regressions going forward |

**Post-Phase-1 re-check**: ✅ No violations introduced by the design. `ScoreGroup` and `PreloadedCatalog` are pure data structures; the collapsible group uses native HTML `<details>/<summary>` — no TypeScript layout calculations involved.

## Project Structure

### Documentation (this feature)

```text
specs/001-scales-generation/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/           ← Phase 1 output
│   └── score-catalog.ts
└── tasks.md             ← Phase 2 output (via /speckit.tasks, not created here)
```

### Source Code (repository root)

```text
scores/
└── scales/                        ← NEW: 48 generated .mxl files
    ├── C_major_oct4.mxl
    ├── C_major_oct5.mxl
    ├── G_major_oct4.mxl
    ├── ... (24 major + 24 minor)
    └── F_minor_oct5.mxl

scripts/
└── generate_scales.py             ← NEW: generator script (Python, no deps)

frontend/
└── src/
    ├── data/
    │   └── preloadedScores.ts     ← MODIFY: add ScoreGroup type + SCALE_SCORE_GROUPS
    └── components/
        └── load-score/
            ├── LoadScoreDialog.tsx        ← MODIFY: render scale groups
            ├── PreloadedScoreList.tsx     ← MODIFY: support grouped rendering
            ├── ScoreGroupList.tsx         ← NEW: collapsible group component
            ├── ScoreGroupList.test.tsx    ← NEW: tests (write first)
            ├── PreloadedScoreList.test.tsx ← MODIFY: add group tests (write first)
            └── LoadScoreDialog.test.tsx   ← MODIFY: add group integration tests

tests/
└── scripts/
    └── test_generate_scales.py    ← NEW: generator script tests (Python)
```

**Structure Decision**: Web application (frontend only). No backend changes. Generator script is a one-time developer tool committed to `scripts/` alongside the generated files in `scores/scales/`.
