import { test } from 'node:test';
import assert from 'node:assert/strict';
import { entriesFromAriaSnapshot } from './snapshot.ts';

const SNAPSHOT = [
  '- generic "Play Score":',
  '  - button "Play Score"',
  '  - button "Für Elise"',
  '- dialog "Select score":',
  '  - button "Cancel"',
  '- text "just noise"',
].join('\n');

test('entriesFromAriaSnapshot reads roles and quoted names, skipping generic/text', () => {
  const entries = entriesFromAriaSnapshot(SNAPSHOT, 'landing');
  const names = entries.map((e) => `${e.role}:${e.name}`);
  assert.ok(names.includes('button:Play Score'));
  assert.ok(names.includes('button:Für Elise'));
  assert.ok(names.includes('dialog:Select score'));
  assert.ok(!names.some((n) => n.startsWith('generic:')));
  assert.ok(!names.some((n) => n.startsWith('text:')));
  assert.equal(entries[0].source, 'snapshot');
  assert.equal(entries[0].screen, 'landing');
});
