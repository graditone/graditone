import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type {
  PluginContext,
  ScorePlayerState,
} from '../../src/plugin-api/index';
import type { PracticeState, PracticeAction, PerformanceRecord } from './practiceEngine.types';

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------

type PinState = { tick: number; noteId: string };
type LoopRegion = { startTick: number; endTick: number };
type LoopRange = { startIndex: number; endIndex: number };

// ---------------------------------------------------------------------------
// Hook contract
// ---------------------------------------------------------------------------

export interface UsePracticeLoopParams {
  practiceState: PracticeState;
  dispatchPractice: React.Dispatch<PracticeAction>;
  playerState: ScorePlayerState;
  practiceStartTimeRef: React.RefObject<number>;
  context: PluginContext;
  onComplete: (record: PerformanceRecord) => void;
  onResultsShow: () => void;
  /** Feature 061: Optional initial loop region start tick (from task config). */
  initialStartTick?: number | null;
  /** Feature 061: Optional initial loop region end tick (from task config). */
  initialEndTick?: number | null;
  /** Feature 061: When true, the loop region is locked and cannot be changed. */
  taskLocked?: boolean;
}

export interface UsePracticeLoopReturn {
  loopStart: PinState | null;
  loopEndPin: PinState | null;
  loopCount: number;
  setLoopCount: React.Dispatch<React.SetStateAction<number>>;
  pinnedNoteIds: ReadonlySet<string>;
  loopRegion: LoopRegion | null;
  loopPracticeRange: LoopRange | null;
  loopRegionRef: React.RefObject<LoopRegion | null>;
  loopPracticeRangeRef: React.RefObject<LoopRange | null>;
  loopIterationRef: React.RefObject<number>;
  loopStartTimesRef: React.RefObject<number[]>;
  remainingLoopsRef: React.MutableRefObject<number>;
  handleNoteLongPress: (tick: number, noteId: string | null) => void;
  resetLoopTracking: () => void;
}

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

