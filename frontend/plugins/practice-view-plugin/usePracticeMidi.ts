import { useState, useEffect, useRef } from 'react';
import type {
  PluginContext,
  ScorePlayerState,
  PluginPracticeNoteEntry,
} from '../../src/plugin-api/index';
import { ChordDetector } from '../../src/plugin-api/index';
import type { PracticeState, PracticeAction } from './practiceEngine.types';

// ---------------------------------------------------------------------------
// Hook contract
// ---------------------------------------------------------------------------

export interface UsePracticeMidiParams {
  context: PluginContext;
  practiceState: PracticeState;
  practiceStateRef: React.RefObject<PracticeState>;
  playerState: ScorePlayerState;
  playerStateRef: React.RefObject<ScorePlayerState>;
  dispatchPractice: React.Dispatch<PracticeAction>;
  loopRegionRef: React.RefObject<{ startTick: number; endTick: number } | null>;
  loopPracticeRangeRef: React.RefObject<{ startIndex: number; endIndex: number } | null>;
  loopIterationRef: React.RefObject<number>;
  loopStartTimesRef: React.RefObject<number[]>;
  practiceStartTimeRef: React.RefObject<number>;
  selectedStaffIndex: number;
  /**
   * Feature 083 (US3): Called once on the first MIDI note attack while practice
   * is in 'waiting' mode. Used to trigger deferred metronome start.
   */
  onFirstNoteAttack?: () => void;
}

export interface UsePracticeMidiReturn {
  midiPressedNoteIds: ReadonlySet<string>;
  midiEventTick: number;
  heldMidiKeysRef: React.RefObject<Set<number>>;
  chordDetectorRef: React.RefObject<ChordDetector>;
}

// PPQ constant for tick→ms conversion
const PPQ = 960;

// ---------------------------------------------------------------------------
// Exported helpers (unit-testable hold-duration formula)
// ---------------------------------------------------------------------------

/**
 * Minimum wall-clock hold duration (ms) required before the hold gate is
 * engaged. Notes whose computed duration is ≤ this value need no hold.
 * Used by T008 to replace the tick-based gate condition.
 */
export const HOLD_FLOOR_MS = 500;

/**
 * Compute the required hold duration in milliseconds for a note.
 * Returns 0 when `bpm ≤ 0` (guards against division-by-zero).
 */
export function computeRequiredHoldMs(durationTicks: number, bpm: number): number {
  return bpm > 0 ? (durationTicks / ((bpm / 60) * PPQ)) * 1000 : 0;
}

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

