/**
 * Practice View Plugin — Practice Toolbar (T025)
 * Feature 037: Practice View Plugin
 *
 * Renders: Back (close), score title, Play/Pause, Stop, elapsed timer,
 * tempo slider, Staff selector (hidden when staffCount ≤ 1),
 * Practice toggle button, inline staff picker, no-MIDI notice.
 *
 * Pure presentational component — all state lives in PracticeViewPlugin.tsx.
 *
 * US1 (T025): Toolbar visible with Practice button (inactive state).
 * US2 (T034): Staff picker when staffCount > 1.
 * US2 (T035): No-MIDI notice when practice active and MIDI not connected.
 */

import { useState, useEffect, useRef } from 'react';
import type { PluginPlaybackStatus, MetronomeSubdivision } from '../../src/plugin-api/index';
import { ProfileIcon, computeEffectiveMinMultiplier, MIN_TEMPO_MULTIPLIER, ABSOLUTE_BPM_FLOOR } from '../../src/plugin-api/index';
import type { PracticeMode } from './practiceEngine.types';
import { useTranslation } from '../../src/i18n';
// Mirror of PlaybackScheduler.PPQ — no host imports allowed
const PPQ = 960;

function ticksToSeconds(ticks: number, bpm: number): number {
  if (bpm <= 0 || ticks < 0) return 0;
  return ticks / ((bpm / 60) * PPQ);
}

