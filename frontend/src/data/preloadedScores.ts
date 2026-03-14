/**
 * Manifest of preloaded scores bundled with the app.
 * Files are served from {BASE_URL}scores/ (symlinked from frontend/public/scores/ → ../../scores).
 *
 * Paths use import.meta.env.BASE_URL so they resolve correctly both locally (/)
 * and on GitHub Pages (/).
 *
 * Feature 028: Load Score Dialog
 * Feature 045: Re-export UserScore so score-picker components import from one location.
 * Feature 001: Scales Generation — ScoreGroup, PreloadedCatalog, SCALE_SCORE_GROUP, PRELOADED_CATALOG.
 */
export type { UserScore } from '../services/userScoreIndex';

export interface PreloadedScore {
  id: string;
  displayName: string;
  /** Path relative to the app's base URL, e.g. "/scores/Bach_InventionNo1.mxl" */
  path: string;
}

/**
 * A named collection of scores from a single scores subfolder,
 * displayed as a collapsible group in the load score dialog.
 * Feature 001: Scales Generation.
 */
export interface ScoreGroup {
  /** Stable unique group identifier, e.g. "scales" */
  id: string;
  /** Label shown in the collapsible header, e.g. "Scales" */
  displayName: string;
  /** Ordered scores within this group */
  scores: ReadonlyArray<PreloadedScore>;
}

/**
 * The complete preloaded score catalog.
 * `ungrouped` — top-level scores shown without a group header.
 * `groups`    — subfolder groups; empty groups are pre-filtered out.
 * Feature 001: Scales Generation.
 */
export interface PreloadedCatalog {
  ungrouped: ReadonlyArray<PreloadedScore>;
  groups: ReadonlyArray<ScoreGroup>;
}

const base = import.meta.env.BASE_URL; // "/" locally, "/" on GitHub Pages

export const PRELOADED_SCORES: ReadonlyArray<PreloadedScore> = [
  {
    id: 'bach-invention-1',
    displayName: 'Bach — Invention No. 1',
    path: `${base}scores/Bach_InventionNo1.mxl`,
  },
  {
    id: 'beethoven-fur-elise',
    displayName: 'Beethoven — Für Elise',
    path: `${base}scores/Beethoven_FurElise.mxl`,
  },
  {
    id: 'burgmuller-arabesque',
    displayName: 'Burgmüller — Arabesque',
    path: `${base}scores/Burgmuller_Arabesque.mxl`,
  },
  {
    id: 'burgmuller-la-candeur',
    displayName: 'Burgmüller — La Candeur',
    path: `${base}scores/Burgmuller_LaCandeur.mxl`,
  },
  {
    id: 'chopin-nocturne-op9-2',
    displayName: 'Chopin — Nocturne Op. 9 No. 2',
    path: `${base}scores/Chopin_NocturneOp9No2.mxl`,
  },
  {
    id: 'pachelbel-canon-d',
    displayName: 'Pachelbel — Canon in D',
    path: `${base}scores/Pachelbel_CanonD.mxl`,
  },
] as const;

/**
 * The Scales score group — all 48 scale scores in circle of fifths order
 * (major oct4, major oct5, minor oct4, minor oct5).
 * Populated by T010 (major) and T013 (minor) during feature 001 implementation.
 * Feature 001: Scales Generation.
 */
export const SCALE_SCORE_GROUP: ScoreGroup = {
  id: 'scales',
  displayName: 'Scales',
  scores: [
    // Major scales — circle of fifths order
    { id: 'c-major',  displayName: 'C Major',       path: `${base}scores/scales/C_major.mxl`  },
    { id: 'g-major',  displayName: 'G Major',       path: `${base}scores/scales/G_major.mxl`  },
    { id: 'd-major',  displayName: 'D Major',       path: `${base}scores/scales/D_major.mxl`  },
    { id: 'a-major',  displayName: 'A Major',       path: `${base}scores/scales/A_major.mxl`  },
    { id: 'e-major',  displayName: 'E Major',       path: `${base}scores/scales/E_major.mxl`  },
    { id: 'b-major',  displayName: 'B Major',       path: `${base}scores/scales/B_major.mxl`  },
    { id: 'fs-major', displayName: 'F# Major',      path: `${base}scores/scales/Fs_major.mxl` },
    { id: 'db-major', displayName: 'D\u266d Major', path: `${base}scores/scales/Db_major.mxl` },
    { id: 'ab-major', displayName: 'A\u266d Major', path: `${base}scores/scales/Ab_major.mxl` },
    { id: 'eb-major', displayName: 'E\u266d Major', path: `${base}scores/scales/Eb_major.mxl` },
    { id: 'bb-major', displayName: 'B\u266d Major', path: `${base}scores/scales/Bb_major.mxl` },
    { id: 'f-major',  displayName: 'F Major',       path: `${base}scores/scales/F_major.mxl`  },
    // Natural minor scales — circle of fifths order
    { id: 'c-minor',  displayName: 'C Minor',       path: `${base}scores/scales/C_minor.mxl`  },
    { id: 'g-minor',  displayName: 'G Minor',       path: `${base}scores/scales/G_minor.mxl`  },
    { id: 'd-minor',  displayName: 'D Minor',       path: `${base}scores/scales/D_minor.mxl`  },
    { id: 'a-minor',  displayName: 'A Minor',       path: `${base}scores/scales/A_minor.mxl`  },
    { id: 'e-minor',  displayName: 'E Minor',       path: `${base}scores/scales/E_minor.mxl`  },
    { id: 'b-minor',  displayName: 'B Minor',       path: `${base}scores/scales/B_minor.mxl`  },
    { id: 'fs-minor', displayName: 'F# Minor',      path: `${base}scores/scales/Fs_minor.mxl` },
    { id: 'cs-minor', displayName: 'C# Minor',      path: `${base}scores/scales/Cs_minor.mxl` },
    { id: 'gs-minor', displayName: 'G# Minor',      path: `${base}scores/scales/Gs_minor.mxl` },
    { id: 'ds-minor', displayName: 'D# Minor',      path: `${base}scores/scales/Ds_minor.mxl` },
    { id: 'bb-minor', displayName: 'B\u266d Minor', path: `${base}scores/scales/Bb_minor.mxl` },
    { id: 'f-minor',  displayName: 'F Minor',       path: `${base}scores/scales/F_minor.mxl`  },
    // Combined collections
    { id: 'all-major-scales', displayName: 'All Major Scales', path: `${base}scores/scales/All_major_scales.mxl` },
    { id: 'all-minor-scales', displayName: 'All Minor Scales', path: `${base}scores/scales/All_minor_scales.mxl` },
  ],
};

/**
 * The complete preloaded score catalog.
 * Groups with zero scores are filtered out automatically.
 * Feature 001: Scales Generation.
 */
export const PRELOADED_CATALOG: PreloadedCatalog = {
  ungrouped: PRELOADED_SCORES,
  groups: [SCALE_SCORE_GROUP].filter((g) => g.scores.length > 0),
};
