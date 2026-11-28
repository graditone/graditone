/**
 * Post-processing, stage two: hand the clip to DemoClip.
 *
 * DemoClip is a browser studio, and it publishes its own operations on
 * `window.democlip` when a page is opened with `?agent=1` (the same surface its
 * MCP server drives). Importing a file needs no screen picker — the app's own
 * `#file-input` takes it — so the whole step runs headless.
 *
 * What we do with it here is deliberately small and declarative: import the
 * recording, then brand it from the flow's own metadata (logo, title,
 * description, title card) and any annotations the flow declares. The export is
 * the finished MP4.
 *
 * The app is served from a built DemoClip (a `dist/`), found via DEMOCLIP_APP
 * or the usual places. If none is found the step is skipped with a note, so a
 * capture-only run still works.
 */

import { chromium, type Browser } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { createRequire } from 'node:module';
import path from 'node:path';
import { probeDurationSec } from './postprocess.ts';
import type { Flow, FlowPaths, StepMark } from './types.ts';

declare global {
  interface Window {
    /** DemoClip's own automation surface, published only with `?agent=1`. */
    democlip?: DemoClipSurface;
  }
}

/** As much of DemoClip's surface as we touch; the rest is reached by name. */
interface DemoClipSurface {
  describe(): { takes: unknown[] };
  readonly [key: string]: unknown;
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ico': 'image/x-icon',
};

/** Where the built DemoClip app lives. */
function findAppRoot(): string | null {
  if (process.env.DEMOCLIP_APP) return process.env.DEMOCLIP_APP;
  const candidates = [path.join(homedir(), 'devel', 'democlip', 'dist')];
  try {
    const require = createRequire(import.meta.url);
    candidates.push(path.join(path.dirname(require.resolve('democlip-mcp/package.json')), 'app'));
  } catch {
    /* democlip-mcp is not installed; fine */
  }
  return candidates.find((dir) => existsSync(path.join(dir, 'index.html'))) ?? null;
}

interface AppServer {
  origin: string;
  close: () => Promise<void>;
}

/** A tiny static server, because the app is a folder of files. */
async function serveDirectory(root: string): Promise<AppServer> {
  const server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
      let file = path.normalize(path.join(root, pathname));
      if (!file.startsWith(root)) {
        res.writeHead(403).end();
        return;
      }
      if (existsSync(file) && (await stat(file)).isDirectory()) file = path.join(file, 'index.html');
      if (!existsSync(file)) file = path.join(root, 'index.html'); // SPA fallback
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch (error) {
      res.writeHead(500).end(String(error));
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

export interface DemoClipOptions {
  out: string;
  /** The recorded step marks — their captions become DemoClip text annotations. */
  marks?: StepMark[];
}

/** Run the flow's post-processing in DemoClip. Returns the exported file, or null. */
export async function postProcessWithDemoClip(
  flow: Flow,
  paths: FlowPaths,
  { out, marks = [] }: DemoClipOptions,
): Promise<string | null> {
  if (!existsSync(paths.muxed)) {
    console.warn('  ! DemoClip: no muxed recording to post-process');
    return null;
  }
  const appRoot = findAppRoot();
  if (!appRoot) {
    console.warn('  ! DemoClip: no build found (set DEMOCLIP_APP=/path/to/dist); skipping');
    return null;
  }

  const app = await serveDirectory(appRoot);
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({ headless: !process.env.DEMO_HEADFUL });
    const context = await browser.newContext({ viewport: null, acceptDownloads: true });
    const page = await context.newPage();
    await page.goto(`${app.origin}/?agent=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.democlip), undefined, { timeout: 30_000 });

    const call = (surfacePath: string, ...args: unknown[]): Promise<unknown> =>
      page.evaluate(
        ([target, callArgs]) => {
          const parts = target.split('.');
          let owner = (window.democlip ?? {}) as Record<string, unknown>;
          for (const part of parts.slice(0, -1)) owner = owner[part] as Record<string, unknown>;
          const fn = owner[parts[parts.length - 1]];
          return (fn as (...a: unknown[]) => unknown).apply(owner, callArgs);
        },
        [surfacePath, args] as [string, unknown[]],
      );

    // 1. Import the recording — the app's own Import input, no picker.
    await page.locator('#file-input').setInputFiles(paths.muxed);
    await page.waitForFunction(() => window.democlip!.describe().takes.length > 0, undefined, {
      timeout: 30_000,
    });

    // 2. Brand it from the flow, the way a person would in the properties panel.
    const brand: Record<string, string> = {
      logo: flow.democlip?.logo ?? 'graditone',
      title: flow.title,
      description: typeof flow.description === 'string' ? flow.description.trim() : '',
    };
    for (const [property, value] of Object.entries(brand)) {
      if (value) await call('edit.setClipProperty', property, value);
    }
    if (flow.democlip?.titleCard !== false) {
      await call('edit.setClipProperty', 'addToExport', 'true');
    }

    // 3. Captions — placed as DemoClip text annotations, never burned into the
    //    recording, so the author can adjust them in DemoClip.
    await addCaptions(call, paths.muxed, marks);

    // 4. Any other annotations the flow declares (arrows, sounds, …).
    for (const annotation of flow.democlip?.annotations ?? []) {
      await call('edit.annotate', annotation.kind, annotation);
    }

    // 5. Export the finished file and catch the download.
    const target = path.join(out, `${flow.id}.mp4`);
    const download = page.waitForEvent('download', { timeout: 300_000 });
    const result = (await call('out.export', 'mp4')) as { ok?: boolean; reason?: string } | undefined;
    if (result?.ok === false) throw new Error(`export refused: ${result.reason}`);
    await (await download).saveAs(target);

    console.log(`  ✓ DemoClip → ${path.basename(target)}`);
    await context.close();
    return target;
  } catch (error) {
    console.warn(`  ! DemoClip step failed: ${(error as Error).message}`);
    return null;
  } finally {
    if (browser) await browser.close().catch(() => {});
    await app.close();
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Place each caption as a DemoClip text annotation over the stretch its step
 * owns, derived from the recorded marks. The annotation colour is set to white
 * first so captions do not inherit the app's default (red) colour. The position
 * is bottom-ish and horizontally centred (DemoClip centres text by default).
 */
async function addCaptions(
  call: (surfacePath: string, ...args: unknown[]) => Promise<unknown>,
  muxed: string,
  marks: StepMark[],
): Promise<void> {
  const captions = marks.filter((mark) => mark.caption && mark.caption.trim());
  if (captions.length === 0) return;

  const durationSec = await probeDurationSec(muxed).catch(() => 0);
  if (!(durationSec > 0)) {
    console.warn('  ! DemoClip: could not read the clip duration; captions not placed');
    return;
  }

  await call('edit.setClipProperty', 'annotationColour', '#ffffff');
  for (let i = 0; i < captions.length; i += 1) {
    const start = captions[i].at / 1000;
    const end = i + 1 < captions.length ? captions[i + 1].at / 1000 : durationSec;
    const span = { s: clamp01(start / durationSec), e: clamp01(Math.max(end / durationSec, start / durationSec + 0.01)) };
    await call('edit.annotate', 'text', {
      span,
      text: captions[i].caption,
      y: 0.82,
      height: 0.05,
    });
  }
}
