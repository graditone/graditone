/**
 * userScoreIndex.test.ts — Unit tests for the user score metadata index service.
 * Feature 045: Persist Uploaded Scores — T004
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  listUserScores,
  addUserScore,
  removeUserScore,
  getUserScore,
  USER_SCORES_INDEX_KEY,
} from '../../services/userScoreIndex';

// ── localStorage mock ──────────────────────────────────────────────────────
// vitest's happy-dom environment usually provides localStorage,
// but we reset it before each test for isolation.
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

beforeEach(() => {
  // Replace global localStorage with our controllable mock
  vi.stubGlobal('localStorage', localStorageMock);
  localStorageMock.clear();
});

describe('listUserScores', () => {
  it('returns [] when localStorage is empty', () => {
    expect(listUserScores()).toEqual([]);
  });

  it('returns the stored entries', () => {
    addUserScore('id-1', 'Score A');
    addUserScore('id-2', 'Score B');
    const result = listUserScores();
    expect(result).toHaveLength(2);
  });

  it('returns entries sorted newest-first', () => {
    addUserScore('id-1', 'Old Score');
    addUserScore('id-2', 'New Score');
    const result = listUserScores();
    expect(result[0].id).toBe('id-2');
    expect(result[1].id).toBe('id-1');
  });
});

describe('addUserScore', () => {
  it('adds an entry and returns it', () => {
    const entry = addUserScore('abc-123', 'My Sonata');
    expect(entry.id).toBe('abc-123');
    expect(entry.displayName).toBe('My Sonata');
    expect(entry.uploadedAt).toBeTruthy();
    expect(listUserScores()).toHaveLength(1);
  });

  it('stores uploadedAt as ISO 8601 string', () => {
    const before = new Date().toISOString();
    const entry = addUserScore('id-x', 'Test');
    const after = new Date().toISOString();
    expect(entry.uploadedAt >= before).toBe(true);
    expect(entry.uploadedAt <= after).toBe(true);
  });

  it('deduplicates display name with numeric suffix when same base name exists', () => {
    addUserScore('id-1', 'Nocturne');
    const second = addUserScore('id-2', 'Nocturne');
    expect(second.displayName).toBe('Nocturne (2)');
    const third = addUserScore('id-3', 'Nocturne');
    expect(third.displayName).toBe('Nocturne (3)');
  });

  it('does not suffix when base name is unique', () => {
    addUserScore('id-1', 'Nocturne');
    const entry = addUserScore('id-2', 'Arabesque');
    expect(entry.displayName).toBe('Arabesque');
  });

  it('persists the index to localStorage', () => {
    addUserScore('id-1', 'Waltz');
    const raw = localStorageMock.getItem(USER_SCORES_INDEX_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed[0].id).toBe('id-1');
  });
});

describe('removeUserScore', () => {
  it('removes an entry by id', () => {
    addUserScore('id-1', 'To Remove');
    addUserScore('id-2', 'To Keep');
    removeUserScore('id-1');
    const remaining = listUserScores();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('id-2');
  });

  it('is a no-op when id is not found', () => {
    addUserScore('id-1', 'Score');
    removeUserScore('nonexistent');
    expect(listUserScores()).toHaveLength(1);
  });

  it('results in an empty list when the last entry is removed', () => {
    addUserScore('id-1', 'Last');
    removeUserScore('id-1');
    expect(listUserScores()).toEqual([]);
  });
});

describe('getUserScore', () => {
  it('returns the entry when found', () => {
    addUserScore('id-1', 'Found Me');
    const entry = getUserScore('id-1');
    expect(entry).toBeDefined();
    expect(entry!.displayName).toBe('Found Me');
  });

  it('returns undefined when not found', () => {
    expect(getUserScore('missing')).toBeUndefined();
  });
});

describe('index stored sorted descending', () => {
  it('newest entry is always at index 0', () => {
    const first = addUserScore('id-1', 'First');
    const second = addUserScore('id-2', 'Second');
    const third = addUserScore('id-3', 'Third');
    const list = listUserScores();
    expect(list[0].id).toBe(third.id);
    expect(list[1].id).toBe(second.id);
    expect(list[2].id).toBe(first.id);
  });
});
