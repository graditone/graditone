/**
 * In-page audio capture — because Playwright's `recordVideo` records no audio.
 *
 * Graditone plays through the Web Audio API (Tone.js). There is no browser API
 * that hands a page the tab's own output stream, so we tap the audio graph
 * instead: whenever a node connects to its AudioContext's destination, we
 * connect it to a `MediaStreamAudioDestinationNode` too, and record that with
 * `MediaRecorder`. The result is a real, in-sync Opus track we can mux with the
 * video (see postprocess.ts).
 *
 * Three things make this fiddly, and each is handled here:
 *
 *  - The page can hold **more than one** AudioContext (a keep-alive one, then
 *    the one that really plays). A single tap bound to "the first context" can
 *    end up recording silence, so we keep one recorder **per context** and
 *    concatenate them.
 *  - The recorder must not start while its context is suspended: a
 *    `MediaRecorder` on a suspended graph's stream yields nothing at all, not
 *    even silence. So we start each one only once its context is running.
 *  - `recordVideo` starts when the browser context does, the audio when sound
 *    first flows, and they are not the same moment. So we record the wall-clock
 *    marks the runner needs to line them up.
 *
 * The function is serialised into the page, so it takes nothing from this
 * module's scope; the types are only for the Node side.
 */

import type { CaptureTimeline, StopResult } from './types.ts';

/** One recorder, its tap and its collected chunks. */
interface TapEntry {
  streamDest: MediaStreamAudioDestinationNode;
  analyser: AnalyserNode;
  recorder: MediaRecorder;
  chunks: Blob[];
  startedAt: number;
}

/** A node that reached its context's destination, kept for (re)connecting. */
interface TapNode {
  node: AudioNode;
  ctx: AudioContext;
}

/** The native `connect`, loose enough to call with our own destinations. */
type ConnectFn = (this: AudioNode, ...args: unknown[]) => unknown;

