/**
 * Feature 089: useAccompaniment hook
 *
 * Detects whether the loaded score has accompaniment parts (non-piano instruments
 * when a piano part is also present), and provides a callback to trigger
 * accompaniment audio during step-by-step practice.
 *
 * Volume and mute are managed externally via the InstrumentMixerOverlay — this
 * hook intentionally does NOT set any channel volume, so user-configured
 * mute/volume state is preserved.
 */

import { useCallback } from 'react';
import type { PluginScorePlayerContext } from '../../src/plugin-api/types';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseAccompanimentResult {
  /** True when the loaded score has both a piano part AND at least one non-piano part. */
  hasAccompaniment: boolean;
  /**
   * Feature 089: Play accompaniment notes at the given tick immediately.
   * Called by the practice engine when the user hits a correct note so that
   * the accompaniment (violin, etc.) sounds in sync with each practice step.
   * Respects the channel's mute state — no-op when the part is muted.
   * No-op when there are no accompaniment parts or no score is loaded.
   *
   * @param tick           Repeat-expanded tick of the practice entry
   * @param bpm            Current score BPM (used to convert durationTicks → seconds)
   * @param ticksPerBeat   Ticks per quarter-note (from score; typically 960)
   */
  playAccompanimentAtTick: (tick: number, bpm: number, ticksPerBeat: number) => void;
}

/**
 * Hook that manages violin/cello/etc accompaniment volume in the Practice plugin.
 *
 * @param scorePlayer - The plugin score player context (v11+ with getInstruments / setPartVolume)
 */
export function useAccompaniment(
  scorePlayer: PluginScorePlayerContext,
): UseAccompanimentResult {
  // Derive instrument info synchronously from the current score
  const instruments = scorePlayer.getInstruments();

  const hasPiano = instruments.some((i) => i.instrumentType === 'piano');
  const hasAccompaniment = hasPiano && instruments.some((i) => i.instrumentType !== 'piano');

  const playAccompanimentAtTick = useCallback(
    (tick: number, bpm: number, ticksPerBeat: number) => {
      if (!hasAccompaniment) return;
      scorePlayer.playAccompanimentAtTick(tick, bpm, ticksPerBeat);
    },
    [scorePlayer, hasAccompaniment],
  );

  return {
    hasAccompaniment,
    playAccompanimentAtTick,
  };
}
