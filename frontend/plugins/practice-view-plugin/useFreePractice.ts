/**
 * useFreePractice.ts
 * Features 092 + 094: Free Practice Option — onset-derived measure detection.
 *
 * Domain hook that owns all free (score-less) practice state, MIDI
 * subscription, and handlers:
 *   handleFreePractice   — enter free-practice mode from selector
 *   handleFreeToggle     — start / stop the live recording session
 *   handleFreeReplay     — replay a completed free session
 *   handleFreeRepractice — start a fresh free session after results
 *   handleFreeBack       — return to selector from free-practice view
 *   handleFreeDismiss    — dismiss results overlay (returns to selector)
 *   loadSavedFreePractice — restore a previously saved free practice
 *   cleanupFreeTimers    — called on unmount to clear any live intervals
 *
 * Feature 094: The live staff, saved record and replay are ALL derived from the
 * raw `FreeMidiEvent[]` onsets via `detectMeasures` — never from a wall-clock
 * measure timer and never from the metronome (FR-001 / SC-007). The raw events
 * remain the only stored data; measures are a derived view (D5).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type React from 'react';
import type { PluginContext, MetronomeState, PluginNoteEvent } from '../../src/plugin-api/index';
import type { ScoreRef, FreeMidiEvent, FreeMidiRecord } from '../../src/plugin-api/index';
import { ABSOLUTE_BPM_FLOOR } from '../../src/plugin-api/index';
import { detectMeasures, freeModeToPluginNotes } from './freePractice.helpers';
import type { FreeMidiEventLike } from './freePractice.helpers';

/** Sync the display-origin state + ref (stable callbacks read the ref). */
function setOrigin(
  setter: (v: number) => void,
  ref: React.MutableRefObject<number>,
  value: number,
) {
  ref.current = value;
  setter(value);
}

// ---------------------------------------------------------------------------
// Effective-BPM helpers (Feature 093)
// ---------------------------------------------------------------------------

/**
 * Nominal free-practice BPM. Free practice has no score, so the scorePlayer
 * nominal tempo is its default (120). The metronome reports the EFFECTIVE BPM
 * (scoreTempo × multiplier), so the free "base" MUST stay at this nominal and
 * the metronome's tempo is realized through the multiplier — keeping the
 * readout, slider, metronome and detection grid in agreement at every tempo.
 */
export const FREE_NOMINAL_BPM = 120;

/**
 * Convert a metronome-reported (effective) BPM into the free-practice
 * multiplier given the free nominal base. e.g. metronome 30 → 0.25 (so the
 * free effective = round(120 × 0.25) = 30, matching the audible metronome).
 * When the metronome is inactive it reports bpm 0 → default multiplier 1.0.
 */
export function computeFreeBpmMultiplier(metronomeBpm: number): number {
  return metronomeBpm > 0 ? metronomeBpm / FREE_NOMINAL_BPM : 1.0;
}

/**
 * Effective free-practice BPM = round(base × multiplier), never below the
 * absolute BPM floor. Used for the toolbar readout, the staff renderer, and
 * the persisted FreeMidiRecord.bpm.
 */
