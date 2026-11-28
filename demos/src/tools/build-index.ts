#!/usr/bin/env node
/**
 * Build the derived element index: `npm run catalog:build`.
 *
 * Scans the application's annotations (and the authored selector references)
 * and writes `demos/catalog/elements.json`. The file is generated, never
 * hand-edited; its identity always comes from the app (research D1/D8).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCatalog } from '../catalog/build.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEMOS = path.resolve(HERE, '..', '..');
const REPO = path.resolve(DEMOS, '..');
const INDEX = path.join(DEMOS, 'catalog', 'elements.json');

function revision(): string {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: REPO,
      encoding: 'utf8',
    }).trim();
  } catch {
    return 'unknown';
  }
}

async function main(): Promise<void> {
  const catalog = await buildCatalog({ root: REPO, revision: revision() });
  await mkdir(path.dirname(INDEX), { recursive: true });
  await writeFile(INDEX, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  console.log(
    `✓ ${catalog.entries.length} entries ` +
      `(annotation ${catalog.sources.annotation}, e2e ${catalog.sources.e2e}, snapshot ${catalog.sources.snapshot}) ` +
      `→ ${path.relative(REPO, INDEX)} @ ${catalog.sourceRevision}`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
