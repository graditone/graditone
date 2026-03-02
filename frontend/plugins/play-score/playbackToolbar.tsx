/**
 * Play Score Plugin — Playback Toolbar (T015)
 * Feature 033: Play Score Plugin
 *
 * Renders Back button, score title, Play/Pause toggle, Stop button,
 * elapsed time display, and tempo control placeholder.
 *
 * US1 (T011): Back button and title.
 * US2 (T015): Full playback controls and timer.
 * US7 (T027): Tempo slider completed.
 *
 * Timer formula (mirrors PlaybackScheduler.ticksToSeconds but without host imports):
 *   PPQ = 960 ticks per quarter note
 *   seconds = ticks / ((bpm / 60) * PPQ)
 */

import { useState, useRef, useEffect } from 'react';
import type { PluginPlaybackStatus } from '../../src/plugin-api/index';
import type { MetronomeSubdivision } from '../../src/plugin-api/index';

// Mirror of PlaybackScheduler.PPQ — no host imports in plugin code
const PPQ = 960;

function ticksToElapsedSeconds(ticks: number, bpm: number): number {
  if (bpm <= 0 || ticks < 0) return 0;
  return ticks / ((bpm / 60) * PPQ);
}

function formatElapsedTime(seconds: number): string {
  const totalSec = Math.floor(seconds);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export interface PlaybackToolbarProps {
  /** Show/hide the Back button (hidden on selection screen, shown on player screen) */
  showBack: boolean;
  scoreTitle: string | null;
  status: PluginPlaybackStatus;
  currentTick: number;
  totalDurationTicks: number;
  bpm: number;
  /** Tempo multiplier [0.5–2.0] */
  tempoMultiplier: number;
  onBack: () => void;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onTempoChange: (multiplier: number) => void;
  // Feature 035: Metronome
  /** Whether the metronome engine is currently active */
  metronomeActive: boolean;
  /** Current beat index from the metronome engine (−1 when inactive) */
  metronomeBeatIndex: number;
  /** Whether the current beat is a downbeat (beat 0 of the measure) */
  metronomeIsDownbeat: boolean;
  /** Called when the user toggles the metronome button */
  onMetronomeToggle: () => void;
  /** Current beat subdivision (1=quarter, 2=eighth, 4=sixteenth) */
  metronomeSubdivision: MetronomeSubdivision;
  /** Called when the user picks a new subdivision */
  onMetronomeSubdivisionChange: (s: MetronomeSubdivision) => void;
}

export function PlaybackToolbar({
  showBack,
  scoreTitle,
  status,
  currentTick,
  totalDurationTicks,
  bpm,
  onBack,
  onPlay,
  onPause,
  onStop,
  tempoMultiplier,
  onTempoChange,
  metronomeActive,
  metronomeBeatIndex,
  metronomeIsDownbeat,
  onMetronomeToggle,
  metronomeSubdivision,
  onMetronomeSubdivisionChange,
}: PlaybackToolbarProps) {
  const isPlaying = status === 'playing';
  const isActive = status === 'playing' || status === 'paused' || status === 'ready';
  const elapsedSeconds = ticksToElapsedSeconds(currentTick, bpm);
  const totalSeconds = ticksToElapsedSeconds(totalDurationTicks, bpm);
  const elapsedFormatted = formatElapsedTime(elapsedSeconds);
  const totalFormatted = totalDurationTicks > 0 ? formatElapsedTime(totalSeconds) : null;

  // Feature 035: Build metronome button CSS class — pulse animates on every beat.
  // metronomeBeatIndex changes each beat, which causes a re-render and restarts
  // the CSS animation via the animation key (className changes each beat).
  const metronomeBtnClass = [
    'play-score__toolbar-btn',
    'play-score__toolbar-btn--metronome',
    ...(metronomeActive ? ['metro-pulse'] : []),
    ...(metronomeActive && metronomeIsDownbeat ? ['metro-downbeat'] : []),
  ].join(' ');

  // Using beatIndex as `key` forces React to remount the button on each beat,
  // which resets the CSS animation so it replays from 0% every beat.
  const metronomeAnimKey = metronomeActive ? `metro-${metronomeBeatIndex}` : 'metro-off';

  // Subdivision dropdown state
  const [menuOpen, setMenuOpen] = useState(false);
  const metroGroupRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleOutside(e: MouseEvent) {
      if (metroGroupRef.current && !metroGroupRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [menuOpen]);

  const SUBDIV_LABELS: Record<MetronomeSubdivision, string> = { 1: '♩ 1/4', 2: '♪ 1/8', 4: '♬ 1/16' };
  const SUBDIV_ICONS: Record<MetronomeSubdivision, string> = { 1: '♩', 2: '♪', 4: '♬' };

  return (
    <div className="play-score__toolbar" role="toolbar" aria-label="Playback controls">
      {/* Back button — icon only, compact */}
      {showBack && (
        <button
          className="play-score__toolbar-btn play-score__toolbar-btn--back"
          onClick={onBack}
          aria-label="Back"
        >
          ←
        </button>
      )}

      {/* Score title */}
      {scoreTitle && (
        <span className="play-score__toolbar-title">{scoreTitle}</span>
      )}

      {/* Play/Pause toggle */}
      {isPlaying ? (
        <button
          className="play-score__toolbar-btn play-score__toolbar-btn--pause"
          onClick={onPause}
          aria-label="Pause"
          disabled={!isActive}
        >
          ⏸ Pause
        </button>
      ) : (
        <button
          className="play-score__toolbar-btn play-score__toolbar-btn--play"
          onClick={onPlay}
          aria-label="Play"
          disabled={status === 'idle' || status === 'loading' || status === 'error'}
        >
          ▶ Play
        </button>
      )}

      {/* Stop button */}
      <button
        className="play-score__toolbar-btn play-score__toolbar-btn--stop"
        onClick={onStop}
        aria-label="Stop"
        disabled={!isActive}
      >
        ■ Stop
      </button>

      {/* Elapsed / total timer */}
      <span className="play-score__toolbar-timer" aria-label="Elapsed time">
        <span className="play-score__toolbar-timer-elapsed">{elapsedFormatted}</span>
        {totalFormatted && (
          <span className="play-score__toolbar-timer-total"> / {totalFormatted}</span>
        )}
      </span>

      {/* Tempo control */}
      <div className="play-score__toolbar-tempo">
        <span className="play-score__toolbar-tempo-label">TEMPO</span>
        <input
          id="play-score-tempo"
          type="range"
          min={0.5}
          max={2.0}
          step={0.05}
          value={tempoMultiplier}
          onChange={e => {
            const raw = parseFloat(e.target.value);
            // Snap to 100% when within one step (±0.05) of 1.0
            onTempoChange(Math.abs(raw - 1.0) <= 0.05 ? 1.0 : raw);
          }}
          aria-label="Tempo"
          className="play-score__toolbar-tempo-slider"
          disabled={status === 'loading'}
        />
        {bpm > 0 && (
          <span className="play-score__toolbar-bpm">{bpm}</span>
        )}
      </div>

      {/* Metronome toggle + subdivision dropdown — Feature 035 */}
      <div className="play-score__metro-group" ref={metroGroupRef}>
        <button
          key={metronomeAnimKey}
          className={metronomeBtnClass}
          onClick={onMetronomeToggle}
          aria-label="Toggle metronome"
          aria-pressed={metronomeActive}
        >
          {SUBDIV_ICONS[metronomeSubdivision]}
        </button>
        <button
          className="play-score__metro-chevron"
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Metronome subdivision"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
        >
          ▾
        </button>
        {menuOpen && (
          <div className="play-score__metro-menu" role="menu">
            {([1, 2, 4] as MetronomeSubdivision[]).map(s => (
              <button
                key={s}
                role="menuitem"
                className={
                  'play-score__metro-menu-item' +
                  (metronomeSubdivision === s ? ' play-score__metro-menu-item--active' : '')
                }
                onClick={() => { onMetronomeSubdivisionChange(s); setMenuOpen(false); }}
              >
                {metronomeSubdivision === s && <span className="play-score__metro-menu-check">✓</span>}
                {SUBDIV_LABELS[s]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