export function installAudioCapture(): void {
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return;

  const timeline: CaptureTimeline = {
    contextAt: 0,
    runningAt: 0,
    recorderStartAt: 0,
    firstSoundAt: 0,
    contexts: 0,
  };
  const taps = new Map<AudioContext, TapEntry>();
  const nodes: TapNode[] = [];
  let origConnect: ConnectFn | null = null;

  const noteRunning = (ctx: AudioContext): void => {
    if (ctx.state === 'running' && !timeline.runningAt) timeline.runningAt = Date.now();
  };

  function ensureTap(ctx: AudioContext): TapEntry | null {
    const existing = taps.get(ctx);
    if (existing) return existing;
    if (ctx.state !== 'running') return null;

    let streamDest: MediaStreamAudioDestinationNode;
    let analyser: AnalyserNode;
    let recorder: MediaRecorder;
    const chunks: Blob[] = [];
    try {
      streamDest = ctx.createMediaStreamDestination();
      analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      const preferred = 'audio/webm;codecs=opus';
      const mime =
        typeof MediaRecorder !== 'undefined' &&
        MediaRecorder.isTypeSupported &&
        MediaRecorder.isTypeSupported(preferred)
          ? preferred
          : 'audio/webm';
      recorder = new MediaRecorder(streamDest.stream, { mimeType: mime });
    } catch {
      return null;
    }
    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size) chunks.push(e.data);
    };
    recorder.start(500);
    const entry: TapEntry = { streamDest, analyser, recorder, chunks, startedAt: Date.now() };
    taps.set(ctx, entry);
    if (!timeline.recorderStartAt) timeline.recorderStartAt = entry.startedAt;

    // Connect every node that already reached this context's destination.
    for (const tap of nodes) {
      if (tap.ctx !== ctx) continue;
      try {
        origConnect?.call(tap.node, streamDest);
        origConnect?.call(tap.node, analyser);
      } catch {
        /* the node may be gone */
      }
    }

    // Watch the tap for the first moment it carries sound, so the runner knows
    // where the audio file really begins.
    const buffer = new Float32Array(analyser.fftSize);
    const poll = (): void => {
      analyser.getFloatTimeDomainData(buffer);
      let peak = 0;
      for (let i = 0; i < buffer.length; i += 1) peak = Math.max(peak, Math.abs(buffer[i]));
      if (peak > 0.002 && !timeline.firstSoundAt) timeline.firstSoundAt = Date.now();
      if (!timeline.firstSoundAt) requestAnimationFrame(poll);
    };
    requestAnimationFrame(poll);
    return entry;
  }

  for (const name of ['AudioContext', 'webkitAudioContext'] as const) {
    const Original = window[name];
    if (!Original) continue;
    const Patched = function PatchedAudioContext(...args: ConstructorParameters<typeof AudioContext>): AudioContext {
      const ctx = new Original(...args);
      timeline.contexts += 1;
      if (!timeline.contextAt) timeline.contextAt = Date.now();
      ctx.addEventListener('statechange', () => {
        noteRunning(ctx);
        ensureTap(ctx);
      });
      noteRunning(ctx);
      ensureTap(ctx);
      return ctx;
    } as unknown as typeof AudioContext;
    Patched.prototype = Original.prototype;
    Object.defineProperty(window, name, { value: Patched, configurable: true, writable: true });
  }

  origConnect = AudioNode.prototype.connect as unknown as ConnectFn;
  AudioNode.prototype.connect = function patchedConnect(this: AudioNode, ...args: unknown[]): unknown {
    const dest = args[0];
    try {
      // `AudioNode.context` is typed as `BaseAudioContext`; a live page's graph
      // is always a real `AudioContext`, which is what we tap.
      const ctx = this.context as AudioContext;
      if (dest && dest === ctx.destination) {
        nodes.push({ node: this, ctx });
        const entry = ensureTap(ctx);
        if (entry) {
          origConnect?.call(this, entry.streamDest);
          origConnect?.call(this, entry.analyser);
        }
      }
    } catch {
      /* never let the tap break the app */
    }
    return origConnect?.apply(this, args);
  } as unknown as typeof AudioNode.prototype.connect;

  window.__demoAudio = {
    timeline,
    debug: () => {
      const first = [...taps.values()][0];
      return {
        contexts: timeline.contexts,
        taps: taps.size,
        nodeCount: nodes.length,
        states: [...taps.values()].map((t) => t.recorder.state),
        ctxState: first?.streamDest.context.state,
        ctxTime: first?.streamDest.context.currentTime,
        hidden: document.hidden,
        visibility: document.visibilityState,
      };
    },
    /** The loudest tap's current peak amplitude (0–1); for probing. */
    peak() {
      let peak = 0;
      const buffer = new Float32Array(2048);
      for (const entry of taps.values()) {
        entry.analyser.getFloatTimeDomainData(buffer);
        for (let i = 0; i < buffer.length; i += 1) peak = Math.max(peak, Math.abs(buffer[i]));
      }
      return peak;
    },
    async stop(): Promise<StopResult | null> {
      const parts = [...taps.values()];
      const blobs = await Promise.all(
        parts.map(
          (entry) =>
            new Promise<Blob>((resolve) => {
              const done = (): void =>
                resolve(new Blob(entry.chunks, { type: entry.recorder.mimeType || 'audio/webm' }));
              if (entry.recorder.state !== 'inactive') {
                entry.recorder.onstop = done;
                entry.recorder.stop();
              } else {
                done();
              }
            }),
        ),
      );
      const blob =
        parts.length > 1
          ? new Blob(blobs, { type: 'audio/webm' })
          : blobs[0] ?? new Blob([], { type: 'audio/webm' });
      return new Promise<StopResult | null>((resolve) => {
        const reader = new FileReader();
        reader.onload = () =>
          resolve({
            dataUrl: typeof reader.result === 'string' ? reader.result : null,
            mime: blob.type,
            timeline,
            bytes: blob.size,
          });
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    },
  };
}
