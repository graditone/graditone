/**
 * The derived element index: a machine-readable list of the application's
 * demo-relevant controls, produced from the app's own annotations (feature 102).
 *
 * Types plus small pure helpers only — the builder lives in `build.ts`.
 * See `specs/102-demo-flow-generation/data-model.md` §1–2.
 */

/** Where an entry came from. */
export type CatalogSource = 'annotation' | 'e2e' | 'snapshot';

/** One identifiable control, as the lookup sees it (data-model.md §1). */
export interface CatalogEntry {
  /** Stable identity: the `testid` when present, else `screen/role/name`. */
  id: string;
  /** Semantic role (`button`, `dialog`, ...); empty string only when genuinely none. */
  role: string;
  /** Accessible name (visible localized label or `aria-label`), or `null`. */
  name: string | null;
  /** The `data-testid` value, or `null`. */
  testid: string | null;
  /** Owning screen or plugin; disambiguates duplicate labels. */
  screen: string;
  /** Provenance. */
  source: CatalogSource;
  /** Preferred selector forms, ordered. */
  selectorHints?: string[];
  /** Extra phrases a goal may use. */
  aliases?: string[];
  /**
   * For a dynamic family the static scan cannot enumerate (e.g. `measure-<n>`):
   * a template id. A phrase with a number resolves to it.
   */
  pattern?: string;
  /** A selector template whose `<n>` is filled from the phrase's number. */
  selectorTemplate?: string;
}

/** The whole index and its provenance (data-model.md §2). */
export interface Catalog {
  builtAt: string;
  sourceRevision: string;
  sources: { annotation: number; e2e: number; snapshot: number };
  entries: CatalogEntry[];
}

/** True when an entry carries at least one usable handle (data-model.md §1). */
export function isUsable(entry: Pick<CatalogEntry, 'role' | 'name' | 'testid'>): boolean {
  return Boolean(entry.testid || entry.name || entry.role);
}

/** Stable identity: `testid` when present, else `screen/role/name`. */
export function makeEntryId(entry: {
  screen: string;
  testid: string | null;
  role: string;
  name: string | null;
}): string {
  if (entry.testid) return entry.testid;
  return [entry.screen, entry.role, entry.name ?? ''].filter(Boolean).join('/');
}

/** Sort for stable diffs: `screen`, then `testid`, then `name`. */
export function sortEntries(entries: CatalogEntry[]): CatalogEntry[] {
  return [...entries].sort(
    (a, b) =>
      a.screen.localeCompare(b.screen) ||
      (a.testid ?? '').localeCompare(b.testid ?? '') ||
      (a.name ?? '').localeCompare(b.name ?? ''),
  );
}
