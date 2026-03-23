/**
 * usePracticeHighlights — Highlight Computation Hook
 *
 * Extracted from PracticeViewPlugin.tsx (Feature 054).
 * Computes target, confirmed, and combined highlight note IDs for the
 * practice view score renderer.
 */

import { useRef, useMemo } from 'react';
import type { PracticeState } from './practiceEngine.types';
import type { ScorePlayerState } from '../../src/plugin-api/index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
function midiToLabel(midi: number): string {
  const name = NOTE_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

// ---------------------------------------------------------------------------
// Hook contract
// ---------------------------------------------------------------------------

export interface UsePracticeHighlightsParams {
  practiceState: PracticeState;
  playerState: ScorePlayerState;
  midiPressedNoteIds: ReadonlySet<string>;
  midiEventTick: number;
  heldMidiKeysRef: React.RefObject<Set<number>>;
  phantomIndex: number;
  isReplaying: boolean;
  replayHighlightedNoteIds: ReadonlySet<string>;
}

export interface UsePracticeHighlightsReturn {
  targetNoteIds: ReadonlySet<string>;
  confirmedNoteIds: ReadonlySet<string>;
  pressedPitchLabels: string[];
  expectedPitchLabels: string[];
  highlightedNoteIds: ReadonlySet<string>;
  practiceActive: boolean;
  practiceWaiting: boolean;
}

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

export function usePracticeHighlights({
  practiceState,
  playerState,
  midiPressedNoteIds,
  midiEventTick,
  heldMidiKeysRef,
  phantomIndex,
  isReplaying,
  replayHighlightedNoteIds,
}: UsePracticeHighlightsParams): UsePracticeHighlightsReturn {
  // ─── Refs for confirmed note tracking ──────────────────────────────────────
  const prevCompletedEntryRef = useRef<{ pitches: number[]; noteIds: string[] } | null>(null);
  const confirmedIndexRef = useRef(-1);

  // ─── Derived booleans ──────────────────────────────────────────────────────
  const practiceActive = (practiceState.mode === 'active' || practiceState.mode === 'holding') && practiceState.notes.length > 0;
  const practiceWaiting = practiceState.mode === 'waiting' && practiceState.notes.length > 0;

  // ─── Combined highlight set ────────────────────────────────────────────────
  const highlightedNoteIds = isReplaying && replayHighlightedNoteIds.size > 0
    ? replayHighlightedNoteIds
    : practiceActive && phantomIndex >= 0 && phantomIndex < practiceState.notes.length
    ? new Set<string>(practiceState.notes[phantomIndex].noteIds)
    : practiceWaiting
      ? new Set<string>(practiceState.notes[practiceState.currentIndex].noteIds)
      : midiPressedNoteIds.size > 0
        ? new Set<string>([...playerState.highlightedNoteIds, ...midiPressedNoteIds])
        : playerState.highlightedNoteIds;

  // ─── Target note IDs (green pinned) ────────────────────────────────────────
  const targetNoteIds = useMemo<ReadonlySet<string>>(() => {
    if (practiceActive && practiceState.currentIndex < practiceState.notes.length) {
      return new Set<string>(practiceState.notes[practiceState.currentIndex].noteIds);
    }
    return new Set<string>();
  }, [practiceActive, practiceState.notes, practiceState.currentIndex]);

  // ─── Confirmed note IDs (full green confirmation) ─────────────────────────
  const confirmedNoteIds = useMemo<ReadonlySet<string>>(() => {
    if (!practiceActive || practiceState.currentIndex >= practiceState.notes.length) {
      if (practiceState.mode === 'waiting' && practiceState.notes.length > 0) {
        confirmedIndexRef.current = practiceState.currentIndex;
      } else if (!practiceActive) {
        confirmedIndexRef.current = -1;
        prevCompletedEntryRef.current = null;
      }
      return new Set<string>();
    }

    // Detect index advancement: snapshot the just-completed entry so green
    // highlights persist while the user still holds those keys down.
    if (practiceState.currentIndex !== confirmedIndexRef.current) {
      if (confirmedIndexRef.current >= 0 && confirmedIndexRef.current < practiceState.notes.length) {
        const prev = practiceState.notes[confirmedIndexRef.current];
        prevCompletedEntryRef.current = {
          pitches: [...(prev.midiPitches as number[]), ...((prev.sustainedPitches ?? []) as number[])],
          noteIds: [...prev.noteIds],
        };
      }
      confirmedIndexRef.current = practiceState.currentIndex;
    }

    const entry = practiceState.notes[practiceState.currentIndex];
    const pitches = entry.midiPitches as number[];
    const ids = entry.noteIds as string[];
    const confirmed = new Set<string>();
    for (let i = 0; i < pitches.length; i++) {
      if (heldMidiKeysRef.current.has(pitches[i]) && i < ids.length) {
        confirmed.add(ids[i]);
      }
    }
    // Green-highlight sustained pitches that are still physically held.
    const sustained = (entry.sustainedPitches ?? []) as number[];
    if (sustained.length > 0) {
      for (const sp of sustained) {
        if (!heldMidiKeysRef.current.has(sp)) continue;
        for (let j = practiceState.currentIndex - 1; j >= 0; j--) {
          const prior = practiceState.notes[j];
          const idx = (prior.midiPitches as number[]).indexOf(sp);
          if (idx >= 0 && idx < prior.noteIds.length) {
            confirmed.add(prior.noteIds[idx]);
            break;
          }
        }
      }
    }
    // Persist green highlights for the just-completed entry while those
    // keys are still physically held.
    const prev = prevCompletedEntryRef.current;
    if (prev) {
      const anyHeld = prev.pitches.some((p) => heldMidiKeysRef.current.has(p));
      if (anyHeld) {
        for (let i = 0; i < prev.pitches.length; i++) {
          if (heldMidiKeysRef.current.has(prev.pitches[i]) && i < prev.noteIds.length) {
            confirmed.add(prev.noteIds[i]);
          }
        }
      } else {
        prevCompletedEntryRef.current = null;
      }
    }
    return confirmed;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practiceActive, practiceState.notes, practiceState.currentIndex, midiPressedNoteIds]);

  // ─── Pitch labels ─────────────────────────────────────────────────────────
  const pressedPitchLabels = useMemo<string[]>(() => {
    if (!practiceActive && !practiceWaiting) return [];
    return Array.from(heldMidiKeysRef.current).sort((a, b) => a - b).map(midiToLabel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practiceActive, practiceWaiting, midiEventTick]);

  const expectedPitchLabels = useMemo<string[]>(() => {
    if ((!practiceActive && !practiceWaiting) || practiceState.currentIndex >= practiceState.notes.length) return [];
    const pitches = practiceState.notes[practiceState.currentIndex].midiPitches as number[];
    return [...pitches].sort((a, b) => a - b).map(midiToLabel);
  }, [practiceActive, practiceWaiting, practiceState.notes, practiceState.currentIndex]);

  return {
    targetNoteIds,
    confirmedNoteIds,
    pressedPitchLabels,
    expectedPitchLabels,
    highlightedNoteIds,
    practiceActive,
    practiceWaiting,
  };
}
