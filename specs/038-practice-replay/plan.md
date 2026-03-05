# Implementation Plan: Practice Replay

**Branch**: `038-practice-replay` | **Date**: 2026-03-05 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/038-practice-replay/spec.md`

## Summary

After a practice exercise completes, a Replay button appears on the results screen. Pressing it plays back the notes the user actually performed (captured `playedMidi` pitches from `PracticeNoteResult[]`) through the app's audio output using `context.playNote` with staggered `offsetMs` values — the same scheduling pattern used by the Train plugin. The exercise staff highlights advance through the expected note positions as each slot plays. The Replay button is replaced in-place by a Stop button; pressing Stop (or reaching playback end) calls `context.stopPlayback()` and restores the results screen. No new Plugin API surface is required; no backend changes are needed.

## Technical Context

**Language/Version**: TypeScript 5+, React 18+
**Primary Dependencies**: Plugin API v2 (`context.playNote`, `context.stopPlayback` — existing); `practiceEngine.types.ts` (existing); no new dependencies
**Storage**: N/A — all replay state is transient in-memory (results screen lifetime only)
**Testing**: Vitest + React Testing Library (`PracticeViewPlugin.test.tsx`)
**Target Platform**: Tablet PWA (iPad, Surface, Android tablets) — Chrome 57+, Safari 11+, Edge 16+
**Project Type**: Web (frontend-only — `frontend/plugins/practice-view-plugin/`)
**Performance Goals**: Replay starts within 500 ms of button press; Stop halts audio within one audio processing frame
**Constraints**: No direct ToneAdapter usage inside plugin (Principle VI / FR-010 of spec 031); no coordinate calculations (Principle VI); BPM frozen at exercise completion (Q5 clarification)
**Scale/Scope**: Two files modified (`PracticeViewPlugin.tsx`, `PracticeViewPlugin.test.tsx`); no new files required

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Domain-Driven Design | ✅ PASS | `PerformanceRecord` and `ReplayStatus` are clear domain entities in musical practice context. No technical abstractions leak into the domain model. |
| II. Hexagonal Architecture | ✅ PASS | All changes are inside the plugin (frontend adapter layer). Plugin API boundary is preserved. No new ports or adapters introduced. |
| III. PWA Architecture | ✅ PASS | Frontend-only change; offline-capable (no network calls); uses existing plugin architecture. |
| IV. Precision & Fidelity | ✅ PASS | Replay timing uses integer arithmetic: `offsetMs = i × (60_000 / bpmAtCompletion)`. No floating-point accumulation in musical timing. |
| V. Test-First Development | ✅ PASS | 9 specific test cases defined in `quickstart.md` to be written before implementation. |
| VI. Layout Engine Authority | ✅ PASS | Replay uses opaque `noteIds` for highlighting (no coordinates). `playedMidi` is MIDI integer (0–127). No coordinate calculations anywhere. |
| VII. Regression Prevention | ✅ PASS | Any bugs found during implementation must result in a failing test before the fix. |

**Gate Result: ALL PASS — no violations.** Implementation may proceed.

## Project Structure

### Documentation (this feature)

```text
specs/038-practice-replay/
├── plan.md              # This file
├── research.md          # Phase 0 output — resolved R-001 through R-007
├── data-model.md        # Phase 1 output — PerformanceRecord, ReplayStatus
├── quickstart.md        # Phase 1 output — dev setup, test cases, code patterns
├── contracts/           # Phase 1 output
│   └── replay-scheduling.md  # Internal API usage contract (5 contracts)
└── tasks.md             # Phase 2 output (created by /speckit.tasks — NOT by /speckit.plan)
```

### Source Code (repository root)

```text
# Option 2: Web application (frontend only for this feature)

frontend/
├── plugins/
│   └── practice-view-plugin/
│       ├── PracticeViewPlugin.tsx          # MODIFIED — replay state + handlers + button
│       ├── PracticeViewPlugin.test.tsx     # MODIFIED — 9 new replay test cases
│       ├── practiceEngine.types.ts         # READ ONLY — PracticeNoteResult, PracticeNoteEntry
│       └── practiceEngine.ts              # READ ONLY — no changes needed
└── src/
    └── plugin-api/
        └── types.ts                        # READ ONLY — PluginContext, PluginNoteEvent
```

**Structure Decision**: Option 2 (Web application). All changes are confined to `frontend/plugins/practice-view-plugin/`. No new files required — replay state and handlers are added inline to the existing component following the established pattern from `TrainPlugin.tsx`. The feature is too small to warrant a new hook or module.

## Complexity Tracking

> No Constitution Check violations. Nothing to justify here.

*All principles satisfied. Implementation is strictly additive to existing code without introducing new abstractions, dependencies, or architectural patterns.*
