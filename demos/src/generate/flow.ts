/**
 * Assemble a Flow Document from resolved step inputs (data-model.md §5–6).
 *
 * The output is exactly the `Flow` the existing runner consumes — same fields,
 * same step vocabulary — so the video pipeline is unchanged (FR-002/FR-014).
 * A step that needs a control but has no resolved selector is rejected.
 */
import type { Flow, FlowStep } from '../types.ts';

export type StepAction = 'goto' | 'click' | 'waitFor' | 'waitForFunction' | 'press' | 'evaluate' | 'hold';

export interface Goal {
  text: string;
  /** Optional explicit flow id (slugged); defaults to one derived from `text`. */
  id?: string;
  audience?: string | null;
  plugin?: string | null;
  locale?: string;
}

export interface StepInput {
  /** The goal fragment this step came from. */
  phrase: string;
  action: StepAction;
  selector?: string;
  script?: string;
  url?: string;
  key?: string;
  caption?: string;
  hold?: number;
  pressMs?: number;
  /** A wait to insert immediately before this step (async content, FR-010). */
  waitForContent?: { script: string; timeout?: number };
}

const DEFAULT_VIEWPORT = { width: 1440, height: 900 };

/** A URL/id-safe slug for the goal text. */
export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}

/** A short title from the goal: its first sentence, trimmed. */
export function titleFrom(text: string): string {
  const firstSentence = text.split(/(?<=[.!?])\s/)[0]?.trim() || text.trim();
  return firstSentence.length > 64 ? `${firstSentence.slice(0, 61).trimEnd()}…` : firstSentence;
}

/** A flow id that does not collide with any existing flow (FR-012). */
export function uniqueId(base: string, existing: string[]): string {
  const root = base || 'demo-flow';
  if (!existing.includes(root)) return root;
  let n = 2;
  while (existing.includes(`${root}-${n}`)) n += 1;
  return `${root}-${n}`;
}

/** Assemble a Flow Document from a goal and its resolved steps. */
export function assembleFlow(goal: Goal, steps: StepInput[], existingIds: string[] = []): Flow {
  const flowSteps: FlowStep[] = [];

  for (const s of steps) {
    if (s.waitForContent) {
      flowSteps.push({
        action: 'waitForFunction',
        script: s.waitForContent.script,
        timeout: s.waitForContent.timeout ?? 30_000,
      });
    }

    if ((s.action === 'click' || s.action === 'waitFor') && !s.selector) {
      throw new Error(`step "${s.phrase}" needs a resolved selector (it targets a control)`);
    }

    const step: FlowStep = { action: s.action };
    if (s.selector !== undefined) step.selector = s.selector;
    if (s.script !== undefined) step.script = s.script;
    if (s.url !== undefined) step.url = s.url;
    if (s.key !== undefined) step.key = s.key;
    if (s.caption !== undefined) step.caption = s.caption;
    if (s.hold !== undefined) step.hold = s.hold;
    if (s.pressMs !== undefined) step.pressMs = s.pressMs;
    flowSteps.push(step);
  }

  const flow: Flow = {
    id: uniqueId(goal.id ? slug(goal.id) : slug(goal.text), existingIds),
    title: titleFrom(goal.text),
    description: goal.text,
    viewport: DEFAULT_VIEWPORT,
    steps: flowSteps,
  };
  if (goal.audience) flow.audience = goal.audience;
  return flow;
}
