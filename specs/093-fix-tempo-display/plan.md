# Implementation Plan: Fix Tempo Display on Metronome Slider

**Branch**: `093-fix-tempo-display` | **Date**: 2026-08-30 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/093-fix-tempo-display/spec.md`

## Summary

During a Free Practice session (Feature 092) the Practice View Plugin's metronome tempo slider changes the beat rate but the numeric BPM readout in the toolbar stays frozen at the value captured when the session started. The readout is fed by `useFreePractice.freeStaffBpm`, which is only written at session boundaries (start / repractice / replay); the slider path (`handleTempoChange`) only updates `tempoMultiplier` and `scorePlayer.setTempoMultiplier`, which never feed back into the free-practice domain state. Fix: make one effective BPM the single source of truth for free practice — the toolbar readout, metronome, measure clock, and saved record must all reflect slider changes in real time.

## Technical Context

**Language/Version**: TypeScript (React 18, strict mode), Vitest + Testing Library  
**Primary Dependencies**: React, Vitest, `@testing-library/react`, existing plugin-api types  
**Storage**: None new (only `FreeMidiRecord.bpm` semantics change — the effective tempo is stored)  
**Testing**: Vitest + @testing-library/react (component/unit tests for `PracticeViewPlugin`, `PracticeToolbar`, `useFreePractice`)  
**Target Platform**: PWA tablet (iPad/Surface/Android) — plugin `practice-view-plugin`, `pluginApiVersion` 6  
**Project Type**: Web / frontend plugin (monorepo `frontend/plugins/practice-view-plugin/`)  
**Performance Goals**: Readout must update in real time during slider drag with zero added latency; no new async IO on the hot path  
**Constraints**: No coordinate arithmetic in renderer (Principle VI); PLAIN integer-BPM rounding only (Principle IV — no floating-point timing); profile/state changes must never desync number vs. audio  
**Scale/Scope**: ~3 source files + tests in `frontend/plugins/practice-view-plugin/`; no host/PlPlugin API changes; no backend/Rust changes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Domain-Driven Design | ✅ Pass | Effective BPM remains a domain concept (`FreeMidiRecord.bpm` = tempo at stop time); no tech leaks into spec |
| II. Hexagonal Architecture | ✅ Pass | Fix confined to the plugin's own hooks/components; no new cross-boundary calls |
| III. PWA Architecture | ✅ Pass | No new network/storage dependencies; offline behaviour unchanged |
| IV. Precision & Fidelity | ✅ Pass | BPM is a whole number; no floating-point timing arithmetic introduced |
| V. Test-First Development | ✅ Pass | Regression test (reproducing the stale readout) written before the fix |
| VI. Layout Engine Authority | ✅ Pass | No spatial/coordinate calculations touched; `StaffViewer` continues to receive an opaque BPM prop |
| VII. Regression Prevention | ✅ Pass | Issue #1 documented in spec; failing test created first, kept permanently |
| VIII. User Profile Awareness | ✅ Pass | No user state added; existing profile-scoped storage untouched |

## Project Structure

### Documentation (this feature)

```text
specs/093-fix-tempo-display/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── free-practice-tempo-contract.md
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (affected files)

```text
frontend/plugins/practice-view-plugin/
├── PracticeViewPlugin.tsx          # handleTempoChange: route multiplier change into free-practice effective BPM
├── useFreePractice.ts             # setFreeTempo(base, multiplier): recompute + publish effective BPM
├── practiceToolbar.tsx            # (readout already driven by `bpm` prop — no code change expected)
├── PracticeViewPlugin.test.tsx    # R: drag slider in free practice → readout updates (regression)
├── useFreePractice.test.ts        # NEW: effective-BPM recompute + record.bpm semantics
└── practiceToolbar.test.tsx       # R: bpm prop renders the passed value (free practice)
```

**Structure Decision**: No new directories or architecture. The practice-view-plugin already owns all free-practice state via `useFreePractice`; the fix adds a tempo-transform path inside that boundary and consumes it in the orchestrator's `handleTempoChange`.

## Complexity Tracking

> No constitution violations. No new architectural patterns introduced.

---

## Phase 0: Research

*See [research.md](research.md)*

## Phase 1: Design & Contracts

*See [data-model.md](data-model.md), [contracts/free-practice-tempo-contract.md](contracts/free-practice-tempo-contract.md), [quickstart.md](quickstart.md)*