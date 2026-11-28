/**
 * Optional enrichment: read the running app's accessibility tree and add the
 * entries the static scan cannot see (research D2) — rendered or dynamically
 * labelled controls. Uses the repo's existing Playwright dependency.
 *
 * The source-derived index stays the default; this is only ever additive.
 */
import { chromium } from 'playwright';
import { makeEntryId } from './schema.ts';
import type { CatalogEntry } from './schema.ts';

export interface SnapshotOptions {
  /** Base URL the app is served at (for example http://localhost:5174). */
  base: string;
  /** Optional extra paths to visit (default `/`). */
  paths?: string[];
}

/** One parsed line of a Playwright aria snapshot. */
const LINE_RE = /^\s*-\s+([a-zA-Z][\w-]*)(?:\s+"((?:[^"\\]|\\.)*)")?/;

/** Flatten a Playwright `ariaSnapshot()` YAML string into role+name entries. */
export function entriesFromAriaSnapshot(text: string, screen: string): CatalogEntry[] {
  const out: CatalogEntry[] = [];
  for (const line of text.split('\n')) {
    const m = line.match(LINE_RE);
    if (!m) continue;
    const role = m[1].toLowerCase();
    const name = m[2] ? m[2].replace(/\\(.)/g, '$1').trim() : null;
    if (role === 'generic' || role === 'none' || role === 'text') continue;
    if (!name && role !== 'button') continue;
    out.push({
      id: makeEntryId({ screen, testid: null, role, name }),
      role,
      name,
      testid: null,
      screen,
      source: 'snapshot',
    });
  }
  return out;
}

/**
 * Visit the app and return snapshot entries. Throws a clear error when the app
 * cannot be reached (FR-016) rather than silently returning nothing.
 */
export async function snapshotEntries(options: SnapshotOptions): Promise<CatalogEntry[]> {
  const paths = options.paths ?? ['/'];
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const out: CatalogEntry[] = [];
    for (const p of paths) {
      try {
        await page.goto(new URL(p, options.base).toString(), { waitUntil: 'domcontentloaded' });
      } catch {
        throw new Error(
          `Could not reach the app at ${options.base}${p} for a snapshot.\n` +
            'Start the dev server (or set DEMO_BASE_URL), then rerun the snapshot.',
        );
      }
      const snapshot = await page.locator('body').ariaSnapshot();
      const screen = p === '/' ? 'landing' : p.replace(/^\/|\/$/g, '');
      out.push(...entriesFromAriaSnapshot(snapshot, screen));
    }
    return out;
  } finally {
    await browser.close();
  }
}
