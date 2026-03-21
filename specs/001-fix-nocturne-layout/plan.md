# Implementation Plan: Fix Nocturne Op.9 No.2 Layout Defects (M29–M37)

**Branch**: `001-fix-nocturne-layout` | **Date**: 2026-03-21 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-fix-nocturne-layout/spec.md`

## Summary

Fix six categories of notation rendering defects in Chopin Nocturne Op.9 No.2, measures M29–M37: (1) double-flat accidental rendered as natural in M29 — a missing SMuFL codepoint in the Rust match arm; (2) 8va bracket missing at M30 — ottava_shift_regions not triggering; (3) missing courtesy accidentals in M34–M36 — accidental state machine measure boundary issue; (4) rests not centred in M34–M36 — likely voice-index mismatch; (5) slur misplaced in M37 — arc geometry at system boundaries; (6) notation overlaps at M32–M34 measure boundaries — cross-measure spacing not accounted for in the overlap detector. All fixes are in the Rust layout engine and WASM pipeline; the frontend propagates new accidental types forwarded from the layout data.

## Technical Context

**Language/Version**: Rust (latest stable), TypeScript 5 / React 18  
**Primary Dependencies**: wasm-bindgen, wasm-pack, Vite, SMuFL Unicode glyphs (U+E260–U+E264)  
**Storage**: N/A — layout computed in WASM at render time; no persistence needed  
**Testing**: `cargo test` (Rust unit + integration), Playwright (E2E), Vitest (frontend unit)  
**Target Platform**: WASM (in-browser, tablet-optimised PWA); Chrome 57+, Safari 11+, Edge 16+  
**Project Type**: Web (monorepo: `backend/` Rust/WASM + `frontend/` React/TypeScript)  
**Performance Goals**: Score render ≤200ms initial load; layout WASM ops ≤100ms; 60fps interaction  
**Constraints**: Rust/WASM engine is the ONLY layout authority (Principle VI); zero TypeScript coordinate calculations; all geometry computed in `backend/src/layout/`  
**Scale/Scope**: Six targeted defects across one 9-measure passage; isolated to layout engine positioner, annotations, and the WASM→TypeScript accidental type contract

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Domain-Driven Design | ✅ PASS | All changes work in music domain: `Accidental`, `OttavaBracket`, `Slur`, `Rest` remain first-class domain entities |
| II. Hexagonal Architecture | ✅ PASS | Fixes are inside `backend/src/layout/` (core domain); frontend remains a pure display adapter; no framework coupling introduced |
| III. PWA Architecture | ✅ PASS | No changes to WASM build pipeline, offline capability, or PWA manifest; layout computed in-browser via WASM |
| IV. Precision & Fidelity | ✅ PASS | Correcting wrong glyphs (natural instead of double-flat) is a fidelity obligation; all fixes improve musical accuracy |
| V. Test-First Development | 🔴 GATE — **Must write failing tests BEFORE each fix** | Each of the 6 defects requires: (1) failing Rust test proving the bug, (2) fix, (3) test passes. No fix may be committed without a failing test first |
| VI. Layout Engine Authority | ✅ PASS | All geometry computed in Rust. Frontend change is limited to propagating new accidental codepoints forwarded from layout output — no TypeScript coordinate calculation |
| VII. Regression Prevention | 🔴 GATE — **Must document each bug and create test before fixing** | 6 bugs found; `spec.md` Known Issues section is ready to receive documentation; each bug must have a named test that stays in the suite permanently |

**Gate Violations**: None blocking. Two GATE items (Principles V and VII) mandate test-first discipline — this is normal and expected for a bug-fix feature. All implementation tasks must follow Red→Green workflow.

**Post-Design Re-check (Phase 1 complete)**: ✅ Design confirmed clean.  
- All entity changes (AccidentalGlyph, OttavaBracketLayout, RestGlyph, SlurArc) are corrections to existing types, not additions of new architecture patterns.  
- No TypeScript coordinate calculations introduced (Principle VI confirmed).  
- Contract layer is minimal: frontend reads `codepoint: string` directly from layout output; no TypeScript glyph-selection logic added.  
- No new external dependencies introduced.  
- No complexity budget violations.

## Project Structure

### Documentation (this feature)

```text
specs/001-fix-nocturne-layout/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   └── layout/
│       ├── mod.rs              # 8va bracket generation (ottava_shift_regions → OttavaBracketLayout)
│       ├── positioner.rs       # Accidental type mapping (line ~927); rest positioning (line ~1264)
│       ├── annotations.rs      # Slur arc geometry; cross-measure/cross-system slur handling
│       ├── extraction.rs       # NoteEvent, StaffData, octave_shift_regions extraction
│       └── types.rs            # OttavaBracketLayout, TieArc, NoteEvent data types
│   └── domain/
│       └── importers/
│           └── musicxml/
│               ├── parser.rs   # <accidental>, <alter>, <octave-shift> element parsing
│               ├── converter.rs # pitch data → NoteEvent spelling
│               └── types.rs    # PitchData.alter, has_explicit_accidental flag
└── tests/
    ├── layout_test.rs          # Nocturne system-break test (line ~2180); new M29-M37 tests here
    ├── m21_accidental_test.rs  # Existing accidental test pattern to follow
    └── nocturne_m29_m37_test.rs  # NEW: regression tests for all 6 defects

frontend/
├── src/
│   └── components/
│       ├── LayoutRenderer.tsx          # 8va bracket, slur, rest, tie rendering
│       └── notation/
│           └── NotationRenderer.tsx    # Accidental glyph mapping — add U+E263/U+E264
└── e2e/
    ├── m21-flat-check.spec.ts          # Existing E2E pattern to follow
    └── nocturne-m29-m37-layout.spec.ts # NEW: E2E visual regression for M29-M37
```

**Structure Decision**: Web (Option 2) — monorepo with `backend/` (Rust layout engine) and `frontend/` (React/TypeScript renderer). All layout logic stays in `backend/src/layout/`; frontend receives geometry via WASM and renders.

## Complexity Tracking

No constitution violations requiring justification. All changes fit within existing architecture.