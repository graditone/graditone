/**
 * useInstrumentMixer — manages mute/volume state for per-instrument audio channels.
 *
 * Feature 088: Piano and Violin Playback Support
 * Contracts: see specs/088-piano-violin-playback/contracts/internal-contracts.md
 */

import { useState, useCallback } from 'react';
import type { InstrumentMixerEntry, InstrumentMixerState } from '../../types/playback';
import { ToneAdapter } from '../playback/ToneAdapter';
import { scopedGetItem, scopedSetItem } from './profileStorage';

/** Shape of score.instruments entries (minimal fields needed here) */
interface InstrumentRef {
  name: string;
  instrument_type: string;
}

/** Build the localStorage key for per-instrument volume. Principle VIII. */
function volumeKey(scoreId: string, partName: string): string {
  return `graditone:volume:part:${scoreId}::${partName}`;
}

const INITIAL_STATE: InstrumentMixerState = {
  entries: [],
  isMultiInstrument: false,
};

export interface UseInstrumentMixerResult {
  mixerState: InstrumentMixerState;
  toggleMute(partIndex: number): void;
  setVolume(partIndex: number, volume: number): void;
  initMixer(instruments: InstrumentRef[], scoreId: string): void;
  resetMixer(): void;
}

export function useInstrumentMixer(): UseInstrumentMixerResult {
  const [mixerState, setMixerState] = useState<InstrumentMixerState>(INITIAL_STATE);
  const [currentScoreId, setCurrentScoreId] = useState<string>('');

  const toggleMute = useCallback((partIndex: number) => {
    setMixerState(prev => {
      const entries = prev.entries.map((entry): InstrumentMixerEntry => {
        if (entry.channel.partIndex !== partIndex) return entry;
        const newMuted = !entry.isMuted;
        // Apply immediately to audio channel
        const channel = ToneAdapter.getInstance().getChannel(partIndex);
        channel?.setMuted(newMuted);
        return { ...entry, isMuted: newMuted };
      });
      return { ...prev, entries };
    });
  }, []);

  const setVolume = useCallback((partIndex: number, volume: number) => {
    setMixerState(prev => {
      const entries = prev.entries.map((entry): InstrumentMixerEntry => {
        if (entry.channel.partIndex !== partIndex) return entry;
        const clamped = Math.max(0, Math.min(1, volume));
        // Apply immediately to audio channel
        const channel = ToneAdapter.getInstance().getChannel(partIndex);
        channel?.setVolume(clamped);
        // Persist
        try {
          scopedSetItem(volumeKey(currentScoreId, entry.channel.partName), String(clamped));
        } catch {
          // localStorage unavailable
        }
        return { ...entry, volume: clamped };
      });
      return { ...prev, entries };
    });
  }, [currentScoreId]);

  const initMixer = useCallback((instruments: InstrumentRef[], scoreId: string) => {
    setCurrentScoreId(scoreId);
    const entries: InstrumentMixerEntry[] = instruments.map((instrument, partIndex) => {
      // Restore persisted volume, default 1.0
      let volume = 1.0;
      try {
        const stored = scopedGetItem(volumeKey(scoreId, instrument.name));
        if (stored !== null) {
          const parsed = parseFloat(stored);
          if (!Number.isNaN(parsed)) volume = Math.max(0, Math.min(1, parsed));
        }
      } catch {
        // localStorage unavailable
      }
      // Apply to channel if already initialised
      const channel = ToneAdapter.getInstance().getChannel(partIndex);
      channel?.setVolume(volume);
      channel?.setMuted(false);
      return {
        channel: {
          partIndex,
          partName: instrument.name,
          instrumentType: instrument.instrument_type,
        },
        isMuted: false,
        volume,
      };
    });
    setMixerState({
      entries,
      isMultiInstrument: entries.length > 1,
    });
  }, []);

  const resetMixer = useCallback(() => {
    setMixerState(INITIAL_STATE);
  }, []);

  return { mixerState, toggleMute, setVolume, initMixer, resetMixer };
}
