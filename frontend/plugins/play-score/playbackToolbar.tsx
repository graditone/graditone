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

import type { PluginPlaybackStatus } from '../../src/plugin-api/index';
import type { MetronomeSubdivision } from '../../src/plugin-api/index';
import { ProfileIcon, TempoMetronomeControl } from '../../src/plugin-api/index';
import { useTranslation } from '../../src/i18n';

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
  /** Position within the current beat subdivision cycle (0 = on-beat) */
  metronomeSubBeatIndex: number;
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
  const { t } = useTranslation();
  const isPlaying = status === 'playing';
  const isActive = status === 'playing' || status === 'paused' || status === 'ready';
  const elapsedSeconds = ticksToElapsedSeconds(currentTick, bpm);
  const totalSeconds = ticksToElapsedSeconds(totalDurationTicks, bpm);
  const elapsedFormatted = formatElapsedTime(elapsedSeconds);
  const totalFormatted = totalDurationTicks > 0 ? formatElapsedTime(totalSeconds) : null;


  return (
    <div className="play-score__toolbar" role="toolbar" aria-label={t('play_score.toolbar.playback_controls_aria')}>
      {/* Back button — icon only, compact */}
      {showBack && (
        <button
          className="play-score__toolbar-btn play-score__toolbar-btn--back"
          onClick={onBack}
          aria-label={t('play_score.toolbar.back_aria')}
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
          aria-label={t('play_score.toolbar.pause_aria')}
          disabled={!isActive}
        >
          ⏸
        </button>
      ) : (
        <button
          className="play-score__toolbar-btn play-score__toolbar-btn--play"
          onClick={onPlay}
          aria-label={t('play_score.toolbar.play_aria')}
          disabled={status === 'idle' || status === 'loading' || status === 'error'}
        >
          ▶
        </button>
      )}

      {/* Stop button */}
      <button
        className="play-score__toolbar-btn play-score__toolbar-btn--stop"
        onClick={onStop}
        aria-label={t('play_score.toolbar.stop_aria')}
        disabled={!isActive}
      >
        ■
      </button>

      {/* Elapsed / total timer */}
      <span className="play-score__toolbar-timer" aria-label={t('play_score.toolbar.elapsed_aria')}>
        <span className="play-score__toolbar-timer-elapsed">{elapsedFormatted}</span>
        {totalFormatted && (
          <span className="play-score__toolbar-timer-total"> / {totalFormatted}</span>
        )}
      </span>

      {/* Tempo + metronome — shared widget, identical to the practice toolbar */}
      <div className="play-score__toolbar-tempo">
        <span className="play-score__toolbar-tempo-label">{t('play_score.toolbar.tempo')}</span>
      </div>
      <TempoMetronomeControl
        bpm={bpm}
        baseTempo={tempoMultiplier > 0 ? bpm / tempoMultiplier : bpm}
        tempoMultiplier={tempoMultiplier}
        onTempoChange={onTempoChange}
        metronomeActive={metronomeActive}
        metronomeBeatIndex={metronomeBeatIndex}
        metronomeIsDownbeat={metronomeIsDownbeat}
        onMetronomeToggle={onMetronomeToggle}
        metronomeSubdivision={metronomeSubdivision}
        onMetronomeSubdivisionChange={onMetronomeSubdivisionChange}
        disabled={status === 'loading'}
        labels={{
          increaseAria: t('play_score.toolbar.tempo_increase'),
          decreaseAria: t('play_score.toolbar.tempo_decrease'),
          metronomeAria: t('play_score.toolbar.metronome_toggle_aria'),
          subdivisionAria: t('play_score.toolbar.metronome_sub_aria'),
        }}
      />

            {/* Feature 080: Profile icon — rightmost toolbar element */}
      <ProfileIcon className="profile-icon-container--toolbar" />
    </div>
  );
}
