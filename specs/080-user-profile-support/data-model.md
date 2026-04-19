# Data Model: User Profile Support

**Feature**: 080-user-profile-support
**Date**: 2026-04-19

## Entities

### Profile

Represents a user identity on the device.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | string (UUID v4) | Required, unique, immutable | Generated on creation |
| `name` | string | Required, non-empty after trim, max 50 chars | Display name (can be renamed) |
| `createdAt` | string (ISO 8601) | Required, immutable | Creation timestamp |
| `lastActiveAt` | string (ISO 8601) | Required | Updated on every profile switch |

**Storage**: `graditone-profiles` localStorage key holds `Profile[]` (JSON-serialized).

**Relationships**:
- One Profile → many Score records (IndexedDB `scores` store, filtered by `profileId`)
- One Profile → many Practice records (IndexedDB `practices` store, filtered by `profileId`)
- One Profile → many Session records (IndexedDB `sessions` store, filtered by `profileId`)
- One Profile → many Goal records (IndexedDB `goals` store, filtered by `profileId`)
- One Profile → many Train records (IndexedDB `trains` in `graditone-db`, filtered by `profileId`)
- One Profile → one set of localStorage keys (prefixed `profile:{id}:`)

---

### Profile-Scoped localStorage Keys

Each key is stored as `profile:{profileId}:{originalKey}`.

| Original Key | New Scoped Key | Owner |
|-------------|---------------|-------|
| `graditone-user-scores-index` | `profile:{id}:graditone-user-scores-index` | userScoreIndex.ts |
| `graditone-saved-practices-index` | `profile:{id}:graditone-saved-practices-index` | savedPracticeIndex.ts |
| `graditone:volume:master` | `profile:{id}:graditone:volume:master` | ToneAdapter.ts |
| `train-complexity-level-v1` | `profile:{id}:train-complexity-level-v1` | TrainPlugin.tsx |
| `graditone-saved-trains-index` | `profile:{id}:graditone-saved-trains-index` | savedTrainIndex.ts |
| `ios-install-dismissed` | `profile:{id}:ios-install-dismissed` | IOSInstallModal.tsx |
| `android-install-banner-dismissed` | `profile:{id}:android-install-banner-dismissed` | AndroidInstallBanner.tsx |

---

### Profile-Scoped IndexedDB Records

Each record in these stores gains a `profileId: string` field (indexed).

| Database | Store | Key Path | New Field | New Index |
|----------|-------|----------|-----------|-----------|
| `graditone-db` (v4→v5) | `scores` | `id` | `profileId` | `profileId` |
| `graditone-db` (v4→v5) | `practices` | `id` | `profileId` | `profileId` |
| `graditone-db` (v4→v5) | `sessions` | `id` | `profileId` | `profileId` |
| `graditone-db` (v4→v5) | `goals` | `id` | `profileId` | `profileId` |

---

### Global (Non-Scoped) Keys

These localStorage keys are shared across all profiles:

| Key | Purpose |
|-----|---------|
| `graditone-profiles` | `Profile[]` — the list of all profiles |
| `graditone-active-profile` | `string` — ID of the currently active profile |
| `graditone-profiles-migrated` | `"true"` — migration flag (set once) |

---

## State Transitions

### Profile Lifecycle

```
[Created] → [Active] ↔ [Inactive] → [Deleted]
```

- **Created → Active**: On creation, profile immediately becomes active
- **Active → Inactive**: When another profile is switched to
- **Inactive → Active**: When user selects this profile
- **Active/Inactive → Deleted**: User deletes the profile (cannot delete the last one)

### App Startup Flow

```
Start → Check 'graditone-profiles-migrated'
  ├─ Not set → Run migration → Create default profile → Set flag → Continue
  └─ Set → Load 'graditone-profiles'
           ├─ Empty/corrupt → Create default profile → Continue
           └─ Valid → Load 'graditone-active-profile'
                      ├─ Valid ID found in profiles → Activate it
                      └─ Missing/invalid → Activate first profile
```

### Profile Switch Flow

```
User taps profile icon → Panel opens → User selects profile
  → Stop active playback (if any)
  → Write new active profile ID to localStorage (triggers cross-tab sync)
  → Update `lastActiveAt` on new profile
  → Reload application state for new profile
  → Navigate to landing page
```

## Validation Rules

| Rule | Applies to | Validation |
|------|-----------|------------|
| Name not empty | Create, Rename | `name.trim().length > 0` |
| Name max length | Create, Rename | `name.trim().length <= 50` |
| Cannot delete last profile | Delete | `profiles.length > 1` |
| Profile ID must exist | Switch, Delete, Rename | `profiles.find(p => p.id === id) !== undefined` |
