# Implementation Plan: Unified Metronome Lifecycle API

**Branch**: `097-metronome-lifecycle-api` | **Date**: 2026-09-01 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/097-metronome-lifecycle-api/spec.md`

## Summary

Promote the metronome's lifecycle (armed/deferred · active · stopped) into one engine-owned state + plugin API, and consolidate the Practice plugin's bespoke logic into a single `useMetronomeLifecycle` hook. Behaviour is unchanged for users; Play/Train unaffected. Removes duplicate armed/enabled refs and two helper sets in practice code.

## Technical Context

**Language/Version**: TypeScript (React 18+), frontend PWA
**Primary Dependencies**: `MetronomeEngine`, `metronomeContext.ts` (bridge), `PluginMetronomeContext`/`MetronomeState` (types.ts), practice `usePracticeMidi`/`useFreePractice`/`practiceToolbar`
**Storage**: N/A — pure frontend state/API refactor
**Testing**: vitest + @testing-library/react. Targets: `MetronomeEngine.test.ts`, `metronomeContext.test.ts`, `PracticeViewPlugin.test.tsx`, plus new `useMetronomeLifecycle` tests; full suite + lint + `tsc -b`
**Target Platform**: Tablet devices (iPad/Android/Surface) — PWA
**Project Type**: Web application (monorepo: `backend/` + `frontend/`)
**Performance Goals**: No audio-path changes; state transitions remain synchronous; no new subscriptions per beat
**Constraints**: Non-breaking for Play/Train; invariant `!(armed && active)`; `MetronomeState.armed` required (compile-forced updates)
**Scale/Scope**: Engine (+`armed`, `setArmed`, stop clears armed) · bridge/API (+`arm`/`disarm`/`startFromDeferred`, armed in state) · new `useMetronomeLifecycle` · practice wiring cleanup · tests

## Constitution Check

- **I. DDD** ✅ — No new domain concepts; metronome lifecycle is clarified terminology (armed/active) already in use.
- **II. Hexagonal** ✅ — Strengthens the port: plugins already go through `PluginMetronomeContext`; the armed state moves *behind* that boundary (engine/API), practice policy in one hook.
- **III. PWA** ✅ — No offline/storage impact.
- **IV. Precision & Fidelity** ✅ — Engine owns timing; no precision change.
- **V. Test-First (NON-NEGOTIABLE)** ✅ — New engine/API/lifecycle tests written first; existing behaviour tests stay green (mechanically updated where the constant/name shifts).
- **VI. Layout Engine Authority** ✅ — N/A.
- **VII. Regression Prevention** ✅ — The recent metronome bugs are pinned by tests; refactor keeps those assertions.
- **VIII. User Profile** ✅ — N/A.

**Gate verdict: PASS. Complexity Tracking not required.**

## Project Structure

```text
frontend/
├── src/
│   ├── services/metronome/MetronomeEngine.ts        # +setArmed, +armed in state, stop clears armed
│   ├── services/metronome/MetronomeEngine.test.ts    # +armed lifecycle tests
│   ├── services/metronome/useMetronome.ts            # INACTIVE_STATE +armed
│   ├── plugin-api/types.ts                           # +MetronomeState.armed, +arm/disarm/startFromDeferred
│   ├── plugin-api/metronomeContext.ts                # implement new API (bridge + noop + proxy), +armed in INACTIVE_STATE
│   └── plugin-api/metronomeContext.test.ts           # +new API tests
└── plugins/
    ├── practice-view-plugin/
    │   ├── useMetronomeLifecycle.ts                  # NEW — unified practice lifecycle hook
    │   ├── useMetronomeLifecycle.test.ts             # NEW — hook tests
    │   ├── PracticeViewPlugin.tsx                    # use the hook; delete bespoke armed/enabled refs & helpers
    │   ├── PracticeViewPlugin.test.tsx               # update to state.armed; behaviour assertions unchanged
    │   ├── usePracticeMidi.ts                        # first-note trigger → lifecycle.onFirstNote
    │   ├── useFreePractice.ts                        # first-note trigger → lifecycle.onFirstNote
    │   └── practiceToolbar.tsx                       # metronomeArmed prop fed from state.armed
    ├── play-score/PlayScorePlugin.tsx                # only INITIAL_METRONOME_STATE +armed (behaviour unchanged)
    └── train-view/TrainPlugin.tsx                    # only INITIAL_METRONOME_STATE +armed (behaviour unchanged)
```

**Structure Decision**: engine owns armed state; API exposes lifecycle; one practice hook. No new engine-layer abstractions beyond what exists.

## Complexity Tracking

> Not required — Constitution Check passed without violations.