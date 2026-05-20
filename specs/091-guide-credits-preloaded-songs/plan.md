# Implementation Plan: Credits Page for Preloaded Songs in Guide Plugin

**Branch**: `agents-credits-page-preloaded-songs` | **Date**: 2025-07-15 | **Spec**: [spec.md](./spec.md)
**Worktree**: `graditone.worktrees/agents-credits-page-preloaded-songs`
**Input**: Feature specification from `specs/091-guide-credits-preloaded-songs/spec.md`

## Summary

Add a Credits section (Section 6) to the Guide plugin's single scrollable page that displays
attribution information for every one of the 7 preloaded songs bundled with the app. Attribution
data lives in a new `creditsCatalog.ts` data file (alongside the existing `preloadedScores.ts`),
completely decoupled from the UI. `GuidePlugin.tsx` maps over the catalog to render one `<dl>`
entry per song. All UI strings use the existing `t()` i18n system; both `en.json` and `es.json`
receive identical key additions.

## Technical Context

**Language/Version**: TypeScript 5 / React 18
**Primary Dependencies**: React 18, Vitest + React Testing Library, flat-key i18n catalog (custom)
**Storage**: N/A — static data, no persistence
**Testing**: Vitest + @testing-library/react (same as rest of frontend)
**Target Platform**: Tablet devices (PWA — Chrome/Safari/Edge), offline-first
**Project Type**: Web (frontend-only change — no backend / WASM involved)
**Performance Goals**: Static content render < 16 ms (60 fps), fully offline
**Constraints**: All user-facing text via `t()` (no hardcoded strings); `TranslationKey` type
  enforced at compile time; `en.json` and `es.json` must remain key-parity (enforced by
  `locales.test.ts`)
**Scale/Scope**: 7 credit entries; 1 new data file; 1 updated component; ~10 new i18n keys
  (×2 locales); 2 updated/new test files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Domain-Driven Design | ✅ PASS | `SongCredit` and `CreditsCatalog` are first-class domain entities using ubiquitous music language |
| II. Hexagonal Architecture | ✅ N/A | Pure frontend static content; no backend/WASM ports touched |
| III. PWA / Offline-First | ✅ PASS | Credits are static data bundled with the app — fully offline |
| IV. Precision & Fidelity | ✅ N/A | No timing or music-engine logic involved |
| V. Test-First Development | ⚠️ MANDATORY | Tests for `creditsCatalog.ts` and GuidePlugin credits section MUST be written before implementation code |
| VI. Layout Engine Authority | ✅ N/A | Guide is prose content; no spatial layout computed in TypeScript |
| VII. Regression Prevention | ⚠️ MANDATORY | Existing test `'renders exactly five <section> elements'` must be updated to six before the sixth section is added |
| VIII. User Profile Awareness | ✅ N/A | Credits is read-only static content; stores no user state |

**Gate result**: PASS — no violations. Principles V and VII are captured as explicit task constraints.

## Project Structure

### Documentation (this feature)

```text
specs/091-guide-credits-preloaded-songs/
├── plan.md              ← this file
├── research.md          ← Phase 0 output (source/license data per song)
├── data-model.md        ← Phase 1 output (SongCredit / CreditsCatalog types)
├── contracts/
│   └── credits-catalog.ts   ← Phase 1 output (exported TypeScript interfaces)
├── quickstart.md        ← Phase 1 output (developer how-to for adding a credit)
└── tasks.md             ← Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
frontend/
├── plugins/
│   └── guide/
│       ├── GuidePlugin.tsx          ← ADD Section 6 (Credits); map over CREDITS_CATALOG
│       ├── GuidePlugin.css          ← No changes required (reuses .guide-section)
│       └── GuidePlugin.test.tsx     ← UPDATE: 5→6 sections; ADD credits heading + entry tests
└── src/
    ├── data/
    │   ├── preloadedScores.ts       ← No changes (read-only reference)
    │   ├── creditsCatalog.ts        ← NEW: SongCredit interface + CREDITS_CATALOG array
    │   └── creditsCatalog.test.ts   ← NEW: TDD unit tests for catalog contract
    └── i18n/
        └── locales/
            ├── en.json              ← ADD ~10 guide.credits.* keys (English)
            └── es.json              ← ADD ~10 guide.credits.* keys (Spanish, parity)
```

**Structure Decision**: Frontend-only Web Application. The `backend/` directory is not touched.
No new directories are created; the new data file slots into `frontend/src/data/` alongside
`preloadedScores.ts`, following the same collocation pattern used by `PRELOADED_DIFFICULTY_LEVELS`.

## Complexity Tracking

> No violations — section left intentionally blank per template rules.
