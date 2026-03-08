/**
 * useAudioRecorder — React hook for microphone capture via AudioWorklet
 *
 * US2: Handles getUserMedia, AudioContext + AudioWorklet lifecycle,
 * PCM frame routing, and clean teardown on stop() / unmount.
 *
 * US4 stubs (currentPitch): filled in T024
 * US5 stubs (noteHistory): filled in T027
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { AudioFrame, NoteOnset, PitchSample, RecordingSession } from '../../types/recording';
import { detectPitch } from './pitchDetection';

// ─── Internal refs ──────────────────────────────────────────────────────────

interface RecorderRefs {
  audioCtx: AudioContext | null;
  workletNode: AudioWorkletNode | null;
  source: MediaStreamAudioSourceNode | null;
  stream: MediaStream | null;
}

/** Onset detection state (kept in a ref so the onmessage closure always reads latest) */
interface OnsetState {
  lastLabel: string | null;
  lastSeenAt: number;
}

const SILENCE_GAP_MS = 300;
const MAX_HISTORY = 200;

/**
 * Number of consecutive frames a pitch label must be stable before it is
 * forwarded to state. At 44100 Hz / 2048 samples ≈ 46 ms/frame, so
 * 3 frames ≈ 140 ms — enough to suppress single-frame jitter / noise spikes.
 */
const PITCH_STABLE_FRAMES = 3;

/**
 * Number of consecutive silent/null frames required before emitting silence.
 * 5 frames ≈ 230 ms — absorbs brief confidence dropouts during a held note
 * so a sustained C4 doesn't fragment into multiple short C4 notes.
 */
const SILENCE_STABLE_FRAMES = 5;

// ─── Hook ────────────────────────────────────────────────────────────────────

export interface UseAudioRecorderReturn {
  session: RecordingSession;
  /** Latest PCM waveform for oscilloscope (last received AudioFrame buffer) */
  waveform: Float32Array | null;
  /** Current detected pitch (populated in T024) */
  currentPitch: PitchSample | null;
  /** Accumulated note history (populated in T027) */
  noteHistory: NoteOnset[];
  /**
   * Ref to all raw PCM chunks recorded since the last start().
   * Accumulated in a ref (not state) to avoid per-frame re-renders.
   * Consumers read it at playback time; clear it via clearAudioChunks().
   */
  audioChunksRef: MutableRefObject<Float32Array[]>;
  /** Start microphone capture */
  start: () => Promise<void>;
  /** Stop capture and release all resources */
  stop: () => void;
  /** Clear note history */
  clearHistory: () => void;
  /** Discard accumulated PCM chunks to free memory */
  clearAudioChunks: () => void;
}

