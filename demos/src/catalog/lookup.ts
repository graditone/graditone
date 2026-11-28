/**
 * The lookup: turn one goal phrase into a concrete control, or an honest gap.
 *
 * A phrase resolves ONLY when exactly one entry matches after any `--screen`
 * filter (data-model.md §3, research D3). Ambiguous, missing, or multi-match
 * phrases return candidates and a reason — never a guessed selector.
 */
import type { Catalog, CatalogEntry } from './schema.ts';

export type UnresolvedReason = 'missing' | 'ambiguous' | 'name-only-localized';

export interface LookupResult {
  phrase: string;
  resolved: boolean;
  entry: CatalogEntry | null;
  candidates: CatalogEntry[];
  reason: UnresolvedReason | null;
}

const norm = (s: string): string => s.toLowerCase().trim();
const tokens = (s: string): string[] => norm(s).split(/[^a-z0-9]+/).filter(Boolean);

/** Fraction of the query's words that a candidate phrase contains. */
function overlap(query: string, candidate: string): number {
  const q = tokens(query);
  if (q.length === 0) return 0;
  const c = new Set(tokens(candidate));
  const hit = q.filter((t) => c.has(t)).length;
  return hit / q.length;
}

/** Score one entry against a phrase: exact handles first, then word overlap. */
function scoreEntry(entry: CatalogEntry, phrase: string): number {
  const q = norm(phrase);
  if (entry.testid && norm(entry.testid) === q) return 1;
  if (entry.name && norm(entry.name) === q) return 1;
  const texts = [entry.name ?? '', entry.testid ?? '', ...(entry.aliases ?? [])].filter(Boolean);
  let best = 0;
  for (const text of texts) best = Math.max(best, overlap(phrase, text));
  return best;
}

const THRESHOLD = 0.6;

/** Resolve a phrase against the catalog. */
export function lookup(
  catalog: Catalog,
  phrase: string,
  options: { screen?: string } = {},
): LookupResult {
  const pool = options.screen
    ? catalog.entries.filter((e) => e.screen === options.screen)
    : catalog.entries;

  const scored = pool
    .map((entry) => ({ entry, score: scoreEntry(entry, phrase) }))
    .filter((s) => s.score >= THRESHOLD)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return {
      phrase,
      resolved: false,
      entry: null,
      candidates: nearest(pool, phrase),
      reason: 'missing',
    };
  }

  const top = scored[0].score;
  const ties = scored.filter((s) => s.score === top);
  if (ties.length > 1) {
    return {
      phrase,
      resolved: false,
      entry: null,
      candidates: ties.map((t) => t.entry),
      reason: 'ambiguous',
    };
  }

  const entry = ties[0].entry;
  return { phrase, resolved: true, entry, candidates: [], reason: null };
}

/** The closest entries to show when nothing crossed the threshold. */
function nearest(pool: CatalogEntry[], phrase: string): CatalogEntry[] {
  return pool
    .map((entry) => ({ entry, score: scoreEntry(entry, phrase) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((s) => s.entry);
}

export function describeCandidate(entry: CatalogEntry): string {
  return entry.testid ?? `${entry.screen}/${entry.role}/${entry.name ?? '?'}`;
}
