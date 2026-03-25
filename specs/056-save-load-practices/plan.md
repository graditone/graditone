# Implementation Plan: Save and Load Practices

**Branch**: `056-save-load-practices` | **Date**: 2026-03-25 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/056-save-load-practices/spec.md`

## Summary

Add the ability to save practice sessions from the results overlay and reload them from the load score dialog. A "Save" button is added to the results overlay button row. Saved practices are persisted using a two-tier storage pattern (localStorage index + IndexedDB for full data) following the existing UserScore architecture. A new "Saved Practices" collapsible section in the load score dialog lists saved practices by date, supporting selection (load + show results overlay) and deletion.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend), React 18+
**Primary Dependencies**: React, Vitest (testing), Vite (bundler)
**Storage**: IndexedDB (`graditone-db`, new `practices` object store) + localStorage (lightweight index)
**Testing**: Vitest with happy-dom environment
**Target Platform**: Tablet devices (iPad/Surface/Android) — PWA, Chrome 57+, Safari 11+, Edge 16+
**Project Type**: Web application (frontend-only for this feature — no backend/Rust changes needed)
**Performance Goals**: Save < 2s, list 100 entries without scroll lag, offline-capable
**Constraints**: <100 saved practices (oldest-first eviction), client-side only storage, 44×44px minimum touch targets
**Scale/Scope**: Single-user local storage; up to 100 saved practices per browser

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Applicable? | Status | Notes |
|-----------|------------|--------|-------|
| I. Domain-Driven Design | Partially | PASS | New `SavedPractice` entity uses music domain terminology (score title, hand, region). No new domain logic in music engine. |
| II. Hexagonal Architecture | Yes | PASS | Storage service acts as an adapter; UI components consume via service interface. No domain core changes. |
| III. PWA Architecture | Yes | PASS | All data stored client-side (IndexedDB + localStorage). Works offline. No network dependency. |
| IV. Precision & Fidelity | N/A | PASS | No timing calculations added; existing performance data stored as-is. |
| V. Test-First Development | Yes | PASS | Unit tests for storage service, component tests for UI. TDD workflow. |
| VI. Layout Engine Authority | N/A | PASS | No spatial/layout calculations involved. Pure UI + storage feature. |
| VII. Regression Prevention | Yes | PASS | Any bugs discovered during implementation will get regression tests per constitution. |

**Gate Result: PASS** — No violations. Feature is frontend-only, follows existing patterns, and adds no layout logic.

## Project Structure

### Documentation (this feature)

```text
specs/056-save-load-practices/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── components/
│   │   └── load-score/
│   │       ├── LoadScoreDialog.tsx        # MODIFY: add SavedPracticeList
│   │       ├── SavedPracticeList.tsx       # NEW: list component
│   │       └── SavedPracticeList.css       # NEW: styles
│   └── services/
│       ├── storage/
│       │   └── local-storage.ts           # MODIFY: add practices object store (DB v2)
│       ├── savedPracticeIndex.ts          # NEW: localStorage index service
│       └── savedPracticeStorage.ts        # NEW: IndexedDB full-data service
├── plugins/
│   └── practice-view-plugin/
│       ├── ResultsOverlay.tsx             # MODIFY: add Save button
│       ├── ResultsOverlay.css             # MODIFY: Save button styles
│       └── PracticeViewPlugin.tsx         # MODIFY: wire save callback + state
└── tests/
    ├── services/
    │   ├── savedPracticeIndex.test.ts     # NEW
    │   └── savedPracticeStorage.test.ts   # NEW
    └── components/
        └── SavedPracticeList.test.tsx     # NEW
```

**Structure Decision**: Frontend-only web application. Follows the existing `UserScore` two-tier storage pattern (localStorage index + IndexedDB data). New components follow the `UserScoreList` pattern for the load score dialog section. The Save button is added to the existing `ResultsOverlay` component in the practice-view plugin.

## Complexity Tracking

No constitution violations requiring justification.
