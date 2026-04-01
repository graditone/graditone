/**
 * RecordingStaff — Live treble-clef staff that displays detected notes
 * with quantized durations in real-time.
 *
 * Architecture:
 * - Receives `currentPitch` from `useAudioRecorder` (via RecordingView)
 * - Tracks pitch onset time with a ref to compute held duration
 * - Quantizes duration → ticks, appends `Note` to a ring-buffer
 * - Wraps around when the buffer exceeds MAX_TICKS (4 measures)
 * - Shows a "ghost" note head at the current pitch while it is being held
 * - Delegates layout calculation to `NotationLayoutEngine`
 * - Delegates SVG rendering to `NotationRenderer`
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { Note } from '../../types/score';
import type { PitchSample } from '../../types/recording';
import { useRenderConfig } from '../../contexts/RenderConfigContext';
import { NotationLayoutEngine } from '../../services/notation/NotationLayoutEngine';
import { NotationRenderer } from '../notation/NotationRenderer';
import { DEFAULT_STAFF_CONFIG } from '../../types/notation/config';
import { quantizeDurationMs, durationTicksToName } from '../../services/recording/durationQuantizer';
import { ToneAdapter } from '../../services/playback/ToneAdapter';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Maximum ticks before the ring-buffer wraps (16 measures × 4/4 × 960 ticks) */
const MAX_TICKS = 61_440;

/** Placeholder duration for the in-progress "ghost" note head (sixteenth) */
const GHOST_DURATION_TICKS = 240;

/** Stable id for the ghost note — lets NotationRenderer highlight it */
const GHOST_NOTE_ID = '__ghost__';

/**
 * Audio worklet frame duration in milliseconds (44100 Hz / 2048 samples).
 * Used to correct the timing bias introduced by the stabilisation debouncer
 * in useAudioRecorder so that note durations map to the real acoustic event.
 */
const FRAME_MS = Math.round(2048 / 44100 * 1000); // ≈ 46 ms

/**
 * How late a pitch *onset* is confirmed after the note physically started.
 * (PITCH_STABLE_FRAMES = 3 frames in useAudioRecorder)
 */
const PITCH_ONSET_DELAY_MS = 3 * FRAME_MS; // ≈ 138 ms

/**
 * How late *silence* is confirmed after the note physically ended.
 * (SILENCE_STABLE_FRAMES = 5 frames in useAudioRecorder)
 */
const SILENCE_TAIL_MS = 5 * FRAME_MS; // ≈ 230 ms

/** BPM assumption when computing distance from Hz → frequency ratio */
const NOTE_A4_HZ = 440;

/**
 * Stable staff config — created once outside the component.
 *
 * pixelsPerTick: 0.04  → lower scale means more notes fit horizontally
 * viewportWidth: 99999 → never let virtual-scroll clip any note;
 *                          the CSS container uses overflow-x: auto for display
 * minNoteSpacing: 8    → tighter horizontal spacing
 */
