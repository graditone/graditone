# Research: Persist Uploaded Scores

**Phase**: 0 — Research & Unknowns Resolution  
**Date**: 2026-03-11  
**Branch**: `045-persist-uploaded-scores`

All unknowns from the Technical Context have been resolved via direct codebase analysis.

---

## RES-001: Persistence Mechanism

**Decision**: Two-layer storage.
1. **Full score data** → IndexedDB `graditone-db / scores` store via existing `ScoreCache.cache(score)` (wraps `saveScoreToIndexedDB`). Already exists; currently never called after user file upload.
2. **Display metadata** → `localStorage` key `graditone-user-scores-index`, a JSON-serialized `Array<{id: string, displayName: string, uploadedAt: string}>` sorted descending by `uploadedAt`.

**Rationale**: The existing `saveScoreToIndexedDB` strips `lastModified` on read and returns full `Score` objects. Loading all full scores just to populate the list picker would be unnecessarily expensive. A lightweight metadata index in `localStorage` gives instant synchronous access to the list without deserializing score objects. It is also trivially re-buildable from IndexedDB if ever lost.

**Alternatives Considered**:
- *New IndexedDB object store `user-score-metadata`*: Cleaner long-term, but requires a DB version bump (`graditone-db` v1 → v2) and async reads. Adds schema migration risk. Unnecessary for MVP scale (small number of scores).
- *Extend stored `Score` object with `displayName` field*: Would require inspecting and potentially conflicting with the WASM-generated `Score` type. Rejected — Score is a WASM domain type; attaching UI metadata to it violates hexagonal boundaries.
- *Use `getAllScoresFromIndexedDB()` on app load*: Returns full `Score[]` (schema-filtered). Expensive, async, already strips `lastModified`, and requires deriving display names from the score — which requires knowing the original filename at load time (no longer available).

---

## RES-002: Where to Call `ScoreCache.cache()`

**Decision**: In `ScoreViewer.handleMusicXMLImport(result: ImportResult)`, immediately after `setScore(result.score)`.

**Rationale**: This is the single canonical entry point for all successful file imports. Both `LoadScoreDialog` and `LoadNewScoreButton` flow through this. Adding caching here avoids duplicating logic. `ScoreCache.cache()` swallows errors (fire-and-forget), so it cannot break the UX if IndexedDB is unavailable.

**What to call**: `await ScoreCache.cache(result.score)` — and then update the metadata index via `userScoreIndex.add({ id: result.score.id, displayName, uploadedAt: new Date().toISOString() })`.

**Display name derivation**: `result.metadata.work_title` if non-empty, otherwise the filename stripped of extension. The file name is available via `result.metadata.file_name` or derived from the `File` object passed to `importFile`. Need to confirm the `ImportResult.metadata` shape — `work_title` and `file_name` are available per existing `setScoreTitle` usage in `handleMusicXMLImport`.

---

## RES-003: `isFileSourced` Guard and Loading from "My Scores"

**Decision**: When the user selects an uploaded score from "My Scores", call `setIsFileSourced(false)` before calling `loadScore(id)`.

**Rationale**: `ScoreViewer` has a `useEffect` with `[scoreId, skipNextLoad, isFileSourced]` deps. When `isFileSourced=true`, the effect skips the `loadScore()` call (prevents re-fetching after user-supplied file). Selecting from "My Scores" is an IndexedDB-sourced load, not a file-sourced load, so `isFileSourced` must be `false`.

**Flow**: `UserScoreList.onSelect(id)` → `onSelectUserScore(id)` (new callback on `LoadScoreDialog`) → `ScoreViewer.handleUserScoreSelect(id)`:
```ts
const handleUserScoreSelect = (id: string) => {
  setIsFileSourced(false);
  setSkipNextLoad(false);
  setScoreId(id);
  setDialogOpen(false);
};
```

---

## RES-004: UUID Collision on Re-upload

**Decision**: Each WASM parse of the same file generates a new UUID. The metadata index is keyed by `id` (UUID). Re-uploading the same file creates a new entry. Deduplication by display name (with numeric suffix: `MySong.mxl`, `MySong (2).mxl`) is applied in `userScoreIndex.add()`. The old entry with the same display name is NOT replaced; both are kept (per spec FR-008). Old score data in IndexedDB accumulates; this is acceptable since the user can delete entries.

