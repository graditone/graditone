# Data Model: Persist Uploaded Scores

**Phase**: 1 — Design  
**Date**: 2026-03-11  
**Branch**: `045-persist-uploaded-scores`

---

## Entities

### UserScore

A user-provided score that has been successfully imported and persisted locally. Represents the display metadata needed to list the score in the picker.

| Field | Type | Description | Source |
|---|---|---|---|
| `id` | `string` (UUID) | Unique identifier assigned by WASM during parse | `ImportResult.score.id` |
| `displayName` | `string` | Human-readable name shown in "My Scores" list. Derived from `work_title` or filename. Deduplication suffix appended if name already exists. | Derived at upload time |
| `uploadedAt` | `string` (ISO 8601) | Timestamp of upload | `new Date().toISOString()` at save time |

**Ordering**: Descending by `uploadedAt` (most recently uploaded first).  
**Storage**: `localStorage` key `graditone-user-scores-index` as `JSON.stringify(UserScore[])`.

---

### Score (existing — no changes)

The full WASM-parsed score object. Stored in IndexedDB via existing `ScoreCache.cache(score)`. No changes to its structure.

| Field | Type | Description |
|---|---|---|
| `id` | `string` (UUID) | Primary key in IndexedDB `scores` store |
| *(other fields)* | *(WASM-defined)* | Music content — unchanged |

**Storage**: IndexedDB `graditone-db / scores` store (existing schema v6+).

---

## Validation Rules

- `displayName` MUST be non-empty. Minimum 1 character.
- `displayName` MUST be unique within the metadata index. Duplicate base names get numeric suffix: `Name.mxl` → `Name (2).mxl`.
- `uploadedAt` MUST be a valid ISO 8601 date string.
- `id` MUST match an existing entry in IndexedDB `scores` store (maintained by: save both atomically; delete IndexedDB entry after undo window closes).

---

## State Transitions

```
[File Selected]
      │
      ▼
[WASM Parse] ──fail──► [Error shown; nothing saved]
      │
    success
      │
      ▼
[Score in React State]
[ScoreCache.cache(score)] → IndexedDB
[userScoreIndex.add({id, displayName, uploadedAt})] → localStorage
      │
      ▼
[Score visible in "My Scores" list on next picker open]

[User clicks × on a "My Scores" row]
      │
      ▼
[Remove from localStorage metadata index immediately]
[Start 5s undo window; score data remains in IndexedDB]
      │
   ┌──┴──────────────────────────────────────────┐
   │ Undo clicked within 5s                      │ No undo
   ▼                                             ▼
[Re-add to localStorage index]      [deleteScoreFromIndexedDB(id)]
[Cancel deferred delete]
```

---

## Storage Layout

### localStorage key: `graditone-user-scores-index`

```json
[
  {
    "id": "f3a21c88-...",
    "displayName": "Chopin — Nocturne Op.9 No.2.mxl",
    "uploadedAt": "2026-03-11T14:32:00.000Z"
  },
  {
    "id": "b9d04f12-...",
    "displayName": "MySong.mxl",
    "uploadedAt": "2026-03-10T09:15:00.000Z"
  }
]
```

- Index is stored sorted descending by `uploadedAt`.
- Maximum practical size: 50 entries × ~150 bytes ≈ 7.5 KB — well within 5 MB `localStorage` limit.

### IndexedDB: `graditone-db` / `scores` store (existing — no change)

```
Key (score.id) → Value (Score object + lastModified:ISO string injected by saveScoreToIndexedDB)
```

---

## Service Layer: `userScoreIndex.ts` (new file)

Responsible for all CRUD on the metadata index.

```ts
export interface UserScore {
  id: string;
  displayName: string;
  uploadedAt: string;
}

const INDEX_KEY = 'graditone-user-scores-index';

function readIndex(): UserScore[]          // JSON.parse from localStorage; empty-array fallback
function writeIndex(entries: UserScore[]): void  // JSON.stringify to localStorage

export function listUserScores(): UserScore[]
  // Returns index sorted descending by uploadedAt

export function addUserScore(id: string, rawDisplayName: string): UserScore
  // Deduplicates displayName; prepends to index; writes; returns the saved entry

export function removeUserScore(id: string): void
  // Removes entry by id; writes

export function getUserScore(id: string): UserScore | undefined
```

All functions are synchronous (localStorage). No async needed.

---

## Hook: `useUserScores.ts` (new file)

React hook that exposes the metadata index as reactive state.

```ts
export function useUserScores(): {
  userScores: UserScore[];
  addUserScore: (id: string, rawDisplayName: string) => UserScore;
  removeUserScore: (id: string) => void;
  refreshUserScores: () => void;
}
```

State is initialized from `listUserScores()` on mount. `addUserScore` and `removeUserScore` update localStorage AND local state atomically (no re-read needed). `refreshUserScores` is a manual re-read for edge cases.

---

## Post-Design Constitution Re-Check

| Principle | Status | Notes |
|---|---|---|
| I. DDD | ✅ | `UserScore` is a named domain entity with clear meaning; `userScoreIndex.ts` is an infrastructure adapter |
| II. Hexagonal | ✅ | `userScoreIndex.ts` as adapter over `localStorage`; `ScoreCache` as adapter over IndexedDB; no domain logic mixed in |
| III. PWA | ✅ | `localStorage` is offline-capable; no network calls |
| IV. Precision | ✅ (N/A) | No timing changes |
| V. Test-First | ⚠️ Required | `userScoreIndex.ts` must have 100% unit coverage before implementation |
| VI. Layout Engine | ✅ (N/A) | No coordinates |
| VII. Regression | ⚠️ Required | On-going during implementation |

**Gate result post-design**: ✅ No new violations introduced by design decisions.
