/**
 * The shapes the demo harness works with: a flow (as written in `flows/*.yaml`)
 * and the artefacts one capture produces.
 *
 * This module is types only — it is erased at run time (Node strips the types),
 * and it also carries the ambient declarations for the globals our injected
 * scripts publish on the page.
 */

import type { Video } from 'playwright';

/** One step of a flow — the small DSL the runner executes. */
export interface FlowStep {
  /** What to do. Omitted (or `hold`) just captions and waits. */
  action?: 'goto' | 'click' | 'holdUntil' | 'waitFor' | 'waitForFunction' | 'press' | 'evaluate' | 'hold';
  /** CSS selector, for `click` / `waitFor`. */
  selector?: string;
  /** URL, for `goto`. */
  url?: string;
  /** Script body, for `waitForFunction` / `holdUntil` / `evaluate`. */
  script?: string;
  /** Key, for `press`. */
  key?: string;
  /** Wait state, for `waitFor`. */
  state?: 'attached' | 'detached' | 'visible' | 'hidden';
  /** Timeout in milliseconds. */
  timeout?: number;
  /** Caption shown in the video while the step runs. */
  caption?: string;
  /** How long to hold after the step, in milliseconds. */
  hold?: number;
  /** Mouse-glide steps for `click`. */
  steps?: number;
  /** Pause after the glide, before the click, in milliseconds. */
  settle?: number;
  /** How long the pointer stays down for `click`, in milliseconds (default 70). */
  pressMs?: number;
}

/** One annotation a flow hands to DemoClip. */
export interface FlowAnnotation {
  kind: string;
  span: { s: number; e: number };
  [property: string]: unknown;
}

/** What a flow wants DemoClip to do with its clip. */
export interface FlowDemoClip {
  logo?: string;
  titleCard?: boolean;
  annotations?: FlowAnnotation[];
}

/** A flow, as written in `flows/<id>.yaml`. */
export interface Flow {
  id: string;
  title: string;
  description?: string;
  audience?: string;
  viewport?: { width: number; height: number };
  steps: FlowStep[];
  democlip?: FlowDemoClip;
}

/** Wall-clock marks the in-page tap records, used to align the audio. */
export interface CaptureTimeline {
  contextAt: number;
  runningAt: number;
  recorderStartAt: number;
  firstSoundAt: number;
  contexts: number;
}

/** When a step began, in milliseconds after the video started. */
export interface StepMark {
  label: string;
  at: number;
}

/** What the in-page tap answers when the runner stops it. */
export interface StopResult {
  dataUrl: string | null;
  mime: string;
  timeline: CaptureTimeline;
  bytes: number;
}

/** The tap our injected script publishes on `window.__demoAudio`. */
export interface DemoAudioTap {
  timeline: CaptureTimeline;
  /** Diagnostics for probing; not part of the video. */
  debug(): Record<string, unknown>;
  /** The loudest tap's current peak amplitude (0–1). */
  peak(): number;
  stop(): Promise<StopResult | null>;
}

declare global {
  interface Window {
    /** Set by the injected page chrome. */
    __demoCaption?: (text: string) => void;
    __demoMoveCursor?: (x: number, y: number) => void;
    /** Set by the injected audio tap. */
    __demoAudio?: DemoAudioTap;
    /** Present in Chromium; the tap patches it alongside `AudioContext`. */
    webkitAudioContext?: typeof AudioContext;
  }
}

/** What one capture produces: the raw paths and the marks to line them up. */
export interface CaptureResult {
  video: Video | null;
  videoStartMs: number;
  audio: string | null;
  timeline: CaptureTimeline | null;
  marks: StepMark[];
  pageErrors: string[];
}

/** Where a flow's artefacts live. */
export interface FlowPaths {
  rawDir: string;
  video: string;
  audio: string;
  muxed: string;
}
