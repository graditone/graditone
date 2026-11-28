#!/usr/bin/env node
/**
 * subset-fonts.ts — Latin font subsetting pre-build step
 * Feature 001-pwa-hosting-service — US3 (T024)
 *
 * For each *.woff2 file in frontend/public/fonts/ (except Bravura which is a
 * music notation font and must keep its full glyph set), runs pyftsubset from
 * the Python fonttools package to strip non-Latin glyphs.
 *
 * Unicode range: U+0000-024F
 *  · U+0000-007F  Basic Latin (ASCII)
 *  · U+0080-00FF  Latin-1 Supplement (accented chars, currency)
 *  · U+0100-017F  Latin Extended-A
 *  · U+0180-024F  Latin Extended-B
 *
 * Expected size reduction: ~48% per text font (verified against design doc).
 * Bravura.woff2 is skipped — it contains music notation symbols not in the
 * Latin range and must retain its full glyph set for score rendering.
 *
 * Prerequisites:
 *   pip install fonttools   (or: pip3 install fonttools)
 *
 * Usage:
 *   node scripts/subset-fonts.ts    # from frontend/ directory
 *   npm run subset-fonts              # via npm script
 */

import { execSync } from 'child_process';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

const FONTS_DIR = new URL('../public/fonts', import.meta.url).pathname;
const UNICODE_RANGE = 'U+0000-024F';

// Fonts to skip — non-text fonts or fonts that must keep full glyph set
const SKIP_FONTS = new Set<string>(['Bravura.woff2']);

// Verify pyftsubset is available
try {
  execSync('pyftsubset --help', { stdio: 'pipe' });
} catch {
  console.error('\n❌ ERROR: pyftsubset not found.');
  console.error('   Install fonttools: pip install fonttools\n');
  process.exit(1);
}

const files = readdirSync(FONTS_DIR).filter((f) => f.endsWith('.woff2'));

if (files.length === 0) {
  console.warn(`\n⚠️  No .woff2 files found in ${FONTS_DIR}\n`);
  process.exit(0);
}

console.log('\n🔤 Font subsetting — Latin range (U+0000-024F)\n');

let processed = 0;
let skipped = 0;
let totalSaved = 0;

for (const file of files) {
  if (SKIP_FONTS.has(file)) {
    console.log(`  ⏭  ${file.padEnd(36)} (skipped — non-text font)`);
    skipped++;
    continue;
  }

  const fullPath = join(FONTS_DIR, file);
  const sizeBefore = statSync(fullPath).size;

  // pyftsubset writes the output to <name>.subset.<ext> by default.
  // We pass --output-file to write back in-place.
  const cmd = [
    'pyftsubset',
    JSON.stringify(fullPath),
    `--unicodes="${UNICODE_RANGE}"`,
    '--flavor=woff2',
    `--output-file=${JSON.stringify(fullPath)}`,
  ].join(' ');

  try {
    execSync(cmd, { stdio: 'pipe' });
  } catch (err) {
    console.error(`  ❌ FAILED ${file}: ${(err as Error).message}`);
    process.exit(1);
  }

  const sizeAfter = statSync(fullPath).size;
  const saved = sizeBefore - sizeAfter;
  const pct = ((saved / sizeBefore) * 100).toFixed(0);
  totalSaved += saved;
  processed++;

  const label = file.padEnd(36);
  const before = `${(sizeBefore / 1024).toFixed(1)} KB`.padStart(9);
  const after = `${(sizeAfter / 1024).toFixed(1)} KB`.padStart(9);
  console.log(`  ✅ ${label} ${before} → ${after}  (${pct}% reduction)`);
}

console.log(`\n  Total saved: ${(totalSaved / 1024).toFixed(1)} KB across ${processed} fonts (${skipped} skipped)\n`);
