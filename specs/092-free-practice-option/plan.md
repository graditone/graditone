# Implementation Plan: Free Practice Option

**Branch**: `092-free-practice-option` | **Date**: 2026-05-31 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/092-free-practice-option/spec.md`

## Summary

Add a "Free Practice" button to the Practice plugin's `ScoreSelectorPlugin` overlay. Clicking it enters the practice view without loading any score, using a synthetic "free" session mode (4/4 at 80 BPM). During free practice the user plays MIDI notes freely; the toolbar shows elapsed time + running note count. Stopping triggers a simplified results overlay (elapsed time, note count, Save/Replay/Repractice). Save/Replay/Repractice reuse the existing Feature 056 infrastructure with a `free` source type and `FreePractice-{datetime}` naming. The "Free Practice" button is gated to `ScoreSelectorPlugin` only — the Play plugin's `LoadScoreDialog` must not show it.

## Technical Context

**Language/Version**: TypeScript (React 18, strict mode), tested with Vitest + Testing Library  
**Primary Dependencies**: React, Vitest, `@testing-library/react`, existing plugin-api types  
**Storage**: IndexedDB (`practices` store via `openDB()`), localStorage (saved practices index)  
**Testing**: Vitest + @testing-library/react (component tests), pure unit tests for logic functions  
**Target Platform**: PWA tablet (iPad/Surface/Android) — Chrome 57+, Safari 11+  
**Project Type**: Web / frontend plugin (monorepo `frontend/` directory)  
**Performance Goals**: Free practice session starts in <3 s; no new async IO on the hot path  
**Constraints**: No coordinate arithmetic in renderer (Principle VI); no new layout engine calls; profile-scoped IndexedDB data (Principle VIII)  
**Scale/Scope**: ~8 TypeScript files touched; ~4 new i18n keys; no backend/Rust changes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Domain-Driven Design | ✅ Pass | `FreePracticeSession` is a first-class domain concept; no leaky tech terms in spec |
| II. Hexagonal Architecture | ✅ Pass | Plugin never imports host internals; `ScoreSelectorPlugin` is a host adapter |
| III. PWA Architecture | ✅ Pass | Offline-capable; IndexedDB storage; no new network calls |
| IV. Precision & Fidelity | ✅ Pass | No timing calculations changed; MIDI events captured as raw timestamps |
| V. Test-First Development | ✅ Pass | Tests written alongside every new function/component |
| VI. Layout Engine Authority | ✅ Pass | No spatial/coordinate calculations in renderer; free practice has no staff to render |
| VII. Regression Prevention | ✅ Pass | Any bug found gets a failing test before fix |
| VIII. User Profile Awareness | ✅ Pass | `SavedPractice` stored in IndexedDB with profileId scoping (same as Feature 056) |

## Project Structure

### Documentation (this feature)

```text
specs/092-free-practice-option/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── free-practice-api.md
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (affected files)

```text
frontend/
├── src/
│   ├── plugin-api/
│   │   └── types.ts                          # Add onFreePractice?: () => void to PluginScoreSelectorProps
│   ├── components/plugins/
│   │   ├── ScoreSelectorPlugin.tsx           # Render "Free Practice" button; pass onFreePractice
│   │   └── ScoreSelectorPlugin.css           # Style for free practice button
│   ├── services/
│   │   ├── savedPractice.types.ts            # Add 'free' to ScoreRef.type; add FreePracticeSession type
│   │   └── savedPracticeStorage.ts           # Add generateFreePracticeName(); extend handleSave for free
│   └── i18n/locales/
│       └── en.json                           # New keys: score_selector.free_practice, practice.free.*
│
└── plugins/practice-view-plugin/
    ├── PracticeViewPlugin.tsx                # isFreePractice state; handleFreePractice; handleSave extension
    ├── PracticeViewPlugin.test.tsx           # Tests for free practice flow
    ├── practiceToolbar.tsx                   # isFreePractice prop: show elapsed+notes, hide score progress
    ├── practiceToolbar.test.tsx              # Tests for free practice toolbar display
    ├── ResultsOverlay.tsx                    # isFreePractice prop: simplified overlay (no accuracy score)
    └── ResultsOverlay.test.tsx               # Tests for simplified results overlay
```

## Complexity Tracking

> No constitution violations. No new architectural patterns introduced.

---

## Phase 0: Research

*See [research.md](research.md)*

## Phase 1: Design & Contracts

*See [data-model.md](data-model.md), [contracts/free-practice-api.md](contracts/free-practice-api.md), [quickstart.md](quickstart.md)*

