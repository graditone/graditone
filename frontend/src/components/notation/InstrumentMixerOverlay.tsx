/**
 * InstrumentMixerOverlay — Compact left-sidebar mixer panel
 *
 * Rendered as a narrow fixed-width column to the LEFT of the score, outside the
 * scroll container. Shows one row per instrument: abbreviated name + round mute
 * button + vertical volume slider.
 *
 * Renders null when the score has only one instrument (isMultiInstrument=false).
 *
 * Feature 088: Piano and Violin Playback Support
 */

import React from 'react';
import type { InstrumentMixerState } from '../../types/playback';

export interface InstrumentMixerOverlayProps {
  /** Current mixer state (from useInstrumentMixer). */
  mixerState: InstrumentMixerState;
  /** Callback when user taps a mute button. */
  onToggleMute(partIndex: number): void;
  /** Callback when user adjusts a volume slider. */
  onVolumeChange(partIndex: number, volume: number): void;
}

export const InstrumentMixerOverlay: React.FC<InstrumentMixerOverlayProps> = ({
  mixerState,
  onToggleMute,
  onVolumeChange,
}) => {
  if (!mixerState.isMultiInstrument) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        padding: '12px 4px 8px',
        width: 52,
        flexShrink: 0,
        background: 'var(--ls-bg, #fff)',
        borderRight: '1px solid color-mix(in srgb, var(--ls-accent, #1976d2) 15%, transparent)',
        overflowY: 'auto',
      }}
      aria-label="Instrument mixer"
    >
      {mixerState.entries.map((entry) => (
        <div
          key={entry.channel.partIndex}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {/* Abbreviated instrument name */}
          <span
            title={entry.channel.partName}
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: '#666',
              textTransform: 'uppercase' as const,
              letterSpacing: '0.05em',
              maxWidth: 44,
              overflow: 'hidden',
              whiteSpace: 'nowrap' as const,
              textOverflow: 'ellipsis',
            }}
          >
            {entry.channel.partName.substring(0, 4)}
          </span>

          {/* Mute toggle — circular icon button */}
          <button
            type="button"
            aria-label={
              entry.isMuted
                ? `Unmute ${entry.channel.partName}`
                : `Mute ${entry.channel.partName}`
            }
            aria-pressed={entry.isMuted}
            onClick={() => onToggleMute(entry.channel.partIndex)}
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              border: `1.5px solid ${entry.isMuted ? '#c0392b' : 'rgba(0,0,0,0.18)'}`,
              background: entry.isMuted ? '#c0392b' : '#fff',
              color: entry.isMuted ? '#fff' : '#555',
              fontSize: 14,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              flexShrink: 0,
              transition: 'background 0.15s, border-color 0.15s',
            }}
          >
            {entry.isMuted ? '🔇' : '🔊'}
          </button>

          {/* Vertical volume slider — high value = top */}
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={entry.volume}
            aria-label={`${entry.channel.partName} volume`}
            onChange={e => onVolumeChange(entry.channel.partIndex, parseFloat(e.target.value))}
            style={{
              writingMode: 'vertical-lr' as React.CSSProperties['writingMode'],
              direction: 'rtl' as React.CSSProperties['direction'],
              width: 28,
              height: 72,
              cursor: 'pointer',
              accentColor: entry.isMuted ? '#c0392b' : '#e67e22',
            }}
          />
        </div>
      ))}
    </div>
  );
};
