# Implementation Plan: Fix Metronome Issues

**Branch**: `085-fix-metronome-issues` | **Date**: 2026-04-26 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/085-fix-metronome-issues/spec.md`

## Summary

Three independent bugs in the `MetronomeEngine` / `useMetronomeBridge` subsystem cause: (1) incorrect tick rate at ultraslow tempos (BPM floor clamped to 20 instead of 10), (2) metronome silence after every loop boundary (Transport restart clears `scheduleRepeat` but `metronomeContext` never re-registers it), and (3) visual blink firing only on full beats regardless of the configured subdivision (subscriber notify gated to `isOnBeat`). The fixes are all frontend-only TypeScript changes: extend the BPM clamp range, add a `onTransportRestart` subscription in `useMetronomeBridge`, and remove the beat-boundary gate from subscriber notifications while adding `subBeatIndex` to `MetronomeState`.

## Technical Context

**Language/Version**: TypeScript 5.x, React 18+  
**Primary Dependencies**: Tone.js (Transport scheduling, audio synthesis), Vitest, React Testing Library  
**Storage**: N/A (no persistence changes)  
**Testing**: Vitest (unit), React Testing Library (component)  
**Target Platform**: PWA on tablet devices (iPad, Surface, Android) — Chrome 57+, Safari 11+, Edge 16+  
**Project Type**: Web application (frontend only — `frontend/` directory)  
**Performance Goals**: Metronome tick deviation ≤ 50 ms at all tempos in [10, 300] BPM; visual blink rate matches subdivision frequency  
**Constraints**: No changes to sound synthesis (oscillator / audio output generation); backward-compatible `MetronomeState` extension  
**Scale/Scope**: 3 targeted bug fixes across ~8 TypeScript files; no new dependencies

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Domain-Driven Design | ✅ PASS | `MetronomeEngine` remains a domain entity; `subBeatIndex` is a music-domain concept (position within beat subdivision) |
| II. Hexagonal Architecture | ✅ PASS | Fix uses the existing `ToneAdapter.onTransportRestart` port — no new coupling. `useMetronomeBridge` subscribes at the correct boundary. |
| III. PWA Architecture | ✅ PASS | Offline-first; no network calls; Tone.js is already the audio adapter |
| IV. Precision & Fidelity | ✅ PASS | BPM clamping to `[10, 300]` matches spec; interval math (`60 / bpm × 4 / denominator`) unchanged |
| V. Test-First Development | ✅ PASS | New failing tests written for each bug before implementation (Principle VII also requires this) |
| VI. Layout Engine Authority | ✅ PASS | No spatial coordinates involved; metronome is purely temporal |
| VII. Regression Prevention | ✅ PASS | Each bug → regression test added to suite before fix |
| VIII. User Profile Awareness | ✅ PASS | No user-specific state persisted; metronome state is session-only |

**Re-check post-design**: All principles hold — the `subBeatIndex` addition to `MetronomeState` is purely additive (no field renamed, no existing consumer broken).

## Project Structure

### Documentation (this feature)

```text
specs/085-fix-metronome-issues/
├── plan.md              # This file
├── research.md          # Root cause analysis for all 3 bugs
├── data-model.md        # MetronomeState change + subBeatIndex semantics
└── tasks.md             # Created by /speckit.tasks (next step)
```

### Source Code (changed files)

```text
frontend/
├── src/
│   ├── plugin-api/
│   │   ├── types.ts                    # MetronomeState: add subBeatIndex; update BPM range comment
│   │   ├── metronomeContext.ts         # useMetronomeBridge: add onTransportRestart subscription
│   │   └── metronomeContext.test.ts    # New: loop restart test; INACTIVE_STATE update
│   └── services/
│       └── metronome/
│           ├── MetronomeEngine.ts      # clampBpm [10,300]; notify on all ticks; capture subBeatIndex
│           ├── MetronomeEngine.test.ts # Update BPM clamp tests; add subdivision blink tests
│           └── useMetronome.ts         # Update INACTIVE_STATE: subBeatIndex: 0
└── plugins/
    └── play-score/
        ├── PlayScorePlugin.tsx         # Pass metronomeSubBeatIndex={metronomeState.subBeatIndex}
        └── playbackToolbar.tsx         # Add metronomeSubBeatIndex prop; update animation key
```

**Structure Decision**: Frontend-only PWA (Option 2 — web application). No backend changes. No new files created — all changes are in-place edits to existing files.

## Complexity Tracking

> No constitution violations. All changes are in-place fixes within existing bounded contexts.
