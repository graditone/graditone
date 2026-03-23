// Feature 011: Score Caching Service
// Automatically saves scores to IndexedDB for offline persistence

import type { Score } from '../types/score';
import type { ScoreLoadResult } from './storage/local-storage';
import {
  saveScoreToIndexedDB,
  loadScoreFromIndexedDB,
  listScoreIdsFromIndexedDB,
  deleteScoreFromIndexedDB,
} from './storage/local-storage';

/**
 * Cache strategy for score persistence
 */
export class ScoreCache {
  /**
   * Save score to cache (IndexedDB), optionally with the raw MXL blob
   * so that stale-schema scores can be re-parsed later.
   */
  static async cache(score: Score, rawMxlBlob?: ArrayBuffer): Promise<void> {
    try {
      await saveScoreToIndexedDB(score, rawMxlBlob);
      console.log(`[ScoreCache] Score ${score.id} cached successfully`);
    } catch (error) {
      console.error('[ScoreCache] Failed to cache score:', error);
      // Don't throw - caching failure shouldn't break the app
    }
  }

  /**
   * Get score from cache (schema-aware).
   * Returns a discriminated-union result: loaded | stale | not-found.
   */
  static async get(scoreId: string, currentSchemaVersion: number): Promise<ScoreLoadResult> {
    try {
      return await loadScoreFromIndexedDB(scoreId, currentSchemaVersion);
    } catch (error) {
      console.error('[ScoreCache] Failed to retrieve score from cache:', error);
      return { kind: 'not-found' };
    }
  }

  /**
   * List all cached score IDs
   * @returns Array of score UUIDs
   */
  static async list(): Promise<string[]> {
    try {
      return await listScoreIdsFromIndexedDB();
    } catch (error) {
      console.error('[ScoreCache] Failed to list cached scores:', error);
      return [];
    }
  }

  /**
   * Remove score from cache
   * @param scoreId - UUID of score to remove
   */
  static async remove(scoreId: string): Promise<void> {
    try {
      await deleteScoreFromIndexedDB(scoreId);
      console.log(`[ScoreCache] Score ${scoreId} removed from cache`);
    } catch (error) {
      console.error('[ScoreCache] Failed to remove score from cache:', error);
    }
  }

  /**
   * Check if a score is cached and compatible
   */
  static async has(scoreId: string, currentSchemaVersion: number): Promise<boolean> {
    const result = await ScoreCache.get(scoreId, currentSchemaVersion);
    return result.kind === 'loaded';
  }
}

/**
 * Hook for automatic score caching
 * Call this whenever a score is loaded or modified
 * 
 * @param score - Current score to cache (or null if no score loaded)
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const [score, setScore] = useState<Score | null>(null);
 *   
 *   useEffect(() => {
 *     if (score) {
 *       ScoreCache.cache(score);
 *     }
 *   }, [score]);
 * }
 * ```
 */
export function useScorecache(score: Score | null): void {
  // Implementation would go here using useEffect
  // Kept as separate export for potential future use
  if (score) {
    ScoreCache.cache(score);
  }
}
