/**
 * savedTrainIndex.ts — localStorage index for saved train metadata.
 * Feature 071: Save and replay train results.
 *
 * Stores lightweight index entries in localStorage so the saved-trains list
 * can be rendered without IndexedDB round-trips.
 * Full train data lives in IndexedDB (savedTrainStorage.ts).
 *
 * No imports from src/ — fully standalone (ESLint plugin API boundary).
 */

import type { SavedTrainIndexEntry } from './trainTypes';

/** localStorage key for the JSON-serialised SavedTrainIndexEntry[] index. */
export const SAVED_TRAINS_INDEX_KEY = 'graditone-saved-trains-index';

/** Maximum number of saved trains to retain in the index. */
export const MAX_SAVED_TRAINS = 50;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function readIndex(): SavedTrainIndexEntry[] {
  try {
    const raw = localStorage.getItem(SAVED_TRAINS_INDEX_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedTrainIndexEntry[];
  } catch {
    return [];
  }
}

function writeIndex(index: SavedTrainIndexEntry[]): void {
  localStorage.setItem(SAVED_TRAINS_INDEX_KEY, JSON.stringify(index));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Return all saved trains, sorted descending by savedAt (newest first). */
export function listSavedTrains(): SavedTrainIndexEntry[] {
  const index = readIndex();
  index.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  return index;
}

/**
 * Add a new entry to the index.
 *
 * Eviction: if the index exceeds MAX_SAVED_TRAINS, the oldest entries are
 * removed. Their IDs are returned so callers can clean up IndexedDB.
 */
export function addSavedTrainIndex(entry: SavedTrainIndexEntry): { evictedIds: string[] } {
  const index = readIndex();
  index.unshift(entry);
  index.sort((a, b) => b.savedAt.localeCompare(a.savedAt));

  const evictedIds: string[] = [];
  while (index.length > MAX_SAVED_TRAINS) {
    const removed = index.pop();
    if (removed) evictedIds.push(removed.id);
  }

  writeIndex(index);
  return { evictedIds };
}

/** Remove an entry by ID. No-op if not found. */
export function removeSavedTrainIndex(id: string): void {
  const index = readIndex().filter((t) => t.id !== id);
  writeIndex(index);
}
