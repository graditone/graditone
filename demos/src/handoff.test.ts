import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTION_SOUND,
  DEFAULT_ANNOTATION_COLOUR,
  actionCueAnnotations,
  buildHandoffPlan,
  captionSpans,
  clamp01,
  handoffInstructions,
} from './handoff.ts';
import type { Flow, StepMark } from './types.ts';

const mark = (at: number, caption?: string): StepMark => ({ label: caption ?? 'hold', at, caption });

test('clamp01 keeps a fraction inside [0, 1]', () => {
  assert.equal(clamp01(-0.2), 0);
  assert.equal(clamp01(0.4), 0.4);
  assert.equal(clamp01(1.7), 1);
});

test('each caption runs to the next, and the last reaches the end', () => {
  const spans = captionSpans([mark(1000, 'one'), mark(5000, 'two')], 10);
  assert.deepEqual(spans, [
    { text: 'one', span: { s: 0.1, e: 0.5 } },
    { text: 'two', span: { s: 0.5, e: 1 } },
  ]);
});

test('steps without a caption are skipped, not stretched over', () => {
  const spans = captionSpans([mark(0, 'open'), mark(2000), mark(6000, 'play')], 10);
  assert.deepEqual(spans.map((c) => c.text), ['open', 'play']);
  assert.deepEqual(spans[0].span, { s: 0, e: 0.6 });
});

test('the last caption is stretched to the end of the clip', () => {
  const [only] = captionSpans([mark(9000, 'done')], 10);
  assert.deepEqual(only.span, { s: 0.9, e: 1 });
});

test('no duration means no spans', () => {
  assert.deepEqual(captionSpans([mark(1000, 'one')], 0), []);
});

const flow: Flow = {
  id: 'play-a-score',
  title: 'Play a Score',
  description: '  Open it and listen.  ',
  steps: [],
};

test('the plan carries the flow branding, with the Graditone defaults', () => {
  const plan = buildHandoffPlan(flow, [mark(1000, 'hello')], 4);
  assert.equal(plan.id, 'play-a-score');
  assert.equal(plan.title, 'Play a Score');
  assert.equal(plan.description, 'Open it and listen.');
  assert.equal(plan.clipSeconds, 4);
  assert.equal(plan.logo, 'graditone');
  assert.equal(plan.addToExport, true);
  assert.equal(plan.annotationColour, DEFAULT_ANNOTATION_COLOUR);
  assert.deepEqual(plan.captions, [{ text: 'hello', span: { s: 0.25, e: 1 } }]);
});

test('a flow may override the branding', () => {
  const branded: Flow = {
    ...flow,
    democlip: { logo: 'acme', titleCard: false, annotationColour: '#123456', annotations: [
      { kind: 'arrow', span: { s: 0.1, e: 0.2 } },
    ] },
  };
  const plan = buildHandoffPlan(branded, [], 4);
  assert.equal(plan.logo, 'acme');
  assert.equal(plan.addToExport, false);
  assert.equal(plan.annotationColour, '#123456');
  assert.deepEqual(plan.annotations, [{ kind: 'arrow', span: { s: 0.1, e: 0.2 } }]);
});

test('the instructions name the clip, the plan and the MCP steps', () => {
  const plan = buildHandoffPlan(flow, [], 4);
  const text = handoffInstructions(plan, '/tmp/out/play-a-score.webm', '/tmp/out/play-a-score.democlip-plan.json');
  assert.match(text, /\/tmp\/out\/play-a-score\.webm/);
  assert.match(text, /import_take/);
  assert.match(text, /export_clip/);
});

// The action cues: an arrow at the control a tap lands on, and a `thud` as it lands.

const cuesFlow: Flow = {
  id: 'cued',
  title: 'Cued',
  steps: [{ action: 'click' }, { action: 'waitFor' }, { action: 'click' }, { action: 'press' }],
  democlip: { actionCues: true },
};

