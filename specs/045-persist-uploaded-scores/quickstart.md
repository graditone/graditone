# Quickstart: Persist Uploaded Scores

**Feature**: 045-persist-uploaded-scores  
**Date**: 2026-03-11

---

## Prerequisites

- Node.js 20+, pnpm (see `frontend/package.json`)
- Rust toolchain + wasm-pack (for WASM rebuild — only needed if `backend/` changes, which this feature does NOT require)
- Branch: `045-persist-uploaded-scores` (already checked out)

---

## Development Setup

```bash
# From repo root — start the frontend dev server
cd frontend
pnpm install
pnpm dev
```

App runs at `http://localhost:5173`.

---

## Running Tests

```bash
# Unit tests (Vitest)
cd frontend
pnpm test

# Unit tests in watch mode
pnpm test --watch

# E2E tests (Playwright) — requires dev server running
pnpm exec playwright test

# Run only tests relevant to this feature
pnpm test --reporter=verbose userScoreIndex
pnpm test --reporter=verbose UserScoreList
pnpm exec playwright test e2e/persist-uploaded-scores.spec.ts
```

---

## Key Files for This Feature

| File | Role |
|---|---|
| `frontend/src/services/userScoreIndex.ts` | NEW — metadata index CRUD (localStorage) |
| `frontend/src/hooks/useUserScores.ts` | NEW — React hook for user scores state |
| `frontend/src/components/load-score/UserScoreList.tsx` | NEW — "My Scores" list component |
| `frontend/src/components/ScoreViewer.tsx` | MODIFIED — wire cache + user score selection/deletion |
| `frontend/src/components/load-score/LoadScoreDialog.tsx` | MODIFIED — add My Scores section |
| `frontend/src/components/plugins/ScoreSelectorPlugin.tsx` | MODIFIED — add My Scores section (plugin overlay) |
| `frontend/src/data/preloadedScores.ts` | MODIFIED — export `UserScore` interface |

---

## Testing the Feature Manually

### Verify upload + persist
1. Start dev server (`pnpm dev`)
2. Open `http://localhost:5173`
3. Click "Load Score" → click "Upload Score" → select any `.mxl` or `.musicxml` file
4. Score renders. Open browser DevTools → Application → localStorage → find `graditone-user-scores-index` — you should see a JSON entry with the score's id, displayName, and uploadedAt
5. **Refresh the page**. Click "Load Score" — the "My Scores" section should appear with your uploaded score

### Verify reload from "My Scores"
1. After the upload + refresh above, click the uploaded score in "My Scores"
2. Score renders identically to the first load

### Verify delete + undo
1. With a score in "My Scores", click the × icon on its row
2. Score disappears from list; undo toast appears
3. Click "Undo" → score reappears
4. Delete again, do NOT click undo — wait 6s, refresh → score is gone from "My Scores"

### Verify duplicate filename handling
1. Upload the same file twice
2. Open "Load Score" — both appear under "My Scores" as `Filename.mxl` and `Filename (2).mxl`

---

## Debugging

**IndexedDB not saving?**  
Check DevTools → Application → IndexedDB → `graditone-db` → `scores` → confirm the entry exists after upload.

**"My Scores" not appearing?**  
Check `localStorage` key `graditone-user-scores-index` — if empty or missing, the metadata index was not written. Add a breakpoint in `userScoreIndex.ts:addUserScore`.

**Score not rendering after selecting from "My Scores"?**  
Most likely cause: `isFileSourced` was still `true`. Verify `handleUserScoreSelect` sets `setIsFileSourced(false)` before updating `scoreId`.

---

## Architecture Notes

- This feature makes **no backend or Rust/WASM changes**. Only the frontend is affected.
- Score data lives in IndexedDB (`graditone-db / scores`) via the existing `ScoreCache`.
- The metadata index (id + displayName + uploadedAt) lives in `localStorage` as a JSON array for fast synchronous access during picker render.
- Deletion is two-phase: metadata removed immediately (list updates), IndexedDB delete deferred by 5s to support undo.