export function usePracticeLoop({
  practiceState,
  dispatchPractice,
  playerState,
  practiceStartTimeRef,
  context,
  onComplete,
  onResultsShow,
  initialStartTick,
  initialEndTick,
  taskLocked,
}: UsePracticeLoopParams): UsePracticeLoopReturn {
  // ─── Multi-loop practice state ─────────────────────────────────────────────
  const [loopCount, setLoopCount] = useState(1);
  const remainingLoopsRef = useRef(0);
  const loopIterationRef = useRef(0);
  const loopStartTimesRef = useRef<number[]>([0]);

  // ─── Pin / loop state (mirrors play-score) ──────────────────────────────────
  const [loopStart, setLoopStart] = useState<PinState | null>(null);
  const [loopEndPin, setLoopEndPin] = useState<PinState | null>(null);

  // Feature 061: Initialize loop region from task config (one-time)
  const initializedRef = useRef(false);
  useEffect(() => {
    if (
      !initializedRef.current &&
      initialStartTick != null &&
      initialEndTick != null &&
      initialStartTick !== initialEndTick
    ) {
      initializedRef.current = true;
      setLoopStart({ tick: initialStartTick, noteId: '__task-start' });
      setLoopEndPin({ tick: initialEndTick, noteId: '__task-end' });
      context.scorePlayer.setPinnedStart(Math.min(initialStartTick, initialEndTick));
      context.scorePlayer.setLoopEnd(Math.max(initialStartTick, initialEndTick));
    }
  }, [initialStartTick, initialEndTick, context.scorePlayer]);

  const pinnedNoteIds = useMemo<ReadonlySet<string>>(() => {
    const ids = new Set<string>();
    if (loopStart) ids.add(loopStart.noteId);
    if (loopEndPin) ids.add(loopEndPin.noteId);
    return ids;
  }, [loopStart, loopEndPin]);

  const loopRegion = useMemo(() => {
    if (!loopStart || !loopEndPin || loopStart.tick === loopEndPin.tick) return null;
    return {
      startTick: Math.min(loopStart.tick, loopEndPin.tick),
      endTick: Math.max(loopStart.tick, loopEndPin.tick),
    };
  }, [loopStart, loopEndPin]);

  const loopRegionRef = useRef(loopRegion);
  // eslint-disable-next-line react-hooks/refs -- writer-owns-ref pattern: keep ref in sync for consumers
  loopRegionRef.current = loopRegion;

  // ─── Practice loop index range ──────────────────────────────────────────────
  const loopPracticeRange = useMemo<LoopRange | null>(() => {
    const notes = practiceState.notes;
    if (!loopRegion || notes.length === 0) return null;
    const startIndex = notes.findIndex((n) => n.tick >= loopRegion.startTick);
    if (startIndex === -1) return null;
    let endIndex = startIndex;
    for (let i = startIndex; i < notes.length; i++) {
      if (notes[i].tick < loopRegion.endTick) endIndex = i;
      else break;
    }
    return { startIndex, endIndex };
  }, [loopRegion, practiceState.notes]);

  const loopPracticeRangeRef = useRef<LoopRange | null>(loopPracticeRange);
  // eslint-disable-next-line react-hooks/refs -- writer-owns-ref pattern: keep ref in sync for consumers
  loopPracticeRangeRef.current = loopPracticeRange;

  // ─── Loop-restart on complete ──────────────────────────────────────────────
  useEffect(() => {
    if (practiceState.mode === 'complete') {
      if (remainingLoopsRef.current > 0) {
        remainingLoopsRef.current -= 1;
        loopIterationRef.current += 1;
        const loopStartMs = Date.now() - practiceStartTimeRef.current;
        loopStartTimesRef.current.push(loopStartMs);
        const range = loopPracticeRangeRef.current;
        if (range) {
          dispatchPractice({ type: 'LOOP_RESTART', startIndex: range.startIndex });
          return;
        }
      }
      onResultsShow();
      onComplete({
        notes: [...practiceState.notes],
        noteResults: [...practiceState.noteResults],
        wrongNoteEvents: [...practiceState.wrongNoteEvents],
        bpmAtCompletion: playerState.bpm,
      });
    }
  }, [practiceState.mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Long press — pin/loop state machine ───────────────────────────────────
  const handleNoteLongPress = useCallback(
    (tick: number, noteId: string | null) => {
      // Feature 061: When task-locked, the loop region cannot be changed.
      if (taskLocked) return;

      const isPlaying = playerState.status === 'playing';

      if (loopRegion && tick >= loopRegion.startTick && tick <= loopRegion.endTick) {
        setLoopStart(null);
        setLoopEndPin(null);
        context.scorePlayer.setPinnedStart(null);
        context.scorePlayer.setLoopEnd(null);
        return;
      }

      if (loopStart === null) {
        const id = noteId ?? '';
        setLoopStart({ tick, noteId: id });
        if (!isPlaying) context.scorePlayer.setPinnedStart(tick);
      } else if (loopStart.noteId === noteId || loopStart.tick === tick) {
        setLoopStart(null);
        setLoopEndPin(null);
        context.scorePlayer.setPinnedStart(null);
        context.scorePlayer.setLoopEnd(null);
      } else {
        const id = noteId ?? '';
        setLoopEndPin({ tick, noteId: id });
        if (!isPlaying) {
          const regionStart = Math.min(loopStart.tick, tick);
          const regionEnd = Math.max(loopStart.tick, tick);
          context.scorePlayer.setPinnedStart(regionStart);
          context.scorePlayer.setLoopEnd(regionEnd);
        }
      }
    },
    [context.scorePlayer, loopStart, loopRegion, playerState.status, taskLocked],
  );

  // ─── Reset callback for orchestrator ───────────────────────────────────────
  const resetLoopTracking = useCallback(() => {
    remainingLoopsRef.current = 0;
    loopIterationRef.current = 0;
    loopStartTimesRef.current = [0];
  }, []);

  return {
    loopStart,
    loopEndPin,
    loopCount,
    setLoopCount,
    pinnedNoteIds,
    loopRegion,
    loopPracticeRange,
    loopRegionRef,
    loopPracticeRangeRef,
    loopIterationRef,
    loopStartTimesRef,
    remainingLoopsRef,
    handleNoteLongPress,
    resetLoopTracking,
  };
}
