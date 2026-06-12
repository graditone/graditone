/**
 * ResultsOverlay — Practice Results Display Component
 *
 * Extracted from PracticeViewPlugin.tsx (Feature 054).
 * Renders the complete and partial results overlays, including replay controls,
 * loop count slider, note-by-note details, and timing deviation graph.
 */

import { useCallback, useRef, useEffect, useMemo } from 'react';
import type { PluginContext, ScorePlayerState } from '../../src/plugin-api/index';
import { computePracticeScore } from '../../src/plugin-api/index';
import { useTranslation } from '../../src/i18n';
import type {
  PracticeState,
  PracticeNoteResult,
  PerformanceRecord,
  PartialPerformanceRecord,
} from './practiceEngine.types';
import type { FreeMidiRecord } from '../../src/plugin-api';

// ---------------------------------------------------------------------------
// Helpers (moved from PracticeViewPlugin.tsx)
// ---------------------------------------------------------------------------

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
function midiToLabel(midi: number): string {
  const name = NOTE_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

function formatTimeMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ResultsOverlayProps {
  practiceState: PracticeState;
  playerState: ScorePlayerState;
  performanceRecord: PerformanceRecord | null;
  partialPerformanceRecord: PartialPerformanceRecord | null;
  resultsOverlayVisible: boolean;
  loopRegion: { startTick: number; endTick: number } | null;
  loopCount: number;
  setLoopCount: React.Dispatch<React.SetStateAction<number>>;
  context: PluginContext;
  onRepractice: () => void;
  onDismiss: () => void;
  /** Lifted replay state — orchestrator owns these for highlight integration */
  isReplaying: boolean;
  replayHighlightedNoteIds: ReadonlySet<string>;
  setIsReplaying: React.Dispatch<React.SetStateAction<boolean>>;
  setReplayHighlightedNoteIds: React.Dispatch<React.SetStateAction<ReadonlySet<string>>>;
  /** Feature 056: Save callback — saves the current practice to storage. */
  onSave?: () => void;
  /** Feature 056: Whether the current practice has been saved this session. */
  isSaved?: boolean;
  /** Feature 056: Error message if save failed (e.g. storage full). */
  saveError?: string | null;
  /** Feature 061: Navigate back to the sessions plugin (only shown for task practices). */
  onReturnToSession?: () => void;
  /** Feature 078: When true, the loop count slider is disabled (practice was launched from a session task). */
  loopCountLocked?: boolean;
  /** Feature 092: When true, show a simplified free practice results overlay. */
  isFreePractice?: boolean;
  /** Feature 092: MIDI event log for free practice — present only when isFreePractice is true. */
  freeMidiRecord?: FreeMidiRecord | null;
  /** Feature 092: Triggered when the user presses Replay in free-practice mode. */
  onFreeReplay?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ResultsOverlay({
  practiceState,
  performanceRecord,
  partialPerformanceRecord,
  resultsOverlayVisible,
  loopRegion,
  loopCount,
  setLoopCount,
  context,
  onRepractice,
  onDismiss,
  isReplaying,
  setIsReplaying,
  setReplayHighlightedNoteIds,
  onSave,
  isSaved,
  saveError,
  onReturnToSession,
  loopCountLocked,
  isFreePractice = false,
  freeMidiRecord,
  onFreeReplay,
}: ResultsOverlayProps) {
  const { t } = useTranslation();
  // ─── Replay internals ────────────────────────────────────────────────────────
  const replayTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Cleanup replay timers on unmount
  useEffect(() => {
    return () => {
      replayTimersRef.current.forEach(clearTimeout);
      replayTimersRef.current = [];
    };
  }, []);

  // Clean up replay timers when isReplaying is set to false externally (e.g. stop button)
  useEffect(() => {
    if (!isReplaying && replayTimersRef.current.length > 0) {
      context.stopPlayback();
      replayTimersRef.current.forEach(clearTimeout);
      replayTimersRef.current = [];
    }
  }, [isReplaying, context]);

  const handleReplayStop = useCallback(() => {
    context.stopPlayback();
    replayTimersRef.current.forEach(clearTimeout);
    replayTimersRef.current = [];
    setReplayHighlightedNoteIds(new Set());
    setIsReplaying(false);
  }, [context, setReplayHighlightedNoteIds, setIsReplaying]);

  const handleReplay = useCallback(() => {
    if (!performanceRecord || isReplaying) return;
    setIsReplaying(true);

    const msPerBeat = 60_000 / performanceRecord.bpmAtCompletion;
    const msPerNote = msPerBeat * 0.85;

    type ReplayEvent = { responseTimeMs: number; midiNotes: number[]; isCorrect: boolean; noteIndex: number };
    const timeline: ReplayEvent[] = [];

    for (const result of performanceRecord.noteResults) {
      timeline.push({
        responseTimeMs: result.responseTimeMs,
        midiNotes: result.expectedMidi as number[],
        isCorrect: true,
        noteIndex: result.noteIndex,
      });
    }
    for (const wrong of performanceRecord.wrongNoteEvents) {
      timeline.push({
        responseTimeMs: wrong.responseTimeMs,
        midiNotes: [wrong.midiNote],
        isCorrect: false,
        noteIndex: wrong.noteIndex,
      });
    }
    timeline.sort((a, b) => a.responseTimeMs - b.responseTimeMs);

    for (const event of timeline) {
      for (const midiNote of event.midiNotes) {
        context.playNote({
          midiNote,
          timestamp: Date.now(),
          type: 'attack',
          offsetMs: event.responseTimeMs,
          durationMs: msPerNote,
        });
      }
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const event of timeline) {
      if (!event.isCorrect) continue;
      const noteIds = performanceRecord.notes[event.noteIndex]?.noteIds ?? [];
      const t = setTimeout(() => {
        setReplayHighlightedNoteIds(new Set(noteIds));
      }, event.responseTimeMs);
      timers.push(t);
    }

    const lastMs = timeline.length > 0 ? timeline[timeline.length - 1].responseTimeMs : 0;
    const totalMs = lastMs + msPerNote + 300;
    const finishTimer = setTimeout(() => {
      context.stopPlayback();
      timers.forEach(clearTimeout);
      setReplayHighlightedNoteIds(new Set());
      setIsReplaying(false);
    }, totalMs);
    timers.push(finishTimer);

    replayTimersRef.current = timers;

    // Hide the results overlay so the score is visible during replay
    onDismiss();
  }, [context, performanceRecord, isReplaying, setIsReplaying, setReplayHighlightedNoteIds, onDismiss]);

  const handleRepractice = useCallback(() => {
    if (isReplaying) handleReplayStop();
    onRepractice();
  }, [isReplaying, handleReplayStop, onRepractice]);

  // ─── Results computation ───────────────────────────────────────────────────
  const practiceReport = useMemo(() => {
    // Use engine state results when available (live practice);
    // fall back to loaded performanceRecord (saved practice loaded from storage).
    const results = practiceState.noteResults.length > 0
      ? practiceState.noteResults
      : performanceRecord?.noteResults ?? [];
    const breakdown = computePracticeScore(results, performanceRecord?.tempoMultiplier ?? 1.0);
    if (!breakdown) return null;

    const lastResult = results[results.length - 1];
    const practiceTimeMs = lastResult.responseTimeMs;
    const scoreTimeMs = lastResult.expectedTimeMs;

    return {
      ...breakdown,
      score: breakdown.score,
      practiceTimeMs,
      scoreTimeMs,
      results,
    };
  }, [practiceState.noteResults, performanceRecord]);

  const partialReport = useMemo(() => {
    if (!partialPerformanceRecord) return null;
    const { noteResults, stoppedAtIndex, totalNoteCount } = partialPerformanceRecord;

    if (noteResults.length === 0) {
      return { zeroProgress: true as const, stoppedAtIndex, totalNoteCount };
    }

    const breakdown = computePracticeScore(noteResults, partialPerformanceRecord?.tempoMultiplier ?? 1.0);
    if (!breakdown) {
      return { zeroProgress: true as const, stoppedAtIndex, totalNoteCount };
    }

    const lastResult = noteResults[noteResults.length - 1];
    const practiceTimeMs = lastResult.responseTimeMs;
    const scoreTimeMs = lastResult.expectedTimeMs;

    return {
      zeroProgress: false as const,
      ...breakdown,
      score: breakdown.score,
      practiceTimeMs,
      scoreTimeMs,
      results: noteResults,
      stoppedAtIndex,
      totalNoteCount,
    };
  }, [partialPerformanceRecord]);

  // ─── Render ────────────────────────────────────────────────────────────────

  // Complete results overlay — shown after practice completion OR when loading a saved complete practice
  const showComplete = resultsOverlayVisible && practiceReport &&
    (practiceState.mode === 'complete' || (practiceState.mode === 'inactive' && !!performanceRecord));
  const completeOverlay = showComplete && (
    <>
      <div className="practice-results__backdrop" />
      <div
        className="practice-results"
        role="region"
        aria-label={t('practice.results.overlay_aria')}
      >
        <button
          className="practice-results__close"
          aria-label={t('practice.results.close_aria')}
          onClick={onDismiss}
        >
          ×
        </button>

        {/* Score headline */}
        <div className="practice-results__score-block">
          <div className="practice-results__score-ring">
            <span
              className="practice-results__score-number"
              style={{
                color:
                  practiceReport.score >= 90 ? '#2e7d32'
                  : practiceReport.score >= 60 ? '#f57f17'
                  : '#c62828',
              }}
            >
              {practiceReport.score}
            </span>
            <span className="practice-results__score-label">/ 100</span>
          </div>
          {/* Feature 072: Tempo context subtitle */}
          <div className="practice-results__tempo-subtitle">
            {(performanceRecord?.bpmAtCompletion ?? 0) > 0
              ? `${performanceRecord!.bpmAtCompletion} BPM · ${Math.round(practiceReport.tempoMultiplier * 100)}%`
              : `${Math.round(practiceReport.tempoMultiplier * 100)}%`}
          </div>
          <div
            className="practice-results__score-grade"
            style={{
              color:
                practiceReport.score >= 90 ? '#2e7d32'
                : practiceReport.score >= 60 ? '#f57f17'
                : '#c62828',
            }}
          >
            {practiceReport.score === 100 ? t('practice.results.grade_perfect')
              : practiceReport.score >= 90 ? t('practice.results.grade_excellent')
              : practiceReport.score >= 70 ? t('practice.results.grade_good')
              : practiceReport.score >= 50 ? t('practice.results.grade_keep_going')
              : t('practice.results.grade_keep_practicing')}
          </div>
        </div>

        {/* Summary stats */}
        <div className="practice-results__stats">
          <div className="practice-results__stat">
            <span className="practice-results__stat-value">{practiceReport.totalNotes}</span>
            <span className="practice-results__stat-label">{t('practice.results.notes')}</span>
          </div>
          <div className="practice-results__stat">
            <span className="practice-results__stat-value">{practiceReport.correctCount}</span>
            <span className="practice-results__stat-label">{t('practice.results.correct')}</span>
          </div>
          <div className="practice-results__stat">
            <span className="practice-results__stat-value practice-results__stat-value--warn">
              {practiceReport.lateCount}
            </span>
            <span className="practice-results__stat-label">{t('practice.results.off_beat')}</span>
          </div>
          <div className="practice-results__stat">
            <span className="practice-results__stat-value practice-results__stat-value--error">
              {practiceReport.totalWrongAttempts}
            </span>
            <span className="practice-results__stat-label">{t('practice.results.wrong')}</span>
          </div>
        </div>

        {/* Time comparison */}
        <div className="practice-results__time-comparison">
          <span>{t('practice.results.your_time')} <strong>{formatTimeMs(practiceReport.practiceTimeMs)}</strong></span>
          <span className="practice-results__time-separator">vs</span>
          <span>{t('practice.results.score_time')} <strong>{formatTimeMs(practiceReport.scoreTimeMs)}</strong></span>
        </div>

        {/* Collapsible per-note details */}
        <details className="practice-results__details">
          <summary className="practice-results__details-summary">
            {t('train.results.details')}
          </summary>
          <div className="practice-results__table-wrapper">
            <table className="practice-results__table" aria-label="Per-note results">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t('practice.results.expected')}</th>
                  <th>{t('practice.results.played')}</th>
                  <th>{t('practice.results.status')}</th>
                  <th>{t('practice.results.wrong_tries')}</th>
                  <th>{t('practice.results.timing_delta')}</th>
                </tr>
              </thead>
              <tbody>
                {practiceReport.results.map((r: PracticeNoteResult, i: number) => (
                  <tr
                    key={i}
                    className={`practice-results__row practice-results__row--${r.outcome}`}
                  >
                    <td>{i + 1}</td>
                    <td>{r.expectedMidi.map(midiToLabel).join('+')}</td>
                    <td>
                      {r.outcome === 'correct' || r.outcome === 'correct-late'
                        ? r.expectedMidi.map(midiToLabel).join('+')
                        : r.playedMidi > 0 ? midiToLabel(r.playedMidi) : '—'}
                    </td>
                    <td>
                      <span className="practice-results__status-icon">
                        {r.outcome === 'correct' ? '✅'
                          : r.outcome === 'correct-late' ? '⏱️'
                          : r.outcome === 'early-release' ? '⏱️'
                          : '❌'}
                      </span>{' '}
                      {r.outcome === 'correct' ? t('practice.results.correct')
                        : r.outcome === 'correct-late' ? t('practice.results.off_beat')
                        : r.outcome === 'early-release' ? 'Held too short'
                        : t('practice.results.wrong')}
                    </td>
                    <td>{r.wrongAttempts > 0 ? r.wrongAttempts : '—'}</td>
                    <td>
                      {r.relativeDeltaMs !== 0
                        ? `${r.relativeDeltaMs > 0 ? '+' : ''}${r.relativeDeltaMs} ms`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>

        {/* Delay evolution graph */}
        {(() => {
          const delayData = practiceReport.results
            .map((r: PracticeNoteResult, i: number) => ({
              index: i, delay: r.relativeDeltaMs, timeMs: r.responseTimeMs,
            }));

          if (delayData.length < 2) return null;

          const totalMs = Math.max(delayData[delayData.length - 1].timeMs, 1);

          const W = 320;
          const H = 140;
          const PAD_L = 40;
          const PAD_R = 10;
          const PAD_T = 16;
          const PAD_B = 24;

          const chartW = W - PAD_L - PAD_R;
          const chartH = H - PAD_T - PAD_B;

          const delays = delayData.map((d) => d.delay);
          const yMax = Math.max(Math.max(...delays), 50);
          const yMin = Math.min(Math.min(...delays), -50);

          const xScale = (ms: number) => PAD_L + (ms / totalMs) * chartW;
          const yScale = (v: number) => PAD_T + ((yMax - v) / (yMax - yMin)) * chartH;

          const polyline = delayData
            .map((d) => `${xScale(d.timeMs).toFixed(1)},${yScale(d.delay).toFixed(1)}`)
            .join(' ');

          const zeroY = yScale(0);

          const totalSec = totalMs / 1000;
          const rawStep = totalSec / 6;
          const niceSteps = [0.5, 1, 2, 5, 10, 15, 20, 30, 60, 120];
          const tickStepSec = niceSteps.find((s) => s >= rawStep) ?? Math.ceil(rawStep / 10) * 10;
          const xTicks: number[] = [];
          for (let s = 0; s <= totalSec + tickStepSec * 0.01; s += tickStepSec) {
            xTicks.push(Math.min(s, totalSec));
            if (s >= totalSec) break;
          }

          return (
            <details className="practice-results__details" style={{ marginTop: '8px' }}>
              <summary className="practice-results__details-summary">
                {t('train.results.timing_chart')}
              </summary>
              <div className="practice-results__graph-wrapper">
                <svg
                  viewBox={`0 0 ${W} ${H}`}
                  width="100%"
                  height={H}
                  aria-label="Delay evolution graph"
                  role="img"
                  style={{ display: 'block', maxWidth: `${W}px`, margin: '8px auto 0' }}
                >
                  {/* Zero line */}
                  <line
                    x1={PAD_L} y1={zeroY} x2={W - PAD_R} y2={zeroY}
                    stroke="#bbb" strokeWidth="1" strokeDasharray="4 2"
                  />
                  {/* Y axis labels */}
                  <text x={PAD_L - 4} y={PAD_T + 4} textAnchor="end" fontSize="9" fill="#888">
                    +{yMax}ms
                  </text>
                  <text x={PAD_L - 4} y={zeroY + 3} textAnchor="end" fontSize="9" fill="#888">
                    0
                  </text>
                  <text x={PAD_L - 4} y={PAD_T + chartH - 2} textAnchor="end" fontSize="9" fill="#888">
                    {yMin}ms
                  </text>
                  {/* X axis time ticks */}
                  {xTicks.map((sec) => {
                    const x = xScale(sec * 1000);
                    const label = Number.isInteger(sec) ? `${sec}s` : `${sec.toFixed(1)}s`;
                    return (
                      <g key={sec}>
                        <line x1={x} y1={PAD_T + chartH} x2={x} y2={PAD_T + chartH + 3} stroke="#ccc" strokeWidth="1" />
                        <text x={x} y={H - 4} textAnchor="middle" fontSize="9" fill="#888">
                          {label}
                        </text>
                      </g>
                    );
                  })}
                  {/* Area fill */}
                  <polygon
                    points={`${xScale(delayData[0].timeMs).toFixed(1)},${zeroY} ${polyline} ${xScale(totalMs).toFixed(1)},${zeroY}`}
                    fill="rgba(245, 163, 64, 0.15)"
                  />
                  {/* Line */}
                  <polyline
                    points={polyline}
                    fill="none"
                    stroke="#F5A340"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                  {/* Dots for off-beat notes */}
                  {delayData.map((d, i) => {
                    const r = practiceReport.results[d.index];
                    if (r.outcome !== 'correct-late') return null;
                    return (
                      <circle
                        key={i}
                        cx={xScale(d.timeMs)}
                        cy={yScale(d.delay)}
                        r="3"
                        fill="#f57f17"
                      />
                    );
                  })}
                </svg>
              </div>
            </details>
          );
        })()}

        {/* Replay / Stop / Save buttons */}
        {performanceRecord && (
          <div className="practice-results__replay-row">
            <button
              className="practice-results__repractice-btn"
              onClick={handleRepractice}
              aria-label={t('practice.results.repractice_aria')}
            >
              ↺ Repractice
            </button>
            {!isReplaying ? (
              <button
                className="practice-results__replay-btn"
                onClick={handleReplay}
                aria-label={t('practice.results.replay_aria')}
              >
                ▶ Replay
              </button>
            ) : (
              <button
                className="practice-results__replay-btn practice-results__replay-btn--stop"
                onClick={handleReplayStop}
                aria-label={t('practice.results.stop_replay_aria')}
              >
                ■ Stop
              </button>
            )}
            {onSave && (
              <button
                className={`practice-results__save-btn${isSaved ? ' practice-results__save-btn--saved' : ''}`}
                onClick={onSave}
                disabled={isSaved}
                aria-label={isSaved ? t('practice.results.saved_aria') : t('practice.results.save_aria')}
              >
                {isSaved ? '✓ Saved' : '💾 Save'}
              </button>
            )}
            {saveError && (
              <span className="practice-results__save-error" role="alert">{saveError}</span>
            )}
            {onReturnToSession && (
              <button
                className="practice-results__session-btn"
                onClick={onReturnToSession}
                  aria-label={t('practice.results.session_aria')}
              >
                ↩ Session
              </button>
            )}
          </div>
        )}

        {/* Loop count slider */}
        {loopRegion && (
          <div className="practice-results__loop-slider-row" aria-label={t('practice.results.loop_count_aria')}>
            <label className="practice-results__loop-label">
              Loops: <strong>{loopCount}</strong>
            </label>
            <input
              type="range"
              className="practice-results__loop-slider"
              min={1}
              max={10}
              step={1}
              value={loopCount}
              onChange={(e) => setLoopCount(Number(e.target.value))}
              aria-label={t('practice.results.loops_aria')}
              disabled={loopCountLocked}
              title={loopCountLocked ? t('practice.results.loop_locked_hint') : undefined}
            />
          </div>
        )}

        <p className="practice-results__hint">
          {t('practice.results.retry_hint')}
        </p>
      </div>
    </>
  );

  // Partial results overlay (shown when Stop is pressed mid-session, or loading a saved partial practice)
  const partialOverlay = partialReport && resultsOverlayVisible && !showComplete && (
    <>
      <div className="practice-results__backdrop" />
      <div
        className="practice-results"
        role="region"
        aria-label={t('practice.results.overlay_aria')}
      >
        <button
          className="practice-results__close"
          aria-label={t('practice.results.close_aria')}
          onClick={onDismiss}
        >
          ×
        </button>

        {partialReport.zeroProgress ? (
          <div className="practice-results__zero-progress">
            <p>{t('practice.results.no_notes')}</p>
          </div>
        ) : (
          <>
            {/* Stopped-at badge */}
            <div className="practice-results__stopped-badge">
              {t('practice.results.stopped_at', { x: String(partialReport.stoppedAtIndex), y: String(partialReport.totalNoteCount) })}
            </div>

            {/* Score headline */}
            <div className="practice-results__score-block">
              <div className="practice-results__score-ring">
                <span
                  className="practice-results__score-number"
                  style={{
                    color:
                      partialReport.score >= 90 ? '#2e7d32'
                      : partialReport.score >= 60 ? '#f57f17'
                      : '#c62828',
                  }}
                >
                  {partialReport.score}
                </span>
                <span className="practice-results__score-label">/ 100</span>
              </div>
              {/* Feature 072: Tempo context subtitle */}
              <div className="practice-results__tempo-subtitle">
                {(partialPerformanceRecord?.bpmAtCompletion ?? 0) > 0
                  ? `${partialPerformanceRecord!.bpmAtCompletion} BPM · ${Math.round(partialReport.tempoMultiplier * 100)}%`
                  : `${Math.round(partialReport.tempoMultiplier * 100)}%`}
              </div>
            </div>

            {/* Summary stats */}
            <div className="practice-results__stats">
              <div className="practice-results__stat">
                <span className="practice-results__stat-value">{partialReport.totalNotes}</span>
                <span className="practice-results__stat-label">{t('practice.results.notes')}</span>
              </div>
              <div className="practice-results__stat">
                <span className="practice-results__stat-value">{partialReport.correctCount}</span>
                <span className="practice-results__stat-label">{t('practice.results.correct')}</span>
              </div>
              <div className="practice-results__stat">
                <span className="practice-results__stat-value practice-results__stat-value--warn">
                  {partialReport.lateCount}
                </span>
                <span className="practice-results__stat-label">{t('practice.results.off_beat')}</span>
              </div>
              <div className="practice-results__stat">
                <span className="practice-results__stat-value practice-results__stat-value--error">
                  {partialReport.totalWrongAttempts}
                </span>
                <span className="practice-results__stat-label">{t('practice.results.wrong')}</span>
              </div>
            </div>

            {/* Time comparison */}
            <div className="practice-results__time-comparison">
              <span>{t('practice.results.your_time')} <strong>{formatTimeMs(partialReport.practiceTimeMs)}</strong></span>
              <span className="practice-results__time-separator">vs</span>
              <span>{t('practice.results.score_time')} <strong>{formatTimeMs(partialReport.scoreTimeMs)}</strong></span>
            </div>
          </>
        )}

        <p className="practice-results__hint">
          {t('practice.results.retry_hint')}
        </p>
      </div>
    </>
  );

  // ─── Feature 092: Free Practice results overlay ────────────────────────────
  const freePracticeOverlay = isFreePractice && resultsOverlayVisible && freeMidiRecord && (
    <>
      <div className="practice-results__backdrop" />
      <div
        className="practice-results"
        role="region"
        aria-label={t('practice.results.overlay_aria')}
      >
        <button
          className="practice-results__close"
          aria-label={t('practice.results.close_aria')}
          onClick={onDismiss}
        >
          ×
        </button>

        <h2 className="practice-results__free-title">{t('practice.free.title')}</h2>

        {/* Summary stats: duration + note count */}
        <div className="practice-results__stats">
          <div className="practice-results__stat">
            <span className="practice-results__stat-value">{formatTimeMs(freeMidiRecord.elapsedMs)}</span>
            <span className="practice-results__stat-label">{t('practice.results.free_elapsed')}</span>
          </div>
          <div className="practice-results__stat">
            <span className="practice-results__stat-value">{freeMidiRecord.noteCount}</span>
            <span className="practice-results__stat-label">{t('practice.results.notes')}</span>
          </div>
        </div>

        {/* Action row: Repractice / Replay / Save */}
        <div className="practice-results__replay-row">
          <button
            className="practice-results__repractice-btn"
            onClick={handleRepractice}
            aria-label={t('practice.results.repractice_aria')}
          >
            ↺ Repractice
          </button>
          {!isReplaying ? (
            <button
              className="practice-results__replay-btn"
              onClick={onFreeReplay}
              aria-label={t('practice.results.replay_aria')}
            >
              ▶ Replay
            </button>
          ) : (
            <button
              className="practice-results__replay-btn practice-results__replay-btn--stop"
              onClick={handleReplayStop}
              aria-label={t('practice.results.stop_replay_aria')}
            >
              ■ Stop
            </button>
          )}
          {onSave && (
            <button
              className={`practice-results__save-btn${isSaved ? ' practice-results__save-btn--saved' : ''}`}
              onClick={onSave}
              disabled={isSaved}
              aria-label={isSaved ? t('practice.results.saved_aria') : t('practice.results.save_aria')}
            >
              {isSaved ? '✓ Saved' : '💾 Save'}
            </button>
          )}
          {saveError && (
            <span className="practice-results__save-error" role="alert">{saveError}</span>
          )}
        </div>
      </div>
    </>
  );

  // When in free practice mode, render only the free overlay
  if (isFreePractice) {
    return <>{freePracticeOverlay}</>;
  }

  return <>{completeOverlay}{partialOverlay}</>;
}
