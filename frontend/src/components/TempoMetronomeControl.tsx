/**
 * TempoMetronomeControl — shared tempo + metronome widget.
 *
 * One control reused by every plugin toolbar (Practice, Play Score) so the
 * metronome/tempo UI is identical everywhere:
 *
 *     −  [128 BPM]  ▾  +
 *
 * - The metronome start button carries the digital BPM readout (value over
 *   unit), keeps its toggle/armed/active/downbeat styling, and pressing it
 *   never changes the tempo — only onTempoChange does.
 * - The − / + steppers adjust the effective BPM: a short press (±1 BPM,
 *   < 1 s hold); holding ≥ 1 s auto-repeats ±5 BPM every 300 ms.
 * - The ▾ chevron opens the subdivision (1/4 · 1/8 · 1/16) dropdown.
 *
 * Presentational + pointer logic only. All state (tempo multiplier,
 * metronome engine) lives in the host plugin.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MetronomeSubdivision } from '../plugin-api/types';
import {
  computeEffectiveMinMultiplier,
  MIN_TEMPO_MULTIPLIER,
  MAX_TEMPO_MULTIPLIER,
  ABSOLUTE_BPM_FLOOR,
} from '../utils/tempoCalculations';
import './TempoMetronomeControl.css';

const SUBDIV_LABELS: Record<MetronomeSubdivision, string> = { 1: '♩ 1/4', 2: '♪ 1/8', 4: '♬ 1/16' };

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TempoMetronomeControlLabels {
  increaseAria: string;
  decreaseAria: string;
  metronomeAria: string;
  subdivisionAria: string;
}

export interface TempoMetronomeControlProps {
  /** Effective BPM (base × multiplier) to display. */
  bpm: number;
  /** 1× original tempo (score tempo / free nominal). */
  baseTempo: number;
  /** Current tempo multiplier (used to re-derive the base if baseTempo is 0). */
  tempoMultiplier: number;
  /** Called with the new multiplier for every tempo step. */
  onTempoChange: (multiplier: number) => void;
  metronomeActive: boolean;
  /** When true, the metronome is armed to start on the next MIDI note. */
  metronomeArmed?: boolean;
  metronomeBeatIndex: number;
  metronomeIsDownbeat: boolean;
  onMetronomeToggle: () => void;
  metronomeSubdivision: MetronomeSubdivision;
  onMetronomeSubdivisionChange: (s: MetronomeSubdivision) => void;
  /** Disables the steppers (e.g. while loading or when the task is locked). */
  disabled?: boolean;
  /** Translated a11y labels (each host owns its i18n namespace). */
  labels: TempoMetronomeControlLabels;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TempoMetronomeControl({
  bpm,
  baseTempo,
  tempoMultiplier,
  onTempoChange,
  metronomeActive,
  metronomeArmed = false,
  metronomeBeatIndex,
  metronomeIsDownbeat,
  onMetronomeToggle,
  metronomeSubdivision,
  onMetronomeSubdivisionChange,
  disabled = false,
  labels,
}: TempoMetronomeControlProps) {
  // ─── Tempo stepper (short press ±1 / long hold auto-repeats ±5) ──────────
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

  // bpm is the effective BPM; base is the 1× original (stable: the score
  // tempo or the free nominal) so stepping never drifts through the rounded
  // effective/multiplier round-trip.
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
      if (disabled) return;
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
    [disabled, emitTempoTarget],
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

  // Stop any in-flight auto-repeat if the control unmounts mid-hold.
  useEffect(() => () => clearTempoAutoRepeat(), [clearTempoAutoRepeat]);

  // ─── Subdivision dropdown ─────────────────────────────────────────────────
  const [menuOpen, setMenuOpen] = useState(false);
  const groupRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    function handleOutside(e: MouseEvent) {
      if (groupRef.current && !groupRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [menuOpen]);

  // ─── Metronome button (beat animation restarts via the key) ──────────────
  const metronomeAnimKey = metronomeActive ? `metro-${metronomeBeatIndex}` : 'metro-off';
  const metronomeBtnClass = [
    'practice-plugin__metro-btn',
    ...(metronomeActive ? ['practice-plugin__metro-btn--active'] : []),
    ...(metronomeActive && metronomeIsDownbeat ? ['practice-plugin__metro-btn--downbeat'] : []),
    ...(metronomeArmed && !metronomeActive ? ['practice-plugin__metro-btn--armed'] : []),
  ].join(' ');

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="practice-plugin__metro-group" ref={groupRef}>
      <button
        type="button"
        className={`practice-plugin__tempo-step-btn practice-plugin__tempo-step-btn--minus${tempoPressed === 'minus' ? ' is-pressed' : ''}`}
        data-testid="tempo-minus"
        aria-label={labels.decreaseAria}
        disabled={disabled}
        onPointerDown={(e) => handleTempoPressStart(e, 'minus')}
        onPointerUp={() => handleTempoPressEnd('minus')}
        onPointerCancel={clearTempoPress}
        onContextMenu={(e) => e.preventDefault()}
      >
        −
      </button>
      <button
        key={metronomeAnimKey}
        className={metronomeBtnClass}
        onClick={onMetronomeToggle}
        data-testid="tempo-display"
        aria-label={labels.metronomeAria}
        aria-pressed={metronomeActive}
        title={floorTooltip}
      >
        <span className="practice-plugin__metro-btn-bpm">
          <span className="practice-plugin__toolbar-bpm practice-plugin__tempo-step-value">
            {bpm > 0 ? String(Math.round(bpm)) : '—'}
          </span>
          <span className="practice-plugin__tempo-step-unit">BPM</span>
        </span>
      </button>
      <button
        className="practice-plugin__metro-chevron"
        onClick={() => setMenuOpen((o) => !o)}
        aria-label={labels.subdivisionAria}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
      >
        ▾
      </button>
      <button
        type="button"
        className={`practice-plugin__tempo-step-btn practice-plugin__tempo-step-btn--plus${tempoPressed === 'plus' ? ' is-pressed' : ''}`}
        data-testid="tempo-plus"
        aria-label={labels.increaseAria}
        disabled={disabled}
        onPointerDown={(e) => handleTempoPressStart(e, 'plus')}
        onPointerUp={() => handleTempoPressEnd('plus')}
        onPointerCancel={clearTempoPress}
        onContextMenu={(e) => e.preventDefault()}
      >
        +
      </button>
      {menuOpen && (
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
                setMenuOpen(false);
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
  );
}