export function useAudioRecorder(
  onFrame?: (frame: AudioFrame) => void,
): UseAudioRecorderReturn {
  const [session, setSession] = useState<RecordingSession>({ state: 'idle', startTimestamp: null, errorMessage: null });
  const [waveform, setWaveform] = useState<Float32Array | null>(null);
  const [currentPitch, setCurrentPitch] = useState<PitchSample | null>(null);
  const [noteHistory, setNoteHistory] = useState<NoteOnset[]>([]);

  const refs = useRef<RecorderRefs>({
    audioCtx: null,
    workletNode: null,
    source: null,
    stream: null,
  });

  /** Mutable onset state — avoids stale closure issues without extra re-renders */
  const onsetRef = useRef<OnsetState>({ lastLabel: null, lastSeenAt: 0 });
  /** Session start timestamp stored in ref so onmessage closure always reads latest */
  const sessionStartRef = useRef<number>(0);
  /**
   * Raw PCM chunks accumulated during the current recording session.
   * Stored in a ref to avoid a setState call every ~46 ms.
   */
  const audioChunksRef = useRef<Float32Array[]>([]);
  /**
   * Temporal pitch stabiliser — only forward a pitch to state once the same
   * note label has appeared in PITCH_STABLE_FRAMES consecutive frames.
   * Prevents single-frame noise spikes from creating spurious note events.
   */
  const stabRef = useRef<{ label: string | null; count: number }>({ label: null, count: 0 });

  // ─── Teardown helper ────────────────────────────────────────────────────

  const teardown = useCallback(() => {
    const { audioCtx, workletNode, source, stream } = refs.current;
    try {
      workletNode?.disconnect();
      source?.disconnect();
      stream?.getTracks().forEach((t) => t.stop());
      audioCtx?.close();
    } catch {
      // Ignore teardown errors
    }
    refs.current = { audioCtx: null, workletNode: null, source: null, stream: null };
  }, []);

  // ─── Start ──────────────────────────────────────────────────────────────

  const start = useCallback(async () => {
    // Guard: AudioWorklet supported?
    if (typeof AudioWorkletNode === 'undefined') {
      setSession({ state: 'error', startTimestamp: null, errorMessage: 'AudioWorklet not supported in this browser' });
      return;
    }

    // Guard: mediaDevices requires a secure context (HTTPS or localhost).
    // On Android Chrome over HTTP, navigator.mediaDevices is undefined.
    if (!navigator.mediaDevices?.getUserMedia) {
      const reason = window.isSecureContext === false
        ? 'Microphone access requires HTTPS — open this page over a secure connection'
        : 'Microphone access is not supported in this browser';
      setSession({ state: 'error', startTimestamp: null, errorMessage: reason });
      return;
    }

    setSession({ state: 'requesting', startTimestamp: null, errorMessage: null });

    // Reset audio chunk accumulator for the new session
    audioChunksRef.current = [];

    // 1. Request microphone
    // Enable browser/OS-level noise suppression and echo cancellation.
    // autoGainControl is disabled so the relative note volume isn't distorted.
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
      const name = (err as DOMException).name;
      const message =
        name === 'NotAllowedError'
          ? 'Microphone access required'
          : name === 'NotFoundError'
          ? 'No microphone detected'
          : `Microphone error: ${(err as Error).message}`;
      setSession({ state: 'error', startTimestamp: null, errorMessage: message });
      return;
    }

    // 2. Create AudioContext
    const audioCtx = new AudioContext({ sampleRate: 44100 });

    // 3. Load AudioWorklet
    // Use import.meta.env.BASE_URL so the path is correct on both local dev
    // (base '/') and GitHub Pages (base '/'). A hardcoded leading '/'
    // would skip the sub-path and produce a 404 on the deployed site.
    try {
      await audioCtx.audioWorklet.addModule(`${import.meta.env.BASE_URL}audio-processor.worklet.js`);
    } catch {
      teardown();
      stream.getTracks().forEach((t) => t.stop());
      audioCtx.close();
      setSession({ state: 'error', startTimestamp: null, errorMessage: 'Failed to load audio processor' });
      return;
    }

    // 4. Create worklet node and wire pipeline
    //
    // Filter chain (applied before the worklet so both pitch detection and the
    // recorded PCM chunks benefit from the cleaned signal):
    //
    //   source → highPass(55 Hz) → lowPass(5500 Hz) → workletNode
    //
    //   • High-pass at 55 Hz: removes mains hum (50/60 Hz), desk rumble, and
    //     anything below the lowest piano key (C2 ≈ 65 Hz).
    //   • Low-pass at 5500 Hz: removes broadband hiss; piano pitch detection
    //     relies on fundamentals and lower harmonics well within this range.
    const workletNode = new AudioWorkletNode(audioCtx, 'audio-capture-processor');
    const source = audioCtx.createMediaStreamSource(stream);

    const highPass = audioCtx.createBiquadFilter();
    highPass.type = 'highpass';
    highPass.frequency.value = 55;   // Hz — just below C2 (65 Hz)
    highPass.Q.value = 0.7;          // Butterworth-like, gentle roll-off

    const lowPass = audioCtx.createBiquadFilter();
    lowPass.type = 'lowpass';
    lowPass.frequency.value = 5500;  // Hz — preserves all piano harmonics
    lowPass.Q.value = 0.7;

    source.connect(highPass);
    highPass.connect(lowPass);
    lowPass.connect(workletNode);
    workletNode.connect(audioCtx.destination);

    // 5. Receive PCM frames
    workletNode.port.onmessage = (evt: MessageEvent) => {
      if (evt.data?.type !== 'pcm') return;
      const buffer = evt.data.buffer as Float32Array;
      setWaveform(buffer);
      // Accumulate raw PCM for later audio playback (stored in ref, no re-render)
      audioChunksRef.current.push(buffer);
      // T024: run pitch detection on each frame
      const rawPitch = detectPitch(buffer, audioCtx.sampleRate);

      // ── Unified temporal stabiliser ───────────────────────────────────
      // Both pitch transitions AND silence must persist for their respective
      // frame-count threshold before being forwarded to state.
      //
      //   PITCH_STABLE_FRAMES   (3 ≈ 140 ms) — new pitch must be consistent
      //   SILENCE_STABLE_FRAMES (5 ≈ 230 ms) — null must persist before note-off
      //
      // This prevents brief confidence dropouts mid-note (e.g. holding C4)
      // from fragmenting a single sustained note into multiple short ones.
      const stab = stabRef.current;
      const newLabel = rawPitch?.label ?? null;

      // Track consecutive frames with the same label (null counts as a label)
      if (newLabel === stab.label) {
        stab.count++;
      } else {
        stab.label = newLabel;
        stab.count = 1;
      }

      const threshold = newLabel === null ? SILENCE_STABLE_FRAMES : PITCH_STABLE_FRAMES;
      if (stab.count >= threshold) {
        setCurrentPitch(rawPitch);
      }
      // Stabilised pitch for onset detection: non-null only when a confirmed pitch
      const pitch = newLabel !== null && stab.count >= PITCH_STABLE_FRAMES ? rawPitch : null;

      // T027: onset detection
      if (pitch !== null) {
        const now = Date.now();
        const onset = onsetRef.current;
        const labelChanged = pitch.label !== onset.lastLabel;
        const silenceGapElapsed = onset.lastLabel === pitch.label && (now - onset.lastSeenAt) >= SILENCE_GAP_MS;
        if (labelChanged || silenceGapElapsed) {
          const newOnset: NoteOnset = {
            label: pitch.label,
            note: pitch.note,
            octave: pitch.octave,
            confidence: pitch.confidence,
            elapsedMs: now - sessionStartRef.current,
          };
          setNoteHistory((prev) => {
            const updated = [...prev, newOnset];
            return updated.length > MAX_HISTORY ? updated.slice(-MAX_HISTORY) : updated;
          });
        }
        onset.lastLabel = pitch.label;
        onset.lastSeenAt = now;
      }

      if (onFrame) {
        onFrame({ buffer, sampleRate: audioCtx.sampleRate });
      }
    };

    refs.current = { audioCtx, workletNode, source, stream };
    sessionStartRef.current = Date.now();

    // T031: handle audio device loss mid-session
    const firstTrack = stream.getTracks()[0];
    if (firstTrack) {
      firstTrack.onended = () => {
        teardown();
        setSession({ state: 'error', startTimestamp: null, errorMessage: 'Microphone disconnected' });
        setWaveform(null);
        setCurrentPitch(null);
        onsetRef.current = { lastLabel: null, lastSeenAt: 0 };
      };
    }

    setSession({ state: 'recording', startTimestamp: Date.now(), errorMessage: null });
  }, [teardown, onFrame]);

  // ─── Stop ───────────────────────────────────────────────────────────────

  const stop = useCallback(() => {
    teardown();
    setSession({ state: 'idle', startTimestamp: null, errorMessage: null });
    setWaveform(null);
    setCurrentPitch(null);
    onsetRef.current = { lastLabel: null, lastSeenAt: 0 };
    stabRef.current = { label: null, count: 0 };
  }, [teardown]);

  // ─── Cleanup on unmount ─────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      teardown();
    };
  }, [teardown]);

  // ─── Note history ────────────────────────────────────────────────────────

  const clearHistory = useCallback(() => setNoteHistory([]), []);
  const clearAudioChunks = useCallback(() => { audioChunksRef.current = []; }, []);

  return { session, waveform, currentPitch, noteHistory, audioChunksRef, start, stop, clearHistory, clearAudioChunks };
}
