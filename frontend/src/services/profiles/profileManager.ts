import type { Profile } from './types';
import { validateProfileName, generateProfileId } from './types';
import {
  PROFILES_KEY,
  ACTIVE_PROFILE_KEY,
  setActiveProfileId,
  migrateKeyToProfile,
  removeAllScopedKeys,
} from './profileStorage';
import { openDB } from '../storage/local-storage';

const MIGRATION_FLAG = 'graditone-profiles-migrated';

/** Keys that need to be migrated from unscoped to scoped. */
const SCOPED_KEYS = [
  'graditone-user-scores-index',
  'graditone-saved-practices-index',
  'graditone:volume:master',
  'train-complexity-level-v1',
  'graditone-saved-trains-index',
  'ios-install-dismissed',
  'android-install-banner-dismissed',
  // sessions plugin (feature 080)
  'graditone-sessions-index',
  'graditone-goals-index',
];

function loadProfiles(): Profile[] {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Profile[];
  } catch {
    return [];
  }
}

function saveProfiles(profiles: Profile[]): void {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

function createDefaultProfile(): Profile {
  const now = new Date().toISOString();
  return {
    id: generateProfileId(),
    name: 'Default',
    createdAt: now,
    lastActiveAt: now,
  };
}

export function listProfiles(): Profile[] {
  const profiles = loadProfiles();
  return profiles.sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt));
}

export function getActiveProfile(): Profile {
  const profiles = loadProfiles();
  const activeId = localStorage.getItem(ACTIVE_PROFILE_KEY);
  const found = profiles.find(p => p.id === activeId);
  if (found) return found;
  if (profiles.length > 0) {
    setActiveProfileId(profiles[0].id);
    return profiles[0];
  }
  // No profiles exist — create default
  const defaultProfile = createDefaultProfile();
  saveProfiles([defaultProfile]);
  setActiveProfileId(defaultProfile.id);
  return defaultProfile;
}

export function createProfile(name: string): Profile {
  const error = validateProfileName(name);
  if (error) throw new Error(error);

  const trimmed = name.trim();
  const now = new Date().toISOString();
  const profile: Profile = {
    id: generateProfileId(),
    name: trimmed,
    createdAt: now,
    lastActiveAt: now,
  };

  const profiles = loadProfiles();
  profiles.push(profile);
  saveProfiles(profiles);
  return profile;
}

export function switchProfile(profileId: string): void {
  const profiles = loadProfiles();
  const idx = profiles.findIndex(p => p.id === profileId);
  if (idx === -1) throw new Error(`Profile not found: ${profileId}`);

  profiles[idx].lastActiveAt = new Date().toISOString();
  saveProfiles(profiles);
  setActiveProfileId(profileId);
}

export function renameProfile(profileId: string, newName: string): void {
  const error = validateProfileName(newName);
  if (error) throw new Error(error);

  const profiles = loadProfiles();
  const profile = profiles.find(p => p.id === profileId);
  if (!profile) throw new Error(`Profile not found: ${profileId}`);

  profile.name = newName.trim();
  saveProfiles(profiles);
}

export async function deleteProfile(profileId: string): Promise<void> {
  const profiles = loadProfiles();
  if (profiles.length <= 1) throw new Error('Cannot delete the last profile');
  const idx = profiles.findIndex(p => p.id === profileId);
  if (idx === -1) throw new Error(`Profile not found: ${profileId}`);

  const wasActive = localStorage.getItem(ACTIVE_PROFILE_KEY) === profileId;
  profiles.splice(idx, 1);
  saveProfiles(profiles);

  // Clean up scoped localStorage keys
  removeAllScopedKeys(profileId);

  // Clean up IndexedDB records
  try {
    const db = await openDB();
    const storeNames = ['scores', 'practices', 'sessions', 'goals'];
    const tx = db.transaction(storeNames, 'readwrite');

    for (const storeName of storeNames) {
      const store = tx.objectStore(storeName);
      if (store.indexNames.contains('profileId')) {
        const index = store.index('profileId');
        const request = index.openCursor(IDBKeyRange.only(profileId));
        await new Promise<void>((resolve, reject) => {
          request.onsuccess = () => {
            const cursor = request.result;
            if (cursor) {
              cursor.delete();
              cursor.continue();
            } else {
              resolve();
            }
          };
          request.onerror = () => reject(request.error);
        });
      }
    }

    db.close();
  } catch (err) {
    console.error('[ProfileManager] Error cleaning IndexedDB for profile:', err);
  }

  // Switch to another profile if the deleted one was active
  if (wasActive && profiles.length > 0) {
    setActiveProfileId(profiles[0].id);
  }
}

/**
 * One-time migration: create default profile and scope all existing data.
 * No-op if migration has already been performed.
 */
export async function migrateIfNeeded(): Promise<void> {
  if (localStorage.getItem(MIGRATION_FLAG)) return;

  console.log('[ProfileManager] Running one-time profile migration...');

  // Create or retrieve default profile
  let profiles = loadProfiles();
  let defaultProfile: Profile;

  if (profiles.length === 0) {
    defaultProfile = createDefaultProfile();
    profiles = [defaultProfile];
    saveProfiles(profiles);
  } else {
    defaultProfile = profiles[0];
  }

  setActiveProfileId(defaultProfile.id);

  // Migrate localStorage keys
  for (const key of SCOPED_KEYS) {
    migrateKeyToProfile(defaultProfile.id, key);
  }

  // Backfill profileId on IndexedDB records
  try {
    const db = await openDB();
    const storeNames = ['scores', 'practices', 'sessions', 'goals'];
    const tx = db.transaction(storeNames, 'readwrite');

    for (const storeName of storeNames) {
      const store = tx.objectStore(storeName);
      const request = store.openCursor();
      await new Promise<void>((resolve, reject) => {
        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            const record = cursor.value;
            if (!record.profileId) {
              record.profileId = defaultProfile.id;
              cursor.update(record);
            }
            cursor.continue();
          } else {
            resolve();
          }
        };
        request.onerror = () => reject(request.error);
      });
    }

    db.close();
    console.log('[ProfileManager] IndexedDB records backfilled with profileId');
  } catch (err) {
    console.error('[ProfileManager] Error backfilling IndexedDB:', err);
  }

  localStorage.setItem(MIGRATION_FLAG, 'true');
  console.log('[ProfileManager] Migration complete');
}

export type ProfileChangeCallback = (newProfile: Profile) => void;
const profileChangeListeners = new Set<ProfileChangeCallback>();

export function onProfileChange(callback: ProfileChangeCallback): () => void {
  profileChangeListeners.add(callback);
  return () => { profileChangeListeners.delete(callback); };
}

/** Notify all listeners — called by cross-tab sync handler. */
export function notifyProfileChange(profile: Profile): void {
  profileChangeListeners.forEach(cb => cb(profile));
}
