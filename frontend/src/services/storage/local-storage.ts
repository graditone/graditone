// Feature 011: Local Score Storage using IndexedDB
// Provides offline persistence for scores using browser IndexedDB

import type { Score } from '../../types/score';

const DB_NAME = 'graditone-db';
const DB_VERSION = 1;
const SCORES_STORE = 'scores';

/**
 * Current schema version - must match backend SCORE_SCHEMA_VERSION
 * Increment when data structure changes (e.g., v2 added active_clef)
 * v4: repeat_barlines added
 * v6: pickup_ticks added for anacrusis/pickup measure support
 */
export const CURRENT_SCHEMA_VERSION = 9;

/**
 * Initialize IndexedDB database
 * @returns Promise<IDBDatabase>
 */
async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create scores object store if it doesn't exist
      if (!db.objectStoreNames.contains(SCORES_STORE)) {
        const objectStore = db.createObjectStore(SCORES_STORE, { keyPath: 'id' });
        objectStore.createIndex('lastModified', 'lastModified', { unique: false });
        console.log('[IndexedDB] Scores object store created');
      }
    };
  });
}

/**
 * Save a score to IndexedDB
 * @param score - Score object to save
 * @returns Promise<void>
 */
export async function saveScoreToIndexedDB(score: Score): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction([SCORES_STORE], 'readwrite');
    const store = transaction.objectStore(SCORES_STORE);

    // Add metadata for tracking
    const scoreWithMetadata = {
      ...score,
      lastModified: new Date().toISOString(),
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.put(scoreWithMetadata);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to save score: ${request.error?.message}`));
    });

    db.close();
    console.log(`[IndexedDB] Score ${score.id} saved successfully`);
  } catch (error) {
    console.error('[IndexedDB] Error saving score:', error);
    throw error;
  }
}

/**
 * Load a score from IndexedDB
 * Returns null if score has incompatible schema version
 * @param scoreId - UUID of the score to load
 * @returns Promise<Score | null>
 */
export async function loadScoreFromIndexedDB(scoreId: string): Promise<Score | null> {
  try {
    const db = await openDB();
    const transaction = db.transaction([SCORES_STORE], 'readonly');
    const store = transaction.objectStore(SCORES_STORE);

    const score = await new Promise<Score | null>((resolve, reject) => {
      const request = store.get(scoreId);
      request.onsuccess = () => {
        const result = request.result;
        resolve(result || null);
      };
      request.onerror = () => reject(new Error(`Failed to load score: ${request.error?.message}`));
    });

    db.close();

    if (score) {
      const scoreVersion = score.schema_version ?? 1;
      
      // If old schema, delete it and return null to force re-fetch
      // Migration is unreliable without complete ClefEvent data
      if (scoreVersion < CURRENT_SCHEMA_VERSION) {
        console.warn(`[IndexedDB] Score ${scoreId} has incompatible schema v${scoreVersion} (current: v${CURRENT_SCHEMA_VERSION})`);
        console.warn('[IndexedDB] Deleting cached score to force re-fetch with correct schema');
        await deleteScoreFromIndexedDB(scoreId);
        return null;
      }

      console.log(`[IndexedDB] Score ${scoreId} loaded successfully`);
      // Remove metadata before returning
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { lastModified: _lastModified, ...scoreWithoutMetadata } = score as Score & { lastModified?: string };
      return scoreWithoutMetadata;
    }

    return null;
  } catch (error) {
    console.error('[IndexedDB] Error loading score:', error);
    throw error;
  }
}

/**
 * Get all score IDs from IndexedDB
 * @returns Promise<string[]>
 */
export async function listScoreIdsFromIndexedDB(): Promise<string[]> {
  try {
    const db = await openDB();
    const transaction = db.transaction([SCORES_STORE], 'readonly');
    const store = transaction.objectStore(SCORES_STORE);

    const keys = await new Promise<string[]>((resolve, reject) => {
      const request = store.getAllKeys();
      request.onsuccess = () => resolve(request.result as string[]);
      request.onerror = () => reject(new Error(`Failed to list scores: ${request.error?.message}`));
    });

    db.close();
    console.log(`[IndexedDB] Found ${keys.length} cached scores`);
    return keys;
  } catch (error) {
    console.error('[IndexedDB] Error listing scores:', error);
    throw error;
  }
}

/**
 * Get all scores from IndexedDB WITHOUT schema filtering
 * Internal use only - for cleanup operations that need to see all scores
 * @returns Promise<Score[]>
 */
export async function getAllScoresFromIndexedDBUnfiltered(): Promise<Score[]> {
  try {
    const db = await openDB();
    const transaction = db.transaction([SCORES_STORE], 'readonly');
    const store = transaction.objectStore(SCORES_STORE);

    const allScores = await new Promise<Score[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(new Error(`Failed to get all scores: ${request.error?.message}`));
    });

    db.close();
    console.log(`[IndexedDB] Retrieved ${allScores.length} scores (unfiltered)`);
    return allScores;
  } catch (error) {
    console.error('[IndexedDB] Error getting all scores:', error);
    throw error;
  }
}

/**
 * Get all scores from IndexedDB
 * Feature 013: Added for demo score detection
 * Filters out scores with incompatible schema versions
 * @returns Promise<Score[]>
 */
export async function getAllScoresFromIndexedDB(): Promise<Score[]> {
  try {
    const db = await openDB();
    const transaction = db.transaction([SCORES_STORE], 'readonly');
    const store = transaction.objectStore(SCORES_STORE);

    const allScores = await new Promise<Score[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(new Error(`Failed to get all scores: ${request.error?.message}`));
    });

    // Filter out incompatible schema versions
    const compatibleScores: Score[] = [];
    const incompatibleScores: Score[] = [];

    for (const score of allScores) {
      const scoreVersion = score.schema_version ?? 1;
      const isCompatible = scoreVersion >= CURRENT_SCHEMA_VERSION;
      
      if (isCompatible) {
        compatibleScores.push(score);
      } else {
        incompatibleScores.push(score);
        console.warn(`[IndexedDB] Score ${score.id} has incompatible schema v${scoreVersion} (current: v${CURRENT_SCHEMA_VERSION})`);
      }
    }

    if (incompatibleScores.length > 0) {
      console.warn(`[IndexedDB] Found ${incompatibleScores.length} score(s) with old schema - they will be hidden`);
      console.warn('[IndexedDB] Re-import MusicXML files to get updated schema with new features');
    }

    db.close();
    console.log(`[IndexedDB] Retrieved ${compatibleScores.length} compatible scores (${incompatibleScores.length} filtered)`);
    return compatibleScores;
  } catch (error) {
    console.error('[IndexedDB] Error getting all scores:', error);
    throw error;
  }
}

/**
 * Delete a score from IndexedDB
 * @param scoreId - UUID of the score to delete
 * @returns Promise<void>
 */
export async function deleteScoreFromIndexedDB(scoreId: string): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction([SCORES_STORE], 'readwrite');
    const store = transaction.objectStore(SCORES_STORE);

    await new Promise<void>((resolve, reject) => {
      const request = store.delete(scoreId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to delete score: ${request.error?.message}`));
    });

    db.close();
    console.log(`[IndexedDB] Score ${scoreId} deleted successfully`);
  } catch (error) {
    console.error('[IndexedDB] Error deleting score:', error);
    throw error;
  }
}

/**
 * Clear all scores from IndexedDB (for testing/debugging)
 * @returns Promise<void>
 */
export async function clearAllScoresFromIndexedDB(): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction([SCORES_STORE], 'readwrite');
    const store = transaction.objectStore(SCORES_STORE);

    await new Promise<void>((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to clear scores: ${request.error?.message}`));
    });

    db.close();
    console.log('[IndexedDB] All scores cleared');
  } catch (error) {
    console.error('[IndexedDB] Error clearing scores:', error);
    throw error;
  }
}