function computeEffectiveBpm(baseBpm: number, multiplier: number): number {
  return Math.max(ABSOLUTE_BPM_FLOOR, Math.round(baseBpm * multiplier));
}

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
  /**
   * Called on every MIDI attack during an active free session. The host uses
   * it to start an armed metronome on the first played note (Feature 083
   * parity with score practice). Optional; safe when absent.
   */
  onFreeNoteAttackRef?: React.MutableRefObject<(() => void) | null> | null;
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
  /** Feature 093: effective BPM (round(base × multiplier)) — single source of truth for display + timing. */
  freeEffectiveBpm: number;
  /** Feature 093: ref mirror of freeEffectiveBpm for use inside stable callbacks. */
  freeEffectiveBpmRef: React.MutableRefObject<number>;
  /** Feature 093: current tempo multiplier applied to the free-practice base. */
  freeTempoMultiplier: number;
  /** Feature 093: ref mirror of the tempo multiplier. */
  freeTempoMultiplierRef: React.MutableRefObject<number>;
  // Handlers
  handleFreePractice: () => void;
  handleFreeToggle: () => void;
  handleFreeRepractice: () => void;
  handleFreeReplay: () => void;
  handleFreeBack: () => void;
  handleFreeDismiss: () => void;
  /** Feature 093: recompute the effective BPM from a new tempo multiplier (slider change). */
  setFreeTempo: (multiplier: number) => void;
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
  onFreeNoteAttackRef,
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
  /** Ref mirror of `freeDisplayOriginMs` for stable-callbacks (handlers/effect). */
  const freeDisplayOriginMsRef = useRef(0);

  // ── Refs ──────────────────────────────────────────────────────────────────

  const isFreePracticeRef = useRef(false);
  isFreePracticeRef.current = isFreePractice;

  const freeSessionActiveRef = useRef(false);
  const freeStaffBpmRef = useRef(120);
  freeStaffBpmRef.current = freeStaffBpm;

  // Feature 093: effective BPM + tempo multiplier (single source of truth)
  const [freeEffectiveBpm, setFreeEffectiveBpm] = useState(120);
  const freeEffectiveBpmRef = useRef(120);
  freeEffectiveBpmRef.current = freeEffectiveBpm;

  const [freeTempoMultiplier, setFreeTempoMultiplier] = useState(1.0);
  const freeTempoMultiplierRef = useRef(1.0);
  freeTempoMultiplierRef.current = freeTempoMultiplier;

  /**
   * Raw onsets (Feature 094): the ONLY recorded representation. `timestampMs`
   * is relative to the first attack (measure-1 grid origin). All measure
   * structure is derived from this array via `detectMeasures`.
   */
  const freeMidiEventsRef = useRef<FreeMidiEvent[]>([]);
  /** Absolute wall-clock ms of the first attack (used for the elapsed ticker). */
  const freeStartMsRef = useRef(0);
  const freeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const freeReplayTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  /**
   * True once the first MIDI note of the session has arrived.
   * All session timing is deferred until then so the user can wait
   * before playing without creating empty leading measures.
   */
  const freeSessionStartedRef = useRef(false);

  // ── Detection-derived display (Feature 094) ───────────────────────────────
  /**
   * Render the current onsets through the onset-derived detector into the
   * plugin staff's `PluginNoteEvent[]`. Timestamps returned by the detector are
   * relative to the first onset; we add `originMs` (an absolute wall-clock) so
   * the existing StaffViewer (`timestampOffset = freeDisplayOriginMs`) yields
   * correct quantized ticks.
   */
  const renderMeasureDisplay = (events: FreeMidiEventLike[], bpm: number, originMs: number) => {
    const measures = detectMeasures(events, bpm);
    const notes = freeModeToPluginNotes(measures, bpm, 0);
    return notes.map((n) => ({ ...n, timestamp: n.timestamp + originMs }));
  };

  /** Effective BPM used for the recovered grid (Feature 093). */
  const effectiveBpmNow = () =>
    freeStaffBpmRef.current * freeTempoMultiplierRef.current;

  /** Current display origin (absolute wall-clock at first onset). */
  const originNow = () => freeDisplayOriginMsRef.current;

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
          setOrigin(setFreeDisplayOriginMs, freeDisplayOriginMsRef, now);
          // Start the elapsed-time ticker from the first note.
          if (freeIntervalRef.current !== null) clearInterval(freeIntervalRef.current);
          freeIntervalRef.current = setInterval(() => {
            setFreeElapsedMs(Date.now() - freeStartMsRef.current);
          }, 1000);
        }
        freeMidiEventsRef.current.push({
          midiNote: event.midiNote,
          timestampMs: now - freeStartMsRef.current,
          durationMs: undefined,
        });
        setFreeNoteCount((c) => c + 1);
        // Feature 083 parity: let the host start an armed metronome on the
        // first played note (calling it every attack is a no-op once started).
        onFreeNoteAttackRef?.current?.();
        // Real-time: re-derive the staff from the recovered grid (onset-derived).
        setFreeDisplayNotes(
          renderMeasureDisplay(freeMidiEventsRef.current, Math.round(effectiveBpmNow()), originNow()),
        );
        return;
      }

      if (event.type === 'release') {
        // Fill the held duration of the matching open attack (latest first).
        const events = freeMidiEventsRef.current;
        for (let i = events.length - 1; i >= 0; i--) {
          if (events[i].midiNote === event.midiNote && events[i].durationMs == null) {
            const relAttack = events[i].timestampMs;
            events[i] = { ...events[i], durationMs: now - (freeStartMsRef.current + relAttack) };
            break;
          }
        }
        setFreeDisplayNotes(
          renderMeasureDisplay(freeMidiEventsRef.current, Math.round(effectiveBpmNow()), originNow()),
        );
      }
    });
    // onFreeNoteAttackRef is a stable ref param — its `.current` may change but
    // the ref identity never does, so it is safe in the deps array.
  }, [context.midi, onFreeNoteAttackRef]);

  // ── Replay cleanup: clear timers when replay ends ─────────────────────────
  useEffect(() => {
    if (!isReplaying && freeReplayTimersRef.current.length > 0) {
      freeReplayTimersRef.current.forEach(clearTimeout);
      freeReplayTimersRef.current = [];
    }
  }, [isReplaying]);

  // ── Tempo seeding + slider transform (Feature 093) ───────────────────────

  /**
   * Seed the free-practice tempo state from an explicit base + multiplier.
   *
   * To keep the readout, slider, metronome and detection grid in agreement,
   * `base` MUST always be the free nominal (FREE_NOMINAL_BPM) and any
   * metronome-derived tempo is expressed through `multiplier`
   * (computeFreeBpmMultiplier). This prevents the desync bugs where the free
   * base was seeded from the metronome's already-*effective* BPM (30) while the
   * scorePlayer-driven metronome ran at 120 (issues #2/#3).
   */
  const seedFreeTempo = useCallback((base: number, multiplier: number) => {
    freeStaffBpmRef.current = base;
    setFreeStaffBpm(base);
    freeTempoMultiplierRef.current = multiplier;
    setFreeTempoMultiplier(multiplier);
    const effective = computeEffectiveBpm(base, multiplier);
    freeEffectiveBpmRef.current = effective;
    setFreeEffectiveBpm(effective);
  }, []);

  /**
   * Feature 093 — apply a tempo change from the toolbar slider.
   * Publishes the recomputed effective BPM so the readout, staff renderer,
   * measure clock, and saved record all follow the slider in real time.
   */
  const setFreeTempo = useCallback((multiplier: number): void => {
    const effective = computeEffectiveBpm(freeStaffBpmRef.current, multiplier);
    freeTempoMultiplierRef.current = multiplier;
    setFreeTempoMultiplier(multiplier);
    freeEffectiveBpmRef.current = effective;
    setFreeEffectiveBpm(effective);
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  /** Enter free-practice mode from the score selector. */
  const handleFreePractice = useCallback(() => {
    freeMidiEventsRef.current = [];
    freeStartMsRef.current = Date.now();
    // Adopt the live metronome tempo through the MULTIPLIER (base stays the
    // free nominal 120). If the metronome is off (bpm 0) the default tempo
    // applies (multiplier 1.0 → 120 BPM). This keeps the readout and the
    // audible metronome in agreement on (re-)entry.
    seedFreeTempo(FREE_NOMINAL_BPM, computeFreeBpmMultiplier(metronomeStateRef.current.bpm));
    setFreeNoteCount(0);
    setFreeMidiRecord(null);
    setResultsOverlayVisible(false);
    setIsSaved(false);
    setSaveError(null);
    setFreeElapsedMs(0);
    setFreeDisplayNotes([]);
    setOrigin(setFreeDisplayOriginMs, freeDisplayOriginMsRef, freeStartMsRef.current);
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
      // Close durations for notes still held at Stop.
      const stopTime = Date.now();
      const events = [...freeMidiEventsRef.current].map((ev) =>
        ev.durationMs == null
          ? { ...ev, durationMs: stopTime - (freeStartMsRef.current + ev.timestampMs) }
          : ev,
      );
      freeMidiEventsRef.current = events;
      const elapsedMs = freeSessionStartedRef.current
        ? (stopTime - freeStartMsRef.current)
        : 0;
      const record: FreeMidiRecord = {
        events,
        elapsedMs,
        noteCount: events.length,
        // Feature 093: persist the EFFECTIVE tempo (base × multiplier at stop),
        // not the stale session-boundary base.
        bpm: Math.max(ABSOLUTE_BPM_FLOOR, Math.round(effectiveBpmNow())),
      };
      setFreeMidiRecord(record);
      // Feature 094: staff reflects the onset-derived measures at Stop.
      setFreeDisplayNotes(
        renderMeasureDisplay(events, record.bpm, originNow()),
      );
      setResultsOverlayVisible(true);
    } else {
      // ── Start free session ────────────────────────────────────────────
      // Timing is initialized on the first MIDI note (deferred start).
      freeMidiEventsRef.current = [];
      // The metronome reports the EFFECTIVE BPM (120 × its multiplier). Adopt
      // it through the multiplier with the base fixed at the free nominal so
      // the readout, click and detection grid stay in agreement. When it is off
      // (bpm 0) keep the current base × multiplier.
      if (metronomeStateRef.current.bpm > 0) {
        seedFreeTempo(FREE_NOMINAL_BPM, computeFreeBpmMultiplier(metronomeStateRef.current.bpm));
      }
      setFreeNoteCount(0);
      setFreeElapsedMs(0);
      setFreeMidiRecord(null);
      setResultsOverlayVisible(false);
      setFreeDisplayNotes([]);
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
    // Keep the free nominal base: the recorded (effective) BPM is realized via
    // the multiplier so the effective tempo stays exactly the record's tempo.
    seedFreeTempo(FREE_NOMINAL_BPM, computeFreeBpmMultiplier(freeMidiRecord.bpm));
    setOrigin(setFreeDisplayOriginMs, freeDisplayOriginMsRef, replayStart);
    // Feature 094: staff shows the SAME onset-derived measures as live/saved.
    setFreeDisplayNotes(
      renderMeasureDisplay(freeMidiRecord.events, freeMidiRecord.bpm, replayStart),
    );
    setResultsOverlayVisible(false);
    setIsReplaying(true);
    for (const event of freeMidiRecord.events) {
      const delay = event.timestampMs - firstTs;
      const timer = setTimeout(() => {
        context.playNote({ midiNote: event.midiNote, timestamp: Date.now(), type: 'attack', durationMs: event.durationMs ?? 200 });
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
    // Issue #3: do NOT re-seed tempo from the metronome and do NOT reset the
    // multiplier here. Repractice continues at the tempo the user just
    // practiced at (base × multiplier). Re-deriving from the metronome's
    // effective/stale bpm previously desynced the readout from the metronome.
    setFreeNoteCount(0);
    setFreeElapsedMs(0);
    setFreeMidiRecord(null);
    setResultsOverlayVisible(false);
    setIsSaved(false);
    setSaveError(null);
    setFreeDisplayNotes([]);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Dismiss the results overlay and return to the score selector. */
  const handleFreeDismiss = useCallback(() => {
    if (freeIntervalRef.current !== null) {
      clearInterval(freeIntervalRef.current);
      freeIntervalRef.current = null;
    }
    freeSessionActiveRef.current = false;
    setFreeSessionActive(false);
    setIsFreePractice(false);
    setFreeMidiRecord(null);
  }, []);

  /**
   * Restore a previously saved free practice into hook state.
   * Called by the orchestrator's onFreePracticeLoad callback when the user
   * selects a saved free practice from the selector or navigation data.
   * Feature 094: staff renders onset-derived measures from the saved events.
   */
  const loadSavedFreePractice = useCallback((record: FreeMidiRecord | null, noteCount: number) => {
    freeMidiEventsRef.current = [];
    freeSessionActiveRef.current = false;
    setFreeSessionActive(false);
    setFreeNoteCount(noteCount);
    setFreeMidiRecord(record);
    setFreeElapsedMs(0);
    setOrigin(setFreeDisplayOriginMs, freeDisplayOriginMsRef, 0);
    if (record) {
      // Keep the free nominal base; the record's (effective) BPM is realized
      // via the multiplier so the readout and staff render at the saved tempo.
      seedFreeTempo(FREE_NOMINAL_BPM, computeFreeBpmMultiplier(record.bpm));
      const sorted = [...record.events].sort((a, b) => a.timestampMs - b.timestampMs);
      setFreeDisplayNotes(renderMeasureDisplay(sorted, record.bpm, 0));
    } else {
      setFreeDisplayNotes([]);
    }
    loadedScoreRefRef.current = { type: 'free', id: '' };
    setIsFreePractice(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Clear live intervals — call on component unmount. */
  const cleanupFreeTimers = useCallback(() => {
    if (freeIntervalRef.current !== null) clearInterval(freeIntervalRef.current);
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
    freeEffectiveBpm,
    freeEffectiveBpmRef,
    freeTempoMultiplier,
    freeTempoMultiplierRef,
    handleFreePractice,
    handleFreeToggle,
    handleFreeRepractice,
    handleFreeReplay,
    handleFreeBack,
    handleFreeDismiss,
    setFreeTempo,
    loadSavedFreePractice,
    cleanupFreeTimers,
  };
}