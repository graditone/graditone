/**
 * PluginMicBroadcaster — T008
 * Feature 031: Practice View Plugin & Plugin API Recording Extension
 *
 * Singleton service that opens one shared microphone stream and multiplexes
 * pitch detection events to all subscribed plugins via context.recording.
 *
 * Design decisions (see specs/031-practice-view-plugin/research.md R-001):
 * - Singleton: only one getUserMedia call regardless of subscriber count.
 * - Opens mic on first subscriber, keeps warm while any subscriber is active.
 * - Releases mic when all subscribers unsubscribe.
 * - Error state is cached and delivered immediately (queued microtask) to late
 *   onError subscribers.
 * - Reuses detectPitch() from pitchDetection.ts (no duplication of algorithm).
 *
 * Privacy constraint (FR-020 / Constitution Principle VI):
 * - PluginPitchEvent contains ONLY pitch metadata (midiNote, hz, confidence,
 *   timestamp). No PCM, waveform, or raw audio data is forwarded to plugins.
 */

import { detectPitch } from './pitchDetection';
import type { PluginPitchEvent } from '../../plugin-api/types';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Minimum frequency accepted for dispatch (C2 ≈ 65.4 Hz) */
const MIN_HZ = 65;
/** Maximum frequency accepted for dispatch (C7 ≈ 2093 Hz) */
const MAX_HZ = 2093;

// ─── Hz → MIDI conversion ─────────────────────────────────────────────────────

/**
 * Convert a frequency in Hz to the nearest integer MIDI note number.
 * Formula: round(12 × log2(hz / 440) + 69)
 * A4 = 440 Hz = MIDI 69.
 */
function hzToMidi(hz: number): number {
  return Math.round(12 * Math.log2(hz / 440) + 69);
}

// ─── Singleton broadcaster ────────────────────────────────────────────────────

class PluginMicBroadcaster {
  private static _instance: PluginMicBroadcaster | null = null;

  static getInstance(): PluginMicBroadcaster {
    if (!PluginMicBroadcaster._instance) {
      PluginMicBroadcaster._instance = new PluginMicBroadcaster();
    }
    return PluginMicBroadcaster._instance;
  }

  private pitchHandlers = new Set<(e: PluginPitchEvent) => void>();
  private errorHandlers = new Set<(e: string) => void>();
  private audioCtx: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private stream: MediaStream | null = null;
  /** Cached error, if any — delivered to late onError subscribers immediately */
  private errorState: string | null = null;

  /**
   * Subscribe to microphone pitch events.
   * Opens the mic on the first subscriber; subsequent calls share the stream.
   * Returns an unsubscribe function — call it in your cleanup.
   */
  subscribe(handler: (e: PluginPitchEvent) => void): () => void {
    this.pitchHandlers.add(handler);
    if (this.pitchHandlers.size === 1 && !this.stream) {
      // First subscriber: open mic
      this.startMic();
    }
    return () => {
      this.pitchHandlers.delete(handler);
      if (this.pitchHandlers.size === 0) {
        this.stopMic();
      }
    };
  }

  /**
   * Subscribe to microphone error notifications.
   * If the mic is already in an error state, fires the handler asynchronously
   * (via queueMicrotask) so callers can safely set up state before receiving.
   * Returns an unsubscribe function.
   */
  onError(handler: (e: string) => void): () => void {
    this.errorHandlers.add(handler);
    if (this.errorState !== null) {
      const err = this.errorState;
      queueMicrotask(() => handler(err));
    }
    return () => {
      this.errorHandlers.delete(handler);
    };
  }

  /**
   * Force-stop the microphone stream immediately and clear all handlers.
   * Called during view teardown as a safety net beyond the automatic
   * subscriber-counting teardown (which relies on every individual
   * unsubscribe running before the browser releases the stream).
   */
  stop(): void {
    this.pitchHandlers.clear();
    this.errorHandlers.clear();
    this.stopMic();
  }

  /**
   * Returns `true` while the mic stream is open (at least one subscriber and
   * no teardown in progress).
   */
  isActive(): boolean {
    return this.stream !== null;
  }

  // ─── Private: mic lifecycle ─────────────────────────────────────────────────

