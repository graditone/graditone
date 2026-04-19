/**
 * Feature 080 — User Profile Support
 * Unit tests for profileStorage.ts
 * Constitution: V. Test-First Development
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getActiveProfileId,
  setActiveProfileId,
  scopedGetItem,
  scopedSetItem,
  scopedRemoveItem,
  migrateKeyToProfile,
  removeAllScopedKeys,
  PROFILES_KEY,
  ACTIVE_PROFILE_KEY,
} from './profileStorage';

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
});

describe('profileStorage constants', () => {
  it('exports expected key constants', () => {
    expect(PROFILES_KEY).toBe('graditone-profiles');
    expect(ACTIVE_PROFILE_KEY).toBe('graditone-active-profile');
  });
});

describe('getActiveProfileId / setActiveProfileId', () => {
  it('returns empty string when no active profile is set', () => {
    expect(getActiveProfileId()).toBe('');
  });

  it('returns the stored active profile id', () => {
    setActiveProfileId('abc-123');
    expect(getActiveProfileId()).toBe('abc-123');
  });

  it('overwrites the active profile id', () => {
    setActiveProfileId('first');
    setActiveProfileId('second');
    expect(getActiveProfileId()).toBe('second');
  });
});

describe('scopedGetItem', () => {
  it('returns null when no active profile is set', () => {
    expect(scopedGetItem('some-key')).toBeNull();
  });

  it('returns null when the scoped key does not exist', () => {
    setActiveProfileId('p1');
    expect(scopedGetItem('missing-key')).toBeNull();
  });

  it('returns the scoped value for the active profile', () => {
    setActiveProfileId('p1');
    localStorage.setItem('profile:p1:volume', '0.8');
    expect(scopedGetItem('volume')).toBe('0.8');
  });

  it('does not leak values between profiles', () => {
    setActiveProfileId('p1');
    scopedSetItem('volume', '0.8');

    setActiveProfileId('p2');
    expect(scopedGetItem('volume')).toBeNull();
  });
});

describe('scopedSetItem', () => {
  it('does nothing when no active profile is set', () => {
    scopedSetItem('key', 'value');
    expect(localStorage.length).toBe(0);
  });

  it('stores a value scoped to the active profile', () => {
    setActiveProfileId('p1');
    scopedSetItem('volume', '0.5');
    expect(localStorage.getItem('profile:p1:volume')).toBe('0.5');
  });
});

describe('scopedRemoveItem', () => {
  it('does nothing when no active profile is set', () => {
    localStorage.setItem('profile:p1:key', 'value');
    scopedRemoveItem('key');
    expect(localStorage.getItem('profile:p1:key')).toBe('value');
  });

  it('removes the scoped key for the active profile', () => {
    setActiveProfileId('p1');
    scopedSetItem('volume', '0.5');
    scopedRemoveItem('volume');
    expect(scopedGetItem('volume')).toBeNull();
  });
});

describe('migrateKeyToProfile', () => {
  it('moves an unscoped key to a scoped key', () => {
    localStorage.setItem('graditone-user-scores-index', '["score1"]');
    migrateKeyToProfile('p1', 'graditone-user-scores-index');

    expect(localStorage.getItem('graditone-user-scores-index')).toBeNull();
    expect(localStorage.getItem('profile:p1:graditone-user-scores-index')).toBe('["score1"]');
  });

  it('does nothing if the unscoped key does not exist', () => {
    migrateKeyToProfile('p1', 'nonexistent');
    expect(localStorage.getItem('profile:p1:nonexistent')).toBeNull();
  });
});

describe('removeAllScopedKeys', () => {
  it('removes all keys for a given profile', () => {
    localStorage.setItem('profile:p1:volume', '0.5');
    localStorage.setItem('profile:p1:scores', '[]');
    localStorage.setItem('profile:p2:volume', '0.9');
    localStorage.setItem('unscoped-key', 'keep');

    removeAllScopedKeys('p1');

    expect(localStorage.getItem('profile:p1:volume')).toBeNull();
    expect(localStorage.getItem('profile:p1:scores')).toBeNull();
    // Other profile and unscoped keys are untouched
    expect(localStorage.getItem('profile:p2:volume')).toBe('0.9');
    expect(localStorage.getItem('unscoped-key')).toBe('keep');
  });

  it('does nothing if no keys exist for the profile', () => {
    localStorage.setItem('unscoped', 'value');
    removeAllScopedKeys('nonexistent');
    expect(localStorage.getItem('unscoped')).toBe('value');
  });
});
