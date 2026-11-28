/**
 * Build the derived element index from the application's own annotations.
 *
 * The app is the source of truth (research D1): a control is identified by its
 * `data-testid` (primary), its role + accessible name (secondary), and the
 * screen it lives on. We scan the demo-relevant components and the authored
 * selector references (the e2e specs and the existing demo flows), merge by
 * identity, and sort for stable diffs.
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { isUsable, makeEntryId, sortEntries } from './schema.ts';
import type { Catalog, CatalogEntry, CatalogSource } from './schema.ts';

export type I18n = Record<string, string>;

/** Components that hold demo-relevant controls (annotation-contract.md §2). */
export const DEMO_FILES: { file: string; screen: string }[] = [
  { file: 'frontend/src/components/LandingScreen.tsx', screen: 'landing' },
  { file: 'frontend/src/components/TempoMetronomeControl.tsx', screen: 'tempo' },
  { file: 'frontend/src/components/plugins/ScoreSelectorPlugin.tsx', screen: 'score-selector' },
  { file: 'frontend/src/components/plugins/ScoreRendererPlugin.tsx', screen: 'play-score' },
  { file: 'frontend/plugins/play-score/playbackToolbar.tsx', screen: 'play-score' },
];

/**
 * Curated phrase aliases keyed by `testid`: extra phrases a natural-language
 * goal may use. Identity still comes from the app; aliases only widen matching.
 */
export const ALIASES: Record<string, string[]> = {
  'tempo-plus': ['bpm up', 'faster', 'raise tempo', 'raise the tempo', 'speed up', 'increase tempo'],
  'tempo-minus': ['bpm down', 'slower', 'lower tempo', 'lower the tempo', 'slow down', 'decrease tempo'],
  'tempo-display': ['bpm', 'tempo readout', 'tempo value', 'current tempo'],
  'plugin-launch-play-score': ['play score', 'open play score', 'play score plugin', 'start play score'],
  'plugin-launch-train-view': ['train view', 'open train view', 'start training', 'train a score'],
  'play-score-play': ['press play', 'start playback', 'start the music', 'begin playback'],
  'play-score-stop': ['press stop', 'stop playback', 'stop the music'],
  'score-phrases-toggle': ['show phrases', 'phrases', 'toggle phrases', 'show the phrases', 'phrases view'],
  'score-phrases-next': ['next phrase', 'go to next phrase', 'next'],
  'score-phrases-prev': ['previous phrase', 'go to previous phrase', 'prev'],
  'score-selector-dialog': ['score chooser', 'select a score', 'score list', 'choose a piece'],
};

