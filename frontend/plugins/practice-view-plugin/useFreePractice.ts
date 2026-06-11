/**
 * useFreePractice.ts
 * Feature 092: Free Practice Option
 *
 * Domain hook that owns all free (score-less) practice state, MIDI
 * subscription, measure-clock recording, and handlers:
 *   handleFreePractice   — enter free-practice mode from selector
 *   handleFreeToggle     — start / stop the live recording session
 *   handleFreeReplay     — replay a completed free session
 *   handleFreeRepractice — start a fresh free session after results
 *   handleFreeBack       — return to selector from free-practice view
 *   handleFreeDismiss    — dismiss results overlay (returns to selector)
 *   loadSavedFreePractice — restore a previously saved free practice
 *   cleanupFreeTimers    — called on unmount to clear any live intervals
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type React from 'react';
import type { PluginContext, MetronomeState, PluginNoteEvent } from '../../src/plugin-api/index';
import type { ScoreRef, FreeMidiEvent, FreeMidiRecord } from '../../src/plugin-api/index';
import { finalizeMeasureNotes } from './freePractice.helpers';
import type { MeasureNoteEntry } from './freePractice.helpers';

// ---------------------------------------------------------------------------
// Params / Return types
// ---------------------------------------------------------------------------

export type UseFreePracticeParams = {
  context: PluginContext;
  metronomeStateRef: React.MutableRefObject<MetronomeState>;
  loadedScoreRefRef: React.MutableRefObject<ScoreRef | null>;
  isReplaying: boolean;
  setIsReplaying: (v: boolean) => void;
  setResultsOverlayVisible: (v: boolean) => void;
  setIsSaved: (v: boolean) => void;
  setSaveError: (e: string | null) => void;
};

export type UseFreePracticeReturn = {
  // State
  isFreePractice: boolean;
  setIsFreePractice: React.Dispatch<React.SetStateAction<boolean>>;
  isFreePracticeRef: React.MutableRefObject<boolean>;
  freeSessionActive: boolean;
  freeSessionActiveRef: React.MutableRefObject<boolean>;
  freeNoteCount: number;
  freeMidiRecord: FreeMidiRecord | null;
  setFreeMidiRecord: React.Dispatch<React.SetStateAction<FreeMidiRecord | null>>;
  freeElapsedMs: number;
  freeDisplayNotes: PluginNoteEvent[];
  freeDisplayOriginMs: number;
  freeStaffBpm: number;
  freeStaffBpmRef: React.MutableRefObject<number>;
  // Handlers
  handleFreePractice: () => void;
  handleFreeToggle: () => void;
  handleFreeRepractice: () => void;
  handleFreeReplay: () => void;
  handleFreeBack: () => void;
  handleFreeDismiss: () => void;
  /** Restore a saved free practice record into the hook state. */
  loadSavedFreePractice: (record: FreeMidiRecord | null, noteCount: number) => void;
  // Cleanup
  cleanupFreeTimers: () => void;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useFreePractice({
  context,
  metronomeStateRef,
  loadedScoreRefRef,
  isReplaying,
  setIsReplaying,
  setResultsOverlayVisible,
  setIsSaved,
  setSaveError,
}: UseFreePracticeParams): UseFreePracticeReturn {

  // ── State ─────────────────────────────────────────────────────────────────
  const [isFreePractice, setIsFreePractice] = useState(false);
  const [freeSessionActive, setFreeSessionActive] = useState(false);
  const [freeNoteCount, setFreeNoteCount] = useState(0);
  const [freeMidiRecord, setFreeMidiRecord] = useState<FreeMidiRecord | null>(null);
  const [freeElapsedMs, setFreeElapsedMs] = useState(0);
  const [freeDisplayNotes, setFreeDisplayNotes] = useState<PluginNoteEvent[]>([]);
  const [freeDisplayOriginMs, setFreeDisplayOriginMs] = useState(0);
  const [freeStaffBpm, setFreeStaffBpm] = useState(120);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const isFreePracticeRef = useRef(false);
  isFreePracticeRef.current = isFreePractice;

  const freeSessionActiveRef = useRef(false);
  const freeStaffBpmRef = useRef(120);
  freeStaffBpmRef.current = freeStaffBpm;

  const freeMidiEventsRef = useRef<FreeMidiEvent[]>([]);
  const freeStartMsRef = useRef(0);
  const freeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const freeReplayTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Measure-clock refs
  const freeMeasureBufferRef = useRef<MeasureNoteEntry[]>([]);
  const freeMeasureStartMsRef = useRef(0);
  const freeMeasureIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /**
   * True once the first MIDI note of the session has arrived.
   * All session timing is deferred until then so the user can wait
   * before playing without creating empty leading measures.
   */
  const freeSessionStartedRef = useRef(false);
  /**
   * Stable ref to startMeasureClock so the MIDI subscription (defined before
   * the callback) can call it without a stale closure.
   */
  const startMeasureClockRef = useRef<(() => void) | null>(null);

  // ── MIDI subscription: capture attacks and releases ───────────────────────
  useEffect(() => {
    return context.midi.subscribe((event) => {
      if (!isFreePracticeRef.current || !freeSessionActiveRef.current) return;
      const now = Date.now();

      if (event.type === 'attack') {
        // First note: initialize all session timing from this exact moment.
        if (!freeSessionStartedRef.current) {
          freeSessionStartedRef.current = true;
          freeStartMsRef.current = now;
          freeMeasureStartMsRef.current = now;
          setFreeDisplayOriginMs(now);
          startMeasureClockRef.current?.();
          // Start the elapsed-time ticker from the first note.
          if (freeIntervalRef.current !== null) clearInterval(freeIntervalRef.current);
          freeIntervalRef.current = setInterval(() => {
            setFreeElapsedMs(Date.now() - freeStartMsRef.current);
          }, 1000);
        }
        freeMeasureBufferRef.current.push({ midiNote: event.midiNote, attackMs: now, durationMs: null });
        setFreeNoteCount((c) => c + 1);
        // Real-time: add to display immediately (durationMs filled on release).
        setFreeDisplayNotes((prev) => [
          ...prev,
          { midiNote: event.midiNote, timestamp: now, type: 'attack' as const },
        ]);
        return;
      }

      if (event.type === 'release') {
        // Update durationMs in measure buffer.
        let attackedAt: number | null = null;
        const buf = freeMeasureBufferRef.current;
        for (let i = buf.length - 1; i >= 0; i--) {
          if (buf[i].midiNote === event.midiNote && buf[i].durationMs === null) {
            attackedAt = buf[i].attackMs;
            buf[i] = { ...buf[i], durationMs: now - buf[i].attackMs };
            break;
          }
        }
        // Real-time: update durationMs on the matching display note.
        if (attackedAt !== null) {
          const durationMs = now - attackedAt;
          setFreeDisplayNotes((prev) => {
            const result = [...prev];
            for (let i = result.length - 1; i >= 0; i--) {
              if (result[i].midiNote === event.midiNote && result[i].durationMs == null) {
                result[i] = { ...result[i], durationMs };
                break;
              }
            }
            return result;
          });
        }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.midi]);

  // ── Replay cleanup: clear timers when replay ends ─────────────────────────
  useEffect(() => {
    if (!isReplaying && freeReplayTimersRef.current.length > 0) {
      freeReplayTimersRef.current.forEach(clearTimeout);
      freeReplayTimersRef.current = [];
    }
  }, [isReplaying]);

  // ── startMeasureClock: fires every measure to quantize the buffer ─────────
  const startMeasureClock = useCallback(() => {
    if (freeMeasureIntervalRef.current !== null) clearInterval(freeMeasureIntervalRef.current);
    const bpm = freeStaffBpmRef.current;
    const msPerMeasure = (4 * 60_000) / bpm;
    freeMeasureIntervalRef.current = setInterval(() => {
      const measureEnd = Date.now();
      const measureStart = freeMeasureStartMsRef.current;
      const buffer = freeMeasureBufferRef.current.slice();
      freeMeasureBufferRef.current = [];
      freeMeasureStartMsRef.current = measureEnd;

      if (buffer.length === 0) return;

      const quantized = finalizeMeasureNotes(buffer, measureStart, bpm, measureEnd);
      const sessionStart = freeStartMsRef.current;
      for (const note of quantized) {
        freeMidiEventsRef.current.push({
          midiNote: note.midiNote,
          timestampMs: note.timestamp - sessionStart,
          durationMs: note.durationMs,
        });
      }
    }, msPerMeasure);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Keep the ref in sync so the MIDI subscription (defined earlier) can call it.
  startMeasureClockRef.current = startMeasureClock;

  // ── Handlers ──────────────────────────────────────────────────────────────

  /** Enter free-practice mode from the score selector. */
  const handleFreePractice = useCallback(() => {
    freeMidiEventsRef.current = [];
    const now = Date.now();
    freeStartMsRef.current = now;
    const activeBpm = metronomeStateRef.current.bpm > 0 ? metronomeStateRef.current.bpm : 120;
    setFreeStaffBpm(activeBpm);
    freeStaffBpmRef.current = activeBpm;
    setFreeNoteCount(0);
    setFreeMidiRecord(null);
    setResultsOverlayVisible(false);
    setIsSaved(false);
    setSaveError(null);
    setFreeElapsedMs(0);
    setFreeDisplayNotes([]);
    setFreeDisplayOriginMs(now);
    freeMeasureBufferRef.current = [];
    freeMeasureStartMsRef.current = now;
    loadedScoreRefRef.current = { type: 'free', id: '' };
    setIsFreePractice(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Toggle the live recording session (start or stop). */
  const handleFreeToggle = useCallback(() => {
    if (freeSessionActiveRef.current) {
      // ── Stop free session ─────────────────────────────────────────────
      freeSessionActiveRef.current = false;
      setFreeSessionActive(false);
      if (freeIntervalRef.current !== null) {
        clearInterval(freeIntervalRef.current);
        freeIntervalRef.current = null;
      }
      if (freeMeasureIntervalRef.current !== null) {
        clearInterval(freeMeasureIntervalRef.current);
        freeMeasureIntervalRef.current = null;
      }
      // Finalize any notes still in the current (partial) measure for saving.
      const stopTime = Date.now();
      const partialBuffer = freeMeasureBufferRef.current.slice();
      freeMeasureBufferRef.current = [];
      if (partialBuffer.length > 0) {
        const bpm = freeStaffBpmRef.current;
        const quantized = finalizeMeasureNotes(partialBuffer, freeMeasureStartMsRef.current, bpm, stopTime);
        const sessionStart = freeStartMsRef.current;
        for (const note of quantized) {
          freeMidiEventsRef.current.push({
            midiNote: note.midiNote,
            timestampMs: note.timestamp - sessionStart,
            durationMs: note.durationMs,
          });
        }
      }
      const elapsedMs = freeSessionStartedRef.current
        ? (stopTime - freeStartMsRef.current)
        : 0;
      const events = [...freeMidiEventsRef.current];
      const record: FreeMidiRecord = {
        events,
        elapsedMs,
        noteCount: events.length,
        bpm: freeStaffBpmRef.current,
      };
      setFreeMidiRecord(record);
      setResultsOverlayVisible(true);
    } else {
      // ── Start free session ────────────────────────────────────────────
      // Timing is initialized on the first MIDI note (deferred start).
      freeMidiEventsRef.current = [];
      const activeBpm = metronomeStateRef.current.bpm > 0 ? metronomeStateRef.current.bpm : 120;
      setFreeStaffBpm(activeBpm);
      freeStaffBpmRef.current = activeBpm;
      setFreeNoteCount(0);
      setFreeElapsedMs(0);
      setFreeMidiRecord(null);
      setResultsOverlayVisible(false);
      setFreeDisplayNotes([]);
      freeMeasureBufferRef.current = [];
      freeSessionStartedRef.current = false;
      freeSessionActiveRef.current = true;
      setFreeSessionActive(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Replay a completed free practice session. */
  const handleFreeReplay = useCallback(() => {
    if (!freeMidiRecord || isReplaying) return;
    freeReplayTimersRef.current.forEach(clearTimeout);
    freeReplayTimersRef.current = [];
    // Normalize to first-note offset so beat 1 of measure 1 is always at tick 0.
    const firstTs = freeMidiRecord.events.length > 0 ? freeMidiRecord.events[0].timestampMs : 0;
    const replayStart = Date.now();
    // Restore the BPM from the original recording so replay layout matches.
    setFreeStaffBpm(freeMidiRecord.bpm);
    setFreeDisplayOriginMs(replayStart);
    setFreeDisplayNotes([]);
    setResultsOverlayVisible(false);
    setIsReplaying(true);
    for (const event of freeMidiRecord.events) {
      const delay = event.timestampMs - firstTs;
      const timer = setTimeout(() => {
        context.playNote({ midiNote: event.midiNote, timestamp: Date.now(), type: 'attack', durationMs: event.durationMs ?? 200 });
        setFreeDisplayNotes((prev) => [
          ...prev,
          { midiNote: event.midiNote, timestamp: replayStart + delay, type: 'attack' as const, durationMs: event.durationMs },
        ]);
      }, delay);
      freeReplayTimersRef.current.push(timer);
    }
    const lastDelay = freeMidiRecord.events.length > 0
      ? freeMidiRecord.events[freeMidiRecord.events.length - 1].timestampMs - firstTs
      : 0;
    const doneTimer = setTimeout(() => {
      context.stopPlayback();
      setIsReplaying(false);
    }, lastDelay + 500);
    freeReplayTimersRef.current.push(doneTimer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context, freeMidiRecord, isReplaying]);

  /** Start a fresh free session after viewing results (Repractice). */
  const handleFreeRepractice = useCallback(() => {
    freeMidiEventsRef.current = [];
    const activeBpm = metronomeStateRef.current.bpm > 0 ? metronomeStateRef.current.bpm : 120;
    setFreeStaffBpm(activeBpm);
    freeStaffBpmRef.current = activeBpm;
    setFreeNoteCount(0);
    setFreeElapsedMs(0);
    setFreeMidiRecord(null);
    setResultsOverlayVisible(false);
    setIsSaved(false);
    setSaveError(null);
    setFreeDisplayNotes([]);
    freeMeasureBufferRef.current = [];
    freeSessionStartedRef.current = false;
    freeSessionActiveRef.current = true;
    setFreeSessionActive(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Return to the score selector from the free-practice view. */
  const handleFreeBack = useCallback(() => {
    freeSessionActiveRef.current = false;
    setFreeSessionActive(false);
    setIsFreePractice(false);
    setFreeMidiRecord(null);
    setResultsOverlayVisible(false);
    if (freeIntervalRef.current !== null) {
      clearInterval(freeIntervalRef.current);
      freeIntervalRef.current = null;
    }
    if (freeMeasureIntervalRef.current !== null) {
      clearInterval(freeMeasureIntervalRef.current);
      freeMeasureIntervalRef.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Dismiss the results overlay and return to the score selector. */
  const handleFreeDismiss = useCallback(() => {
    if (freeIntervalRef.current !== null) {
      clearInterval(freeIntervalRef.current);
      freeIntervalRef.current = null;
    }
    if (freeMeasureIntervalRef.current !== null) {
      clearInterval(freeMeasureIntervalRef.current);
      freeMeasureIntervalRef.current = null;
    }
    freeSessionActiveRef.current = false;
    setFreeSessionActive(false);
    setIsFreePractice(false);
    setFreeMidiRecord(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Restore a previously saved free practice into hook state.
   * Called by the orchestrator's onFreePracticeLoad callback when the user
   * selects a saved free practice from the selector or navigation data.
   */
  const loadSavedFreePractice = useCallback((record: FreeMidiRecord | null, noteCount: number) => {
    freeMidiEventsRef.current = [];
    freeSessionActiveRef.current = false;
    setFreeSessionActive(false);
    setFreeNoteCount(noteCount);
    setFreeMidiRecord(record);
    setFreeElapsedMs(0);
    setFreeDisplayNotes([]);
    loadedScoreRefRef.current = { type: 'free', id: '' };
    setIsFreePractice(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Clear live intervals — call on component unmount. */
  const cleanupFreeTimers = useCallback(() => {
    if (freeIntervalRef.current !== null) clearInterval(freeIntervalRef.current);
    if (freeMeasureIntervalRef.current !== null) clearInterval(freeMeasureIntervalRef.current);
  }, []);

  return {
    isFreePractice,
    setIsFreePractice,
    isFreePracticeRef,
    freeSessionActive,
    freeSessionActiveRef,
    freeNoteCount,
    freeMidiRecord,
    setFreeMidiRecord,
    freeElapsedMs,
    freeDisplayNotes,
    freeDisplayOriginMs,
    freeStaffBpm,
    freeStaffBpmRef,
    handleFreePractice,
    handleFreeToggle,
    handleFreeRepractice,
    handleFreeReplay,
    handleFreeBack,
    handleFreeDismiss,
    loadSavedFreePractice,
    cleanupFreeTimers,
  };
}
