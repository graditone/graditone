# Contract: Profile Manager API

**Feature**: 080-user-profile-support
**Date**: 2026-04-19

This contract defines the internal TypeScript API surface for the profile management module.
All profile operations are exposed through this interface.

## Profile Interface

```typescript
interface Profile {
  id: string;              // UUID v4
  name: string;            // Display name (1–50 chars, trimmed)
  createdAt: string;       // ISO 8601
  lastActiveAt: string;    // ISO 8601, updated on activation
}
```

## ProfileManager API

```typescript
interface ProfileManager {
  /** Get all profiles, ordered by lastActiveAt descending. */
  listProfiles(): Profile[];

  /** Get the currently active profile. Always returns a valid profile. */
  getActiveProfile(): Profile;

  /**
   * Create a new profile and activate it immediately.
   * @throws Error if name is invalid (empty/whitespace-only/exceeds 50 chars).
   * @returns The newly created Profile.
   */
  createProfile(name: string): Profile;

  /**
   * Switch to an existing profile by ID.
   * Updates lastActiveAt, writes to localStorage (triggers cross-tab sync),
   * and signals the app to reload state.
   * @throws Error if profileId not found.
   */
  switchProfile(profileId: string): void;

  /**
   * Rename an existing profile.
   * @throws Error if profileId not found or name is invalid.
   */
  renameProfile(profileId: string, newName: string): void;

  /**
   * Delete a profile and all its associated data.
   * If the deleted profile is active, switches to the next available profile.
   * @throws Error if profileId not found or it's the last remaining profile.
   */
  deleteProfile(profileId: string): Promise<void>;

  /**
   * Run one-time migration: create default profile, scope existing data.
   * No-op if migration has already been performed.
   */
  migrateIfNeeded(): Promise<void>;

  /**
   * Subscribe to profile changes (for cross-tab sync).
   * Callback fires when the active profile changes in another tab.
   * @returns Unsubscribe function.
   */
  onProfileChange(callback: (newProfile: Profile) => void): () => void;
}
```

## Scoped Storage API

```typescript
interface ScopedStorage {
  /**
   * Get a localStorage value scoped to the active profile.
   * Reads from `profile:{activeProfileId}:{key}`.
   */
  getItem(key: string): string | null;

  /**
   * Set a localStorage value scoped to the active profile.
   * Writes to `profile:{activeProfileId}:{key}`.
   */
  setItem(key: string, value: string): void;

  /**
   * Remove a localStorage value scoped to the active profile.
   */
  removeItem(key: string): void;

  /**
   * Get the active profile ID for use in IndexedDB queries.
   */
  getActiveProfileId(): string;
}
```

## React Integration

```typescript
/**
 * React context providing the active profile and profile operations.
 */
interface ProfileContextValue {
  activeProfile: Profile;
  profiles: Profile[];
  switchProfile: (id: string) => void;
  createProfile: (name: string) => Profile;
  renameProfile: (id: string, newName: string) => void;
  deleteProfile: (id: string) => Promise<void>;
}
```

## Cross-Tab Sync Contract

| Event | Trigger | localStorage Key | Behavior |
|-------|---------|-----------------|----------|
| Profile switched | `switchProfile()` called | `graditone-active-profile` | Other tabs receive `storage` event, reload profile state, navigate to landing |
| Profile created | `createProfile()` called | `graditone-profiles` | Other tabs see updated profile list on next panel open |
| Profile deleted | `deleteProfile()` called | `graditone-profiles` + `graditone-active-profile` | Other tabs reload if their active profile was deleted |
| Profile renamed | `renameProfile()` called | `graditone-profiles` | Other tabs see updated name on next panel open |