const TAG_RE = /<([A-Za-z][\w.]*)((?:[^<>"']|"[^"]*"|'[^']*'|`[^`]*`)*?)\/?>/gs;
const TAG_ROLES: Record<string, string> = {
  button: 'button',
  a: 'link',
  select: 'combobox',
  textarea: 'textbox',
};

/** Resolve a JSX expression like `t('key')` against the i18n map. */
function resolveExpr(expr: string, i18n: I18n): string | null {
  const call = expr.match(/t\(\s*['"]([^'"]+)['"]\s*\)/);
  if (call) return i18n[call[1]] ?? null;
  return null;
}

/** Read one JSX attribute (static string, template without `${}`, or `t('key')`). */
function attr(attrs: string, name: string, i18n: I18n): string | null {
  const re = new RegExp(
    `${name}=(?:"([^"]*)"|'([^']*)'|\\{\\s*\`([^\`$]*)\`\\s*\\}|\\{\\s*([^}]*?)\\s*\\})`,
  );
  const m = attrs.match(re);
  if (!m) return null;
  if (m[1] !== undefined) return m[1];
  if (m[2] !== undefined) return m[2];
  if (m[3] !== undefined) return m[3];
  if (m[4] !== undefined) return resolveExpr(m[4], i18n);
  return null;
}

/**
 * Parse the JSX elements of one source file into entries. Best-effort: the
 * `testid` and `screen` are authoritative; `role` and `name` are read from the
 * element's own attributes (or a mapped tag name).
 */
export function parseElements(
  source: string,
  screen: string,
  i18n: I18n = {},
  origin: CatalogSource = 'annotation',
): CatalogEntry[] {
  const out: CatalogEntry[] = [];
  for (const match of source.matchAll(TAG_RE)) {
    const tag = match[1].toLowerCase();
    const attrs = match[2] ?? '';
    const testid = attr(attrs, 'data-testid', i18n);
    const role = (attr(attrs, 'role', i18n) ?? TAG_ROLES[tag] ?? '').toLowerCase();
    const name = attr(attrs, 'aria-label', i18n);
    if (!isUsable({ role, name, testid })) continue;
    const entry: CatalogEntry = {
      id: makeEntryId({ screen, testid, role, name }),
      role,
      name,
      testid,
      screen,
      source: origin,
    };
    if (testid) entry.selectorHints = [`[data-testid="${testid}"]`];
    out.push(entry);
  }
  return out;
}

/** Parse testids and aria-labels out of an authored selector reference. */
export function parseReferences(
  text: string,
  screen: string,
  origin: CatalogSource = 'e2e',
): CatalogEntry[] {
  const out: CatalogEntry[] = [];
  const testidRe = /data-testid\s*=\s*["']([^"']+)["']|getByTestId\(\s*["']([^"']+)["']\s*\)/g;
  for (const m of text.matchAll(testidRe)) {
    const testid = m[1] ?? m[2];
    if (!testid) continue;
    out.push({
      id: testid,
      role: '',
      name: null,
      testid,
      screen,
      source: origin,
      selectorHints: [`[data-testid="${testid}"]`],
    });
  }
  const ariaRe = /\[aria-label=["']([^"']+)["']\]|aria-label=["']([^"']+)["']/g;
  for (const m of text.matchAll(ariaRe)) {
    const name = m[1] ?? m[2];
    if (!name) continue;
    out.push({
      id: makeEntryId({ screen, testid: null, role: 'button', name }),
      role: 'button',
      name,
      testid: null,
      screen,
      source: origin,
    });
  }
  return out;
}

const SOURCE_RANK: Record<CatalogSource, number> = { annotation: 3, snapshot: 2, e2e: 1 };

/**
 * Dynamic control families the static scan cannot enumerate. The measures are
 * numbered 1..N, so the app marks each note glyph with `data-measure="N"` (and
 * `aria-label="Measure N"`); this templates that family for the lookup.
 */
export function dynamicEntries(): CatalogEntry[] {
  return [
    {
      id: 'measure-<n>',
      role: 'note',
      name: 'Measure',
      testid: null,
      screen: 'play-score',
      source: 'annotation',
      pattern: 'measure-<n>',
      selectorTemplate: '[data-measure="<n>"]',
      aliases: ['measure', 'bar'],
    },
  ];
}

/** Merge entries by identity, preferring the higher-ranked source's fields. */
export function mergeEntries(entries: CatalogEntry[]): CatalogEntry[] {
  const byId = new Map<string, CatalogEntry>();
  for (const e of entries) {
    const id = e.testid ?? makeEntryId(e);
    const cur = byId.get(id);
    if (!cur) {
      byId.set(id, { ...e, id });
      continue;
    }
    const [win, lose] = SOURCE_RANK[e.source] > SOURCE_RANK[cur.source] ? [e, cur] : [cur, e];
    byId.set(id, {
      ...win,
      id,
      role: win.role || lose.role,
      name: win.name ?? lose.name,
      testid: win.testid ?? lose.testid,
      selectorHints: win.selectorHints ?? lose.selectorHints,
      aliases: win.aliases ?? lose.aliases,
    });
  }
  for (const e of byId.values()) {
    if (e.testid && ALIASES[e.testid]) e.aliases = ALIASES[e.testid];
  }
  return sortEntries([...byId.values()]);
}

async function readIfPresent(file: string): Promise<string | null> {
  try {
    return await readFile(file, 'utf8');
  } catch {
    return null;
  }
}

async function listMatching(dir: string, re: RegExp): Promise<string[]> {
  try {
    return (await readdir(dir)).filter((f) => re.test(f)).sort();
  } catch {
    return [];
  }
}

async function loadI18n(root: string): Promise<I18n> {
  const raw = await readIfPresent(path.join(root, 'frontend/src/i18n/locales/en.json'));
  if (!raw) return {};
  try {
    return JSON.parse(raw) as I18n;
  } catch {
    return {};
  }
}

export interface BuildOptions {
  /** Repository root. */
  root: string;
  /** Override the timestamp (tests). */
  builtAt?: string;
  /** Override the source revision (tests). */
  revision?: string;
}

/**
 * Build the catalog. Throws a clear, actionable error when no demo-relevant
 * controls can be read at all (FR-016) rather than returning an empty index.
 */
export async function buildCatalog(options: BuildOptions): Promise<Catalog> {
  const { root } = options;
  const i18n = await loadI18n(root);
  const collected: CatalogEntry[] = [];

  for (const { file, screen } of DEMO_FILES) {
    const text = await readIfPresent(path.join(root, file));
    if (text) collected.push(...parseElements(text, screen, i18n, 'annotation'));
  }

  const e2eDir = path.join(root, 'frontend/e2e');
  for (const f of await listMatching(e2eDir, /\.spec\.ts$/)) {
    collected.push(...parseReferences(await readFile(path.join(e2eDir, f), 'utf8'), 'e2e', 'e2e'));
  }

  const flowsDir = path.join(root, 'demos/flows');
  for (const f of await listMatching(flowsDir, /\.ya?ml$/)) {
    const screen = f.replace(/\.ya?ml$/, '');
    collected.push(...parseReferences(await readFile(path.join(flowsDir, f), 'utf8'), screen, 'e2e'));
  }

  const entries = mergeEntries(collected);
  entries.push(...dynamicEntries());
  if (entries.length === 0) {
    throw new Error(
      'No demo-relevant controls could be read.\n' +
        'Checked the demo components, frontend/e2e/*.spec.ts and demos/flows/*.yaml.\n' +
        `Expected annotated controls in: ${DEMO_FILES.map((f) => f.file).join(', ')}.\n` +
        'Annotate a control (role + accessible name + data-testid) or restore the sources, then rerun `npm run catalog:build`.',
    );
  }

  const sources = { annotation: 0, e2e: 0, snapshot: 0 };
  for (const e of entries) sources[e.source] += 1;

  return {
    builtAt: options.builtAt ?? new Date().toISOString(),
    sourceRevision: options.revision ?? 'unknown',
    sources,
    entries,
  };
}
