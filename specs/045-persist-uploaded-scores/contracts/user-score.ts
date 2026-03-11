// contracts/user-score.ts
// TypeScript interface contract for UserScore
// Canonical source: specs/045-persist-uploaded-scores/contracts/user-score.ts
// Implementation target: frontend/src/services/userScoreIndex.ts

/**
 * Lightweight display metadata for a user-uploaded score.
 * Persisted to localStorage key 'graditone-user-scores-index' as JSON array.
 * Full Score data is stored separately in IndexedDB via ScoreCache.
 */
export interface UserScore {
  /** UUID assigned by WASM during MusicXML parse. Matches the Score.id in IndexedDB. */
  id: string;

  /**
   * Human-readable name displayed in "My Scores" section of the score picker.
   * Derived from work_title (if available) or filename without extension.
   * Deduplication suffix appended when the same base name already exists:
   * e.g. "MySong.mxl", "MySong (2).mxl", "MySong (3).mxl"
   */
  displayName: string;

  /** ISO 8601 timestamp of when the score was uploaded and persisted. */
  uploadedAt: string;
}

/**
 * The localStorage key used to store the metadata index.
 * Value is JSON.stringify(UserScore[]), sorted descending by uploadedAt.
 */
export const USER_SCORES_INDEX_KEY = 'graditone-user-scores-index';

/**
 * A UserScore entry as it appears in the "My Scores" list UI.
 * Extends UserScore with UI interaction callbacks.
 */
export interface UserScoreListEntry extends UserScore {
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}
