# Quickstart: Save and Load Practices

**Feature**: 056-save-load-practices  
**Date**: 2026-03-25

## Overview

This feature adds the ability to save practice sessions and reload them later. It involves three user-facing capabilities:

1. **Save** — A button in the results overlay persists the current practice (complete or partial) to browser storage.
2. **Load** — A new "Saved Practices" section in the load score dialog lets users select a saved practice to restore.
3. **Delete** — Each saved practice in the list can be removed.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Components                      │
│                                                          │
│  ResultsOverlay          LoadScoreDialog                 │
│  ┌──────────────┐       ┌──────────────────────┐        │
│  │ Save button   │       │ SavedPracticeList     │        │
│  │ → onSave()   │       │ → onSelect(practice)  │        │
│  │ → isSaved    │       │ → onDelete(id)        │        │
│  └──────┬───────┘       └──────────┬───────────┘        │
│         │                          │                     │
└─────────┼──────────────────────────┼─────────────────────┘
          │                          │
          ▼                          ▼
┌─────────────────────────────────────────────────────────┐
│                    Service Layer                         │
│                                                          │
│  savedPracticeIndex.ts     savedPracticeStorage.ts       │
│  (localStorage metadata)   (IndexedDB full data)         │
│                                                          │
│  generatePracticeName()    savePracticeToIndexedDB()      │
│  listSavedPractices()      loadPracticeFromIndexedDB()    │
│  addSavedPracticeIndex()   deletePracticeFromIndexedDB()  │
│  removeSavedPracticeIndex()                               │
└─────────────────────────────────────────────────────────┘
          │                          │
          ▼                          ▼
┌──────────────────┐    ┌──────────────────────┐
│   localStorage    │    │      IndexedDB        │
│   (index only)    │    │ graditone-db v2       │
│                   │    │ store: practices      │
└──────────────────┘    └──────────────────────┘
```

## Key Files

| File | Action | Purpose |
|------|--------|---------|
| `frontend/src/services/savedPracticeIndex.ts` | NEW | localStorage index CRUD |
| `frontend/src/services/savedPracticeStorage.ts` | NEW | IndexedDB practice CRUD |
| `frontend/src/services/storage/local-storage.ts` | MODIFY | Bump DB version to 2, add `practices` store |
| `frontend/src/components/load-score/SavedPracticeList.tsx` | NEW | List component for load dialog |
| `frontend/src/components/load-score/SavedPracticeList.css` | NEW | Styles for list component |
| `frontend/src/components/load-score/LoadScoreDialog.tsx` | MODIFY | Add SavedPracticeList section + props |
| `frontend/plugins/practice-view-plugin/ResultsOverlay.tsx` | MODIFY | Add Save button to button row |
| `frontend/plugins/practice-view-plugin/ResultsOverlay.css` | MODIFY | Save button styles |
| `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx` | MODIFY | Wire save logic, manage saved state |

## Implementation Order

1. **Storage layer** — `savedPracticeIndex.ts` + `savedPracticeStorage.ts` + DB version bump
2. **Name generation** — `generatePracticeName()` pure function (in storage service or utility)
3. **Save button** — Modify ResultsOverlay + PracticeViewPlugin
4. **List component** — `SavedPracticeList.tsx`
5. **Load dialog integration** — Modify LoadScoreDialog
6. **Load flow** — Wire practice selection to score loading + results overlay display
7. **Delete flow** — Wire delete button to storage removal

## Testing Strategy

- **Unit tests**: `savedPracticeIndex.test.ts` (localStorage mocking), `generatePracticeName` tests
- **Unit tests**: `savedPracticeStorage.test.ts` (IndexedDB mocking via fake-indexeddb or similar)
- **Component tests**: `SavedPracticeList.test.tsx` (render, select, delete interactions)
- **Integration**: ResultsOverlay with Save button behavior (save → disabled state)
- **E2E**: Full save → load → replay flow (Playwright, if applicable)

## Patterns to Follow

- **UserScoreList** for list component structure
- **userScoreIndex.ts** for localStorage index service pattern
- **local-storage.ts** for IndexedDB service pattern
- **ScoreGroupList** for `<details>/<summary>` collapsible section pattern
