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
import type { PracticeMode } from './practiceEngine.types';

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
  // Metronome
  metronomeActive: boolean;
  metronomeBeatIndex: number;
  metronomeIsDownbeat: boolean;
  onMetronomeToggle: () => void;
  metronomeSubdivision: MetronomeSubdivision;
  onMetronomeSubdivisionChange: (s: MetronomeSubdivision) => void;
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
  metronomeActive,
  metronomeBeatIndex,
  metronomeIsDownbeat,
  onMetronomeToggle,
  metronomeSubdivision,
  onMetronomeSubdivisionChange,
}: PracticeToolbarProps) {
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

  // Practice button label and CSS class
  // 'holding' is a sub-state of active (note duration being measured) — show Stop button during both
  const practiceRunning = practiceMode === 'active' || practiceMode === 'holding' || practiceMode === 'waiting';
  let practiceBtnLabel = '♩ Practice';
  let practiceBtnClass = 'practice-plugin__toolbar-btn practice-plugin__toolbar-btn--practice';
  if (practiceRunning) {
    practiceBtnLabel = '■ Stop Practice';
    practiceBtnClass =
      'practice-plugin__toolbar-btn practice-plugin__toolbar-btn--practice-active';
  }

  return (
    <div
      className="practice-plugin__toolbar"
      role="toolbar"
      aria-label="Practice controls"
    >
      {/* Back / Close button */}
      <button
        className="practice-plugin__toolbar-btn practice-plugin__toolbar-btn--back"
        onClick={onBack}
        aria-label="Back"
      >
        ←
      </button>

      {/* Score title */}
      {scoreTitle && (
        <span className="practice-plugin__toolbar-title" title={scoreTitle}>
          {scoreTitle}
        </span>
      )}

      {/* Play / Pause toggle */}
      {isPlaying ? (
        <button
          className="practice-plugin__toolbar-btn practice-plugin__toolbar-btn--pause"
          onClick={onPause}
          aria-label="Pause"
        >
          ⏸
        </button>
      ) : (
        <button
          className="practice-plugin__toolbar-btn practice-plugin__toolbar-btn--play"
          onClick={onPlay}
          aria-label="Play"
          disabled={!isLoaded}
        >
          ▶
        </button>
      )}

      {/* Stop */}
      <button
        className="practice-plugin__toolbar-btn practice-plugin__toolbar-btn--stop"
        onClick={onStop}
        aria-label="Stop"
        disabled={!isLoaded}
      >
        ■
      </button>

      {/* Staff selector — only shown when score has more than 1 staff */}
      {staffCount > 1 && (
        <select
          className="practice-plugin__staff-select"
          value={selectedStaffIndex}
          onChange={(e) => onStaffChange(Number(e.target.value))}
          aria-label="Select staff"
        >
          {Array.from({ length: staffCount }, (_, i) => (
            <option key={i} value={i}>
              {i === 0 ? 'Right Hand' : i === 1 ? 'Left Hand' : `Staff ${i + 1}`}
            </option>
          ))}
          <option value={-1}>Both Hands</option>
        </select>
      )}

      {/* Inline staff picker prompt — shown when Practice button was pressed
          but staff has not been confirmed yet (staffCount > 1) */}
      {showStaffPicker && (
        <span className="practice-plugin__staff-picker">
          <span className="practice-plugin__staff-picker-label">Select staff above, then press Practice</span>
        </span>
      )}

      {/* Practice toggle button — disabled when no MIDI device connected */}
      <span
        className="practice-plugin__practice-btn-wrapper"
        title={midiConnected === false ? 'A MIDI input device is required for practice mode' : undefined}
      >
        <button
          className={practiceBtnClass}
          onClick={onPracticeToggle}
          aria-label={
            practiceRunning ? 'Stop practice mode' : 'Start practice mode'
          }
          aria-pressed={practiceRunning}
          disabled={!isLoaded || midiConnected === false}
        >
          {practiceBtnLabel}
        </button>
      </span>

      {/* Practice progress x / total */}
      {practiceRunning && totalPracticeNotes > 0 && (
        <span className="practice-plugin__progress" aria-live="polite">
          {currentPracticeIndex + 1}&nbsp;/&nbsp;{totalPracticeNotes}
        </span>
      )}

      {/* No-MIDI notice — shown when practice is active but MIDI is disconnected */}
      {practiceRunning && midiConnected === false && (
        <span className="practice-plugin__no-midi-notice" role="alert">
          Connect a MIDI device to practice
        </span>
      )}

      {/* Spacer — pushes everything after it to the right */}
      <div className="practice-plugin__toolbar-spacer" />

      {/* Timer — right side, left of tempo */}
      <span className="practice-plugin__toolbar-timer" aria-label="Elapsed time">
        <span className="practice-plugin__toolbar-timer-elapsed">{elapsedFormatted}</span>
        {totalFormatted && (
          <span className="practice-plugin__toolbar-timer-total"> / {totalFormatted}</span>
        )}
      </span>

      {/* Tempo */}
      <div className="practice-plugin__toolbar-tempo">
        <span className="practice-plugin__toolbar-tempo-label">TEMPO</span>
        <input
          type="range"
          min={0.5}
          max={2.0}
          step={0.05}
          value={tempoMultiplier}
          onChange={(e) => {
            const raw = parseFloat(e.target.value);
            onTempoChange(Math.abs(raw - 1.0) <= 0.05 ? 1.0 : raw);
          }}
          aria-label="Tempo multiplier"
          className="practice-plugin__toolbar-tempo-slider"
          disabled={status === 'loading'}
        />
        {bpm > 0 && (
          <span className="practice-plugin__toolbar-bpm">{Math.round(bpm * tempoMultiplier)}</span>
        )}
      </div>

      {/* Metronome toggle + subdivision dropdown */}
      <div className="practice-plugin__metro-group" ref={metroGroupRef}>
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
          className="practice-plugin__metro-chevron"
          onClick={() => setMetroMenuOpen((o) => !o)}
          aria-label="Metronome subdivision"
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
          title="MIDI keyboard detected"
          aria-label="MIDI keyboard connected"
        >
          🎹 MIDI
        </span>
      )}
    </div>
  );
}
