/**
 * The representative goal set (spec SC-001/SC-002/SC-003): the goals that
 * demonstrate the generator covers the requirements — a resolved journey, a
 * wait-heavy journey, and a journey with a control the app does not annotate.
 *
 * Builds the real index from the app's annotations and runs each plan through
 * the authoring pipeline, asserting the outcomes the plan declares in `expect`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCatalog } from '../catalog/build.ts';
import { authorFromPlan } from './author.ts';
import type { Plan } from './author.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEMOS = path.resolve(HERE, '..', '..');
const REPO = path.resolve(DEMOS, '..');
const PLANS = path.join(DEMOS, 'plans');
const EXISTING = ['play-a-score', 'play-a-score-tempo'];

async function loadPlan(name: string): Promise<Plan> {
  return JSON.parse(await readFile(path.join(PLANS, name), 'utf8')) as Plan;
}

test('every representative goal authors within the time budget and meets its expectations', async () => {
  const catalog = await buildCatalog({ root: REPO, revision: 'test' });
  const files = (await readdir(PLANS)).filter((f) => f.endsWith('.json')).sort();
  assert.ok(files.length >= 3, 'the 3 new goals are present');

  for (const f of files) {
    const plan = await loadPlan(f);
    const started = Date.now();
    const { flow, report } = authorFromPlan(catalog, plan, EXISTING, started);
    const elapsed = Date.now() - started;

    assert.ok(elapsed < 10_000, `${f}: authored in ${elapsed} ms (< 10 000) — SC-001`);
    assert.ok(flow.id.length > 0 && !EXISTING.includes(flow.id), `${f}: non-colliding id`);
    if (plan.expect?.resolved !== undefined) {
      assert.equal(report.resolved.length, plan.expect.resolved, `${f}: resolved count`);
    }
    if (plan.expect?.unresolved !== undefined) {
      assert.equal(report.unresolved.length, plan.expect.unresolved, `${f}: unresolved count`);
    }
    if (plan.expect?.steps !== undefined) {
      assert.equal(flow.steps.length, plan.expect.steps, `${f}: steps produced`);
    }
    // Every unresolved step is flagged and produces a gap, never a selector (SC-003).
    for (const u of report.unresolved) {
      assert.ok(report.gaps.some((g) => g.includes(u.step)), `${f}: gap recorded for "${u.step}"`);
    }
  }
});

test('the set spans a resolved, a wait-heavy and an unresolved journey', async () => {
  const catalog = await buildCatalog({ root: REPO, revision: 'test' });

  const resolved = authorFromPlan(catalog, await loadPlan('play-score-slow-down.json'), EXISTING);
  const waitHeavy = authorFromPlan(catalog, await loadPlan('train-a-session.json'), EXISTING);
  const unresolved = authorFromPlan(catalog, await loadPlan('settings-dark-mode.json'), EXISTING);

  assert.equal(resolved.report.unresolved.length, 0, 'resolved journey: no gaps');
  assert.ok(
    waitHeavy.flow.steps.some((s) => s.action === 'waitForFunction'),
    'wait-heavy journey: a content wait was inserted',
  );
  assert.ok(unresolved.report.unresolved.length > 0, 'unresolved journey: at least one step flagged');
  assert.equal(
    unresolved.flow.steps.length,
    unresolved.report.resolved.length,
    'unresolved journey: only resolved steps are written into the flow',
  );
});
