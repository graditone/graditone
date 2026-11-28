import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, formatReport } from './report.ts';

test('buildReport records counts and adds a gap line per unresolved step', () => {
  const report = buildReport({
    flowId: 'demo',
    elapsedMs: 7400,
    lookupMs: 180,
    stepsProduced: 5,
    resolved: [{ step: 'open', target: 'plugin-launch-play-score' }],
    unresolved: [{ step: 'open the settings tab', reason: 'missing', candidates: ['play'] }],
  });
  assert.equal(report.flowId, 'demo');
  assert.equal(report.elapsedMs, 7400);
  assert.equal(report.lookupMs, 180);
  assert.equal(report.stepsProduced, 5);
  assert.equal(report.unresolved.length, 1);
  assert.ok(report.gaps.some((g) => g.includes('open the settings tab')));
});

test('every unresolved step appears in gaps; format is one-screen', () => {
  const report = buildReport({
    flowId: 'd',
    elapsedMs: 1,
    lookupMs: 1,
    stepsProduced: 0,
    resolved: [],
    unresolved: [
      { step: 'a', reason: 'ambiguous', candidates: [] },
      { step: 'b', reason: 'missing', candidates: [] },
    ],
  });
  for (const u of report.unresolved) assert.ok(report.gaps.some((g) => g.includes(u.step)));
  assert.match(formatReport(report), /Flow: d/);
  assert.match(formatReport(report), /Unresolved: 2/);
});
