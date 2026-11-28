#!/usr/bin/env node
/**
 * Resolve one goal phrase: `npm run catalog:find -- "<phrase>" [--screen <screen>]`.
 *
 * Prints the lookup JSON and exits 0 when the phrase resolves to exactly one
 * control, 1 when it does not (missing or ambiguous) — never a guessed selector.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lookup } from '../catalog/lookup.ts';
import type { Catalog } from '../catalog/schema.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEMOS = path.resolve(HERE, '..', '..');
const INDEX = path.join(DEMOS, 'catalog', 'elements.json');

function parseArgs(argv: string[]): { phrase: string; screen?: string } {
  let screen: string | undefined;
  const words: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--screen') {
      screen = argv[i + 1];
      i += 1;
    } else if (arg === '--') {
      // npm's argument separator — ignore.
    } else {
      words.push(arg);
    }
  }
  return { phrase: words.join(' ').trim(), screen };
}

async function main(): Promise<void> {
  const { phrase, screen } = parseArgs(process.argv.slice(2));
  if (!phrase) {
    console.error('usage: npm run catalog:find -- "<phrase>" [--screen <screen>]');
    process.exit(2);
  }

  let catalog: Catalog;
  try {
    catalog = JSON.parse(await readFile(INDEX, 'utf8')) as Catalog;
  } catch {
    console.error(`No index at ${path.relative(DEMOS, INDEX)}. Run \`npm run catalog:build\` first.`);
    process.exit(2);
  }

  const result = lookup(catalog, phrase, screen ? { screen } : {});
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.resolved ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(2);
});