function formatTime(seconds: number): string {
  const total = Math.floor(seconds);
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PracticeToolbarProps {
  // Playback state
  scoreTitle: string | null;
  status: PluginPlaybackStatus;
  currentTick: number;
  totalDurationTicks: number;
  bpm: number;
  tempoMultiplier: number;
  // Playback handlers
  onBack: () => void;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onTempoChange: (multiplier: number) => void;
  // Staff selection (hidden when staffCount <= 1)
  staffCount: number;
  selectedStaffIndex: number;
  onStaffChange: (index: number) => void;
  // Practice
  practiceMode: PracticeMode;
  currentPracticeIndex: number;
  totalPracticeNotes: number;
  onPracticeToggle: () => void;
  /**
   * When true, show inline staff picker prompt before starting practice
   * (only relevant when staffCount > 1).
   */
  showStaffPicker: boolean;
  /**
   * Whether at least one MIDI input device is connected.
   * Shows indicator in toolbar.
   */
  midiConnected: boolean | null;
  /**
   * Whether the Web MIDI API is available in this browser.
   * When false, shows "MIDI not supported" message instead of "no MIDI device".
   */
  midiSupported?: boolean;
  // Metronome
  metronomeActive: boolean;
  metronomeBeatIndex: number;
  metronomeIsDownbeat: boolean;
  onMetronomeToggle: () => void;
  metronomeSubdivision: MetronomeSubdivision;
  onMetronomeSubdivisionChange: (s: MetronomeSubdivision) => void;
  /** When true, metronome is armed — will start on the first MIDI note attack. */
  metronomeArmed?: boolean;
  /** When true, a replay is running — practice toggle should be disabled. */
  isReplaying?: boolean;
  /** Feature 061: Session task tag — when set, config is locked and tag is shown. */
  taskTag?: { taskNumber: number; sessionName: string; difficulty?: 1 | 2 | 3 } | null;
  /** Feature 061: Called when the task tag badge is clicked. */
  onTaskTagClick?: () => void;
  /** Feature 092: When true, this is a score-less free practice session. */
  isFreePractice?: boolean;
  /** Feature 092: Running count of MIDI note attacks captured so far (free practice only). */
  freeNoteCount?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PracticeToolbar({
  scoreTitle,
  status,
  currentTick,
  totalDurationTicks,
  bpm,
  tempoMultiplier,
  onBack,
  onPlay,
  onPause,
  onStop,
  onTempoChange,
  staffCount,
  selectedStaffIndex,
  onStaffChange,
  practiceMode,
  currentPracticeIndex,
  totalPracticeNotes,
  onPracticeToggle,
  showStaffPicker,
  midiConnected,
  midiSupported = true,
  metronomeActive,
  metronomeBeatIndex,
  metronomeIsDownbeat,
  onMetronomeToggle,
  metronomeSubdivision,
  onMetronomeSubdivisionChange,
  metronomeArmed = false,
  isReplaying,
  taskTag,
  onTaskTagClick,
  isFreePractice = false,
  freeNoteCount = 0,
}: PracticeToolbarProps) {
  const { t } = useTranslation();
  const isPlaying = status === 'playing';
  const isLoaded = status === 'ready' || status === 'playing' || status === 'paused';

  const elapsedFormatted = formatTime(ticksToSeconds(currentTick, bpm));
  const totalFormatted =
    totalDurationTicks > 0 ? formatTime(ticksToSeconds(totalDurationTicks, bpm)) : null;

  // Metronome beat animation key — changing it on every beat restarts CSS animation
  const metronomeAnimKey = metronomeActive ? `metro-${metronomeBeatIndex}` : 'metro-off';
  const metronomeBtnClass = [
    'practice-plugin__metro-btn',
    ...(metronomeActive ? ['practice-plugin__metro-btn--active'] : []),
    ...(metronomeActive && metronomeIsDownbeat ? ['practice-plugin__metro-btn--downbeat'] : []),
    ...(metronomeArmed && !metronomeActive ? ['practice-plugin__metro-btn--armed'] : []),
  ].join(' ');
  const SUBDIV_ICONS: Record<MetronomeSubdivision, string> = { 1: '♩', 2: '♪', 4: '♬' };
  const SUBDIV_LABELS: Record<MetronomeSubdivision, string> = { 1: '♩ 1/4', 2: '♪ 1/8', 4: '♬ 1/16' };

  const [metroMenuOpen, setMetroMenuOpen] = useState(false);
  const metroGroupRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!metroMenuOpen) return;
    function handleOutside(e: MouseEvent) {
      if (metroGroupRef.current && !metroGroupRef.current.contains(e.target as Node)) {
        setMetroMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [metroMenuOpen]);

  const [staffMenuOpen, setStaffMenuOpen] = useState(false);
  const staffGroupRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!staffMenuOpen) return;
    function handleOutside(e: MouseEvent) {
      if (staffGroupRef.current && !staffGroupRef.current.contains(e.target as Node)) {
        setStaffMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [staffMenuOpen]);

  function staffIndexLabel(index: number): string {
    if (index === -1) return t('practice.toolbar.both_hands');
    if (index === 0) return t('practice.toolbar.right_hand');
    if (index === 1) return t('practice.toolbar.left_hand');
    return `Staff ${index + 1}`;
  }

  const staffOptions: { value: number; label: string }[] = [
    ...Array.from({ length: staffCount }, (_, i) => ({
      value: i,
      label: staffIndexLabel(i),
    })),
    { value: -1, label: t('practice.toolbar.both_hands') },
  ];

  // Practice button label and CSS class
  // 'holding' is a sub-state of active (note duration being measured) — show Stop button during both
  const practiceRunning = practiceMode === 'active' || practiceMode === 'holding' || practiceMode === 'waiting';
  let practiceBtnLabel = t('practice.toolbar.practice_btn');
  let practiceBtnClass = 'practice-plugin__toolbar-btn practice-plugin__toolbar-btn--practice';
  if (practiceRunning) {
    practiceBtnLabel = t('practice.toolbar.stop_btn');
    practiceBtnClass =
      'practice-plugin__toolbar-btn practice-plugin__toolbar-btn--practice-active';
  }

  return (
    <div
      className="practice-plugin__toolbar"
      role="toolbar"
      aria-label={t('practice.toolbar.controls_aria')}
    >
      {/* Back / Close button */}
      <button
        className="practice-plugin__toolbar-btn practice-plugin__toolbar-btn--back"
        onClick={onBack}
        aria-label={t('practice.toolbar.back_aria')}
      >
        ←
      </button>

      {/* Score title */}
      {scoreTitle && (
        <span className="practice-plugin__toolbar-title" title={scoreTitle}>
          {scoreTitle}
        </span>
      )}

      {/* Feature 061: Session task tag — shown when launched from a session task */}
      {taskTag && (
        <button
          className="practice-plugin__task-tag"
          title={t('practice.toolbar.session_task', { n: taskTag.taskNumber })}
          onClick={onTaskTagClick}
          type="button"
        >
          {t('practice.toolbar.session_task', { n: taskTag.taskNumber })}
        </button>
      )}

      {/* Feature 070: Difficulty tag next to task tag in practice view */}
      {taskTag?.difficulty && (
        <span
          className={`difficulty-tag difficulty-tag--${taskTag.difficulty === 1 ? 'easy' : taskTag.difficulty === 2 ? 'medium' : 'hard'}`}
        >
          {taskTag.difficulty === 1 ? t('train.level.easy') : taskTag.difficulty === 2 ? t('train.level.medium') : t('train.level.hard')}
        </span>
      )}

      {/* Play / Pause toggle — hidden in free practice (no score to play) */}
      {!isFreePractice && (isPlaying ? (
        <button
          className="practice-plugin__toolbar-btn practice-plugin__toolbar-btn--pause"
          onClick={onPause}
          aria-label={t('practice.toolbar.pause_aria')}
        >
          ⏸
        </button>
      ) : (
        <button
          className="practice-plugin__toolbar-btn practice-plugin__toolbar-btn--play"
          onClick={onPlay}
          aria-label={t('practice.toolbar.play_aria')}
          disabled={!isLoaded}
        >
          ▶
        </button>
      ))}

      {/* Stop — hidden in free practice */}
      {!isFreePractice && (
        <button
          className="practice-plugin__toolbar-btn practice-plugin__toolbar-btn--stop"
          onClick={onStop}
          aria-label={t('practice.toolbar.stop_aria')}
          disabled={!isLoaded}
        >
          ■
        </button>
      )}

      {/* Staff selector — only shown when score has more than 1 staff */}
      {staffCount > 1 && (
        <div className="practice-plugin__staff-group" ref={staffGroupRef}>
          <button
            className="practice-plugin__staff-btn"
            onClick={() => setStaffMenuOpen((o) => !o)}
            aria-haspopup="listbox"
            aria-expanded={staffMenuOpen}
            aria-label={t('practice.toolbar.hand_aria')}
            disabled={!isLoaded || !!taskTag}
          >
            {staffIndexLabel(selectedStaffIndex)}
            <span className="practice-plugin__staff-chevron">▾</span>
          </button>
          {staffMenuOpen && (
            <div className="practice-plugin__staff-menu" role="listbox">
              {staffOptions.map(({ value, label }) => (
                <button
                  key={value}
                  role="option"
                  aria-selected={selectedStaffIndex === value}
                  className={
                    'practice-plugin__staff-menu-item' +
                    (selectedStaffIndex === value ? ' practice-plugin__staff-menu-item--active' : '')
                  }
                  onClick={() => {
                    onStaffChange(value);
                    setStaffMenuOpen(false);
                  }}
                >
                  {selectedStaffIndex === value && (
                    <span className="practice-plugin__staff-menu-check">✓</span>
                  )}
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Inline staff picker prompt — shown when Practice button was pressed
          but staff has not been confirmed yet (staffCount > 1) */}
      {showStaffPicker && (
        <span className="practice-plugin__staff-picker">
          <span className="practice-plugin__staff-picker-label">{t('practice.toolbar.select_staff_prompt')}</span>
        </span>
      )}

      {/* Practice toggle button — disabled when no MIDI device connected or unsupported */}
      <span
        className="practice-plugin__practice-btn-wrapper"
        title={
          !midiSupported
            ? t('practice.toolbar.midi_not_supported')
            : midiConnected === false
              ? t('practice.toolbar.no_midi_device')
              : undefined
        }
      >
        <button
          className={practiceBtnClass}
          onClick={onPracticeToggle}
          aria-label={
            practiceRunning ? t('practice.toolbar.practice_mode_stop_aria') : t('practice.toolbar.practice_mode_start_aria')
          }
          aria-pressed={practiceRunning}
          disabled={!isLoaded || midiConnected === false || !midiSupported || !!isReplaying}
        >
          {practiceBtnLabel}
        </button>
      </span>

      {/* Practice progress x / total — or free note count for free practice */}
      {isFreePractice && practiceRunning && (
        <span className="practice-plugin__progress" aria-live="polite">
          {t('practice.free.note_count', { n: freeNoteCount })}
        </span>
      )}
      {!isFreePractice && practiceRunning && totalPracticeNotes > 0 && (
        <span className="practice-plugin__progress" aria-live="polite">
          {currentPracticeIndex + 1}&nbsp;/&nbsp;{totalPracticeNotes}
        </span>
      )}

      {/* Replay mode label */}
      {isReplaying && (
        <span className="practice-plugin__replay-label" aria-live="polite">
          {t('practice.toolbar.replaying')}
        </span>
      )}

      {/* No-MIDI notice — shown when practice is active but MIDI is disconnected */}
      {practiceRunning && midiConnected === false && midiSupported && (
        <span className="practice-plugin__no-midi-notice" role="alert">
          {t('practice.toolbar.connect_midi')}
        </span>
      )}

      {/* MIDI not supported notice — shown when Web MIDI API is unavailable */}
      {!midiSupported && (
        <span className="practice-plugin__no-midi-notice" role="alert">
          {t('practice.toolbar.midi_not_supported')}
        </span>
      )}

      {/* Spacer — pushes everything after it to the right */}
      <div className="practice-plugin__toolbar-spacer" />

      {/* Timer — right side, left of tempo */}
      <span className="practice-plugin__toolbar-timer" aria-label={t('practice.toolbar.elapsed_aria')}>
        <span className="practice-plugin__toolbar-timer-elapsed">{elapsedFormatted}</span>
        {totalFormatted && (
          <span className="practice-plugin__toolbar-timer-total"> / {totalFormatted}</span>
        )}
      </span>

      {/* Tempo */}
      <div className="practice-plugin__toolbar-tempo">
        <span className="practice-plugin__toolbar-tempo-label">{t('practice.toolbar.tempo')}</span>
        {(() => {
          // bpm prop is the effective BPM (scoreTempo × multiplier); derive original for floor calc
          const originalBpm = tempoMultiplier > 0 ? bpm / tempoMultiplier : bpm;
          const effectiveMin = computeEffectiveMinMultiplier(originalBpm);
          const showFloorTooltip = effectiveMin > MIN_TEMPO_MULTIPLIER;
          const floorTooltip = showFloorTooltip ? `Min. speed limited to ${ABSOLUTE_BPM_FLOOR} BPM` : undefined;
          return (
            <>
              <input
                type="range"
                min={effectiveMin}
                max={2.0}
                step={0.01}
                value={tempoMultiplier}
                onChange={(e) => {
                  const raw = Math.round(parseFloat(e.target.value) * 100) / 100;
                  onTempoChange(Math.round(Math.abs(raw - 1.0) * 100) <= 3 ? 1.0 : raw);
                }}
                aria-label={t('practice.toolbar.tempo_aria')}
                className="practice-plugin__toolbar-tempo-slider"
                disabled={status === 'loading' || !!taskTag}
                list="practice-tempo-ticks"
                title={floorTooltip}
              />
              <datalist id="practice-tempo-ticks">
                <option value="1.0" />
              </datalist>
            </>
          );
        })()}
        {bpm > 0 && (
          <span className="practice-plugin__toolbar-bpm">{bpm}</span>
        )}
      </div>

      {/* Metronome toggle + subdivision dropdown */}
      <div className="practice-plugin__metro-group" ref={metroGroupRef}>
        <button
          key={metronomeAnimKey}
          className={metronomeBtnClass}
          onClick={onMetronomeToggle}
          aria-label={t('practice.toolbar.metronome_aria')}
          aria-pressed={metronomeActive}
        >
          {SUBDIV_ICONS[metronomeSubdivision]}
        </button>
        <button
          className="practice-plugin__metro-chevron"
          onClick={() => setMetroMenuOpen((o) => !o)}
          aria-label={t('practice.toolbar.metronome_sub_aria')}
          aria-expanded={metroMenuOpen}
          aria-haspopup="menu"
        >
          ▾
        </button>
        {metroMenuOpen && (
          <div className="practice-plugin__metro-menu" role="menu">
            {([1, 2, 4] as MetronomeSubdivision[]).map((s) => (
              <button
                key={s}
                role="menuitem"
                className={
                  'practice-plugin__metro-menu-item' +
                  (metronomeSubdivision === s ? ' practice-plugin__metro-menu-item--active' : '')
                }
                onClick={() => {
                  onMetronomeSubdivisionChange(s);
                  setMetroMenuOpen(false);
                }}
              >
                {metronomeSubdivision === s && (
                  <span className="practice-plugin__metro-menu-check">✓</span>
                )}
                {SUBDIV_LABELS[s]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* MIDI badge — only shown when a MIDI device is detected */}
      {midiConnected && (
        <span
          className="practice-plugin__midi-badge"
          title={t('practice.toolbar.midi_connected_title')}
          aria-label={t('practice.toolbar.midi_connected_aria')}
        >
          🎹 MIDI
        </span>
      )}

      {/* Feature 080: Profile icon — rightmost toolbar element */}
      <ProfileIcon className="profile-icon-container--toolbar" />
    </div>
  );
}
