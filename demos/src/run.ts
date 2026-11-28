#!/usr/bin/env node
/**
 * graditone-demos — turn a flow into a demo video.
 *
 *   node src/run.ts play-a-score      # one flow, by id
 *   node src/run.ts --all             # every flow in flows/
 *   node src/run.ts --list            # list the catalog
 *   DEMO_HEADFUL=1 node src/run.ts    # watch it happen in a real window
 *
 * It makes sure the app is served, records the flow, muxes in the audio, and
 * (unless DEMO_SKIP_DEMOCLIP=1) hands the result to DemoClip.
 */

import { readFile, readdir, mkdir } from 'node:fs/promises';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { runFlow } from './runner.ts';
import { muxWithAudio, audioDelayMs, defaultPaths } from './postprocess.ts';
import { postProcessWithDemoClip } from './democlip.ts';
import type { Flow } from './types.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(ROOT, '..');
const FLOWS_DIR = path.join(ROOT, 'flows');
const OUT_DIR = path.join(ROOT, 'out');
const BASE = process.env.DEMO_BASE_URL || 'http://localhost:5174';

async function reachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.status < 500;
  } catch {
    return false;
  }
}

/** Start the app's dev server if one is not already answering. */
async function ensureServer(): Promise<ChildProcess | null> {
  if (await reachable(BASE)) return null;
  console.log('· starting the Graditone dev server…');
  const child = spawn('npm', ['run', 'dev', '--', '--port', '5174', '--strictPort'], {
    cwd: path.join(REPO, 'frontend'),
    env: { ...process.env, PLAYWRIGHT_TEST: '1' },
    stdio: 'ignore',
  });
  for (let i = 0; i < 160; i += 1) {
    await new Promise((r) => setTimeout(r, 500));
    if (await reachable(BASE)) return child;
    if (child.exitCode !== null) break;
  }
  throw new Error('the dev server did not come up');
}

async function loadFlows(): Promise<Flow[]> {
  const files = (await readdir(FLOWS_DIR))
    .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
    .sort();
  return Promise.all(
    files.map(async (f) => parseYaml(await readFile(path.join(FLOWS_DIR, f), 'utf8')) as Flow),
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith('--')));
  const ids = args.filter((a) => !a.startsWith('--'));

  const flows = await loadFlows();

  if (flags.has('--list')) {
    for (const f of flows) console.log(`${f.id.padEnd(24)} ${f.title}`);
    return;
  }

  const selected = flows.filter((f) => flags.has('--all') || ids.includes(f.id));
  if (selected.length === 0) {
    console.error(`no flow matched. Known ids: ${flows.map((f) => f.id).join(', ')}`);
    process.exitCode = 1;
    return;
  }

  await mkdir(OUT_DIR, { recursive: true });
  const server = await ensureServer();

  try {
    for (const flow of selected) {
      console.log(`\n▶ ${flow.id} — ${flow.title}`);
      const started = Date.now();
      const capture = await runFlow(flow, {
        base: BASE,
        out: OUT_DIR,
        headless: !process.env.DEMO_HEADFUL,
      });
      const paths = defaultPaths(OUT_DIR, flow.id);

      if (capture.pageErrors.length) {
        console.warn(`  ! ${capture.pageErrors.length} page error(s): ${capture.pageErrors[0]}`);
      }

      const delayMs = audioDelayMs(capture.timeline, capture.videoStartMs);
      if (process.env.DEMO_DEBUG) {
        console.log('  · steps:', capture.marks.map((m) => `${Math.round(m.at)}ms`).join(', '));
        console.log('  · audio timeline:', JSON.stringify(capture.timeline));
      }
      const muxed = await muxWithAudio(
        { video: paths.video, audio: capture.audio ? paths.audio : null, delayMs },
        paths.muxed,
      );
      console.log(
        '  ✓ recorded video · muxed' +
          (muxed.hasAudio ? ` (+${muxed.delayMs} ms audio delay)` : ' (silent)') +
          ` → ${path.relative(REPO, paths.muxed)}`,
      );

      if (!process.env.DEMO_SKIP_DEMOCLIP) {
        await postProcessWithDemoClip(flow, paths, { out: OUT_DIR, marks: capture.marks });
      }

      console.log(`  · done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
    }
  } finally {
    server?.kill();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
