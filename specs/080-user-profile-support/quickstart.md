# Quickstart: User Profile Support

**Feature**: 080-user-profile-support

## What This Feature Does

Adds multi-user profile support to Graditone. Each profile isolates scores, practice sessions, volume settings, and plugin configurations. A profile icon on every page (landing, score viewer, plugins) lets users switch profiles instantly.

## Key Files

| File | Role |
|------|------|
| `frontend/src/services/profiles/profileManager.ts` | Profile CRUD, migration, cross-tab sync |
| `frontend/src/services/profiles/profileStorage.ts` | Scoped localStorage/IndexedDB helpers |
| `frontend/src/components/ProfileIcon.tsx` | Profile icon button + dropdown trigger |
| `frontend/src/components/ProfilePanel.tsx` | Profile list, create, rename, delete UI |
| `frontend/src/services/storage/local-storage.ts` | Modified: DB v5 upgrade, profileId filtering |
| `frontend/src/services/userScoreIndex.ts` | Modified: scoped localStorage keys |
| `frontend/src/services/savedPracticeIndex.ts` | Modified: scoped localStorage keys |
| `frontend/src/services/playback/ToneAdapter.ts` | Modified: scoped volume key |
| `frontend/src/plugins/train-view/TrainPlugin.tsx` | Modified: scoped complexity key |
| `frontend/src/plugins/train-view/savedTrainIndex.ts` | Modified: scoped train index key |

## How Profile Scoping Works

### localStorage

All profile-specific keys are prefixed with `profile:{profileId}:`. A `ScopedStorage` helper transparently adds the prefix:

```typescript
// Instead of: localStorage.getItem('graditone-user-scores-index')
// Use:        scopedStorage.getItem('graditone-user-scores-index')
// Reads:      localStorage.getItem('profile:abc-123:graditone-user-scores-index')
```

### IndexedDB

All records gain a `profileId` field. Queries filter by the active profile's ID using an index:

```typescript
const index = store.index('profileId');
const request = index.getAll(activeProfileId);
```

## How Cross-Tab Sync Works

Profile changes propagate via the `storage` event on `window`:
1. Tab A calls `switchProfile('xyz')` → writes `graditone-active-profile` to localStorage
2. Tab B receives `storage` event → reads new profile ID → reloads state → navigates to landing

## How Migration Works

On first launch after update:
1. Check `graditone-profiles-migrated` — if present, skip
2. Create default profile with UUID
3. Prefix all existing localStorage keys with `profile:{defaultId}:`
4. Upgrade IndexedDB to v5, add `profileId` to all existing records
5. Set `graditone-profiles-migrated = true`

## Testing

```bash
cd frontend
npx vitest run --grep "profile"    # Unit tests
npx playwright test --grep "profile"  # E2E tests
```

## Dependencies

- No backend/WASM changes required
- No new npm packages needed
- IndexedDB version bump: v4 → v5
