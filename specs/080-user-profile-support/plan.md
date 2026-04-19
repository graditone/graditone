# Implementation Plan: User Profile Support

**Branch**: `080-user-profile-support` | **Date**: 2026-04-19 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/080-user-profile-support/spec.md`

## Summary

Add a multi-profile system to Graditone enabling family/shared-device usage. All user state (scores, practices, volume, plugin settings) is scoped per profile. A profile icon appears at the rightmost position on all pages (landing, score toolbar, plugins), synchronized across browser tabs via localStorage `storage` events. Existing data is auto-migrated into a default "Default" profile on first launch.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend), React 18+ (UI)
**Primary Dependencies**: React 18, Vite, vitest, Playwright (e2e)
**Storage**: IndexedDB (`graditone-db` v4 with stores: scores, practices, sessions, goals; `plugin-registry` v1 with stores: manifests, assets) + localStorage (9 keys)
**Testing**: vitest (unit), Playwright (e2e)
**Target Platform**: Tablet devices (iPad/Surface/Android tablets), PWA, Chrome 57+, Safari 11+, Edge 16+
**Project Type**: Web (monorepo: `backend/` Rust + `frontend/` React)
**Performance Goals**: Profile switch < 2s, offline-capable, 60fps UI
**Constraints**: Offline-first, tablet-optimized (44×44px touch targets), no network dependency for profiles
**Scale/Scope**: 2–5 profiles per device, small localStorage footprint

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Domain-Driven Design | ✅ PASS | Profile is a new domain entity using ubiquitous language. No music domain terminology violated. |
| II. Hexagonal Architecture | ✅ PASS | Profile management is entirely frontend infrastructure. No backend/WASM changes needed. Profiles are a storage adapter concern. |
| III. PWA Architecture | ✅ PASS | Offline-first: profiles stored locally in localStorage/IndexedDB. No network dependency. |
| IV. Precision & Fidelity | ✅ N/A | No timing/PPQ changes. |
| V. Test-First Development | ✅ PASS | Tests will be written before implementation per TDD. |
| VI. Layout Engine Authority | ✅ N/A | No layout/rendering changes. Profile icon is UI chrome, not notation rendering. |
| VII. Regression Prevention | ✅ PASS | Migration path preserves existing data. Tests validate backward compatibility. |

**Gate result**: PASS — No violations.

## Project Structure

### Documentation (this feature)

```text
specs/080-user-profile-support/
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
│   │   ├── LandingScreen.tsx        # Add profile icon
│   │   ├── ScoreViewer.tsx          # Add profile icon to toolbar-right
│   │   ├── ProfileIcon.tsx          # NEW: Profile icon + dropdown panel
│   │   └── ProfilePanel.tsx         # NEW: Profile list/create/rename/delete
│   ├── services/
│   │   ├── profiles/
│   │   │   ├── profileManager.ts    # NEW: CRUD + migration + active profile
│   │   │   └── profileStorage.ts    # NEW: localStorage/IndexedDB scoping
│   │   ├── storage/
│   │   │   └── local-storage.ts     # Modify: scope by profile ID
│   │   ├── userScoreIndex.ts        # Modify: scope key by profile ID
│   │   ├── savedPracticeIndex.ts    # Modify: scope key by profile ID
│   │   └── playback/
│   │       └── ToneAdapter.ts       # Modify: scope volume key by profile ID
│   └── plugins/
│       └── train-view/
│           ├── TrainPlugin.tsx       # Modify: scope complexity key by profile ID
│           └── savedTrainIndex.ts    # Modify: scope key by profile ID
└── tests/
    └── unit/
        ├── profileManager.test.ts   # NEW
        └── profileStorage.test.ts   # NEW
```

**Structure Decision**: Frontend-only feature. All changes in `frontend/src/` with new `services/profiles/` module. No backend/WASM changes.

## Complexity Tracking

No constitution violations to justify.