const STAFF_CONFIG = {
  ...DEFAULT_STAFF_CONFIG,
  pixelsPerTick: 0.04,
  minNoteSpacing: 8,
  viewportWidth: 99999,
  scrollX: 0,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert a frequency in Hz to the nearest MIDI pitch number (0-127). */
function hzToMidi(hz: number): number {
  return Math.round(12 * Math.log2(hz / NOTE_A4_HZ) + 69);
}

// ─── Component ───────────────────────────────────────────────────────────────

export interface RecordingStaffProps {
  /** Current detected pitch from the audio recorder (null = silence). */
  currentPitch: PitchSample | null;
  /** Tempo used for duration quantization (default 120 BPM). */
  bpm?: number;
  /** Ref to accumulated raw PCM chunks from useAudioRecorder (for audio playback). */
  audioChunksRef: MutableRefObject<Float32Array[]>;
  /** Discard all accumulated PCM chunks to free memory. */
  clearAudioChunks: () => void;
  /** Increment this value to clear all staff notes from the parent. */
  clearTrigger?: number;
}

/**
 * RecordingStaff — Shows detected notes on a treble-clef staff with
 * quantized rhythmic durations in a ring-buffer that wraps every 4 measures.
 */
export function RecordingStaff({ currentPitch, bpm = 120, audioChunksRef, clearAudioChunks, clearTrigger }: RecordingStaffProps) {
  // ── Committed notes (finalised) ───────────────────────────────────
  const [notes, setNotes] = useState<Note[]>([]);

  // ── Theme ─────────────────────────────────────────────────────────────
  const renderConfig = useRenderConfig();

  // ── Playback state ───────────────────────────────────────────────
  const [isPlayingNotes, setIsPlayingNotes] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  /** AudioContext used for raw audio playback (kept to allow stop) */
  const audioCtxRef = useRef<AudioContext | null>(null);

  // ── Mutable refs (avoid stale-closure issues inside the effect) ─────────
  /** Time the current pitch started (ms since epoch) */
  const pitchOnsetTimeRef = useRef<number>(0);
  /** Hz of the pitch currently being held (for MIDI conversion at finalise time) */
  const pitchHzRef = useRef<number>(0);
  /** Label of the last observed pitch (used to detect label transitions) */
  const currentLabelRef = useRef<string | null>(null);
  /** Write cursor: next note starts here */
  const nextTickRef = useRef<number>(0);
  /** Monotonic counter for unique note ids */
  const noteCounterRef = useRef<number>(0);

  // ── Playback helpers ─────────────────────────────────────────────

  const stopPlayback = useCallback(() => {
    ToneAdapter.getInstance().stopAll();
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    setIsPlayingNotes(false);
    setIsPlayingAudio(false);
  }, []);

  // ── External clear trigger ───────────────────────────────────────────────
  // When clearTrigger increments (from parent's handleClearAll), reset staff.
  useEffect(() => {
    if (clearTrigger === undefined || clearTrigger === 0) return;
    stopPlayback();
    setNotes([]);
    nextTickRef.current = 0;
    currentLabelRef.current = null;
    clearAudioChunks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearTrigger]);

  /** Play detected notes using piano samples via ToneAdapter. */
  const handlePlayNotes = useCallback(() => {
    if (notes.length === 0) return;
    stopPlayback();

    const msPerQ = 60_000 / bpm;
    const msPerTick = msPerQ / 960;
    let lastEndSec = 0;

    const adapter = ToneAdapter.getInstance();
    void (async () => {
      await adapter.init();
      adapter.startTransport();
      for (const note of notes) {
        const noteStartSec = (note.start_tick * msPerTick) / 1000;
        const noteDurSec = (note.duration_ticks * msPerTick) / 1000;
        const noteEndSec = noteStartSec + noteDurSec;
        adapter.playNote(note.pitch, noteDurSec, noteStartSec);
        if (noteEndSec > lastEndSec) lastEndSec = noteEndSec;
      }
      setIsPlayingNotes(true);
      setTimeout(() => {
        adapter.stopAll();
        setIsPlayingNotes(false);
      }, (lastEndSec + 0.4) * 1000);
    })();
  }, [notes, bpm, stopPlayback]);

  /** Concatenate raw PCM chunks and play back the original recorded audio. */
  const handlePlayAudio = useCallback(async () => {
    const chunks = audioChunksRef.current;
    if (chunks.length === 0) return;
    stopPlayback();

    const SAMPLE_RATE = 44100;
    const totalSamples = chunks.reduce((s, c) => s + c.length, 0);
    const combined = new Float32Array(totalSamples);
    let offset = 0;
    for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.length; }

    const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
    audioCtxRef.current = ctx;
    setIsPlayingAudio(true);

    const audioBuffer = ctx.createBuffer(1, totalSamples, SAMPLE_RATE);
    audioBuffer.copyToChannel(combined, 0);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.start();
    source.onended = () => {
      ctx.close();
      audioCtxRef.current = null;
      setIsPlayingAudio(false);
    };
  }, [audioChunksRef, stopPlayback]);

  // Stop playback if component unmounts
  useEffect(() => stopPlayback, [stopPlayback]);

  // ── Pitch-change detection ───────────────────────────────────────────────
  useEffect(() => {
    const newLabel = currentPitch?.label ?? null;
    const prevLabel = currentLabelRef.current;

    // Only act when the pitch label actually changes (or first onset / disappears)
    if (newLabel === prevLabel) return;

    // --- Finalise the previous note -----------------------------------------
    if (prevLabel !== null) {
      // Correct for the debounce delay introduced by the temporal stabiliser:
      //   - onset was recorded PITCH_ONSET_DELAY_MS late (3 confirmed frames)
      //   - offset depends on the transition type:
      //       silence  → pitch was last heard SILENCE_TAIL_MS before now
      //       new pitch → new pitch confirmed PITCH_ONSET_DELAY_MS late (cancels)
      const endTimeMs = newLabel === null
        ? Date.now() - SILENCE_TAIL_MS
        : Date.now() - PITCH_ONSET_DELAY_MS;
      const durationMs = Math.max(80, endTimeMs - pitchOnsetTimeRef.current);
      const durationTicks = quantizeDurationMs(durationMs, bpm);
      const midiPitch = hzToMidi(pitchHzRef.current);
      const startTick = nextTickRef.current;
      const newTick = startTick + durationTicks;

      const finalisedNote: Note = {
        id: `rec-${++noteCounterRef.current}`,
        start_tick: startTick,
        duration_ticks: durationTicks,
        pitch: midiPitch,
      };

      if (newTick > MAX_TICKS) {
        // Wrap-around: clear the buffer and restart
        nextTickRef.current = 0;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setNotes([]);
      } else {
        nextTickRef.current = newTick;
        setNotes(prev => [...prev, finalisedNote]);
      }
    }

    // --- Begin tracking the new note ----------------------------------------
    if (newLabel !== null && currentPitch !== null) {
      // Back-date the onset to when the pitch was first physically heard,
      // before the stabiliser accumulated its 3-frame confirmation delay.
      pitchOnsetTimeRef.current = Date.now() - PITCH_ONSET_DELAY_MS;
      pitchHzRef.current = currentPitch.hz;
    }

    currentLabelRef.current = newLabel;
  }, [currentPitch, bpm]);

  // ── Ghost note (current pitch, not yet finalised) ────────────────────────
  // Derive the write cursor from committed notes so it is available during render
  // without accessing a ref (which ESLint flags as invalid during render).
  // When notes is empty, the cursor is always 0 (reset alongside setNotes([])).
  const nextTick = useMemo(
    () =>
      notes.length > 0
        ? notes[notes.length - 1].start_tick + notes[notes.length - 1].duration_ticks
        : 0,
    [notes],
  );

  const ghostNote = useMemo<Note | null>(() => {
    if (!currentPitch) return null;
    return {
      id: GHOST_NOTE_ID,
      start_tick: nextTick,
      duration_ticks: GHOST_DURATION_TICKS,
      pitch: hzToMidi(currentPitch.hz),
    };
  }, [currentPitch, nextTick]);

  // ── Layout calculation ───────────────────────────────────────────────────
  const displayNotes = useMemo<Note[]>(() => {
    return ghostNote ? [...notes, ghostNote] : notes;
  }, [notes, ghostNote]);

  const layout = useMemo(
    () =>
      NotationLayoutEngine.calculateLayout({
        notes: displayNotes,
        clef: 'Treble',
        timeSignature: { numerator: 4, denominator: 4 },
        config: STAFF_CONFIG,
      }),
    [displayNotes],
  );

  // ── Aria label / status ──────────────────────────────────────────────────
  const statusLabel = currentPitch
    ? `Recording — current note: ${currentPitch.label}`
    : notes.length > 0
      ? `${notes.length} note${notes.length !== 1 ? 's' : ''} recorded`
      : 'No notes yet';

  const lastNote = notes.at(-1);
  const lastDurationLabel = lastNote ? durationTicksToName(lastNote.duration_ticks) : null;

  return (
    <div
      className="recording-staff"
      role="region"
      aria-label="Detected notes staff"
      data-testid="recording-staff"
    >
      <div className="recording-staff__header">
        <span className="recording-staff__label">Live Staff</span>
        <div className="recording-staff__actions">
          {notes.length > 0 && !isPlayingNotes && !isPlayingAudio && (
            <>
              <button
                className="recording-staff__play-btn recording-staff__play-btn--notes"
                onClick={handlePlayNotes}
                aria-label="Play detected notes"
                title="Play detected notes (piano samples)"
              >
                ▶ Notes
              </button>
              <button
                className="recording-staff__play-btn recording-staff__play-btn--audio"
                onClick={handlePlayAudio}
                aria-label="Play recorded audio"
                title="Play original recorded audio"
              >
                ▶ Audio
              </button>
            </>
          )}
          {(isPlayingNotes || isPlayingAudio) && (
            <button
              className="recording-staff__play-btn recording-staff__play-btn--stop"
              onClick={stopPlayback}
              aria-label="Stop playback"
            >
              ■ Stop
            </button>
          )}
          {notes.length > 0 && !isPlayingNotes && !isPlayingAudio && (
            <button
              className="recording-staff__clear-btn"
              onClick={() => {
                stopPlayback();
                setNotes([]);
                nextTickRef.current = 0;
                currentLabelRef.current = null;
                clearAudioChunks();
              }}
              aria-label="Clear staff"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div
        className="recording-staff__renderer"
        aria-label={statusLabel}
        role="img"
        style={{ background: renderConfig?.backgroundColor ?? '#fff' }}
      >
        <NotationRenderer
          layout={layout}
          highlightedNoteIds={ghostNote ? [GHOST_NOTE_ID] : []}
          showClef
          inkColor={renderConfig?.glyphColor ?? 'black'}
        />
      </div>

      {/* Status text for screen-readers and visual confirmation */}
      <div
        className="recording-staff__status"
        data-testid="recording-staff-status"
        aria-live="polite"
        aria-atomic="true"
      >
        {currentPitch ? (
          <span>
            Holding <strong>{currentPitch.label}</strong>
            {' '}({currentPitch.hz.toFixed(1)} Hz)
          </span>
        ) : lastDurationLabel ? (
          <span>
            Last note: <strong>{lastDurationLabel}</strong>
          </span>
        ) : (
          <span className="recording-staff__status--muted">
            Start recording and sing or play a note…
          </span>
        )}
      </div>
    </div>
  );
}
