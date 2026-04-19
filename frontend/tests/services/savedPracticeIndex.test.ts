/**
 * Unit Tests: savedPracticeIndex
 * Feature 056: Save and Load Practices
 *
 * Constitution Principle V: Test-First Development
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  listSavedPractices,
  addSavedPracticeIndex,
  removeSavedPracticeIndex,
  SAVED_PRACTICES_INDEX_KEY,
  MAX_SAVED_PRACTICES,
} from '../../src/services/savedPracticeIndex';

// Bypass profile scoping so tests use plain localStorage keys
vi.mock('../../src/services/profiles/profileStorage', () => ({
  scopedGetItem: (key: string) => localStorage.getItem(key),
  scopedSetItem: (key: string, val: string) => localStorage.setItem(key, val),
  scopedRemoveItem: (key: string) => localStorage.removeItem(key),
  getActiveProfileId: () => 'test',
}));
import type { SavedPracticeIndexEntry } from '../../src/services/savedPractice.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(overrides: Partial<SavedPracticeIndexEntry> = {}): SavedPracticeIndexEntry {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    name: overrides.name ?? 'Test-RH-all-20260325T120000',
    savedAt: overrides.savedAt ?? new Date().toISOString(),
    completionStatus: overrides.completionStatus ?? 'complete',
    scoreTitle: overrides.scoreTitle ?? 'Test Score',
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('savedPracticeIndex', () => {
  beforeEach(() => {
    localStorage.removeItem(SAVED_PRACTICES_INDEX_KEY);
  });

  describe('listSavedPractices', () => {
    it('returns empty array when no practices saved', () => {
      expect(listSavedPractices()).toEqual([]);
    });

    it('returns practices sorted by savedAt descending (newest first)', () => {
      const older = makeEntry({ savedAt: '2026-03-24T10:00:00.000Z', name: 'older' });
      const newer = makeEntry({ savedAt: '2026-03-25T10:00:00.000Z', name: 'newer' });
      addSavedPracticeIndex(older);
      addSavedPracticeIndex(newer);
      const list = listSavedPractices();
      expect(list[0].name).toBe('newer');
      expect(list[1].name).toBe('older');
    });

    it('handles corrupted localStorage gracefully', () => {
      localStorage.setItem(SAVED_PRACTICES_INDEX_KEY, 'not-json');
      expect(listSavedPractices()).toEqual([]);
    });
  });

  describe('addSavedPracticeIndex', () => {
    it('adds an entry and persists it', () => {
      const entry = makeEntry();
      addSavedPracticeIndex(entry);
      const list = listSavedPractices();
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(entry.id);
    });

    it('returns empty evictedIds when under limit', () => {
      const entry = makeEntry();
      const { evictedIds } = addSavedPracticeIndex(entry);
      expect(evictedIds).toEqual([]);
    });

    it('evicts oldest entries when exceeding MAX_SAVED_PRACTICES', () => {
      // Fill to max
      const entries: SavedPracticeIndexEntry[] = [];
      for (let i = 0; i < MAX_SAVED_PRACTICES; i++) {
        const entry = makeEntry({
          savedAt: new Date(2026, 0, 1, 0, 0, i).toISOString(),
        });
        entries.push(entry);
        addSavedPracticeIndex(entry);
      }

      // Add one more — the oldest should be evicted
      const newEntry = makeEntry({
        savedAt: new Date(2026, 6, 1).toISOString(),
      });
      const { evictedIds } = addSavedPracticeIndex(newEntry);
      expect(evictedIds).toHaveLength(1);
      // The evicted entry should be the oldest one (index 0 — earliest date)
      expect(evictedIds[0]).toBe(entries[0].id);

      const list = listSavedPractices();
      expect(list).toHaveLength(MAX_SAVED_PRACTICES);
      // Newest should be first
      expect(list[0].id).toBe(newEntry.id);
    });
  });

  describe('removeSavedPracticeIndex', () => {
    it('removes an existing entry by ID', () => {
      const entry = makeEntry();
      addSavedPracticeIndex(entry);
      expect(listSavedPractices()).toHaveLength(1);
      removeSavedPracticeIndex(entry.id);
      expect(listSavedPractices()).toHaveLength(0);
    });

    it('is a no-op for non-existent ID', () => {
      const entry = makeEntry();
      addSavedPracticeIndex(entry);
      removeSavedPracticeIndex('non-existent-id');
      expect(listSavedPractices()).toHaveLength(1);
    });
  });
});