export function usePracticeMidi({
  context,
  practiceState,
  practiceStateRef,
  playerState,
  playerStateRef,
  dispatchPractice,
  loopRegionRef,
  loopPracticeRangeRef,
  loopIterationRef,
  loopStartTimesRef,
  practiceStartTimeRef,
  selectedStaffIndex: _selectedStaffIndex,
  onFirstNoteAttack,
}: UsePracticeMidiParams): UsePracticeMidiReturn {
  // ─── Chord detector ─────────────────────────────────────────────────────────
  const chordDetectorRef = useRef(new ChordDetector());
  const prevPracticeIndexRef = useRef(-1);

  // ─── Held MIDI keys tracking ───────────────────────────────────────────────
  const heldMidiKeysRef = useRef<Set<number>>(new Set());

  // ─── MIDI-pressed note IDs ─────────────────────────────────────────────────
  const [midiPressedNoteIds, setMidiPressedNoteIds] = useState<ReadonlySet<string>>(new Set());
  const [midiEventTick, setMidiEventTick] = useState(0);

  // ─── Feature 083: First-note attack callback (deferred metronome start) ────
  // Keep a ref to the latest callback to avoid stale closures inside the MIDI
  // subscription effect.
  const onFirstNoteAttackRef = useRef(onFirstNoteAttack);
  useEffect(() => { onFirstNoteAttackRef.current = onFirstNoteAttack; }, [onFirstNoteAttack]);

  // Guard: fire exactly once per practice session. Reset when practice stops.
  const hasCalledFirstNoteRef = useRef(false);
  useEffect(() => {
    if (practiceState.mode === 'inactive' || practiceState.mode === 'waiting') {
      hasCalledFirstNoteRef.current = false;
    }
  }, [practiceState.mode]);

  // ─── All-notes lookup for MIDI visual highlight ────────────────────────────
  const allNotesRef = useRef<PluginPracticeNoteEntry[]>([]);
  const prevLoadKeyRef = useRef('');

  // ─── Chord detector reset (on beat change / mode change) ──────────────────
  useEffect(() => {
    const ps = practiceStateRef.current;
    if (ps.mode === 'active' || ps.mode === 'waiting') {
      const isNewBeat = ps.currentIndex !== prevPracticeIndexRef.current;
      prevPracticeIndexRef.current = ps.currentIndex;

      const entry = ps.notes[ps.currentIndex];
      if (entry) {
        const onset = entry.midiPitches as number[];
        const sustained = (entry.sustainedPitches ?? []) as number[];
        chordDetectorRef.current.reset([...onset, ...sustained]);
        for (const pitch of sustained) {
          if (heldMidiKeysRef.current.has(pitch)) {
            chordDetectorRef.current.pin(pitch);
          }
        }
        if (isNewBeat) {
          const allRequired = [...onset, ...sustained];
          const wouldAutoComplete = allRequired.length > 0 && allRequired.every(
            (p) => heldMidiKeysRef.current.has(p),
          );
          if (!wouldAutoComplete) {
            for (const pitch of onset) {
              if (heldMidiKeysRef.current.has(pitch)) {
                chordDetectorRef.current.pin(pitch);
              }
            }
          }
        } else {
          for (const pitch of onset) {
            if (heldMidiKeysRef.current.has(pitch)) {
              chordDetectorRef.current.pin(pitch);
            }
          }
        }
      } else {
        chordDetectorRef.current.reset([]);
      }
    } else {
      prevPracticeIndexRef.current = ps.currentIndex;
      chordDetectorRef.current.reset([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practiceState.currentIndex, practiceState.mode]);

  // ─── All-notes rebuild ─────────────────────────────────────────────────────
  useEffect(() => {
    const { status, staffCount, title } = playerState;
    const loadKey = `${status}:${staffCount}:${title ?? ''}`;
    if (!['ready', 'playing', 'paused'].includes(status) || staffCount === 0) {
      allNotesRef.current = [];
      prevLoadKeyRef.current = '';
      return;
    }
    if (loadKey === prevLoadKeyRef.current) return;
    prevLoadKeyRef.current = loadKey;
    const all: PluginPracticeNoteEntry[] = [];
    for (let s = 0; s < staffCount; s++) {
      const pitches = context.scorePlayer.extractPracticeNotes(s);
      if (pitches) all.push(...(pitches.notes as PluginPracticeNoteEntry[]));
    }
    allNotesRef.current = all;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerState.status, playerState.staffCount, playerState.title, context.scorePlayer]);

  // ─── MIDI subscription ─────────────────────────────────────────────────────
  useEffect(() => {
    return context.midi.subscribe((event) => {
      if (event.type === 'release') {
        heldMidiKeysRef.current.delete(event.midiNote);
        context.playNote({ midiNote: event.midiNote, timestamp: event.timestamp, type: 'release' });
        setMidiPressedNoteIds(new Set());
        setMidiEventTick(t => t + 1);

        const holdPs = practiceStateRef.current;
        if (holdPs.mode === 'holding') {
          const holdEntry = holdPs.notes[holdPs.currentIndex];
          if (holdEntry && (
            (holdEntry.midiPitches as number[]).includes(event.midiNote) ||
            ((holdEntry.sustainedPitches ?? []) as number[]).includes(event.midiNote)
          )) {
            const holdDurationMs = Date.now() - holdPs.holdStartTimeMs;
            dispatchPractice({ type: 'EARLY_RELEASE', holdDurationMs });
          }
        }
        return;
      }
      if (event.type !== 'attack') return;

      heldMidiKeysRef.current.add(event.midiNote);
      setMidiEventTick(t => t + 1);

      context.playNote({
        midiNote: event.midiNote,
        timestamp: event.timestamp,
        type: 'attack',
        durationMs: event.durationMs ?? 500,
      });

      const TICK_WINDOW = 240;
      const currentTick = playerStateRef.current.currentTick;
      const matching = allNotesRef.current.filter(
        (e) =>
          Math.abs(e.tick - currentTick) <= TICK_WINDOW &&
          (e.midiPitches as number[]).includes(event.midiNote),
      );
      if (matching.length > 0) {
        const ids: string[] = [];
        for (const e of matching) {
          const idx = (e.midiPitches as number[]).indexOf(event.midiNote);
          if (idx >= 0 && idx < e.noteIds.length) ids.push(e.noteIds[idx]);
        }
        if (ids.length > 0) setMidiPressedNoteIds(new Set(ids));
      }

      const ps = practiceStateRef.current;
      if (ps.mode !== 'active' && ps.mode !== 'waiting' && ps.mode !== 'holding') return;

      // Feature 083 (US3): fire deferred-metronome callback on the first note
      // attack of a practice session (mode === 'waiting'). The guard ref ensures
      // simultaneous chord events only trigger the callback once.
      if (ps.mode === 'waiting' && !hasCalledFirstNoteRef.current) {
        hasCalledFirstNoteRef.current = true;
        onFirstNoteAttackRef.current?.();
      }

      const currentEntry = ps.notes[ps.currentIndex];
      if (!currentEntry) return;

      const allRequired = [...(currentEntry.midiPitches as number[]), ...((currentEntry.sustainedPitches ?? []) as number[])];
      for (const p of allRequired) {
        if (!heldMidiKeysRef.current.has(p)) {
          chordDetectorRef.current.unpin(p);
        }
      }

      let chordResult = chordDetectorRef.current.press(event.midiNote, event.timestamp);
      const isInChord = (currentEntry.midiPitches as number[]).includes(event.midiNote);
      const isSustained = ((currentEntry.sustainedPitches ?? []) as number[]).includes(event.midiNote);

      if (!chordResult.complete && chordResult.missing.length > 0) {
        let repinned = false;
        for (const pitch of chordResult.missing) {
          if (heldMidiKeysRef.current.has(pitch)) {
            chordDetectorRef.current.pin(pitch);
            repinned = true;
          }
        }
        if (repinned) {
          chordResult = chordDetectorRef.current.press(event.midiNote, event.timestamp);
        }
      }
      if (ps.mode === 'holding') {
        if (!isInChord && !isSustained) {
          const wrongResponseTimeMs = Date.now() - practiceStartTimeRef.current;
          dispatchPractice({ type: 'WRONG_MIDI', midiNote: event.midiNote, responseTimeMs: wrongResponseTimeMs });
        }
        return;
      }
      if (chordResult.complete) {
        chordDetectorRef.current.reset([]);

        if (ps.mode === 'waiting') {
          practiceStartTimeRef.current = Date.now();
        }
        const bpm = playerStateRef.current.bpm;
        const baseExpectedTimeMs = bpm > 0
          ? (currentEntry.tick / ((bpm / 60) * PPQ)) * 1000
          : 0;
        const lr = loopRegionRef.current;
        const loopK = loopIterationRef.current;
        let expectedTimeMs: number;
        if (lr && loopK > 0 && bpm > 0) {
          const loopStartBaseMs = (lr.startTick / ((bpm / 60) * PPQ)) * 1000;
          const timeWithinLoop = baseExpectedTimeMs - loopStartBaseMs;
          const loopStartMs = loopStartTimesRef.current[loopK] ?? 0;
          expectedTimeMs = loopStartMs + timeWithinLoop;
        } else {
          expectedTimeMs = baseExpectedTimeMs;
        }
        const responseTimeMs = ps.mode === 'waiting' ? 0 : Date.now() - practiceStartTimeRef.current;

        const range = loopPracticeRangeRef.current;
        let effectiveDurTicks = currentEntry.durationTicks;
        const nextEntry = ps.notes[ps.currentIndex + 1];
        if (nextEntry) {
          const gapTicks = nextEntry.tick - currentEntry.tick;
          if (gapTicks > 0 && gapTicks < effectiveDurTicks) {
            effectiveDurTicks = gapTicks;
          }
        }
        const entryRequiredHoldMs = computeRequiredHoldMs(effectiveDurTicks, bpm) > HOLD_FLOOR_MS
          ? computeRequiredHoldMs(effectiveDurTicks, bpm)
          : 0;
        dispatchPractice({
          type: 'CORRECT_MIDI',
          midiNote: event.midiNote,
          responseTimeMs,
          expectedTimeMs,
          endIndex: range?.endIndex,
          pressTimeMs: Date.now(),
          requiredHoldMs: entryRequiredHoldMs,
        });
      } else if (!isInChord && !isSustained) {
        const wrongResponseTimeMs = ps.mode === 'waiting' ? 0 : Date.now() - practiceStartTimeRef.current;
        dispatchPractice({ type: 'WRONG_MIDI', midiNote: event.midiNote, responseTimeMs: wrongResponseTimeMs });
      }
    });
  }, [context.midi, context]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    midiPressedNoteIds,
    midiEventTick,
    heldMidiKeysRef,
    chordDetectorRef,
  };
}