**Undo edge case**: If undo is triggered, the in-memory deleted `{id, displayName, uploadedAt}` entry is re-inserted into the metadata index. The score data was never removed from IndexedDB during the undo window (deletion from IndexedDB only happens after the undo window closes or the user navigates away). See RES-006.

---

## RES-005: Notification / Toast for Undo

**Decision**: Reuse the existing `setSuccessMessage` / `setTimeout` pattern in `ScoreViewer`. No new Toast component needed.

**Implementation**: On delete, display `successMessage = "Score removed. Undo"` with an undo button inline. `setTimeout` of ~5s clears and commits the actual `deleteScoreFromIndexedDB(id)` call. If undo is clicked before timeout fires, cancel the timeout, restore the metadata index entry, and clear the message.

**Rationale**: The codebase has no Toast component. Introducing a generic Toast abstraction for one use case would be over-engineering. The existing `success-message` pattern with a simple timer handles this cleanly.

---

## RES-006: Deletion Flow (Deferred Commit)

**Decision**: Two-phase deletion.
1. **Immediate**: Remove entry from `localStorage` metadata index → score disappears from "My Scores" list immediately.
2. **Deferred (5s)**: Call `deleteScoreFromIndexedDB(id)` after undo window closes.

**Undo**: If triggered within 5s, cancel the deferred deletion, re-add to metadata index, update UI.

**Why not delete from IndexedDB immediately?**: The `Score` object in IndexedDB is the authoritative data. If we delete it immediately and the user clicks undo, we'd have metadata but no score — forcing a re-import. Deferring the IndexedDB deletion makes undo cheap (just re-add the metadata index entry).

---

## RES-007: Plugin Surface (`ScoreSelectorPlugin`)

**Decision**: Extend `PluginScoreSelectorProps` with a `userScores: ReadonlyArray<{id: string, displayName: string}>` prop and an `onDeleteUserScore: (id: string) => void` callback. The host (`ScoreViewer` / plugin context wiring) populates this from the metadata index. Full parity with main dialog per FR-004.

**Rationale**: `ScoreSelectorPlugin` renders the full score picker in the plugin overlay. It is completely independent from `LoadScoreDialog`. The props-based approach keeps the component pure; the host manages state and IndexedDB calls.

---

## RES-008: Duplicate Filename Display Name Resolution

**Decision**: Before inserting `{ id, displayName, uploadedAt }` into the metadata index, check whether `displayName` already exists. If so, find the lowest integer `n ≥ 2` such that `${baseName} (${n})${ext}` does not exist, and use that as the stored display name.

**Example**: Uploading `MySong.mxl` three times → `MySong.mxl`, `MySong (2).mxl`, `MySong (3).mxl`.

**Implementation**: O(n) scan of the metadata array on every upload (acceptable for expected scale of <50 scores).

---

## RES-009: Ordering

**Decision**: Metadata index array is maintained in descending upload-time order (most recent first). New entries are unshifted to the front. This matches FR-003.

---

## RES-010: Test Strategy

**Decision**:
- **Unit tests** (Vitest + Testing Library):
  - `userScoreIndex.ts` — add/remove/duplicate deduplication
  - `UserScoreList.tsx` — renders list, fires onSelect, fires onDelete
  - `ScoreViewer` — `ScoreCache.cache()` is called after import; `handleUserScoreSelect` sets `isFileSourced=false`
- **E2E test** (Playwright):
  - Upload a score → refresh page → open score picker → "My Scores" section visible with uploaded score → select it → score renders
  - Upload same file twice → both appear with deduplicated names
  - Delete a score → undo → score restored → refresh → still in list
  - Delete a score → wait (no undo) → refresh → score gone

---

## Summary: All NEEDS CLARIFICATION Resolved

| Unknown | Resolution |
|---|---|
| Persistence mechanism | IndexedDB (full score) + localStorage metadata index |
| Save hook location | `ScoreViewer.handleMusicXMLImport` |
| isFileSourced guard | `setIsFileSourced(false)` before calling `loadScore(id)` for cached scores |
| UUID collision on re-upload | Allowed; deduplicated in display name only |
| Notification / undo UX | Existing `success-message` pattern + deferred IndexedDB delete |
| Plugin surface | Extend `PluginScoreSelectorProps` with `userScores` + `onDeleteUserScore` |
| Duplicate filename | Append numeric counter in metadata index at save time |
| Ordering | Descending by upload time (most recent first) |
| Test strategy | Unit (Vitest) + E2E (Playwright) — test-first per Principle V |
