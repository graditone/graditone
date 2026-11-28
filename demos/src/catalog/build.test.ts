import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseElements, parseReferences, mergeEntries, DEMO_FILES } from './build.ts';
import { sortEntries, makeEntryId, isUsable } from './schema.ts';

const I18N = {
  'play_score.toolbar.tempo_increase': 'Increase tempo',
  'play_score.toolbar.play_aria': 'Play',
};

const JSX = [
  '<div>',
  '  <button data-testid="tempo-plus" role="button" aria-label={t(\'play_score.toolbar.tempo_increase\')}>+</button>',
  '  <button data-testid="play" role="button" aria-label="Play">▶</button>',
  '  <div role="dialog" data-testid="score-selector-dialog" aria-label="Select score"></div>',
  '</div>',
].join('\n');

test('parseElements reads testid, role and an i18n aria-label', () => {
  const entries = parseElements(JSX, 'play-score', I18N);
  const plus = entries.find((e) => e.testid === 'tempo-plus');
  assert.ok(plus);
  assert.equal(plus.role, 'button');
  assert.equal(plus.name, 'Increase tempo');
  assert.deepEqual(plus.selectorHints, ['[data-testid="tempo-plus"]']);
  assert.equal(plus.source, 'annotation');
});

test('parseElements infers a role from a native tag', () => {
  const entries = parseElements('<button aria-label="Go">x</button>', 'x');
  assert.equal(entries.length, 1);
  assert.equal(entries[0].role, 'button');
});

test('parseElements skips elements with no testid, name, or role', () => {
  assert.equal(parseElements('<div className="x" id="y"></div>', 'x').length, 0);
});

test('parseReferences reads getByTestId, [data-testid] and [aria-label]', () => {
  const text =
    "page.getByTestId('plugin-launch-play-score'); " +
    'page.locator(\'[data-testid="tempo-minus"]\'); ' +
    'page.locator(\'[aria-label="Stop"]\');';
  const keys = parseReferences(text, 'e2e').map((e) => e.testid ?? e.name);
  assert.ok(keys.includes('plugin-launch-play-score'));
  assert.ok(keys.includes('tempo-minus'));
  assert.ok(keys.includes('Stop'));
});

test('mergeEntries prefers the annotation source and fills a missing name', () => {
  const ann = parseElements(JSX, 'play-score', I18N);
  const refs = parseReferences("getByTestId('tempo-plus')", 'e2e');
  const merged = mergeEntries([...refs, ...ann]);
  const plus = merged.find((e) => e.testid === 'tempo-plus');
  assert.ok(plus);
  assert.equal(plus.source, 'annotation');
  assert.equal(plus.name, 'Increase tempo');
});

test('mergeEntries attaches curated aliases by testid', () => {
  const merged = mergeEntries(parseElements(JSX, 'play-score', I18N));
  assert.ok(merged.find((e) => e.testid === 'tempo-plus')?.aliases?.includes('raise the tempo'));
});

test('sortEntries is screen, then testid, then name', () => {
  const sorted = sortEntries([
    { id: 'b', role: 'button', name: 'B', testid: 'b', screen: 'z', source: 'annotation' },
    { id: 'a', role: 'button', name: 'A', testid: 'a', screen: 'a', source: 'annotation' },
  ]);
  assert.deepEqual(sorted.map((e) => e.screen), ['a', 'z']);
});

test('makeEntryId and isUsable', () => {
  assert.equal(makeEntryId({ screen: 's', testid: 'x', role: 'button', name: 'X' }), 'x');
  assert.equal(makeEntryId({ screen: 's', testid: null, role: 'button', name: 'X' }), 's/button/X');
  assert.equal(isUsable({ role: '', name: null, testid: null }), false);
  assert.equal(isUsable({ role: 'button', name: null, testid: null }), true);
});

test('DEMO_FILES covers the annotated surfaces', () => {
  assert.ok(DEMO_FILES.some((f) => f.file.endsWith('LandingScreen.tsx')));
  assert.ok(DEMO_FILES.some((f) => f.file.endsWith('playbackToolbar.tsx')));
});
