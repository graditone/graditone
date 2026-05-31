/**
 * savedPracticeStorage.ts — IndexedDB storage for full practice data.
 * Feature 056: Save and Load Practices
 *
 * Stores and retrieves complete SavedPractice records in the IndexedDB `practices` store.
 * Uses the shared openDB() from local-storage.ts (DB version 2).
 */
import { openDB } from './storage/local-storage';
import type { SavedPractice } from './savedPractice.types';

const PRACTICES_STORE = 'practices';

// ---------------------------------------------------------------------------
// IndexedDB CRUD
// ---------------------------------------------------------------------------

/** Save full practice data to IndexedDB 'practices' store. */
export async function savePracticeToIndexedDB(practice: SavedPractice): Promise<void> {
  const db = await openDB();
  try {
    const tx = db.transaction([PRACTICES_STORE], 'readwrite');
    const store = tx.objectStore(PRACTICES_STORE);
    await new Promise<void>((resolve, reject) => {
      const request = store.put(practice);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to save practice: ${request.error?.message}`));
    });
    console.log(`[IndexedDB] Practice ${practice.id} saved successfully`);
  } finally {
    db.close();
  }
}

/** Load full practice data by ID. Returns null if not found. */
export async function loadPracticeFromIndexedDB(id: string): Promise<SavedPractice | null> {
  const db = await openDB();
  try {
    const tx = db.transaction([PRACTICES_STORE], 'readonly');
    const store = tx.objectStore(PRACTICES_STORE);
    const record = await new Promise<SavedPractice | null>((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve((request.result as SavedPractice) ?? null);
      request.onerror = () => reject(new Error(`Failed to load practice: ${request.error?.message}`));
    });
    return record;
  } finally {
    db.close();
  }
}

/** Delete a practice from IndexedDB by ID. */
export async function deletePracticeFromIndexedDB(id: string): Promise<void> {
  const db = await openDB();
  try {
    const tx = db.transaction([PRACTICES_STORE], 'readwrite');
    const store = tx.objectStore(PRACTICES_STORE);
    await new Promise<void>((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to delete practice: ${request.error?.message}`));
    });
    console.log(`[IndexedDB] Practice ${id} deleted`);
  } finally {
    db.close();
  }
}

// ---------------------------------------------------------------------------
// Name Generation (pure function)
// ---------------------------------------------------------------------------

/**
 * Generate the practice name per FR-002.
 *
 * Format: {sanitized_title}-{RH|LH|BH}-{all|region}-{YYYYMMDDTHHmmss}
 *
 * @param scoreTitle  - Display title of the score.
 * @param staffIndex  - 0 = RH, 1 = LH, -1 = BH.
 * @param loopRegion  - Non-null when a loop region is active.
 * @param date        - Date/time of saving (local time).
 */
export function generatePracticeName(
  scoreTitle: string,
  staffIndex: number,
  loopRegion: { startTick: number; endTick: number } | null,
  date: Date,
): string {
  // Sanitize: replace spaces with underscores, remove non-alphanumeric (except underscores), truncate
  const sanitized = scoreTitle
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_]/g, '')
    .slice(0, 50);

  // Map staff index to hand label
  const hand = staffIndex === 0 ? 'RH' : staffIndex === 1 ? 'LH' : 'BH';

  // Scope
  const scope = loopRegion ? 'region' : 'all';

  // Datetime in compact ISO-like local format: YYYYMMDDTHHmmss
  const pad = (n: number) => String(n).padStart(2, '0');
  const datetime =
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `T${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;

  return `${sanitized}-${hand}-${scope}-${datetime}`;
}

/**
 * Generate a name for a free practice session (Feature 092).
 *
 * Format: FreePractice-{YYYYMMDDTHHmmss}
 *
 * @param date - Date/time of saving (local time).
 */
export function generateFreePracticeName(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const datetime =
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `T${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `FreePractice-${datetime}`;
}
