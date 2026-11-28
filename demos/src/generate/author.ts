/**
 * Author a flow from a plan (research D4): the deterministic half of the
 * generation workflow. Resolves each step's phrase against the derived index,
 * assembles the Flow, and builds the Generation Report. Never touches the app
 * and never starts a capture — the agent supplies the ordering and presentation.
 */
import { describeCandidate, lookup } from '../catalog/lookup.ts';
import { assembleFlow } from './flow.ts';
import { buildReport } from './report.ts';
import type { Goal, StepInput } from './flow.ts';
import type { Catalog } from '../catalog/schema.ts';
import type { Flow } from '../types.ts';
import type { GenerationReport, UnresolvedRef } from './report.ts';

export interface PlanStep {
  phrase?: string;
  selector?: string;
  action: StepInput['action'];
  caption?: string;
  hold?: number;
  pressMs?: number;
  waitForContent?: { script: string; timeout?: number };
}

export interface Plan {
  goal: Goal;
  steps: PlanStep[];
  /** Optional expected outcome — asserted by the representative-set test. */
  expect?: { resolved?: number; unresolved?: number; steps?: number };
}

export interface AuthorResult {
  flow: Flow;
  report: GenerationReport;
}

/** Resolve and assemble one plan into a flow + report. */
export function authorFromPlan(
  catalog: Catalog,
  plan: Plan,
  existingIds: string[],
  startedAt: number = Date.now(),
): AuthorResult {
  let lookupMs = 0;
  const resolved: { step: string; target: string }[] = [];
  const unresolved: UnresolvedRef[] = [];
  const steps: StepInput[] = [];

  for (const s of plan.steps) {
    let selector = s.selector;

    if (!selector && s.phrase) {
      const t0 = Date.now();
      const result = lookup(catalog, s.phrase);
      lookupMs += Date.now() - t0;
      if (result.resolved && result.entry) {
        selector = result.entry.selectorHints?.[0] ?? `[data-testid="${result.entry.testid}"]`;
      } else {
        unresolved.push({
          step: s.phrase,
          reason: result.reason ?? 'missing',
          candidates: result.candidates.map(describeCandidate),
        });
        continue;
      }
    }

    if (!selector && (s.action === 'click' || s.action === 'waitFor')) {
      unresolved.push({ step: s.phrase ?? s.action, reason: 'missing', candidates: [] });
      continue;
    }

    const step: StepInput = { phrase: s.phrase ?? selector ?? s.action, action: s.action };
    if (selector) step.selector = selector;
    if (s.caption !== undefined) step.caption = s.caption;
    if (s.hold !== undefined) step.hold = s.hold;
    if (s.pressMs !== undefined) step.pressMs = s.pressMs;
    if (s.waitForContent) step.waitForContent = s.waitForContent;
    steps.push(step);
    resolved.push({ step: s.phrase ?? selector ?? s.action, target: selector ?? '(script)' });
  }

  const flow = assembleFlow(plan.goal, steps, existingIds);
  const report = buildReport({
    flowId: flow.id,
    elapsedMs: Date.now() - startedAt,
    lookupMs,
    stepsProduced: flow.steps.length,
    resolved,
    unresolved,
  });
  return { flow, report };
}
