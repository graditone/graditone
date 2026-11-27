/**
 * The generic runner: take a flow (data) and drive Graditone with Playwright,
 * recording video and audio. It knows nothing about any particular flow.
 */

import { chromium } from 'playwright';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { installDemoChrome } from './pageChrome.mjs';
import { installAudioCapture } from './audioCapture.mjs';

const DEFAULT_VIEWPORT = { width: 1440, height: 900 };

/** Glide the (hidden) mouse to an element's centre, then click it. */
async function glideClick(page, selector, { steps = 22, settle = 140 } = {}) {
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: 'visible', timeout: 30_000 });
  const box = await locator.boundingBox();
  if (!box) throw new Error(`no box for ${selector}`);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y, { steps });
  await page.waitForTimeout(settle);
  await page.mouse.down();
  await page.waitForTimeout(70);
  await page.mouse.up();
}

async function setCaption(page, text) {
  await page.evaluate((t) => window.__demoCaption?.(t), text ?? '');
}

async function runStep(page, step) {
  if (step.caption !== undefined) await setCaption(page, step.caption);
  // (marks are recorded by the caller, around each step)

  switch (step.action) {
    case undefined:
    case 'hold':
      break;
    case 'goto':
      await page.goto(step.url ?? '/', { waitUntil: 'domcontentloaded' });
      break;
    case 'click':
      await glideClick(page, step.selector, step);
      break;
    case 'waitFor':
      await page
        .locator(step.selector)
        .first()
        .waitFor({ state: step.state ?? 'visible', timeout: step.timeout ?? 30_000 });
      break;
    case 'waitForFunction':
      await page.waitForFunction(step.script, undefined, { timeout: step.timeout ?? 30_000 });
      break;
    case 'press':
      await page.keyboard.press(step.key);
      break;
    case 'evaluate':
      await page.evaluate(step.script);
      break;
    default:
      throw new Error(`unknown action: ${step.action}`);
  }

  if (step.hold) await page.waitForTimeout(step.hold);
}

/**
 * Run one flow. Returns the raw video path, the parallel audio path (if any),
 * and the wall-clock marks the post-processing needs to line them up.
 */
export async function runFlow(flow, { base, out, headless = true }) {
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

  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  try {
    await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });

    const marks = [];
    for (const step of flow.steps) {
      marks.push({ label: step.caption ?? step.action ?? 'hold', at: Date.now() - videoStartMs });
      await runStep(page, step);
    }

    // Stop the in-page recorder and collect the audio the app produced.
    let audio = null;
    let timeline = null;
    try {
      const result = await page.evaluate(async () => {
        const tap = window.__demoAudio;
        if (!tap) return null;
        return tap.stop();
      });
      if (process.env.DEMO_DEBUG) {
        console.log('  · audio result:', JSON.stringify(result && { bytes: result.bytes, timeline: result.timeline }));
      }
      if (result?.dataUrl && result.bytes > 0) {
        timeline = result.timeline;
        audio = path.join(rawDir, `${flow.id}.audio.webm`);
        await writeFile(audio, Buffer.from(result.dataUrl.split(',')[1], 'base64'));
      } else {
        console.warn(
          '  ! no audio was captured — the AudioContext clock was silent/frozen.\n' +
            '    Usually the machine has no working audio output (a USB interface that is\n' +
            '    unplugged or asleep freezes it); check the system output device.',
        );
      }
    } catch (error) {
      console.warn(`  ! audio capture failed: ${error.message}`);
    }

    return { video, videoStartMs, audio, timeline, marks, pageErrors };
  } finally {
    await context.close();
    const videoPath = path.join(rawDir, `${flow.id}.video.webm`);
    await video.saveAs(videoPath);
    await browser.close();
  }
}
