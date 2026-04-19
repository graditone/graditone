/**
 * scopedStorage.ts — Profile-scoped localStorage helper for plugins.
 *
 * Plugins cannot import from src/services/ (ESLint boundary), so this
 * standalone helper reads the active profile ID directly from localStorage
 * and applies the same key scoping convention as profileStorage.ts.
 */

const ACTIVE_PROFILE_KEY = 'graditone-active-profile';

function getActiveProfileId(): string {
  return localStorage.getItem(ACTIVE_PROFILE_KEY) ?? '';
}

export function scopedGetItem(key: string): string | null {
  const profileId = getActiveProfileId();
  if (!profileId) return localStorage.getItem(key);
  return localStorage.getItem(`profile:${profileId}:${key}`);
}

export function scopedSetItem(key: string, value: string): void {
  const profileId = getActiveProfileId();
  if (!profileId) {
    localStorage.setItem(key, value);
    return;
  }
  localStorage.setItem(`profile:${profileId}:${key}`, value);
}
