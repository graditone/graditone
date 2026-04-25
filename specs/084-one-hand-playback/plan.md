# Implementation Plan: One-Hand Playback in Practice Mode

**Branch**: `084-one-hand-playback` | **Date**: 2026-04-25 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/084-one-hand-playback/spec.md`

## Summary

When a student practices one hand on a two-stave piano score, they need playback to emit audio only for the selected hand's staff. This feature adds a **Hand Mode selector** (Both / Right / Left) to the Train plugin and Practice View plugin, and implements a **playback staff filter** in the host's score player context so only notes from the active staff are scheduled for audio output.

The approach filters notes in `useScorePlayerBridge` before they reach `usePlayback` — a minimal, non-breaking change that preserves all existing playback behaviour when hand mode is "Both hands".

## Technical Context

**Language/Version**: TypeScript 5.x / React 18 (frontend); Rust stable (backend — no changes needed)  
**Primary Dependencies**: Vite, vitest, Tone.js (audio), wasm-pack (WASM build)  
**Storage**: `localStorage` via `scopedStorage.ts` for session-persistent hand mode (profile-scoped per Constitution VIII); no IndexedDB changes needed  
**Testing**: vitest (frontend unit tests); no backend changes  
**Target Platform**: Tablet devices (iPad/Surface/Android) — PWA, offline-capable  
**Project Type**: Web application (frontend-only change; backend unchanged)  
**Performance Goals**: Filter applied before note scheduling — zero additional latency; stays within existing 100ms WASM + 200ms rendering budgets  
**Constraints**: Plugin ESLint import boundary — plugins cannot import from `src/services/`; all new API surface added to `src/plugin-api/`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. DDD — Ubiquitous Language | ✅ PASS | Uses "Hand Mode", "staff", "treble/bass" — standard music domain terms |
| II. Hexagonal Architecture | ✅ PASS | Filter lives in the adapter layer (`scorePlayerContext.ts`); domain `Note` model unchanged |
| III. PWA Architecture | ✅ PASS | Frontend-only; offline capability unaffected |
| IV. Precision & Fidelity | ✅ PASS | No timing changes; filter removes notes before scheduling, not mid-play |
| V. Test-First Development | ✅ PASS — REQUIRED | Tests must be written before implementation for all new logic |
| VI. Layout Engine Authority | ✅ PASS | No coordinate logic added; only MIDI pitch filtering |
| VII. Regression Prevention | ✅ PASS | Existing both-hands tests must remain green; must add regression tests for default (both-hands) path |
| VIII. User Profile Awareness | ✅ PASS | Hand mode stored with `scopedSetItem` (profile-scoped localStorage) |

**Gate result**: No violations. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/084-one-hand-playback/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── setPlaybackStaffFilter.md
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── plugin-api/
│   │   ├── types.ts                          # Add setPlaybackStaffFilter to PluginScorePlayerContext
│   │   ├── scorePlayerContext.ts             # Add playbackStaffFilter state + note filtering logic
│   │   └── index.ts                          # Re-export HandMode type
│   └── services/
│       └── playback/
│           └── PlaybackScheduler.ts          # (read-only; no changes needed)
├── plugins/
│   ├── train-view/
│   │   ├── trainTypes.ts                     # Add HandMode type + field to ExerciseConfig
│   │   ├── TrainPlugin.tsx                   # Add HandMode selector UI + wire to scorePlayer
│   │   ├── TrainPlugin.test.tsx              # Tests for hand mode selection + filter wiring
│   │   └── TrainPlugin.css                   # Hand mode selector styles
│   └── practice-view-plugin/
│       ├── practiceToolbar.tsx               # Add handMode prop + selector UI
│       ├── practiceToolbar.test.tsx          # Tests for hand mode selector rendering
│       ├── PracticeViewPlugin.tsx            # Wire handMode state → setPlaybackStaffFilter
│       └── PracticeViewPlugin.test.tsx       # Tests for filter activation/deactivation
└── tests/                                    # Vitest unit tests
    └── (existing test suite — must remain green)
```

**Structure Decision**: Frontend-only PWA change. All modifications are in `frontend/`. Backend (`backend/`) is entirely unaffected. No new files in `backend/` or `android/`.

## Complexity Tracking

> No constitution violations — this section is not required.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
