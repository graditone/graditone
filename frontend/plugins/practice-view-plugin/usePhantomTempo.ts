import { useState, useEffect, useRef } from 'react';
import type { ScorePlayerState, PluginPracticeNoteEntry } from '../../src/plugin-api/index';
import type { PracticeState } from './practiceEngine.types';

// PPQ constant for tick→ms conversion
const PPQ = 960;

export interface UsePhantomTempoParams {
  practiceState: PracticeState;
  practiceStateRef: React.RefObject<PracticeState>;
  playerBpm: number;
  playerStateRef: React.RefObject<ScorePlayerState>;
}

export interface UsePhantomTempoReturn {
  /** Index into practiceState.notes indicating the phantom tempo cursor position. -1 when inactive. */
  phantomIndex: number;
}

/**
 * Advances through practice notes at the configured tempo to show the user
 * where they *should* be. Uses the existing highlighted-note pipeline at 50%
 * opacity (CSS class on root), while the target note uses the green pinned
 * pipeline.
 */
export function usePhantomTempo({
  practiceState,
  practiceStateRef,
  playerBpm,
  playerStateRef,
}: UsePhantomTempoParams): UsePhantomTempoReturn {
  const [phantomIndex, setPhantomIndex] = useState(-1);
  const phantomTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phantomStartTimeRef = useRef(0);
  const phantomNotesRef = useRef<readonly PluginPracticeNoteEntry[]>([]);
  const phantomBpmRef = useRef(0);
  const phantomBaseTickRef = useRef(0);

  // Start/stop phantom timer when practice mode transitions.
  // The timer starts on the first correct note (waiting→active).
  useEffect(() => {
    if ((practiceState.mode === 'active' || practiceState.mode === 'holding') && phantomTimerRef.current === null) {
      // Phantom starts from the note the user just matched.
      const notes = practiceState.notes;
      const startIdx = practiceState.currentIndex;
      phantomNotesRef.current = notes;
      // playerState.bpm already includes tempoMultiplier (scoreTempo × multiplier)
      phantomBpmRef.current = playerBpm;
      phantomBaseTickRef.current = notes[startIdx]?.tick ?? notes[0].tick;
      phantomStartTimeRef.current = Date.now();
      setPhantomIndex(startIdx);

      // Advance phantom every ~50 ms by comparing elapsed time
      // against each note's expected tick-based time.
      phantomTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - phantomStartTimeRef.current;
        const bpm = phantomBpmRef.current;
        if (bpm <= 0) return;
        const ticksPerMs = (bpm / 60) * PPQ / 1000;
        const pNotes = phantomNotesRef.current;
        if (pNotes.length === 0) return;
        const currentTick = phantomBaseTickRef.current + elapsed * ticksPerMs;
        // Find the last note whose tick ≤ currentTick
        let idx = 0;
        for (let i = pNotes.length - 1; i >= 0; i--) {
          if (pNotes[i].tick <= currentTick) { idx = i; break; }
        }
        // Hide phantom when it's ≥ 2 measures ahead of the user's position.
        const ps = practiceStateRef.current;
        const userIdx = ps.currentIndex;
        if (idx >= 0 && userIdx < pNotes.length && idx > userIdx) {
          const ts = playerStateRef.current.timeSignature;
          const ticksPerMeasure = ts.numerator * (4 / ts.denominator) * PPQ;
          const phantomTick = pNotes[idx].tick;
          const userTick = pNotes[userIdx].tick;
          if (phantomTick - userTick >= 2 * ticksPerMeasure) {
            setPhantomIndex(-1);
            return;
          }
        }
        setPhantomIndex(idx);
      }, 50); // ~20 Hz — smooth enough for visual guide
    }

    // Stop phantom timer when practice ends or deactivates
    if (practiceState.mode !== 'active' && practiceState.mode !== 'holding' && phantomTimerRef.current !== null) {
      clearInterval(phantomTimerRef.current);
      phantomTimerRef.current = null;
      setPhantomIndex(-1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practiceState.mode, practiceState.notes, practiceState.currentIndex, playerBpm, playerStateRef]);

  // Cleanup phantom timer on unmount
  useEffect(() => {
    return () => {
      if (phantomTimerRef.current !== null) {
        clearInterval(phantomTimerRef.current);
        phantomTimerRef.current = null;
      }
    };
  }, []);

  return { phantomIndex };
}
