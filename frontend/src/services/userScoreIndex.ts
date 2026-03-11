/**
 * userScoreIndex.ts — Metadata index for user-uploaded scores.
 * Feature 045: Persist Uploaded Scores
 *
 * Stores lightweight display metadata in localStorage (graditone-user-scores-index).
 * Full Score data lives separately in IndexedDB (via ScoreCache / saveScoreToIndexedDB).
 * All functions are synchronous over localStorage.
 */

/** Lightweight display metadata for a user-uploaded score. */
export interface UserScore {
  /** UUID assigned by WASM during MusicXML parse. Matches Score.id in IndexedDB. */
  id: string;
  /**
   * Human-readable name shown in "My Scores" section.
   * Derived from work_title (if available) or filename without extension.
   * Numeric suffix appended for duplicate base names: "Song", "Song (2)", "Song (3)".
   */
  displayName: string;
  /** ISO 8601 timestamp of when the score was uploaded. */
  uploadedAt: string;
}

/** localStorage key for the JSON-serialised UserScore[] index. */
export const USER_SCORES_INDEX_KEY = 'graditone-user-scores-index';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function readIndex(): UserScore[] {
  try {
    const raw = localStorage.getItem(USER_SCORES_INDEX_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as UserScore[];
  } catch {
    return [];
  }
}

function writeIndex(index: UserScore[]): void {
  localStorage.setItem(USER_SCORES_INDEX_KEY, JSON.stringify(index));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return all user scores, sorted descending by uploadedAt (newest first).
 */
export function listUserScores(): UserScore[] {
  return readIndex();
}

/**
 * Add a new score entry to the index.
 *
 * Deduplication: if an entry with the same base display name already exists,
 * a numeric suffix is appended: "Song", "Song (2)", "Song (3)", …
 *
 * @param id - UUID of the score (matches IndexedDB key).
 * @param rawDisplayName - Proposed display name (work_title or filename).
 * @returns The newly created UserScore entry.
 */
export function addUserScore(id: string, rawDisplayName: string): UserScore {
  const index = readIndex();
  const displayName = deduplicateName(rawDisplayName, index);
  const entry: UserScore = {
    id,
    displayName,
    uploadedAt: new Date().toISOString(),
  };
  // Insert at head (newest first)
  index.unshift(entry);
  writeIndex(index);
  return entry;
}

/**
 * Remove a score entry from the index by id.
 * No-op if the id is not found.
 */
export function removeUserScore(id: string): void {
  const index = readIndex().filter((s) => s.id !== id);
  writeIndex(index);
}

/**
 * Retrieve a single score entry by id.
 * Returns undefined if not found.
 */
export function getUserScore(id: string): UserScore | undefined {
  return readIndex().find((s) => s.id === id);
}

// ---------------------------------------------------------------------------
// Deduplication helper
// ---------------------------------------------------------------------------

/**
 * Given a proposed name and the current index, return a unique display name.
 * If the base name already exists, appends " (N)" for N = 2, 3, …
 */
function deduplicateName(rawName: string, index: UserScore[]): string {
  const existingNames = new Set(index.map((s) => s.displayName));
  if (!existingNames.has(rawName)) return rawName;

  let counter = 2;
  while (existingNames.has(`${rawName} (${counter})`)) {
    counter++;
  }
  return `${rawName} (${counter})`;
}
