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
  action?: 'goto' | 'click' | 'waitFor' | 'waitForFunction' | 'press' | 'evaluate' | 'hold';
  /** CSS selector, for `click` / `waitFor`. */
  selector?: string;
  /** URL, for `goto`. */
  url?: string;
  /** Script body, for `waitForFunction` / `evaluate`. */
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
  /**
   * Cue this step (true) or never cue it (false), overriding the demo's
   * `democlip.actionCues`. Omitted, the demo decides — so a step may cue itself in a demo
   * that asks for no cues, or opt out of one that does.
   */
  cue?: boolean;
  /**
   * The stock sound this step's cue plays when it lands — `thud` when it names none. Used
   * only when the step is cued.
   */
  sound?: string;
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
  /** The colour the captions are made in — Graditone's orange when a flow names none. */
  annotationColour?: string;
  /**
   * Cue every action (a `click`, or a `press` that has a control) with an **arrow** at the
   * control it lands on, and a **sound** the moment it lands — so a tap on a button reads on
   * the video. Off unless a flow asks for it; a step may override it with `cue`, and name its
   * own sound with `sound`.
   */
  actionCues?: boolean;
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
  /** When the step's action finished (its control pressed), if it was an action. */
  doneAt?: number;
  /**
   * Where the action's control sits, as a fraction of the picture — what an action cue's
   * arrow points at. Absent when the step names no control (a key press, a wait).
   */
  target?: { x: number; y: number };
  /** The caption shown from this step onwards, if the step has one. */
  caption?: string;
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
