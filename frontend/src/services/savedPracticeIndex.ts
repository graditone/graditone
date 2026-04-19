/**
 * savedPracticeIndex.ts — Metadata index for saved practices.
 * Feature 056: Save and Load Practices
 *
 * Stores lightweight display metadata in localStorage (graditone-saved-practices-index).
 * Full practice data lives separately in IndexedDB (via savedPracticeStorage.ts).
 * All functions are synchronous over localStorage.
 */
import type { SavedPracticeIndexEntry } from './savedPractice.types';
import { scopedGetItem, scopedSetItem } from './profiles/profileStorage';

/** localStorage key for the JSON-serialised SavedPracticeIndexEntry[] index. */
export const SAVED_PRACTICES_INDEX_KEY = 'graditone-saved-practices-index';

/** Maximum number of saved practices to keep. Oldest are evicted first. */
export const MAX_SAVED_PRACTICES = 100;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function readIndex(): SavedPracticeIndexEntry[] {
  try {
    const raw = scopedGetItem(SAVED_PRACTICES_INDEX_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedPracticeIndexEntry[];
  } catch {
    return [];
  }
}

function writeIndex(index: SavedPracticeIndexEntry[]): void {
  scopedSetItem(SAVED_PRACTICES_INDEX_KEY, JSON.stringify(index));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return all saved practices, sorted descending by savedAt (newest first).
 */
export function listSavedPractices(): SavedPracticeIndexEntry[] {
  const index = readIndex();
  // Ensure sorted newest-first (should already be, but defensive)
  index.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  return index;
}

/**
 * Add a new entry to the index.
 *
 * Eviction: if the index exceeds MAX_SAVED_PRACTICES, the oldest entries are
 * removed. Their IDs are returned so callers can clean up IndexedDB.
 *
 * @returns Object with any evicted practice IDs.
 */
export function addSavedPracticeIndex(
  entry: SavedPracticeIndexEntry,
): { evictedIds: string[] } {
  const index = readIndex();

  // Insert at head (newest first)
  index.unshift(entry);

  // Re-sort newest first
  index.sort((a, b) => b.savedAt.localeCompare(a.savedAt));

  // Evict oldest entries beyond the limit
  const evictedIds: string[] = [];
  while (index.length > MAX_SAVED_PRACTICES) {
    const removed = index.pop();
    if (removed) evictedIds.push(removed.id);
  }

  writeIndex(index);
  return { evictedIds };
}

/**
 * Remove an entry by ID. No-op if not found.
 */
export function removeSavedPracticeIndex(id: string): void {
  const index = readIndex().filter((p) => p.id !== id);
  writeIndex(index);
}
