/**
 * Contract: Score Catalog — Scales Generation feature (001)
 *
 * These TypeScript interfaces define the data contract between the
 * score catalog data layer (preloadedScores.ts) and the load score
 * dialog components (LoadScoreDialog, PreloadedScoreList, ScoreGroupList).
 *
 * This file is the authoritative source during planning. Implementation
 * MUST match these shapes exactly.
 */

// ---------------------------------------------------------------------------
// Existing interface (unchanged) — retained here for reference
// ---------------------------------------------------------------------------

export interface PreloadedScore {
  /** Stable unique identifier, e.g. "c-major-oct4" */
  id: string;
  /** Human-readable label shown in the list, e.g. "C Major — Octave 4" */
  displayName: string;
  /** URL relative to app BASE_URL, e.g. "/scores/scales/C_major_oct4.mxl" */
  path: string;
}

// ---------------------------------------------------------------------------
// New interfaces
// ---------------------------------------------------------------------------

/**
 * A named collection of scores originating from a single scores subfolder.
 * Displayed as a collapsible group in the load score dialog.
 *
 * Invariant: `scores` is non-empty — a group with zero scores MUST NOT
 * appear in PRELOADED_CATALOG.groups; the consumer filters it out.
 */
export interface ScoreGroup {
  /** Stable unique group identifier, e.g. "scales" */
  id: string;
  /** Label shown in the collapsible header, e.g. "Scales" */
  displayName: string;
  /** Ordered scores within this group (circle of fifths, major→minor, oct4→oct5) */
  scores: ReadonlyArray<PreloadedScore>;
}

/**
 * The complete preloaded score catalog.
 *
 * `ungrouped` — top-level scores shown without a group header (existing classical pieces)
 * `groups`    — subfolder groups; each group is non-empty (empty groups are pre-filtered)
 */
export interface PreloadedCatalog {
  ungrouped: ReadonlyArray<PreloadedScore>;
  groups: ReadonlyArray<ScoreGroup>;
}

// ---------------------------------------------------------------------------
// Component prop contracts (unchanged for PreloadedScoreList; new for ScoreGroupList)
// ---------------------------------------------------------------------------

/**
 * Props for the existing PreloadedScoreList component.
 * Shape is unchanged — only the ungrouped scores are passed here.
 */
export interface PreloadedScoreListProps {
  scores: ReadonlyArray<PreloadedScore>;
  selectedId?: string;
  disabled?: boolean;
  onSelect: (score: PreloadedScore) => void;
}

/**
 * Props for the new ScoreGroupList component.
 * Renders a single collapsible <details>/<summary> group containing
 * the scores from one ScoreGroup.
 */
export interface ScoreGroupListProps {
  group: ScoreGroup;
  selectedId?: string;
  disabled?: boolean;
  onSelect: (score: PreloadedScore) => void;
}

// ---------------------------------------------------------------------------
// Data module exports (preloadedScores.ts public surface)
// ---------------------------------------------------------------------------

/**
 * The catalog of all preloaded scores. Assembles ungrouped + groups.
 * Exported from: frontend/src/data/preloadedScores.ts
 *
 * Backward-compatible: PRELOADED_SCORES continues to export the ungrouped array.
 */
export declare const PRELOADED_CATALOG: PreloadedCatalog;

/**
 * The Scales score group.
 * Exported from: frontend/src/data/preloadedScores.ts
 * Contains all 48 scale scores ordered by circle of fifths (major then minor, oct4 then oct5).
 */
export declare const SCALE_SCORE_GROUP: ScoreGroup;
