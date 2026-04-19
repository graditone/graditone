const PROFILES_KEY = 'graditone-profiles';
const ACTIVE_PROFILE_KEY = 'graditone-active-profile';

function scopedKey(profileId: string, key: string): string {
  return `profile:${profileId}:${key}`;
}

export function getActiveProfileId(): string {
  return localStorage.getItem(ACTIVE_PROFILE_KEY) ?? '';
}

export function setActiveProfileId(profileId: string): void {
  localStorage.setItem(ACTIVE_PROFILE_KEY, profileId);
}

export function scopedGetItem(key: string): string | null {
  const profileId = getActiveProfileId();
  if (!profileId) return null;
  return localStorage.getItem(scopedKey(profileId, key));
}

export function scopedSetItem(key: string, value: string): void {
  const profileId = getActiveProfileId();
  if (!profileId) return;
  localStorage.setItem(scopedKey(profileId, key), value);
}

export function scopedRemoveItem(key: string): void {
  const profileId = getActiveProfileId();
  if (!profileId) return;
  localStorage.removeItem(scopedKey(profileId, key));
}

/**
 * Migrate an unscoped key to a scoped key for a given profile.
 * Moves the value from `key` to `profile:{profileId}:{key}` and removes the original.
 */
export function migrateKeyToProfile(profileId: string, key: string): void {
  const value = localStorage.getItem(key);
  if (value !== null) {
    localStorage.setItem(scopedKey(profileId, key), value);
    localStorage.removeItem(key);
  }
}

/**
 * Remove all scoped localStorage keys for a given profile.
 */
export function removeAllScopedKeys(profileId: string): void {
  const prefix = `profile:${profileId}:`;
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));
}

export { PROFILES_KEY, ACTIVE_PROFILE_KEY };
