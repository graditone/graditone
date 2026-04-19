/**
 * userScoreIndex.ts — Metadata index for user-uploaded scores.
 * Feature 045: Persist Uploaded Scores
 *
 * Stores lightweight display metadata in localStorage (graditone-user-scores-index).
 * Full Score data lives separately in IndexedDB (via ScoreCache / saveScoreToIndexedDB).
 * All functions are synchronous over localStorage.
 */
import type { DifficultyLevel } from '../types/score';
import { scopedGetItem, scopedSetItem } from './profiles/profileStorage';

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
  /** Difficulty level computed from note density (Feature 055). Absent for legacy entries. */
  difficulty_level?: DifficultyLevel;
}

/** localStorage key for the JSON-serialised UserScore[] index. */
export const USER_SCORES_INDEX_KEY = 'graditone-user-scores-index';

/** Maximum number of user-uploaded scores to keep. Oldest are evicted first. */
export const MAX_USER_SCORES = 20;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function readIndex(): UserScore[] {
  try {
    const raw = scopedGetItem(USER_SCORES_INDEX_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as UserScore[];
  } catch {
    return [];
  }
}

function writeIndex(index: UserScore[]): void {
  scopedSetItem(USER_SCORES_INDEX_KEY, JSON.stringify(index));
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
 * Eviction: if the index exceeds MAX_USER_SCORES, the oldest entries are
 * removed. Their IDs are returned so callers can clean up IndexedDB.
 *
 * @param id - UUID of the score (matches IndexedDB key).
 * @param rawDisplayName - Proposed display name (work_title or filename).
 * @returns Object with the new entry and any evicted score IDs.
 */
export function addUserScore(
  id: string,
  rawDisplayName: string,
  difficulty_level?: DifficultyLevel,
): { entry: UserScore; evictedIds: string[] } {
  const index = readIndex();
  const displayName = deduplicateName(rawDisplayName, index);
  const entry: UserScore = {
    id,
    displayName,
    uploadedAt: new Date().toISOString(),
    ...(difficulty_level !== undefined && { difficulty_level }),
  };
  // Insert at head (newest first)
  index.unshift(entry);

  // Evict oldest entries beyond the limit
  const evictedIds: string[] = [];
  while (index.length > MAX_USER_SCORES) {
    const removed = index.pop();
    if (removed) evictedIds.push(removed.id);
  }

  writeIndex(index);
  return { entry, evictedIds };
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
 * Update the difficulty_level for an existing user score entry.
 * Used when a stale-schema score is re-parsed and gains a difficulty rating.
 * No-op if the id is not found.
 */
export function updateUserScoreDifficulty(id: string, level: DifficultyLevel): void {
  const index = readIndex();
  const entry = index.find((s) => s.id === id);
  if (!entry) return;
  entry.difficulty_level = level;
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
