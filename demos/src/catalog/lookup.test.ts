import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lookup } from './lookup.ts';
import type { Catalog } from './schema.ts';

const catalog: Catalog = {
  builtAt: 'x',
  sourceRevision: 'x',
  sources: { annotation: 3, e2e: 0, snapshot: 0 },
  entries: [
    {
      id: 'tempo-plus',
      role: 'button',
      name: 'Increase tempo',
      testid: 'tempo-plus',
      screen: 'play-score',
      source: 'annotation',
      aliases: ['raise the tempo'],
    },
    { id: 'play', role: 'button', name: 'Play', testid: 'play', screen: 'play-score', source: 'annotation' },
    { id: 'train-play', role: 'button', name: 'Play', testid: 'train-play', screen: 'train', source: 'annotation' },
  ],
};

test('an unambiguous alias phrase resolves', () => {
  const r = lookup(catalog, 'raise the tempo');
  assert.equal(r.resolved, true);
  assert.equal(r.entry?.testid, 'tempo-plus');
  assert.equal(r.reason, null);
});

test('a testid phrase resolves', () => {
  const r = lookup(catalog, 'tempo-plus');
  assert.equal(r.resolved, true);
  assert.equal(r.entry?.testid, 'tempo-plus');
});

test('a duplicated label is ambiguous with both candidates', () => {
  const r = lookup(catalog, 'Play');
  assert.equal(r.resolved, false);
  assert.equal(r.entry, null);
  assert.equal(r.reason, 'ambiguous');
  assert.equal(r.candidates.length, 2);
});

test('--screen narrows an ambiguous phrase to one', () => {
  const r = lookup(catalog, 'Play', { screen: 'play-score' });
  assert.equal(r.resolved, true);
  assert.equal(r.entry?.testid, 'play');
});

test('a phrase that matches nothing is missing with no entry', () => {
  const r = lookup(catalog, 'open the quantum settings');
  assert.equal(r.resolved, false);
  assert.equal(r.entry, null);
  assert.equal(r.reason, 'missing');
});

const measurePattern = {
  id: 'measure-<n>',
  role: 'note',
  name: 'Measure',
  testid: null,
  screen: 'play-score',
  source: 'annotation' as const,
  pattern: 'measure-<n>',
  selectorTemplate: '[data-measure="<n>"]',
  aliases: ['measure', 'bar'],
};

test('a numbered measure phrase resolves to the measure template', () => {
  const c: Catalog = { ...catalog, entries: [...catalog.entries, measurePattern] };
  const r = lookup(c, 'measure 10');
  assert.equal(r.resolved, true);
  assert.deepEqual(r.entry?.selectorHints, ['[data-measure="10"]']);
});

test('a measure phrase without a number does not resolve to the template', () => {
  const c: Catalog = { ...catalog, entries: [...catalog.entries, measurePattern] };
  const r = lookup(c, 'measure');
  assert.notDeepEqual(r.entry?.selectorHints, ['[data-measure="<n>"]']);
});
