#!/usr/bin/env node
/**
 * Author a flow from a plan: `npm run flow:author -- <plan.json>`.
 *
 * Resolves each step's phrase against the derived index, assembles the Flow,
 * writes `demos/flows/<id>.yaml`, and prints the Generation Report. It never
 * starts a capture (research D7, FR-004). See `demos/src/generate/author.ts`.
 */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify } from 'yaml';
import { authorFromPlan } from '../generate/author.ts';
import { slug } from '../generate/flow.ts';
import { formatReport } from '../generate/report.ts';
import type { Plan } from '../generate/author.ts';
import type { Catalog } from '../catalog/schema.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEMOS = path.resolve(HERE, '..', '..');
const REPO = path.resolve(DEMOS, '..');
const FLOWS_DIR = path.join(DEMOS, 'flows');
const INDEX = path.join(DEMOS, 'catalog', 'elements.json');

async function existingFlowIds(): Promise<string[]> {
  const files = (await readdir(FLOWS_DIR)).filter((f) => /\.ya?ml$/.test(f));
  const ids: string[] = [];
  for (const f of files) {
    const m = (await readFile(path.join(FLOWS_DIR, f), 'utf8')).match(/^id:\s*(.+)$/m);
    if (m) ids.push(m[1].trim());
  }
  return ids;
}

async function main(): Promise<void> {
  const planPath = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (!planPath) {
    console.error('usage: npm run flow:author -- <plan.json>');
    process.exit(2);
  }

  const started = Date.now();
  const catalog = JSON.parse(await readFile(INDEX, 'utf8')) as Catalog;
  const plan = JSON.parse(await readFile(planPath, 'utf8')) as Plan;

  const { flow, report } = authorFromPlan(
    catalog,
    plan,
    // Re-authoring a plan may replace its own flow, but never another one.
    (await existingFlowIds()).filter((id) => id !== (plan.goal.id ? slug(plan.goal.id) : null)),
    started,
  );

  const out = path.join(FLOWS_DIR, `${flow.id}.yaml`);
  await writeFile(out, stringify(flow, { lineWidth: 0 }), 'utf8');
  console.log(`✓ wrote ${path.relative(REPO, out)}`);
  console.log(formatReport(report));
  if (report.unresolved.length) {
    console.error(`\n${report.unresolved.length} unresolved step(s) — the flow has a gap to close.`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
