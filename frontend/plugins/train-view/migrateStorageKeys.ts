/**
 * migrateStorageKeys — Feature 036
 *
 * One-time migration: copies practice-* storage keys to train-* keys.
 * Safe to call multiple times (idempotent).
 * Called from index.tsx init() on every plugin startup.
 */

const KEY_MAP: Array<{ old: string; new: string; store: 'local' | 'session' }> = [
  { old: 'practice-complexity-level-v1', new: 'train-complexity-level-v1', store: 'local' },
  { old: 'practice-tips-v1-dismissed', new: 'train-tips-v1-dismissed', store: 'session' },
];

export function migrateStorageKeys(): void {
  for (const { old: oldKey, new: newKey, store } of KEY_MAP) {
    const storage = store === 'local' ? localStorage : sessionStorage;
    if (storage.getItem(newKey) !== null) continue; // already migrated
    const value = storage.getItem(oldKey);
    if (value !== null) {
      storage.setItem(newKey, value);
      storage.removeItem(oldKey);
    }
  }
}
