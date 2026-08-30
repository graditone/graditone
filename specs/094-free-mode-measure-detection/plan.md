# Implementation Plan: Free Mode Measure Detection

**Branch**: `free-mode-fixes` | **Date**: 2026-08-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/094-free-mode-measure-detection/spec.md`

## Summary

Free practice (Feature 092) records raw MIDI note events and quantizes them per fixed wall-clock measure windows (via `finalizeMeasureNotes`), so beat-aligned quarter notes get fractured into spurious subdivisions (1/8, 1/16) and phantom rests. This plan replaces the wall-clock quantization with **onset-derived beat-grid reconstruction** (metronome-agnostic, per clarification): the measure clock and note positions MUST be recomputed from the recorded note onsets at session-end (and incrementally for the live staff display), never from the metronome or a free-running timer.

Primary requirement: replay of an 8-quarter-note-on-the-beat performance MUST produce exactly two complete 4/4 measures of four quarter notes each — 8 notes, no rests, exact 4-beat sums — at every tempo in 20–300 BPM, with the finest detected value 1/16.

## Technical Context

**Language/Version**: TypeScript (React 18+), Vitest for tests; Rust/WASM layout engine is a downstream consumer (unchanged contract)  
**Primary Dependencies**: Existing practice-view-plugin internals (`useFreePractice.ts`, `freePractice.helpers.ts`); host `PluginStaffViewer` via `context.components.StaffViewer`; no new libraries  
**Storage**: No persistence-schema change. `FreeMidiRecord` (`frontend/src/services/savedPractice.types.ts`) keeps raw `FreeMidiEvent[]` + `bpm`; detection/measure segmentation is derived at render/replay, not stored. Optional additive field for per-measure decomposition if tests require it (see research R-005)  
**Testing**: Vitest unit tests mirroring existing patterns (`freePractice.helpers.test.ts`, `useFreePractice.test.ts`, `PluginStaffViewer.test.tsx`); regression test written RED first (Constitution Principle VII)  
**Target Platform**: Tablet PWA (iPad/Surface/Android), Chrome 57+/Safari 11+; frontend React  
**Project Type**: Web application (frontend monorepo; no backend changes)  
**Performance Goals**: Onset-grid reconstruction MUST complete in <100ms for a typical session (≤ 500 notes) — inline with constitution WASM-operation budget; live staff update stays within the 60fps budget (16ms) for incremental additions  
**Constraints**: 960-PPQ fixed resolution; integer arithmetic in the WASM conversion path (Principle IV); layout authority stays in the WASM engine (Principle VI); offline-first PWA (Principle III); no language/framework changes; metronome MUST NOT influence timing (clarified)  
**Scale/Scope**: Frontend-only; single session ≤ ~500 note events typical; measure grid derived from onsets at 1/16 resolution (16 steps/measure in 4/4)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status |
|------|--------|
| G1 — DDD (ubiquitous language, domain entities) | PASS — entities already exist (`Measure`, `Detected Note`, `Beat Grid` in spec). Detection logic is pure-domain (no UI/API), preserving hexagon. |
| G2 — Hexagonal architecture (no framework in core) | PASS — onset-grid reconstruction is a pure function on `FreeMidiEvent[]`; the React hook and WASM layout remain adapters. |
| G3 — PWA / 960-PPQ + integer math | PASS — quantization uses integer 1/16 steps; ms→tick conversion stays integer at 960 PPQ. |
| G4 — Test-First (RED before implementation) | PASS-PENDING — regression test must be authored and shown failing BEFORE the fix (task sequencing enforces). |
| G5 — Layout Engine Authority | PASS — the fix computes *musical* positions (onsets→beats→ticks) which the staff view consumes; the WASM layout engine remains the only spatial-geometry authority. |
| G6 — Regression Prevention (Issue #1) | PASS — Issue #1 documented in spec; regression test is a mandatory task (TASK-DET-001). |
| G7 — User Profile Awareness | N/A — no new persisted user state. |

**Complexity Tracking**: no violations; design introduces no new dependencies or layers.

## Project Structure

### Documentation (this feature)

```text
specs/094-free-mode-measure-detection/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (function-level contracts)
└── tasks.md             # /speckit.tasks command output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── services/
│   │   └── savedPractice.types.ts      # FreeMidiEvent / FreeMidiRecord (data contract, unchanged)
│   └── plugin-api/
│       ├── types.ts                    # PluginNoteEvent / StaffViewer props contract
│       └── PluginStaffViewer.tsx       # renders measure grid + note values from notes+bpm
└── plugins/
    └── practice-view-plugin/
        ├── freePractice.helpers.ts     # NEW onset-grid reconstruction + decomposition (feature code)
        ├── freePractice.helpers.test.ts# NEW unit tests (incl. RED regression for Issue #1)
        ├── useFreePractice.ts          # replace measure-clock quantization with onset-derived finalize
        ├── useFreePractice.test.ts     # extend with beat-aligned scenario + metronome-agnostic test
        └── PracticeViewPlugin.tsx      # StaffViewer bpm/timestampOffset wiring (no logic change)
```

**Structure Decision**: Frontend-only, feature-internal to `practice-view-plugin`. New pure-domain helpers stay in `freePractice.helpers.ts` (already the pure-function home, no React import — preserves hexagon). Nothing outside the plugin changes except staff-display wiring (already present).

## Complexity Tracking

> Not required — no constitution violations.

## Phase 0 & Phase 1

See the generated artifacts:

- **research.md** — resolves all technical unknowns (onset-grid algorithm, tolerance calibration, tempo invariance, quantization edge behavior, replay/decomposition strategy) with decisions, rationale, and alternatives.
- **data-model.md** — entities retained from the spec, extended with detection-time derived fields and 1/16-subdivision constraints (no persistence changes).
- **contracts/free-mode-detection.md** — pure-function contracts for the onset-grid reconstruction and note-value decomposition (input/output/guarantees) with example vectors.
- **quickstart.md** — runnable validation scenarios proving SC-001 through SC-008 end-to-end: unit-test commands and manual PWA validation flows.