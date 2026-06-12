// Feature 011: Local Score Storage using IndexedDB
// Provides offline persistence for scores using browser IndexedDB

import type { Score } from '../../types/score';
import { getActiveProfileId } from '../profiles/profileStorage';

const DB_NAME = 'graditone-db';
const DB_VERSION = 5;
const SCORES_STORE = 'scores';
const PRACTICES_STORE = 'practices';
const SESSIONS_STORE = 'sessions';
const GOALS_STORE = 'goals';

/** Result from loadScoreFromIndexedDB when the cached schema is stale but a raw blob exists. */
export interface StaleScoreResult {
  readonly kind: 'stale';
  readonly rawMxlBlob: ArrayBuffer;
}

/** Successful score load. */
export interface LoadedScoreResult {
  readonly kind: 'loaded';
  readonly score: Score;
}

/** Score not found at all. */
export interface NotFoundScoreResult {
  readonly kind: 'not-found';
}

export type ScoreLoadResult = LoadedScoreResult | StaleScoreResult | NotFoundScoreResult;

/**
 * Initialize IndexedDB database
 * @returns Promise<IDBDatabase>
 */
export async function openDB(): Promise<IDBDatabase> {
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

      // Feature 056: Create practices object store if it doesn't exist
      if (!db.objectStoreNames.contains(PRACTICES_STORE)) {
        const practicesStore = db.createObjectStore(PRACTICES_STORE, { keyPath: 'id' });
        practicesStore.createIndex('savedAt', 'savedAt', { unique: false });
        console.log('[IndexedDB] Practices object store created');
      }

      // Feature 060: Create sessions object store if it doesn't exist
      if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
        const sessionsStore = db.createObjectStore(SESSIONS_STORE, { keyPath: 'id' });
        sessionsStore.createIndex('createdAt', 'createdAt', { unique: false });
        sessionsStore.createIndex('status', 'status', { unique: false });
        console.log('[IndexedDB] Sessions object store created');
      }

      // Feature 067: Create goals object store if it doesn't exist
      if (!db.objectStoreNames.contains(GOALS_STORE)) {
        const goalsStore = db.createObjectStore(GOALS_STORE, { keyPath: 'id' });
        goalsStore.createIndex('createdAt', 'createdAt', { unique: false });
        goalsStore.createIndex('status', 'status', { unique: false });
        console.log('[IndexedDB] Goals object store created');
      }

      // Feature 080: Add profileId index to all stores (v4 → v5)
      const allStores = [SCORES_STORE, PRACTICES_STORE, SESSIONS_STORE, GOALS_STORE];
      for (const storeName of allStores) {
        if (db.objectStoreNames.contains(storeName)) {
          const store = (event.target as IDBOpenDBRequest).transaction!.objectStore(storeName);
          if (!store.indexNames.contains('profileId')) {
            store.createIndex('profileId', 'profileId', { unique: false });
            console.log(`[IndexedDB] profileId index added to ${storeName}`);
          }
        }
      }
    };
  });
}

/**
 * Save a score to IndexedDB, optionally with the original MXL blob.
 * When rawMxlBlob is provided the blob is stored alongside the parsed score
 * so that stale-schema scores can be re-parsed from the original file.
 */
export async function saveScoreToIndexedDB(score: Score, rawMxlBlob?: ArrayBuffer): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction([SCORES_STORE], 'readwrite');
    const store = transaction.objectStore(SCORES_STORE);

    // Add metadata for tracking
    const record: Record<string, unknown> = {
      ...score,
      lastModified: new Date().toISOString(),
      profileId: getActiveProfileId(),
    };
    if (rawMxlBlob) {
      record.rawMxlBlob = rawMxlBlob;
    }

    await new Promise<void>((resolve, reject) => {
      const request = store.put(record);
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
 * Load a score from IndexedDB.
 *
 * Returns a discriminated-union result:
 * - `loaded`   — schema is current, score is ready to use.
 * - `stale`    — schema is outdated but a rawMxlBlob is available for re-parse.
 * - `not-found`— no record for this ID.
 */
export async function loadScoreFromIndexedDB(scoreId: string, currentSchemaVersion: number): Promise<ScoreLoadResult> {
  try {
    const db = await openDB();
    const transaction = db.transaction([SCORES_STORE], 'readonly');
    const store = transaction.objectStore(SCORES_STORE);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record = await new Promise<any>((resolve, reject) => {
      const request = store.get(scoreId);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(new Error(`Failed to load score: ${request.error?.message}`));
    });

    db.close();

    if (!record) return { kind: 'not-found' };

    const scoreVersion: number = record.schema_version ?? 1;

    if (scoreVersion < currentSchemaVersion) {
      // Schema is stale — if we have the original blob, offer it for re-parse
      if (record.rawMxlBlob instanceof ArrayBuffer) {
        console.warn(`[IndexedDB] Score ${scoreId} schema v${scoreVersion} stale (current: v${currentSchemaVersion}), raw blob available for re-parse`);
        return { kind: 'stale', rawMxlBlob: record.rawMxlBlob };
      }
      // No blob — delete the useless record and report not found
      console.warn(`[IndexedDB] Score ${scoreId} schema v${scoreVersion} stale, no raw blob — deleting`);
      await deleteScoreFromIndexedDB(scoreId);
      return { kind: 'not-found' };
    }

    console.log(`[IndexedDB] Score ${scoreId} loaded successfully`);
    // Strip internal metadata before returning
    const { lastModified: _lm, rawMxlBlob: _blob, ...scoreOnly } = record;
    return { kind: 'loaded', score: scoreOnly as Score };
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
    const profileId = getActiveProfileId();

    let keys: string[];
    if (profileId && store.indexNames.contains('profileId')) {
      const index = store.index('profileId');
      const records = await new Promise<Score[]>((resolve, reject) => {
        const request = index.getAll(profileId);
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(new Error(`Failed to list scores: ${request.error?.message}`));
      });
      keys = records.map(r => r.id);
    } else {
      keys = await new Promise<string[]>((resolve, reject) => {
        const request = store.getAllKeys();
        request.onsuccess = () => resolve(request.result as string[]);
        request.onerror = () => reject(new Error(`Failed to list scores: ${request.error?.message}`));
      });
    }

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
 */
export async function getAllScoresFromIndexedDB(currentSchemaVersion: number): Promise<Score[]> {
  try {
    const db = await openDB();
    const transaction = db.transaction([SCORES_STORE], 'readonly');
    const store = transaction.objectStore(SCORES_STORE);
    const profileId = getActiveProfileId();

    let allScores: Score[];
    if (profileId && store.indexNames.contains('profileId')) {
      const index = store.index('profileId');
      allScores = await new Promise<Score[]>((resolve, reject) => {
        const request = index.getAll(profileId);
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(new Error(`Failed to get all scores: ${request.error?.message}`));
      });
    } else {
      allScores = await new Promise<Score[]>((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(new Error(`Failed to get all scores: ${request.error?.message}`));
      });
    }

    // Filter out incompatible schema versions
    const compatibleScores: Score[] = [];
    const incompatibleScores: Score[] = [];

    for (const score of allScores) {
      const scoreVersion = score.schema_version ?? 1;
      const isCompatible = scoreVersion >= currentSchemaVersion;
      
      if (isCompatible) {
        compatibleScores.push(score);
      } else {
        incompatibleScores.push(score);
        console.warn(`[IndexedDB] Score ${score.id} has incompatible schema v${scoreVersion} (current: v${currentSchemaVersion})`);
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
