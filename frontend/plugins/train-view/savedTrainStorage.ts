/**
 * savedTrainStorage.ts — Self-contained IndexedDB storage for saved train results.
 * Feature 071: Save and replay train results.
 *
 * Uses a dedicated 'graditone-train-db' so it does not conflict with the shared
 * graditone-db opened by src/services/storage/local-storage.ts (which the plugin
 * ESLint boundary forbids importing directly from plugin code).
 *
 * No imports from src/ — fully standalone (ESLint plugin API boundary).
 */

import type { SavedTrain } from './trainTypes';

const TRAIN_DB_NAME = 'graditone-train-db';
const TRAIN_DB_VERSION = 1;
const TRAINS_STORE = 'trains';

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

function openTrainDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(TRAIN_DB_NAME, TRAIN_DB_VERSION);
    request.onerror = () =>
      reject(new Error(`Failed to open train DB: ${request.error?.message}`));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(TRAINS_STORE)) {
        const store = db.createObjectStore(TRAINS_STORE, { keyPath: 'id' });
        store.createIndex('savedAt', 'savedAt', { unique: false });
        console.log('[TrainDB] trains object store created');
      }
    };
  });
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/** Save a complete train record to IndexedDB. */
export async function saveTrainToIndexedDB(train: SavedTrain): Promise<void> {
  const db = await openTrainDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const request = db
        .transaction([TRAINS_STORE], 'readwrite')
        .objectStore(TRAINS_STORE)
        .put(train);
      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(new Error(`Failed to save train: ${request.error?.message}`));
    });
    console.log(`[TrainDB] Train ${train.id} saved`);
  } finally {
    db.close();
  }
}

/** Load a train record by ID. Returns null if not found. */
export async function loadTrainFromIndexedDB(id: string): Promise<SavedTrain | null> {
  const db = await openTrainDB();
  try {
    return await new Promise<SavedTrain | null>((resolve, reject) => {
      const request = db
        .transaction([TRAINS_STORE], 'readonly')
        .objectStore(TRAINS_STORE)
        .get(id);
      request.onsuccess = () => resolve((request.result as SavedTrain) ?? null);
      request.onerror = () =>
        reject(new Error(`Failed to load train: ${request.error?.message}`));
    });
  } finally {
    db.close();
  }
}

/** Delete a train record from IndexedDB. */
export async function deleteTrainFromIndexedDB(id: string): Promise<void> {
  const db = await openTrainDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const request = db
        .transaction([TRAINS_STORE], 'readwrite')
        .objectStore(TRAINS_STORE)
        .delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(new Error(`Failed to delete train: ${request.error?.message}`));
    });
    console.log(`[TrainDB] Train ${id} deleted`);
  } finally {
    db.close();
  }
}

// ---------------------------------------------------------------------------
// Name generation
// ---------------------------------------------------------------------------

/**
 * Generate a display name for a saved train.
 * Format: Train-{preset}-{mode}-{YYYYMMDDTHHmmss}
 */
export function generateTrainName(
  config: { preset: string; mode: string; scaleId?: string },
  date: Date,
): string {
  const presetLabel =
    config.preset === 'scales'
      ? `Scale-${config.scaleId ?? 'unknown'}`
      : 'Score';
  const modeLabel = config.mode === 'step' ? 'Step' : 'Flow';
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `Train-${presetLabel}-${modeLabel}-${y}${mo}${d}T${h}${m}${s}`;
}
