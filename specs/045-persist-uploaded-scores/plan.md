# Implementation Plan: Persist Uploaded Scores

**Branch**: `045-persist-uploaded-scores` | **Date**: 2026-03-11 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/045-persist-uploaded-scores/spec.md`

## Summary

When a user uploads a MusicXML/MXL score, it must be saved to local device storage and appear in the score picker under a "My Scores" section (below built-in preloaded scores), sorted newest-first. Uploaded scores survive page refresh. Users can delete entries via a × icon on each row; deletion is immediate with an undo toast. This applies to both the main `LoadScoreDialog` and the plugin `ScoreSelectorPlugin` overlay.

**Technical approach**: Wire the existing-but-unused `ScoreCache.cache()` into `ScoreViewer.handleMusicXMLImport`. Maintain a lightweight metadata index (`graditone-user-scores-index`) in `localStorage` to hold displayName + uploadedAt for each persisted score, enabling fast list rendering without loading full score objects. Add a new `UserScoreList` component to each score picker surface.

## Technical Context

**Language/Version**: TypeScript 5.x, React 18+  
**Primary Dependencies**: React, IndexedDB (`graditone-db` / `scores` store via existing `local-storage.ts`), `localStorage` (metadata index), WASM music engine (score parsing, no changes)  
**Storage**: IndexedDB (full `Score` object) + `localStorage` key `graditone-user-scores-index` (lightweight `Array<{id, displayName, uploadedAt}>`)  
**Testing**: Vitest + Testing Library (unit), Playwright (E2E)  
**Target Platform**: Tablet PWA — Chrome 57+, Safari 11+, Edge 16+; offline-capable  
**Project Type**: Web application (frontend-only change; no backend/Rust changes)  
**Performance Goals**: Score picker shows "My Scores" within 2s of app load (SC-004); score persisted within 10s of file selection (SC-003); delete + undo UI responds within 16ms  
**Constraints**: Offline-first (Principle III); no backend API calls; client-side only; no new npm dependencies; storage bounded by browser quota (IndexedDB) and ~5MB localStorage limit (acceptable for small number of score IDs)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Domain-Driven Design | ✅ PASS | New `UserScore` entity is a domain concept; `displayName` and `uploadedAt` match ubiquitous language |
| II. Hexagonal Architecture | ✅ PASS | All changes are in frontend adapter layer; IndexedDB access stays via existing port (`local-storage.ts`); no domain core changes |
| III. PWA Architecture | ✅ PASS | IndexedDB + localStorage are offline-capable; no network dependency introduced |
| IV. Precision & Fidelity | ✅ PASS (N/A) | No PPQ arithmetic or timing changes |
| V. Test-First Development | ⚠️ REQUIRED | Tests must be written before implementation for: `ScoreCache.cache()` wiring, `UserScoreList` component, metadata index CRUD, E2E upload-persist-reload flow |
| VI. Layout Engine Authority | ✅ PASS (N/A) | No coordinate calculations; UI is list rendering only |
| VII. Regression Prevention | ⚠️ REQUIRED | Any bugs found during implementation must generate a regression test before the fix |

**Gate result**: ✅ No blocking violations. Test-first discipline required throughout.

## Project Structure

### Documentation (this feature)

```text
specs/045-persist-uploaded-scores/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/           ← Phase 1 output
│   ├── user-score.ts    ← UserScore interface
│   └── component-api.md ← changed component props
└── tasks.md             ← Phase 2 (created by /speckit.tasks)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── data/
│   │   └── preloadedScores.ts          ← add UserScore interface export
│   ├── services/
│   │   ├── storage/
│   │   │   └── local-storage.ts        ← no functional change needed
│   │   ├── score-cache.ts              ← no change needed
│   │   └── userScoreIndex.ts           ← NEW: metadata index CRUD
│   ├── components/
│   │   ├── ScoreViewer.tsx             ← wire ScoreCache.cache() + loadFromCache path
│   │   ├── load-score/
│   │   │   ├── LoadScoreDialog.tsx     ← add userScores prop + My Scores section
│   │   │   ├── UserScoreList.tsx       ← NEW: parallel to PreloadedScoreList
│   │   │   └── UserScoreItem.tsx       ← NEW: row with × delete button + undo toast
│   │   └── plugins/
│   │       └── ScoreSelectorPlugin.tsx ← extend props with userScores + delete cb
│   └── hooks/
│       └── useUserScores.ts            ← NEW: load/refresh user score index
├── src/test/
│   └── components/
│       ├── UserScoreList.test.tsx       ← NEW unit test
│       └── ScoreViewer.upload.test.tsx  ← NEW unit test (cache wiring)
└── e2e/
    └── persist-uploaded-scores.spec.ts  ← NEW E2E test
```

**Structure Decision**: Frontend-only web application. No backend or Rust changes. All new files are in `frontend/src/`. Split into: `userScoreIndex.ts` (metadata service), `UserScoreList.tsx` + `UserScoreItem.tsx` (UI), `useUserScores.ts` (React hook), plus targeted modifications to `ScoreViewer`, `LoadScoreDialog`, and `ScoreSelectorPlugin`.

## Complexity Tracking

*No Constitution Check violations — section not required.*
