/**
 * The generic runner: take a flow (data) and drive Graditone with Playwright,
 * recording video and audio. It knows nothing about any particular flow.
 */

import { chromium, type Page } from 'playwright';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { installDemoChrome } from './pageChrome.ts';
import { installAudioCapture } from './audioCapture.ts';
import type { CaptureResult, CaptureTimeline, Flow, FlowStep, StepMark } from './types.ts';

const DEFAULT_VIEWPORT = { width: 1440, height: 900 };

interface GlideOptions {
  steps?: number;
  settle?: number;
  pressMs?: number;
}

/** Glide the (hidden) mouse to an element's centre, then click it; returns that centre. */
async function glideClick(
  page: Page,
  selector: string,
  { steps = 22, settle = 140, pressMs = 70 }: GlideOptions = {},
): Promise<{ x: number; y: number }> {
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: 'visible', timeout: 30_000 });
  const box = await locator.boundingBox();
  if (!box) throw new Error(`no box for ${selector}`);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y, { steps });
  await page.waitForTimeout(settle);
  await page.mouse.down();
  await page.waitForTimeout(pressMs);
  await page.mouse.up();
  return { x, y };
}

/** The selector a step needs, or a clear error naming the step that lacks one. */
function requireSelector(step: FlowStep): string {
  if (!step.selector) throw new Error(`step "${step.action ?? 'click'}" needs a selector`);
  return step.selector;
}

/** Run one step's action; answers where a click landed, so its cue can point at it. */
async function runStep(page: Page, step: FlowStep): Promise<{ x: number; y: number } | undefined> {
  switch (step.action) {
    case undefined:
    case 'hold':
      break;
    case 'goto':
      await page.goto(step.url ?? '/', { waitUntil: 'domcontentloaded' });
      break;
    case 'click':
      return glideClick(page, requireSelector(step), step);
    case 'waitFor':
      await page
        .locator(requireSelector(step))
        .first()
        .waitFor({ state: step.state ?? 'visible', timeout: step.timeout ?? 30_000 });
      break;
    case 'waitForFunction':
      await page.waitForFunction(step.script ?? 'true', undefined, { timeout: step.timeout ?? 30_000 });
      break;
    case 'press':
      await page.keyboard.press(step.key ?? '');
      break;
    case 'evaluate':
      await page.evaluate(step.script ?? '');
      break;
    default:
      throw new Error(`unknown action: ${String(step.action)}`);
  }
  return undefined;
}

/** Keep a fraction inside [0, 1]. */
function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export interface RunOptions {
  base: string;
  out: string;
  headless?: boolean;
}

/**
 * Run one flow. Returns the raw video path, the parallel audio path (if any),
 * and the wall-clock marks the post-processing needs to line them up.
 */
export async function runFlow(
  flow: Flow,
  { base, out, headless = true }: RunOptions,
): Promise<CaptureResult> {
  const viewport = flow.viewport ?? DEFAULT_VIEWPORT;
  const rawDir = path.join(out, 'raw', flow.id);
  await rm(rawDir, { recursive: true, force: true });
  await mkdir(rawDir, { recursive: true });

  const browser = await chromium.launch({
    headless,
    args: [
      '--autoplay-policy=no-user-gesture-required',
      // The recorded frame comes from the window, not the emulated viewport, so
      // the window has to match or the page lands in a corner of the video.
      `--window-size=${viewport.width},${viewport.height}`,
    ],
  });
  const context = await browser.newContext({
    viewport,
    hasTouch: true,
    recordVideo: { dir: rawDir, size: viewport },
  });
  await context.addInitScript(installDemoChrome);
  await context.addInitScript(installAudioCapture);

  // The video's own t=0 is when the page is created, so mark it right after
  // `newPage()` returns rather than before it — the few hundred ms of page
  // creation otherwise land in the audio delay.
  const page = await context.newPage();
  const videoStartMs = Date.now();
  const video = page.video();

  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  try {
    await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });

    const marks: StepMark[] = [];
    for (const step of flow.steps) {
      const mark: StepMark = {
        label: step.caption ?? step.action ?? 'hold',
        at: Date.now() - videoStartMs,
        caption: step.caption,
      };
      marks.push(mark);
      const target = await runStep(page, step);
      if (target) {
        mark.target = { x: clamp01(target.x / viewport.width), y: clamp01(target.y / viewport.height) };
      }
      // The moment an action lands — the marker a cue's sound plays on. Taken before the
      // step's own `hold`, so the sound is heard at the press and not after the pause.
      if (step.action === 'click' || step.action === 'press') mark.doneAt = Date.now() - videoStartMs;
      if (step.hold) await page.waitForTimeout(step.hold);
    }

    // Stop the in-page recorder and collect the audio the app produced.
    let audio: string | null = null;
    let timeline: CaptureTimeline | null = null;
    try {
      const result = await page.evaluate(async () => {
        const tap = window.__demoAudio;
        if (!tap) return null;
        return tap.stop();
      });
      const dataUrl = result?.dataUrl ?? null;
      if (process.env.DEMO_DEBUG) {
        console.log(
          '  · audio result:',
          JSON.stringify(result && { bytes: result.bytes, timeline: result.timeline }),
        );
      }
      if (dataUrl && result && result.bytes > 0) {
        timeline = result.timeline;
        audio = path.join(rawDir, `${flow.id}.audio.webm`);
        await writeFile(audio, Buffer.from(dataUrl.split(',')[1] ?? '', 'base64'));
      } else {
        console.warn(
          '  ! no audio was captured — the AudioContext clock was silent/frozen.\n' +
            '    Usually the machine has no working audio output (a USB interface that is\n' +
            '    unplugged or asleep freezes it); check the system output device.',
        );
      }
    } catch (error) {
      console.warn(`  ! audio capture failed: ${(error as Error).message}`);
    }

    return { video, videoStartMs, audio, timeline, marks, pageErrors };
  } finally {
    await context.close();
    const videoPath = path.join(rawDir, `${flow.id}.video.webm`);
    if (video) await video.saveAs(videoPath);
    await browser.close();
  }
}
