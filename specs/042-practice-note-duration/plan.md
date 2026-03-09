# Implementation Plan: Practice Note Duration Validation

**Branch**: `042-practice-note-duration` | **Date**: 2026-03-09 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/042-practice-note-duration/spec.md`

## Summary

Extend the Practice View Plugin to validate how long each note/chord is held, in addition to which pitches are pressed. When the user is practising from a loaded score, each `PluginPracticeNoteEntry` will carry its written `durationTicks`. The plugin converts that to a required hold duration in real-time milliseconds using the session BPM slider value. The user must hold all required pitches for at least 90% of the required duration before the session advances. Early releases are recorded as half-credit (`early-release` outcome, same weight as `correct-late`), and the session stays on the note to let the user retry. A visual hold progress indicator renders at 60 fps for notes longer than a quarter note.

## Technical Context

**Language/Version**: TypeScript 5.x, React 18+  
**Primary Dependencies**: React hooks (useState, useRef, useEffect, useCallback), Vitest + React Testing Library (tests), existing Plugin API v6  
**Storage**: N/A — all session state lives in React memory; no persistence changes  
**Testing**: Vitest (unit + component), existing `practiceEngine.test.ts` and `PracticeViewPlugin.test.tsx` suites  
**Target Platform**: Tablet PWA — Chrome 57+, Safari 11+, offline-capable  
**Project Type**: Web application — frontend-only changes; Rust/WASM backend is not modified by this feature  
**Performance Goals**: Hold indicator renders at 60 fps (≥60 Hz `requestAnimationFrame` loop); hold timer fires within ±10ms of the 90% threshold  
**Constraints**: Must not regress existing random-note / scale practice modes (no `durationTicks` path); all integer tick arithmetic (Principle IV); no spatial/layout calculations in the plugin (Principle VI)  
**Scale/Scope**: Single plugin file set (~4 files changed); two new actions in the engine; one new field on the plugin API type

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Domain-Driven Design | ✅ PASS | `HoldOutcome` (`early-release`), `HoldProgress` (percentage), `durationTicks`, `holdStartTimeMs`, `requiredHoldMs` all use music domain language. `'holding'` mode maps to the musical concept of sustaining a note. |
| II. Hexagonal Architecture | ✅ PASS | Plugin API v7 remains the only boundary between the score domain and the practice plugin. The engine reducer stays pure functional. The rAF timer is infrastructure (React side effects) dispatching pure domain actions. |
| III. PWA Architecture | ✅ PASS | `requestAnimationFrame` is a browser-native API; works fully offline. No network requests introduced. |
| IV. Precision & Fidelity | ✅ PASS | `durationTicks` is an integer (960 PPQ). `requiredHoldMs` uses the existing `(ticks / ((bpm/60)*960)) * 1000` formula — same integer tick arithmetic already used throughout. Hold threshold is `requiredHoldMs * 0.90` — a single floating-point scalar applied once; no accumulation. |
| V. Test-First Development | ✅ PASS (enforced) | Test tasks for `HOLD_COMPLETE`, `EARLY_RELEASE`, scoring, and hold indicator are listed before implementation tasks in `tasks.md`. |
| VI. Layout Engine Authority | ✅ PASS | Hold progress is a unitless scalar (0.0–1.0). The visual indicator uses CSS `width: N%`. No coordinates, bounding boxes, or spatial calculations in TypeScript. |
| VII. Regression Prevention | ✅ PASS (enforced) | No regressions at plan time. Bug-fix test requirement is documented in spec under Known Issues. |

**Post-design gate result: ALL PASS**

## Project Structure

### Documentation (this feature)

```text
specs/042-practice-note-duration/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── plugin-api-v7.md
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   └── plugin-api/
│       ├── types.ts                   # Add durationTicks to PluginPracticeNoteEntry
│       └── scorePlayerContext.ts      # Include note.duration_ticks in extractPracticeNotes
└── plugins/
    └── practice-view-plugin/
        ├── practiceEngine.types.ts    # NoteOutcome + 'early-release', PracticeMode + 'holding',
        │                              #   PracticeState.holdStartTimeMs, new HOLD_COMPLETE /
        │                              #   EARLY_RELEASE actions
        ├── practiceEngine.ts          # Handle new actions in reducer; hold-advance logic
        ├── practiceEngine.test.ts     # New tests for HOLD_COMPLETE, EARLY_RELEASE, scoring
        ├── PracticeViewPlugin.tsx     # Hold timer, MIDI release handler, progress indicator
        └── PracticeViewPlugin.test.tsx # Component-level tests for hold progression

tests/
└── (no new integration tests required — pure TypeScript plugin, no backend changes)
```

**Structure Decision**: Web application layout (option 2). Frontend-only changes — Rust/WASM backend is not modified because the score's `duration_ticks` is already available in the TypeScript score model used by `scorePlayerContext.ts`. No new files needed outside the existing plugin and plugin-api directories.

## Complexity Tracking

> No constitution violations — this section is blank.
