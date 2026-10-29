/**
 * Practice View Plugin — Practice Toolbar (T025)
 * Feature 037: Practice View Plugin
 *
 * Renders: Back (close), score title, Play/Pause, Stop, elapsed timer,
 * tempo stepper (− BPM display / +), Staff selector (hidden when staffCount ≤ 1),
 * Practice toggle button, inline staff picker, no-MIDI notice.
 *
 * Pure presentational component — all state lives in PracticeViewPlugin.tsx.
 *
 * US1 (T025): Toolbar visible with Practice button (inactive state).
 * US2 (T034): Staff picker when staffCount > 1.
 * US2 (T035): No-MIDI notice when practice active and MIDI not connected.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { PluginPlaybackStatus, MetronomeSubdivision } from '../../src/plugin-api/index';
import { ProfileIcon, computeEffectiveMinMultiplier, MIN_TEMPO_MULTIPLIER, MAX_TEMPO_MULTIPLIER, ABSOLUTE_BPM_FLOOR } from '../../src/plugin-api/index';
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
  /** 1× original tempo (score tempo, or the free nominal). When absent, derived from bpm/tempoMultiplier. */
  baseTempo?: number;
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
  /** Feature 101: strict tempo mode is enforcing the tempo grid (Score Practice + metronome). */
  strictTempoActive?: boolean;
  /** Feature 101: number of consecutive strict timing failures so far (0–2 while running). */
  strictFailureCount?: number;
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
  baseTempo,
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
  strictTempoActive = false,
  strictFailureCount = 0,
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

  // ─── Tempo stepper (digital BPM display + short/auto-repeat buttons) ───────
  // A slider has far too little precision on touch/tablet. The stepper edits
  // the effective BPM: a short press (< 1 s) steps ±1; holding ≥ 1 s starts
  // continuous ±5 steps (every 300 ms) until release. The display itself is
  // inert — tapping/selecting it never changes the tempo.
  const [tempoPressed, setTempoPressed] = useState<'plus' | 'minus' | null>(null);
  const tempoPressStartRef = useRef<number | null>(null);
  const tempoBpmRef = useRef<number>(bpm);
  // eslint-disable-next-line react-hooks/refs -- writer-owns-ref pattern: keep ref in sync for consumers
  tempoBpmRef.current = bpm;
  const tempoTargetRef = useRef<number>(0);
  const tempoLastEmittedRef = useRef<number>(0);
  const tempoRepeatStartedRef = useRef<boolean>(false);
  const tempoHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tempoRepeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tempoDisabled = status === 'loading' || !!taskTag;
  // bpm prop is the effective BPM; baseTempo is the 1× original (stable:
  // the score tempo or the free nominal) so stepping never drifts through
  // the rounded effective/multiplier round-trip.
  const originalBpm =
    baseTempo > 0 ? baseTempo : tempoMultiplier > 0 ? bpm / tempoMultiplier : bpm;
  const effectiveMin = computeEffectiveMinMultiplier(originalBpm);
  const floorTooltip =
    effectiveMin > MIN_TEMPO_MULTIPLIER
      ? `Min. speed limited to ${ABSOLUTE_BPM_FLOOR} BPM`
      : undefined;

  const clearTempoAutoRepeat = useCallback(() => {
    if (tempoHoldTimerRef.current !== null) {
      clearTimeout(tempoHoldTimerRef.current);
      tempoHoldTimerRef.current = null;
    }
    if (tempoRepeatTimerRef.current !== null) {
      clearInterval(tempoRepeatTimerRef.current);
      tempoRepeatTimerRef.current = null;
    }
    tempoRepeatStartedRef.current = false;
  }, []);

  // Emit the (clamped) target BPM as a multiplier; skip no-ops at the clamps.
  const emitTempoTarget = useCallback(
    (dir: 1 | -1, step: number) => {
      if (tempoBpmRef.current <= 0) return;
      const orig = originalBpm;
      if (orig <= 0) return;
      const minBpm = Math.max(1, Math.round(orig * effectiveMin));
      const maxBpm = Math.min(998, Math.round(orig * MAX_TEMPO_MULTIPLIER));
      const target = Math.min(maxBpm, Math.max(minBpm, tempoTargetRef.current + dir * step));
      if (target === tempoLastEmittedRef.current) return;
      tempoTargetRef.current = target;
      tempoLastEmittedRef.current = target;
      onTempoChange(Math.round((target / orig) * 1000) / 1000);
    },
    [onTempoChange, originalBpm, effectiveMin],
  );

  const handleTempoPressStart = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>, side: 'plus' | 'minus') => {
      if (tempoDisabled) return;
      tempoPressStartRef.current = Date.now();
      tempoTargetRef.current = Math.round(tempoBpmRef.current);
      tempoLastEmittedRef.current = tempoTargetRef.current;
      setTempoPressed(side);
      // Keep receiving the pointer-up even when the finger drifts off the button.
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* jsdom/tests */ }
      // Hold ≥ 1 s starts continuous ±5 stepping (every 300 ms).
      tempoHoldTimerRef.current = setTimeout(() => {
        const step = 5;
        tempoRepeatStartedRef.current = true;
        emitTempoTarget(side === 'plus' ? 1 : -1, step);
        tempoRepeatTimerRef.current = setInterval(() => {
          emitTempoTarget(side === 'plus' ? 1 : -1, step);
        }, 300);
      }, 1000);
    },
    [tempoDisabled, emitTempoTarget],
  );

  const handleTempoPressEnd = useCallback(
    (side: 'plus' | 'minus') => {
      const dir = side === 'plus' ? 1 : -1;
      const start = tempoPressStartRef.current;
      tempoPressStartRef.current = null;
      setTempoPressed(null);
      if (start !== null) {
        const heldMs = Date.now() - start;
        if (heldMs < 1000) {
          // Short press: ±1.
          emitTempoTarget(dir, 1);
        } else if (!tempoRepeatStartedRef.current) {
          // Long press whose hold-timer never fired (e.g. test timers): ±5 once.
          emitTempoTarget(dir, 5);
        }
        // If the repeat already ran, the interval emitted the steps — just stop it.
      }
      clearTempoAutoRepeat();
    },
    [clearTempoAutoRepeat, emitTempoTarget],
  );

  const clearTempoPress = useCallback(() => {
    tempoPressStartRef.current = null;
    setTempoPressed(null);
    clearTempoAutoRepeat();
  }, [clearTempoAutoRepeat]);

  // Stop any in-flight auto-repeat if the toolbar unmounts mid-hold.
  useEffect(() => () => clearTempoAutoRepeat(), [clearTempoAutoRepeat]);

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

      {/* Tempo — digital BPM stepper */}
      <div className="practice-plugin__toolbar-tempo">
        <span className="practice-plugin__toolbar-tempo-label" id="practice-tempo-label">
          {t('practice.toolbar.tempo')}
        </span>
        <div
          className="practice-plugin__tempo-step"
          role="group"
          aria-label={t('practice.toolbar.tempo_aria')}
        >
          <button
            type="button"
            className={`practice-plugin__tempo-step-btn practice-plugin__tempo-step-btn--minus${tempoPressed === 'minus' ? ' is-pressed' : ''}`}
            data-testid="tempo-minus"
            aria-label={t('practice.toolbar.tempo_decrease')}
            disabled={tempoDisabled}
            onPointerDown={(e) => handleTempoPressStart(e, 'minus')}
            onPointerUp={() => handleTempoPressEnd('minus')}
            onPointerCancel={clearTempoPress}
            onContextMenu={(e) => e.preventDefault()}
          >
            −
          </button>
          <div
            className="practice-plugin__tempo-step-display"
            data-testid="tempo-display"
            title={floorTooltip}
          >
            <span className="practice-plugin__toolbar-bpm practice-plugin__tempo-step-value">
              {bpm > 0 ? String(Math.round(bpm)) : '—'}
            </span>
            <span className="practice-plugin__tempo-step-unit">BPM</span>
          </div>
          <button
            type="button"
            className={`practice-plugin__tempo-step-btn practice-plugin__tempo-step-btn--plus${tempoPressed === 'plus' ? ' is-pressed' : ''}`}
            data-testid="tempo-plus"
            aria-label={t('practice.toolbar.tempo_increase')}
            disabled={tempoDisabled}
            onPointerDown={(e) => handleTempoPressStart(e, 'plus')}
            onPointerUp={() => handleTempoPressEnd('plus')}
            onPointerCancel={clearTempoPress}
            onContextMenu={(e) => e.preventDefault()}
          >
            +
          </button>
        </div>
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
        {/* Feature 101: strict tempo indicator — informational badge, not focusable */}
        {strictTempoActive && !isFreePractice && (
          <span
            className={`practice-plugin__strict-badge practice-plugin__strict-badge--${
              strictFailureCount === 0 ? 'none' : strictFailureCount === 1 ? 'warn' : 'danger'
            }`}
            data-testid="strict-tempo-indicator"
            data-failures={strictFailureCount}
            aria-live="polite"
            title={t('practice.toolbar.strict_tempo_title', { n: String(strictFailureCount) })}
            aria-label={t('practice.toolbar.strict_tempo_title', { n: String(strictFailureCount) })}
          >
            {t('practice.toolbar.strict_tempo')}
          </span>
        )}
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
