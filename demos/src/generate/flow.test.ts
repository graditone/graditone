import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assembleFlow, slug, titleFrom, uniqueId } from './flow.ts';

test('assembleFlow builds a Flow with id, title, description and steps', () => {
  const flow = assembleFlow({ text: 'Open Play Score and raise the tempo.' }, [
    { phrase: 'open play score', action: 'click', selector: '[data-testid="plugin-launch-play-score"]' },
    { phrase: 'raise the tempo', action: 'click', selector: '[data-testid="tempo-plus"]', hold: 1200 },
  ]);
  assert.equal(flow.id, 'open-play-score-and-raise-the-tempo');
  assert.equal(flow.title, 'Open Play Score and raise the tempo.');
  assert.equal(flow.description, 'Open Play Score and raise the tempo.');
  assert.equal(flow.viewport?.width, 1440);
  assert.equal(flow.steps.length, 2);
  assert.equal(flow.steps[1].hold, 1200);
});

test('assembleFlow avoids a colliding id', () => {
  const flow = assembleFlow({ text: 'Play a score' }, [], ['play-a-score']);
  assert.equal(flow.id, 'play-a-score-2');
});

test('assembleFlow rejects a control step without a selector', () => {
  assert.throws(
    () => assembleFlow({ text: 'x' }, [{ phrase: 'press play', action: 'click' }]),
    /needs a resolved selector/,
  );
});

test('assembleFlow inserts a content wait before the step', () => {
  const flow = assembleFlow({ text: 'x' }, [
    {
      phrase: 'wait for the score',
      action: 'click',
      selector: '[data-testid="play"]',
      waitForContent: { script: "document.querySelectorAll('svg line').length > 40" },
    },
  ]);
  assert.equal(flow.steps[0].action, 'waitForFunction');
  assert.equal(flow.steps[1].action, 'click');
});

test('slug, titleFrom and uniqueId', () => {
  assert.equal(slug('Für Elise & Tempo!'), 'f-r-elise-tempo');
  assert.equal(titleFrom('One. Two.'), 'One.');
  assert.equal(uniqueId('a', ['a', 'a-2']), 'a-3');
  assert.equal(uniqueId('a', []), 'a');
});
