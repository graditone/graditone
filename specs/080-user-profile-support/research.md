# Research: User Profile Support

**Feature**: 080-user-profile-support
**Date**: 2026-04-19

## Research Task 1: localStorage Key Scoping Strategy

**Context**: The app uses 9 localStorage keys that need per-profile isolation.

**Decision**: Prefix-based key scoping — prepend `profile:{profileId}:` to each existing key.

**Rationale**:
- Minimal code change: each read/write call adds the prefix via a helper function
- No schema migration needed for localStorage (old un-prefixed keys become the default profile's keys during migration)
- Easy to enumerate and delete all keys for a profile (iterate keys matching `profile:{id}:*`)
- Readable and debuggable in browser DevTools

**Alternatives considered**:
- Namespace via a single JSON blob per profile: Rejected — would require loading/saving all keys atomically, breaking the independent key model
- Separate localStorage per profile via iframe sandbox: Rejected — overly complex and fragile

**Migration path**: On first launch after update, detect absence of `graditone-profiles` key → create default profile → rename each existing un-prefixed key to `profile:{defaultId}:{originalKey}`.

---

## Research Task 2: IndexedDB Per-Profile Isolation

**Context**: IndexedDB `graditone-db` (v4) has 4 object stores (scores, practices, sessions, goals). `plugin-registry` (v1) has 2 stores (manifests, assets).

**Decision**: Add a `profileId` field to all stored records + use IndexedDB indexes to filter by profile.

**Rationale**:
- Adding a field + index is a non-breaking schema change (requires DB version bump to v5)
- Existing records get `profileId` set to the default profile's ID during migration
- Queries use the `profileId` index to retrieve only the active profile's data
- Avoids creating separate databases per profile (which would complicate cleanup and quota management)

**Alternatives considered**:
- Separate IndexedDB database per profile (e.g., `graditone-db-{profileId}`): Rejected — complicates database lifecycle management, quota is shared anyway, and cleanup on profile delete requires knowing all DB names
- Composite key (`{profileId}:{id}`): Rejected — would break existing code that uses `id` as the primary key

**Migration path**: Bump `graditone-db` to v5 in the `onupgradeneeded` handler. In the upgrade, iterate all existing records and set `profileId` to the default profile's ID. Create a `profileId` index on each store.

---

## Research Task 3: Cross-Tab Profile Synchronization

**Context**: The active profile must sync across all browser tabs (FR-007, clarification).

**Decision**: Use the `storage` event on `window` to detect changes to a `graditone-active-profile` localStorage key.

**Rationale**:
- The `storage` event fires in all **other** tabs when localStorage changes — perfect for cross-tab sync
- No additional library needed (BroadcastChannel is an alternative but less widely supported in older Safari)
- Simple: write `activeProfileId` to localStorage → other tabs receive event → reload their profile state
- Works offline (no server needed)

**Alternatives considered**:
- BroadcastChannel API: Rejected — Safari only added full support in 15.4; the `storage` event has broader compatibility matching the app's Chrome 57+, Safari 11+ targets
- SharedWorker: Rejected — overkill for a single value sync
- Polling: Rejected — wasteful and introduces latency

**Implementation**: 
1. On profile switch, write `graditone-active-profile` to localStorage
2. Each tab listens for `window.addEventListener('storage', handler)`
3. When the handler fires with `key === 'graditone-active-profile'`, reload the active profile and navigate to the landing page

---

## Research Task 4: Profile Icon Placement Across All Pages

**Context**: Profile icon must appear on landing page, score toolbar, and plugin views. Currently there is no shared header/toolbar component — each page manages its own layout.

**Decision**: Create a `ProfileIcon` component rendered in each page's layout at the rightmost position.

**Rationale**:
- The app has no global app shell/header (landing is full-viewport hero, score viewer has its own toolbar, plugins have their own layout). Introducing a global header would be a significant refactor beyond the scope of this feature.
- A standalone `ProfileIcon` component can be dropped into each page independently.
- For the landing page: position the icon absolutely at the top-right corner
- For the score toolbar: add it after the existing buttons in `toolbar-right`
- For plugin views: the plugin framework's `PluginView` wrapper can include the profile icon in its chrome

**Alternatives considered**:
- Global app shell header: Rejected — would require restructuring App.tsx and all page components. Out of scope.
- Floating/fixed position overlay: Rejected — could conflict with plugin full-screen modes and z-index issues

---

## Research Task 5: Profile Data Migration for Existing Users

**Context**: FR-011 requires seamless migration of pre-profile data into a default profile.

**Decision**: Perform one-time migration on app startup, gated by a `graditone-profiles-migrated` flag.

**Rationale**:
- Check `graditone-profiles-migrated` in localStorage at app startup
- If absent: create default profile, rename all localStorage keys with profile prefix, update IndexedDB records with profileId, set migration flag
- If present: skip (normal startup)
- Migration is idempotent — if interrupted, re-running produces the same result

**Migration steps**:
1. Generate UUID for default profile
2. Create profile entry: `{ id, name: "Default", createdAt, lastActiveAt }`
3. Write profile list to `graditone-profiles`
4. Write active profile to `graditone-active-profile`
5. For each known localStorage key, copy value to prefixed key, delete original
6. Open IndexedDB, iterate all stores, add `profileId` field to each record
7. Set `graditone-profiles-migrated = true`

**Risk mitigation**: If IndexedDB migration fails (e.g., store not found), log warning and continue — the profile system still works for new data even if old data is un-scoped.
