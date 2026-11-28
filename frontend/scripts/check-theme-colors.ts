#!/usr/bin/env node
/**
 * check-theme-colors.ts — guards the Graditone theme-token rule.
 *
 * UI must style colours through the landing-theme tokens (--ls-*), the app
 * bridge tokens (--color-*, --dialog-*), and color-mix() over them. Hardcoded
 * colours (#hex, rgb()/rgba(), hsl()/hsla()) are only allowed as a token's
 * fallback, e.g. `var(--ls-accent, #7c3aed)`. See the `graditone-theming`
 * skill for the full rules.
 *
 * Adoption is ratcheted: existing offenders are grandfathered in
 * `scripts/theme-colors-baseline.json` (a file → count map). The check FAILS
 * when a file not in the baseline gains a hardcoded colour, or a baselined file
 * exceeds its recorded count. Shrink the baseline over time.
 *
 * Usage:
 *   node scripts/check-theme-colors.ts            # check (CI / pre-commit)
 *   node scripts/check-theme-colors.ts --update   # rewrite the baseline
 *   node scripts/check-theme-colors.ts --list      # print current offenders
 */

import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join, extname, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const FRONTEND_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = join(FRONTEND_ROOT, 'scripts', 'theme-colors-baseline.json');

/** Directories (relative to frontend/) to scan for CSS. */
const SCAN_DIRS = ['src', 'plugins'];

/** Files whose literals are legitimate: the theme palette source itself. */
const ALLOWLIST = new Set<string>(['src/themes/landing-themes.css']);

const args = new Set(process.argv.slice(2));
const UPDATE = args.has('--update');
const LIST = args.has('--list');

// ── Colour detection ─────────────────────────────────────────────────────────

const COLOR_RE = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/g;

/** Blank out block comments, preserving length so indices and lines stay put. */
function maskComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

/**
 * Index ranges of every `var(--token, <fallback>)` fallback argument. Colour
 * literals inside these ranges are allowed (that is what fallbacks are for).
 */
function fallbackRanges(src: string): [number, number][] {
  const ranges: [number, number][] = [];
  const varRe = /var\(\s*--[a-zA-Z0-9-]+\s*,/g;
  let m: RegExpExecArray | null;
  while ((m = varRe.exec(src)) !== null) {
    const open = src.indexOf('(', m.index); // the var( paren
    let depth = 0;
    let close = -1;
    for (let i = open; i < src.length; i++) {
      const c = src[i];
      if (c === '(') depth++;
      else if (c === ')' && --depth === 0) { close = i; break; }
    }
    if (close < 0) continue;
    // first top-level comma inside var(...) starts the fallback
    let d = 0;
    let comma = -1;
    for (let j = open + 1; j < close; j++) {
      const c = src[j];
      if (c === '(') d++;
      else if (c === ')') d--;
      else if (c === ',' && d === 0) { comma = j; break; }
    }
    if (comma >= 0) ranges.push([comma + 1, close]);
  }
  return ranges;
}

const inRanges = (idx: number, ranges: [number, number][]): boolean =>
  ranges.some(([a, b]) => idx >= a && idx < b);

/** One hardcoded colour found in a CSS source. */
interface Violation {
  line: number;
  col: number;
  text: string;
}

/** Return the hardcoded colours in one CSS source. */
function findViolations(src: string): Violation[] {
  const masked = maskComments(src);
  const ranges = fallbackRanges(masked);
  const lineStarts = [0];
  for (let i = 0; i < masked.length; i++) if (masked[i] === '\n') lineStarts.push(i + 1);
  const lineOf = (idx: number): { line: number; col: number } => {
    let lo = 0, hi = lineStarts.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (lineStarts[mid] <= idx) lo = mid; else hi = mid - 1; }
    return { line: lo + 1, col: idx - lineStarts[lo] + 1 };
  };

  const out: Violation[] = [];
  for (const match of masked.matchAll(COLOR_RE)) {
    const index = match.index ?? 0;
    if (inRanges(index, ranges)) continue;
    const { line, col } = lineOf(index);
    out.push({ line, col, text: match[0] });
  }
  return out;
}

// ── File scanning ────────────────────────────────────────────────────────────

function walkCss(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) walkCss(p, out);
    else if (extname(p) === '.css') out.push(p);
  }
  return out;
}

function scan(): Map<string, Violation[]> {
  /** Map of frontend-relative path → violations[] */
  const results = new Map<string, Violation[]>();
  for (const d of SCAN_DIRS) {
    for (const abs of walkCss(join(FRONTEND_ROOT, d))) {
      const rel = relative(FRONTEND_ROOT, abs).split('\\').join('/');
      if (ALLOWLIST.has(rel)) continue;
      const violations = findViolations(readFileSync(abs, 'utf8'));
      if (violations.length) results.set(rel, violations);
    }
  }
  return results;
}

// ── Main ─────────────────────────────────────────────────────────────────────

const current = scan();
const currentCounts: Record<string, number> = Object.fromEntries(
  [...current.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([f, v]) => [f, v.length]),
);

if (UPDATE) {
  writeFileSync(BASELINE_PATH, JSON.stringify(currentCounts, null, 2) + '\n');
  const total = Object.values(currentCounts).reduce((a, b) => a + b, 0);
  console.log(`✅ Baseline updated: ${Object.keys(currentCounts).length} files, ${total} grandfathered literals.`);
  process.exit(0);
}

if (LIST) {
  for (const [file, violations] of current) {
    console.log(`${file} (${violations.length})`);
    for (const v of violations) console.log(`  ${v.line}:${v.col}  ${v.text}`);
  }
  process.exit(0);
}

const baseline: Record<string, number> = existsSync(BASELINE_PATH)
  ? (JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as Record<string, number>)
  : {};

/** Violations that are new or exceed the baseline: file → violations[:] */
const failures: [string, Violation[], number][] = [];
let reduced = 0;
for (const [file, violations] of current) {
  const allowed = baseline[file] ?? 0;
  if (violations.length > allowed) failures.push([file, violations, allowed]);
}
for (const [file, allowed] of Object.entries(baseline)) {
  const now = currentCounts[file] ?? 0;
  if (now < allowed) reduced++;
}

if (failures.length) {
  console.error('❌ Hardcoded colours found — use theme tokens (see the graditone-theming skill).');
  console.error('   Allowed: var(--ls-…) / var(--color-…) / var(--dialog-…) and color-mix() over them,');
  console.error('   or a literal ONLY as a token fallback: var(--ls-accent, #7c3aed).\n');
  for (const [file, violations, allowed] of failures) {
    const extra = violations.length - allowed;
    console.error(`  ${file} — ${extra} new (${violations.length} total, ${allowed} grandfathered)`);
    for (const v of violations.slice(allowed)) console.error(`      ${v.line}:${v.col}  ${v.text}`);
  }
  console.error('\nIf this is an intentional, reviewed change, update the ratchet:');
  console.error('  npm run lint:colors:update\n');
  process.exit(1);
}

const grandfathered = Object.values(baseline).reduce((a, b) => a + b, 0);
console.log(
  `✅ Theme colour check passed — no new hardcoded colours ` +
  `(${Object.keys(baseline).length} grandfathered files, ${grandfathered} literals).`,
);
if (reduced > 0) {
  console.log(`ℹ️  ${reduced} file(s) now have fewer literals than the baseline — run 'npm run lint:colors -- --update' to tighten the ratchet.`);
}