  private async startMic(): Promise<void> {
    // Guard: AudioWorklet supported
    if (typeof AudioWorkletNode === 'undefined') {
      this.dispatchError('AudioWorklet not supported in this browser');
      return;
    }

    // Guard: secure context
    if (!navigator.mediaDevices?.getUserMedia) {
      const reason =
        typeof window !== 'undefined' && window.isSecureContext === false
          ? 'Microphone access requires HTTPS'
          : 'Microphone access is not supported in this browser';
      this.dispatchError(reason);
      return;
    }

    // Request microphone
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: false,
        },
      });
    } catch (err) {
      // Check if subscriber count dropped to zero while we were awaiting permission
      if (this.pitchHandlers.size === 0) return;
      const name = (err as DOMException).name;
      const message =
        name === 'NotAllowedError'
          ? 'Microphone access required to record your response'
          : name === 'NotFoundError'
          ? 'No microphone detected'
          : `Microphone error: ${(err as Error).message}`;
      this.dispatchError(message);
      return;
    }

    // Check if all subscribers unsubscribed while awaiting permission
    if (this.pitchHandlers.size === 0) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    const audioCtx = new AudioContext({ sampleRate: 44100 });

    try {
      await audioCtx.audioWorklet.addModule(
        `${typeof import.meta !== 'undefined' ? import.meta.env?.BASE_URL ?? '/' : '/'}audio-processor.worklet.js`
      );
    } catch {
      if (this.pitchHandlers.size === 0) {
        stream.getTracks().forEach((t) => t.stop());
        audioCtx.close();
        return;
      }
      stream.getTracks().forEach((t) => t.stop());
      audioCtx.close();
      this.dispatchError('Failed to load audio processor');
      return;
    }

    if (this.pitchHandlers.size === 0) {
      stream.getTracks().forEach((t) => t.stop());
      audioCtx.close();
      return;
    }

    const workletNode = new AudioWorkletNode(audioCtx, 'audio-capture-processor');
    const source = audioCtx.createMediaStreamSource(stream);

    const highPass = audioCtx.createBiquadFilter();
    highPass.type = 'highpass';
    highPass.frequency.value = 55;
    highPass.Q.value = 0.7;

    const lowPass = audioCtx.createBiquadFilter();
    lowPass.type = 'lowpass';
    lowPass.frequency.value = 5500;
    lowPass.Q.value = 0.7;

    source.connect(highPass);
    highPass.connect(lowPass);
    lowPass.connect(workletNode);
    workletNode.connect(audioCtx.destination);

    workletNode.port.onmessage = (evt: MessageEvent) => {
      if (evt.data?.type !== 'pcm') return;
      const buffer = evt.data.buffer as Float32Array;
      const pitchSample = detectPitch(buffer, audioCtx.sampleRate);
      if (!pitchSample) return;
      if (pitchSample.hz < MIN_HZ || pitchSample.hz > MAX_HZ) return;

      const event: PluginPitchEvent = {
        midiNote: hzToMidi(pitchSample.hz),
        hz: pitchSample.hz,
        confidence: pitchSample.confidence,
        timestamp: Date.now(),
      };
      this.dispatch(event);
    };

    this.stream = stream;
    this.audioCtx = audioCtx;
    this.workletNode = workletNode;
  }

  private stopMic(): void {
    // Each teardown step runs independently so a failed disconnect()
    // cannot prevent the MediaStream tracks from being stopped — the tracks
    // must be stopped for the browser to release the mic indicator.
    try { this.workletNode?.disconnect(); } catch { /* ignore */ }
    try { this.stream?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    try { this.audioCtx?.close(); } catch { /* ignore */ }
    this.stream = null;
    this.audioCtx = null;
    this.workletNode = null;
    // Clear error state so re-subscribing gets a fresh attempt
    this.errorState = null;
  }

  private dispatch(event: PluginPitchEvent): void {
    this.pitchHandlers.forEach((h) => h(event));
  }

  private dispatchError(msg: string): void {
    this.errorState = msg;
    this.errorHandlers.forEach((h) => h(msg));
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const pluginMicBroadcaster = PluginMicBroadcaster.getInstance();
