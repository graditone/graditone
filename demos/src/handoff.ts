/**
 * The hand-off: everything DemoClip needs to brand and caption a captured clip,
 * written down as data so the **DemoClip MCP** can apply it in the window the
 * person is watching.
 *
 * The harness used to drive DemoClip itself, in a browser of its own, and close
 * that browser when it was done — so the finished clip was a file and nothing
 * else, and the person could not go on editing it. Instead the harness can stop
 * at the muxed recording: `--handoff` (or `DEMO_HANDOFF=1`) leaves the clip as a
 * normal video plus this plan, and the agent opens that clip in the MCP's own
 * (visible, persistent) DemoClip window, applies the plan through the MCP tools,
 * and exports. The window stays open, so the person picks the clip up and evolves
 * it by hand.
 *
 * Nothing here touches a browser: it is the arithmetic that turns the recorded
 * step marks into the stretches a caption belongs over, plus the flow's own
 * branding. That keeps it testable, and keeps the harness and the in-harness
 * DemoClip path (`democlip.ts`) agreeing on one definition of a caption's span.
 */

import type { Flow, FlowAnnotation, FlowStep, StepMark } from './types.ts';

/** The colour captions are made in — Graditone's orange — unless a flow names another. */
export const DEFAULT_ANNOTATION_COLOUR = '#ff6c23';

/** The overview font's place on the picture (fractions), for a caption text. */
export const CAPTION_Y = 0.82;
export const CAPTION_HEIGHT = 0.05;

/** The stock sound an action lands with — the app's own `thud`. */
export const ACTION_SOUND = 'thud';

/** How long that sound is played for, in seconds (its file is 0.45 s). */
const ACTION_SOUND_SECONDS = 0.45;

/** One caption: the words, and the stretch of the clip they are shown over. */
export interface CaptionPlan {
  text: string;
  span: { s: number; e: number };
}

/**
 * What the MCP needs to finish one captured clip, as a single readable document.
 *
 * It carries the flow's branding (`title`, `description`, `logo`, `addToExport`,
 * `annotationColour`) and the captions with their spans already worked out, so the
 * agent does not have to re-derive them from the flow and the debug timings.
 */
export interface HandoffPlan {
  id: string;
  title: string;
  description: string;
  /** The clip's length in seconds — what the spans are fractions of. */
  clipSeconds: number;
  logo: string;
  addToExport: boolean;
  annotationColour: string;
  /** The caption over each stretch, in the order they appear in the clip. */
  captions: CaptionPlan[];
  /** The annotations to place after the captions — the flow's own, then the action cues. */
  annotations: FlowAnnotation[];
}

/** Keep a fraction inside [0, 1]. */
export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Turn the recorded step marks into the stretches their captions own.
 *
 * A caption runs from its own step to the next caption (or the end of the clip),
 * which is how the runner has always placed them. The last caption reaches the
 * clip's end. The end is nudged at least 1% past the start, so a caption with no
 * successor at the very end is still a stretch DemoClip will draw.
 */
export function captionSpans(marks: StepMark[], durationSec: number): CaptionPlan[] {
  const captions = marks.filter((mark) => mark.caption && mark.caption.trim());
  if (!(durationSec > 0)) return [];
  return captions.map((mark, index) => {
    const start = mark.at / 1000;
    const end = index + 1 < captions.length ? captions[index + 1].at / 1000 : durationSec;
    const s = clamp01(start / durationSec);
    const e = clamp01(Math.max(end / durationSec, s + 0.01));
    return { text: mark.caption!.trim(), span: { s, e } };
  });
}

/** The actions whose landing is cued — a control pressed, or a key. */
function isAction(step: FlowStep): boolean {
  return step.action === 'click' || step.action === 'press';
}

/**
 * The cues a flow asks for: an **arrow** at the control each action lands on, and a
 * **sound** the moment it lands. Nothing unless the flow asks (`democlip.actionCues`).
 *
 * The arrow points at the control's centre — tail a little above it, or below when the
 * control sits near the top so the arrow stays on the picture — over the stretch the step
 * owns (to the next step, or the end). The sound is placed where the action landed
 * (`doneAt`, taken at the press rather than after the step's hold), a `thud` by default.
 */
export function actionCueAnnotations(
  flow: Flow,
  marks: StepMark[],
  durationSec: number,
): FlowAnnotation[] {
  if (!flow.democlip?.actionCues || !(durationSec > 0)) return [];
  const cues: FlowAnnotation[] = [];
  flow.steps.forEach((step, index) => {
    const mark = marks[index];
    if (!mark || !isAction(step)) return;

    if (mark.target) {
      const { x, y } = mark.target;
      const end = marks[index + 1]?.at ?? durationSec * 1000;
      const s = clamp01(mark.at / 1000 / durationSec);
      const e = clamp01(Math.max(end / 1000 / durationSec, s + 0.02));
      const above = y >= 0.18;
      cues.push({
        kind: 'arrow',
        span: { s, e },
        from: { x, y: above ? y - 0.16 : y + 0.16 },
        to: { x, y: above ? y - 0.02 : y + 0.02 },
      });
    }

    const landed = clamp01((mark.doneAt ?? mark.at) / 1000 / durationSec);
    cues.push({
      kind: 'sound',
      span: { s: landed, e: clamp01(Math.min(1, landed + ACTION_SOUND_SECONDS / durationSec)) },
      sound: ACTION_SOUND,
    });
  });
  return cues;
}

/** The plan for one flow and its capture. */
export function buildHandoffPlan(flow: Flow, marks: StepMark[], durationSec: number): HandoffPlan {
  return {
    id: flow.id,
    title: flow.title,
    description: typeof flow.description === 'string' ? flow.description.trim() : '',
    clipSeconds: Math.round(durationSec * 1000) / 1000,
    logo: flow.democlip?.logo ?? 'graditone',
    addToExport: flow.democlip?.titleCard !== false,
    annotationColour: flow.democlip?.annotationColour ?? DEFAULT_ANNOTATION_COLOUR,
    captions: captionSpans(marks, durationSec),
    annotations: [...(flow.democlip?.annotations ?? []), ...actionCueAnnotations(flow, marks, durationSec)],
  };
}

/**
 * What to print after a hand-off run: the clip, the plan, and the MCP steps that
 * apply one to the other. Paths are absolute so they can be pasted straight into
 * `import_take`/`export_clip`.
 */
export function handoffInstructions(plan: HandoffPlan, clip: string, planPath: string): string {
  const lines = [
    `  → hand off to the DemoClip MCP (the window the person can see):`,
    `      clip:  ${clip}`,
    `      plan:  ${planPath}`,
    `      import_take("${clip}")`,
    `      set_clip_property title / description / addToExport from the plan`,
    `      annotate("text", { span, text }) for each plan.captions entry` +
      (plan.annotations.length ? `, then each plan.annotations entry` : ''),
    `      export_clip("mp4")  → rename the result to demos/out/${plan.id}.mp4`,
  ];
  return lines.join('\n');
}
