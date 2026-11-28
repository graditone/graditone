#!/usr/bin/env node
/**
 * check-budget.ts — CI asset budget gate
 * Feature 001-pwa-hosting-service — US3 (T022)
 *
 * Calculates estimated gzip-compressed sizes of all INITIAL-LOAD assets in
 * frontend/dist/ and exits with code 1 if the total exceeds 2 MB (FR-009,
 * SC-003). Lazy chunks (containing 'tone-audio' in their filename) are
 * excluded because they are deferred and not in the initial transfer.
 *
 * Usage:
 *   node scripts/check-budget.ts          # from frontend/ directory
 *   npm run check-budget                    # via npm script
 *
 * Exit codes:
 *   0 — budget OK (total compressed initial transfer <= 2 MB)
 *   1 — budget exceeded (deployment blocked)
 */

import { readdirSync, statSync, readFileSync } from 'fs';
import { join, relative, extname } from 'path';
import { gzipSync } from 'zlib';

const BUDGET_BYTES = 2 * 1024 * 1024; // 2 MB
const DIST_DIR = new URL('../dist', import.meta.url).pathname;

// Extensions that represent initial-load assets
const INITIAL_EXTENSIONS = new Set<string>(['.js', '.css', '.wasm', '.html', '.woff2']);

// Chunk name patterns to exclude (lazy/deferred bundles)
const LAZY_PATTERNS = ['tone-audio'];

function isLazyChunk(filePath: string): boolean {
  return LAZY_PATTERNS.some((p) => filePath.includes(p));
}

function walkDir(dir: string, results: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      walkDir(fullPath, results);
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

function gzipSize(filePath: string): number {
  const content = readFileSync(filePath);
  return gzipSync(content, { level: 9 }).length;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

interface Row {
  path: string;
  uncompressed: number;
  compressed: number;
}

// ----- main -----

let files: string[];
try {
  files = walkDir(DIST_DIR);
} catch {
  console.error(`\n❌ ERROR: dist/ directory not found at ${DIST_DIR}`);
  console.error('   Run "npm run build" first.\n');
  process.exit(1);
}

const rows: Row[] = [];
let totalCompressed = 0;

for (const filePath of files) {
  const ext = extname(filePath);
  if (!INITIAL_EXTENSIONS.has(ext)) continue;
  if (isLazyChunk(filePath)) continue;

  const uncompressed = statSync(filePath).size;
  const compressed = gzipSize(filePath);
  totalCompressed += compressed;

  rows.push({ path: relative(DIST_DIR, filePath), uncompressed, compressed });
}

// Sort by compressed size descending
rows.sort((a, b) => b.compressed - a.compressed);

console.log('\n📦 Asset Budget Check — initial-load compressed sizes (gzip)\n');
console.log('  File                                              Uncompressed   Gzip');
console.log('  ' + '─'.repeat(72));

for (const { path, uncompressed, compressed } of rows) {
  const label = path.padEnd(48);
  const raw = formatBytes(uncompressed).padStart(13);
  const gz = formatBytes(compressed).padStart(7);
  console.log(`  ${label}${raw}   ${gz}`);
}

console.log('  ' + '─'.repeat(72));
console.log(`  ${'TOTAL (gzip)'.padEnd(48)}${''.padStart(13)}   ${formatBytes(totalCompressed).padStart(7)}`);
console.log(`  ${'BUDGET'.padEnd(48)}${''.padStart(13)}   ${formatBytes(BUDGET_BYTES).padStart(7)}`);

if (totalCompressed <= BUDGET_BYTES) {
  console.log(`\n✅ PASS — ${formatBytes(totalCompressed)} of ${formatBytes(BUDGET_BYTES)} budget used\n`);
  process.exit(0);
} else {
  const over = totalCompressed - BUDGET_BYTES;
  console.error(`\n❌ FAIL — Over budget by ${formatBytes(over)}. Reduce initial-load asset sizes.\n`);
  console.error('Tips:');
  console.error('  · Run "npm run subset-fonts" to apply Latin subsetting to woff2 files');
  console.error('  · Ensure Tone.js is in a lazy chunk (manualChunks: tone-audio)');
  console.error('  · Check for large unintended dependencies with "npx vite-bundle-analyzer"\n');
  process.exit(1);
}
