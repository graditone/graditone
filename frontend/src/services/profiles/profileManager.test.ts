/**
 * Feature 080 — User Profile Support
 * Unit tests for profileManager.ts
 * Constitution: V. Test-First Development
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  listProfiles,
  getActiveProfile,
  createProfile,
  switchProfile,
  renameProfile,
  deleteProfile,
  migrateIfNeeded,
  onProfileChange,
  notifyProfileChange,
} from './profileManager';
import { PROFILES_KEY, ACTIVE_PROFILE_KEY } from './profileStorage';
import type { Profile } from './types';

// Mock generateProfileId to produce deterministic IDs
let idCounter = 0;
vi.mock('./types', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./types')>();
  return {
    ...actual,
    generateProfileId: () => `profile-${++idCounter}`,
  };
});

// Mock openDB to return a fake IDBDatabase that simulates empty stores
vi.mock('../storage/local-storage', () => ({
  openDB: vi.fn().mockImplementation(() => {
    function makeCursorRequest() {
      const req: Record<string, unknown> = {
        result: null,
        onsuccess: null as ((e: unknown) => void) | null,
        onerror: null as ((e: unknown) => void) | null,
      };
      // Fire onsuccess asynchronously with result=null (no records)
      Promise.resolve().then(() => {
        if (typeof req.onsuccess === 'function') {
          (req.onsuccess as (e: unknown) => void)({ target: req });
        }
      });
      return req;
    }

    return Promise.resolve({
      transaction: () => ({
        objectStore: () => ({
          indexNames: { contains: () => false },
          openCursor: makeCursorRequest,
        }),
      }),
      close: vi.fn(),
    });
  }),
}));

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
})();

beforeEach(() => {
  vi.stubGlobal('localStorage', localStorageMock);
  localStorageMock.clear();
  idCounter = 0;
});

function seedProfile(overrides: Partial<Profile> = {}): Profile {
  const p: Profile = {
    id: `seed-${++idCounter}`,
    name: 'Seed',
    createdAt: '2026-01-01T00:00:00.000Z',
    lastActiveAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
  const existing = JSON.parse(localStorage.getItem(PROFILES_KEY) || '[]');
  existing.push(p);
  localStorage.setItem(PROFILES_KEY, JSON.stringify(existing));
  return p;
}

// --- listProfiles ---
describe('listProfiles', () => {
  it('returns empty array when no profiles exist', () => {
    expect(listProfiles()).toEqual([]);
  });

  it('returns profiles sorted by lastActiveAt descending', () => {
    seedProfile({ id: 'a', name: 'Alpha', lastActiveAt: '2026-01-01T00:00:00.000Z' });
    seedProfile({ id: 'b', name: 'Beta', lastActiveAt: '2026-06-01T00:00:00.000Z' });
    const result = listProfiles();
    expect(result[0].id).toBe('b');
    expect(result[1].id).toBe('a');
  });

  it('handles corrupted JSON gracefully', () => {
    localStorage.setItem(PROFILES_KEY, 'not-json');
    expect(listProfiles()).toEqual([]);
  });
});

// --- getActiveProfile ---
describe('getActiveProfile', () => {
  it('creates a default profile when none exist', () => {
    const profile = getActiveProfile();
    expect(profile.name).toBe('Default');
    expect(profile.id).toBeTruthy();
    // Persisted
    const stored = JSON.parse(localStorage.getItem(PROFILES_KEY)!);
    expect(stored).toHaveLength(1);
    expect(localStorage.getItem(ACTIVE_PROFILE_KEY)).toBe(profile.id);
  });

  it('returns the active profile when it exists', () => {
    const p = seedProfile({ id: 'p1', name: 'Alice' });
    localStorage.setItem(ACTIVE_PROFILE_KEY, 'p1');
    const result = getActiveProfile();
    expect(result.id).toBe('p1');
    expect(result.name).toBe('Alice');
  });

  it('falls back to the first profile if active id is stale', () => {
    seedProfile({ id: 'p1', name: 'Alice' });
    localStorage.setItem(ACTIVE_PROFILE_KEY, 'nonexistent');
    const result = getActiveProfile();
    expect(result.id).toBe('p1');
    expect(localStorage.getItem(ACTIVE_PROFILE_KEY)).toBe('p1');
  });
});

// --- createProfile ---
describe('createProfile', () => {
  it('creates and activates a new profile', () => {
    seedProfile({ id: 'existing', name: 'Existing' });
    const profile = createProfile('Bob');
    expect(profile.name).toBe('Bob');
    expect(profile.id).toBeTruthy();
    expect(localStorage.getItem(ACTIVE_PROFILE_KEY)).toBe(profile.id);

    const all = listProfiles();
    expect(all).toHaveLength(2);
  });

  it('trims the name', () => {
    const profile = createProfile('  Charlie  ');
    expect(profile.name).toBe('Charlie');
  });

  it('throws for empty name', () => {
    expect(() => createProfile('')).toThrow('Profile name cannot be empty');
  });

  it('throws for whitespace-only name', () => {
    expect(() => createProfile('   ')).toThrow('Profile name cannot be empty');
  });
});

// --- switchProfile ---
describe('switchProfile', () => {
  it('switches to an existing profile and updates lastActiveAt', () => {
    const p1 = seedProfile({ id: 'p1', name: 'A', lastActiveAt: '2026-01-01T00:00:00.000Z' });
    seedProfile({ id: 'p2', name: 'B' });
    localStorage.setItem(ACTIVE_PROFILE_KEY, 'p1');

    switchProfile('p2');
    expect(localStorage.getItem(ACTIVE_PROFILE_KEY)).toBe('p2');

    const profiles = listProfiles();
    const updated = profiles.find(p => p.id === 'p2');
    expect(updated!.lastActiveAt).not.toBe(p1.lastActiveAt);
  });

  it('throws for nonexistent profile', () => {
    expect(() => switchProfile('ghost')).toThrow('Profile not found: ghost');
  });
});

// --- renameProfile ---
describe('renameProfile', () => {
  it('renames an existing profile', () => {
    seedProfile({ id: 'p1', name: 'Old' });
    renameProfile('p1', 'New Name');
    const profiles = listProfiles();
    expect(profiles.find(p => p.id === 'p1')!.name).toBe('New Name');
  });

  it('trims the new name', () => {
    seedProfile({ id: 'p1', name: 'Old' });
    renameProfile('p1', '  Trimmed  ');
    const profiles = listProfiles();
    expect(profiles.find(p => p.id === 'p1')!.name).toBe('Trimmed');
  });

  it('throws for empty name', () => {
    seedProfile({ id: 'p1', name: 'Old' });
    expect(() => renameProfile('p1', '')).toThrow('Profile name cannot be empty');
  });

  it('throws for nonexistent profile', () => {
    expect(() => renameProfile('ghost', 'Name')).toThrow('Profile not found: ghost');
  });
});

// --- deleteProfile ---
describe('deleteProfile', () => {
  it('throws when trying to delete the last profile', async () => {
    seedProfile({ id: 'p1', name: 'Only' });
    await expect(deleteProfile('p1')).rejects.toThrow('Cannot delete the last profile');
  });

  it('throws for nonexistent profile', async () => {
    seedProfile({ id: 'p1', name: 'A' });
    seedProfile({ id: 'p2', name: 'B' });
    await expect(deleteProfile('ghost')).rejects.toThrow('Profile not found: ghost');
  });

  it('deletes a non-active profile', async () => {
    seedProfile({ id: 'p1', name: 'A' });
    seedProfile({ id: 'p2', name: 'B' });
    localStorage.setItem(ACTIVE_PROFILE_KEY, 'p1');
    // Add scoped keys for p2
    localStorage.setItem('profile:p2:volume', '0.5');

    await deleteProfile('p2');

    const profiles = listProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].id).toBe('p1');
    expect(localStorage.getItem('profile:p2:volume')).toBeNull();
    // Active profile unchanged
    expect(localStorage.getItem(ACTIVE_PROFILE_KEY)).toBe('p1');
  });

  it('switches to another profile if the active one is deleted', async () => {
    seedProfile({ id: 'p1', name: 'A' });
    seedProfile({ id: 'p2', name: 'B' });
    localStorage.setItem(ACTIVE_PROFILE_KEY, 'p1');

    await deleteProfile('p1');

    expect(localStorage.getItem(ACTIVE_PROFILE_KEY)).toBe('p2');
    const profiles = listProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].id).toBe('p2');
  });
});

// --- migrateIfNeeded ---
describe('migrateIfNeeded', () => {
  it('creates a default profile and sets migration flag', async () => {
    await migrateIfNeeded();

    expect(localStorage.getItem('graditone-profiles-migrated')).toBe('true');
    const profiles = listProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].name).toBe('Default');
    expect(localStorage.getItem(ACTIVE_PROFILE_KEY)).toBe(profiles[0].id);
  });

  it('migrates existing localStorage keys to scoped keys', async () => {
    localStorage.setItem('graditone-user-scores-index', '["s1"]');
    localStorage.setItem('graditone:volume:master', '0.7');

    await migrateIfNeeded();

    const profileId = localStorage.getItem(ACTIVE_PROFILE_KEY)!;
    // Original keys are removed
    expect(localStorage.getItem('graditone-user-scores-index')).toBeNull();
    expect(localStorage.getItem('graditone:volume:master')).toBeNull();
    // Scoped keys exist
    expect(localStorage.getItem(`profile:${profileId}:graditone-user-scores-index`)).toBe('["s1"]');
    expect(localStorage.getItem(`profile:${profileId}:graditone:volume:master`)).toBe('0.7');
  });

  it('is a no-op on subsequent calls', async () => {
    await migrateIfNeeded();
    const profilesBefore = listProfiles();

    // Reset the id counter but migration flag prevents re-running
    await migrateIfNeeded();
    const profilesAfter = listProfiles();

    expect(profilesAfter).toHaveLength(profilesBefore.length);
  });

  it('uses existing profiles if already present', async () => {
    const existing = seedProfile({ id: 'existing-1', name: 'PreExisting' });
    localStorage.setItem(ACTIVE_PROFILE_KEY, existing.id);

    await migrateIfNeeded();

    const profiles = listProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].name).toBe('PreExisting');
  });
});

// --- onProfileChange / notifyProfileChange ---
describe('onProfileChange / notifyProfileChange', () => {
  it('calls registered listeners when profile changes', () => {
    const listener = vi.fn();
    onProfileChange(listener);

    const profile: Profile = {
      id: 'p1',
      name: 'Test',
      createdAt: '2026-01-01T00:00:00.000Z',
      lastActiveAt: '2026-01-01T00:00:00.000Z',
    };
    notifyProfileChange(profile);

    expect(listener).toHaveBeenCalledWith(profile);
  });

  it('returns an unsubscribe function', () => {
    const listener = vi.fn();
    const unsub = onProfileChange(listener);
    unsub();

    const profile: Profile = {
      id: 'p1',
      name: 'Test',
      createdAt: '2026-01-01T00:00:00.000Z',
      lastActiveAt: '2026-01-01T00:00:00.000Z',
    };
    notifyProfileChange(profile);

    expect(listener).not.toHaveBeenCalled();
  });
});
