# Contract: IndexedDB Schema v5

**Feature**: 080-user-profile-support
**Date**: 2026-04-19

This contract defines the IndexedDB schema upgrade from v4 to v5 for profile support.

## Database: `graditone-db`

**Version**: 4 → 5

### Schema Changes

All existing object stores gain a `profileId` field and index.

#### `scores` store

```
Key path: id
Existing indexes: lastModified
New index: profileId (non-unique)
New field: profileId: string (required)
```

#### `practices` store

```
Key path: id
Existing indexes: savedAt
New index: profileId (non-unique)
New field: profileId: string (required)
```

#### `sessions` store

```
Key path: id
Existing indexes: createdAt, status
New index: profileId (non-unique)
New field: profileId: string (required)
```

#### `goals` store

```
Key path: id
Existing indexes: createdAt, status
New index: profileId (non-unique)
New field: profileId: string (required)
```

### Upgrade Handler (`onupgradeneeded`)

When upgrading from v4 to v5:

1. For each store (`scores`, `practices`, `sessions`, `goals`):
   a. Open a cursor on the store
   b. For each record missing `profileId`:
      - Set `profileId` to the default profile ID (read from `graditone-active-profile` localStorage key, or generate if absent)
      - Put the updated record back
   c. Create index `profileId` on the store (non-unique)

### Query Pattern

All queries that previously read entire stores must now filter by `profileId`:

```typescript
// Before (v4):
const request = store.getAll();

// After (v5):
const index = store.index('profileId');
const request = index.getAll(activeProfileId);
```

## Database: `plugin-registry`

**Version**: 1 (no change)

Plugin registry stores installed third-party plugins. These are **shared across profiles** — a plugin installed by one profile is available to all profiles. Only the plugin's per-user state (if any) is profile-scoped via localStorage keys.

**Rationale**: Plugins are system-level resources. Requiring re-installation per profile would be confusing and wasteful.
