/**
 * Manifest of preloaded scores bundled with the app.
 * Files are served from {BASE_URL}scores/ (symlinked from frontend/public/scores/ → ../../scores).
 *
 * Paths use import.meta.env.BASE_URL so they resolve correctly both locally (/)
 * and on GitHub Pages (/).
 *
 * Feature 028: Load Score Dialog
 * Feature 045: Re-export UserScore so score-picker components import from one location.
 */
export type { UserScore } from '../services/userScoreIndex';

export interface PreloadedScore {
  id: string;
  displayName: string;
  /** Path relative to the app's base URL, e.g. "/scores/Bach_InventionNo1.mxl" */
  path: string;
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