const cuesMarks: StepMark[] = [
  { label: 'click', at: 1000, doneAt: 1300, target: { x: 0.5, y: 0.5 } },
  { label: 'waitFor', at: 2000 },
  { label: 'click', at: 5000, doneAt: 5300, target: { x: 0.5, y: 0.1 } },
  { label: 'press', at: 8000, doneAt: 8000 },
];

test('an action is cued with an arrow at its control and a thud as it lands', () => {
  const cues = actionCueAnnotations(cuesFlow, cuesMarks, 10);
  const near = (actual: number, expected: number): void =>
    assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} is not ~${expected}`);
  const point = (value: unknown): { x: number; y: number } => value as { x: number; y: number };

  assert.deepEqual(cues.map((cue) => cue.kind), ['arrow', 'sound', 'arrow', 'sound', 'sound']);
  assert.equal(cues[0].kind, 'arrow');
  near(cues[0].span.s, 0.1);
  near(cues[0].span.e, 0.2);
  near(point(cues[0].from).y, 0.34);
  near(point(cues[0].to).y, 0.48);
  assert.equal(cues[1].kind, 'sound');
  assert.equal(cues[1].sound, ACTION_SOUND);
  near(cues[1].span.s, 0.13);
  near(cues[1].span.e, 0.175);
  // A control near the top is pointed at from below, so the arrow stays on the picture.
  near(point(cues[2].from).y, 0.26);
  near(point(cues[2].to).y, 0.12);
  // A key press has no control to point at, so it is heard, not shown.
  assert.equal(cues[4].kind, 'sound');
  assert.equal(cues[4].sound, ACTION_SOUND);
  near(cues[4].span.s, 0.8);
  near(cues[4].span.e, 0.845);
});

test('nothing is cued unless the flow asks, or without a clip length', () => {
  assert.deepEqual(actionCueAnnotations({ ...cuesFlow, democlip: {} }, cuesMarks, 10), []);
  assert.deepEqual(actionCueAnnotations(cuesFlow, cuesMarks, 0), []);
});

test('a step may cue itself in a demo that asks for none', () => {
  const flow: Flow = {
    id: 'x',
    title: 'X',
    steps: [{ action: 'click' }, { action: 'click', cue: true }],
  };
  const marks: StepMark[] = [
    { label: 'click', at: 0, doneAt: 0, target: { x: 0.5, y: 0.5 } },
    { label: 'click', at: 1000, doneAt: 1000, target: { x: 0.5, y: 0.5 } },
  ];
  assert.deepEqual(actionCueAnnotations(flow, marks, 10).map((cue) => cue.kind), ['arrow', 'sound']);
});

test('a step may opt out of the demo’s cues, and name its own sound', () => {
  const flow: Flow = {
    id: 'x',
    title: 'X',
    democlip: { actionCues: true },
    steps: [
      { action: 'click', cue: false },
      { action: 'click', sound: 'whoosh' },
      { action: 'click' },
    ],
  };
  const marks: StepMark[] = [0, 1000, 2000].map((at) => ({
    label: 'click',
    at,
    doneAt: at,
    target: { x: 0.5, y: 0.5 },
  }));
  const cues = actionCueAnnotations(flow, marks, 10);
  assert.deepEqual(cues.map((cue) => cue.kind), ['arrow', 'sound', 'arrow', 'sound']);
  assert.deepEqual(
    cues.filter((cue) => cue.kind === 'sound').map((cue) => cue.sound),
    ['whoosh', 'thud'],
  );
});

test('the plan carries the cues after the flow’s own annotations', () => {
  const plan = buildHandoffPlan({ ...cuesFlow, democlip: { actionCues: true, annotations: [{ kind: 'text', span: { s: 0, e: 0.1 }, text: 'hi' }] } }, cuesMarks, 10);
  assert.equal(plan.annotations.length, 6);
  assert.equal(plan.annotations[0].kind, 'text');
  assert.equal(plan.annotations[1].kind, 'arrow');
});
