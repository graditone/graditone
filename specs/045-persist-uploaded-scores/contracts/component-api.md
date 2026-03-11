# Component API Contract

**Feature**: Persist Uploaded Scores  
**Date**: 2026-03-11

This document defines the changed and new component prop interfaces for this feature.

---

## New Components

### `UserScoreList` — `frontend/src/components/load-score/UserScoreList.tsx`

Presentational list of user-uploaded scores. Parallel to `PreloadedScoreList`.

```ts
interface UserScoreListProps {
  scores: ReadonlyArray<UserScore>;     // From useUserScores() hook; sorted desc by uploadedAt
  selectedId?: string;                  // Highlights the currently active uploaded score (if any)
  disabled?: boolean;                   // Disables all interactions (e.g., while WASM is loading)
  onSelect: (score: UserScore) => void; // Called when a row is clicked to load the score
  onDelete: (id: string) => void;       // Called when × button is clicked
}
```

Renders:
- A `<section>` with `<h3>My Scores</h3>` heading
- Only rendered when `scores.length > 0`
- A `<ul role="list">` of rows, each with: score `displayName`, formatted `uploadedAt` date, × delete button
- Active row highlighted with CSS class `user-score-item--selected`
- Hidden entirely when `scores` is empty

---

### `useUserScores` — `frontend/src/hooks/useUserScores.ts`

React hook managing the metadata index.

```ts
interface UseUserScoresResult {
  userScores: UserScore[];
  addUserScore: (id: string, rawDisplayName: string) => UserScore;
  removeUserScore: (id: string) => void;
  refreshUserScores: () => void;
}

function useUserScores(): UseUserScoresResult
```

---

### `userScoreIndex` — `frontend/src/services/userScoreIndex.ts`

Pure synchronous service (not a hook) for localStorage CRUD.

```ts
function listUserScores(): UserScore[]
function addUserScore(id: string, rawDisplayName: string): UserScore
function removeUserScore(id: string): void
function getUserScore(id: string): UserScore | undefined
```

---

## Modified Components

### `LoadScoreDialog` — `frontend/src/components/load-score/LoadScoreDialog.tsx`

**New props added**:

```ts
// Before (existing props unchanged):
interface LoadScoreDialogProps {
  open: boolean;
  onClose: () => void;
  onImportComplete: (result: ImportResult) => void;
  onWillLoad?: () => void;
}

// After (additions):
interface LoadScoreDialogProps {
  open: boolean;
  onClose: () => void;
  onImportComplete: (result: ImportResult) => void;
  onWillLoad?: () => void;
  // NEW:
  userScores: ReadonlyArray<UserScore>;     // Passed from ScoreViewer via useUserScores
  onSelectUserScore: (id: string) => void;  // Called when user clicks a "My Scores" entry
  onDeleteUserScore: (id: string) => void;  // Called when user clicks × on a "My Scores" entry
}
```

**UI change**: Add `<UserScoreList>` beneath `<PreloadedScoreList>` in the left panel. `UserScoreList` is only rendered when `userScores.length > 0`.

---

### `ScoreViewer` — `frontend/src/components/ScoreViewer.tsx`

**New responsibilities (internal — no prop changes)**:

1. Call `ScoreCache.cache(result.score)` and `addUserScore(result.score.id, displayName)` in `handleMusicXMLImport`.
2. New method `handleUserScoreSelect(id: string)`:
   ```ts
   const handleUserScoreSelect = (id: string) => {
     setIsFileSourced(false);
     setSkipNextLoad(false);
     setScoreId(id);
     setDialogOpen(false);
   };
   ```
3. New method `handleUserScoreDelete(id: string)`:
   - Calls `removeUserScore(id)` (metadata index)
   - Shows undo `successMessage`
   - Starts 5s timer → `deleteScoreFromIndexedDB(id)` on expiry
   - Undo action: clears timer, calls `addUserScore(id, displayName)` (restore to metadata index; score data still in IndexedDB)
4. Pass `userScores`, `onSelectUserScore`, `onDeleteUserScore` to `<LoadScoreDialog>`.

---

### `ScoreSelectorPlugin` — `frontend/src/components/plugins/ScoreSelectorPlugin.tsx`

**New props added**:

```ts
// Before (existing props):
interface PluginScoreSelectorProps {
  catalogue: ReadonlyArray<PluginPreloadedScore>;
  isLoading?: boolean;
  error?: string | null;
  onSelectScore: (catalogueId: string) => void;
  onLoadFile: (file: File) => void;
  onCancel: () => void;
}

// After (additions):
interface PluginScoreSelectorProps {
  catalogue: ReadonlyArray<PluginPreloadedScore>;
  isLoading?: boolean;
  error?: string | null;
  onSelectScore: (catalogueId: string) => void;
  onLoadFile: (file: File) => void;
  onCancel: () => void;
  // NEW:
  userScores?: ReadonlyArray<UserScore>;              // Optional; if absent, "My Scores" section hidden
  onSelectUserScore?: (id: string) => void;
  onDeleteUserScore?: (id: string) => void;
}
```

**UI change**: Add `<UserScoreList>` below the built-in score list. Same `UserScoreList` component reused.

---

## Test Contract

Each modified/new component MUST have test coverage for these scenarios **before** implementation is written (Principle V: Test-First):

| Component | Test Cases |
|---|---|
| `userScoreIndex.ts` | listUserScores() returns [] when empty; addUserScore() adds entry; addUserScore() deduplicates display name; removeUserScore() removes entry; index is sorted desc by uploadedAt |
| `UserScoreList.tsx` | renders "My Scores" heading; renders each score name; calls onSelect with correct id; calls onDelete with correct id; renders nothing when scores is empty |
| `ScoreViewer` (upload) | ScoreCache.cache() called after successful import; addUserScore() called with correct displayName; handleUserScoreSelect sets isFileSourced=false |
| E2E | Upload → refresh → "My Scores" shows uploaded score → select → score renders |
| E2E | Delete → undo → score still in list after refresh |
| E2E | Delete → no undo → score gone after refresh |
