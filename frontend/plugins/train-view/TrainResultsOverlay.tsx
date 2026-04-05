/**
 * TrainResultsOverlay.tsx
 * Feature 071 — Results overlay for Train view, aligned with Practice results (Feature 038).
 *
 * Renders a centred modal panel showing score, stats, per-note details,
 * timing deviation graph, and action buttons (Retry / New / Session).
 * Reuses practice-results__* CSS classes so both views share the same visual language.
 */

import '../practice-view-plugin/PracticeViewPlugin.css';
import type { ExerciseResult, NoteComparison } from './trainTypes';
import { midiToLabel } from './trainTypes';

export interface TrainResultsOverlayProps {
  result: ExerciseResult | null;
  visible: boolean;
  onDismiss: () => void;
  onRetry: () => void;
  /** Only shown when not in warm-up mode */
  onNew?: () => void;
  /** Only passed when launched from a session warm-up task */
  onReturnToSession?: () => void;
  /** Called when the user wants to save this train result. Omit to hide Save button. */
  onSave?: () => void;
  /** True once the result has been persisted successfully. */
  isSaved?: boolean;
  /** Non-null when the save attempt failed. */
  saveError?: string | null;
  /** True while audio replay of the recorded notes is in progress. */
  isReplaying?: boolean;
  /** Start audio replay. Omit to hide Replay button. */
  onReplay?: () => void;
  /** Stop an in-progress audio replay. */
  onReplayStop?: () => void;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  return score >= 90 ? '#2e7d32' : score >= 60 ? '#f57f17' : '#c62828';
}

function scoreGrade(score: number): string {
  if (score === 100) return '🏆 Perfect!';
  if (score >= 90) return '🌟 Excellent!';
  if (score >= 70) return '👍 Good job!';
  if (score >= 50) return '💪 Keep going!';
  return '🎯 Keep practicing!';
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TrainResultsOverlay({
  result,
  visible,
  onDismiss,
  onRetry,
  onNew,
  onReturnToSession,
  onSave,
  isSaved,
  saveError,
  isReplaying,
  onReplay,
  onReplayStop,
}: TrainResultsOverlayProps) {
  if (!result || !visible) return null;

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalNotes = result.comparisons.length;
  const correctCount = result.comparisons.filter((c) => c.status === 'correct').length;
  const offBeatCount = result.comparisons.filter((c) => c.status === 'wrong-timing').length;
  const wrongCount = result.comparisons.filter(
    (c) => c.status === 'wrong-pitch' || c.status === 'missed',
  ).length;

  // ── Timing deviation chart data ────────────────────────────────────────────
  const timingData: { index: number; deviation: number }[] = result.comparisons
    .map((c: NoteComparison, i: number) => ({ index: i, deviation: c.timingDeviationMs ?? 0 }))
    .filter((d) => d.deviation !== 0);

  const showTimingChart = timingData.length >= 2;

  // Build the SVG timing deviation polyline (note index as X axis)
  function renderTimingChart() {
    if (!showTimingChart) return null;

    const W = 320, H = 140, PAD_L = 40, PAD_R = 10, PAD_T = 16, PAD_B = 24;
    const chartW = W - PAD_L - PAD_R;
    const chartH = H - PAD_T - PAD_B;

    const allDeviations = timingData.map((d) => d.deviation);
    const yMax = Math.max(Math.max(...allDeviations), 50);
    const yMin = Math.min(Math.min(...allDeviations), -50);
    const n = timingData.length;

    const xScale = (idx: number) => PAD_L + (idx / Math.max(n - 1, 1)) * chartW;
    const yScale = (v: number) => PAD_T + ((yMax - v) / (yMax - yMin)) * chartH;

    const polyline = timingData
      .map((d) => `${xScale(d.index).toFixed(1)},${yScale(d.deviation).toFixed(1)}`)
      .join(' ');
    const zeroY = yScale(0);

    // X-axis ticks: note numbers (up to 6)
    const tickCount = Math.min(n, 6);
    const xTicks: number[] = Array.from({ length: tickCount }, (_, i) =>
      Math.round(i * (n - 1) / Math.max(tickCount - 1, 1)),
    );

    return (
      <details className="practice-results__details" style={{ marginTop: '8px' }}>
        <summary className="practice-results__details-summary">
          Timing deviation per note
        </summary>
        <div className="practice-results__graph-wrapper">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            height={H}
            aria-label="Timing deviation graph"
            role="img"
            style={{ display: 'block', maxWidth: `${W}px`, margin: '8px auto 0' }}
          >
            {/* Zero baseline */}
            <line
              x1={PAD_L} y1={zeroY} x2={W - PAD_R} y2={zeroY}
              stroke="#bbb" strokeWidth="1" strokeDasharray="4 2"
            />
            {/* Y labels */}
            <text x={PAD_L - 4} y={PAD_T + 4} textAnchor="end" fontSize="9" fill="#888">
              +{Math.round(yMax)}ms
            </text>
            <text x={PAD_L - 4} y={zeroY + 3} textAnchor="end" fontSize="9" fill="#888">
              0
            </text>
            <text x={PAD_L - 4} y={PAD_T + chartH - 2} textAnchor="end" fontSize="9" fill="#888">
              {Math.round(yMin)}ms
            </text>
            {/* X ticks */}
            {xTicks.map((idx) => (
              <g key={idx}>
                <line
                  x1={xScale(idx)} y1={PAD_T + chartH}
                  x2={xScale(idx)} y2={PAD_T + chartH + 3}
                  stroke="#ccc" strokeWidth="1"
                />
                <text x={xScale(idx)} y={H - 4} textAnchor="middle" fontSize="9" fill="#888">
                  #{idx + 1}
                </text>
              </g>
            ))}
            {/* Area fill */}
            <polygon
              points={`${xScale(timingData[0].index).toFixed(1)},${zeroY} ${polyline} ${xScale(timingData[timingData.length - 1].index).toFixed(1)},${zeroY}`}
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
            {/* Highlight off-beat notes */}
            {timingData.map((d) => {
              const c = result!.comparisons[d.index];
              if (c.status !== 'wrong-timing') return null;
              return (
                <circle
                  key={d.index}
                  cx={xScale(d.index)}
                  cy={yScale(d.deviation)}
                  r="3"
                  fill="#f57f17"
                />
              );
            })}
          </svg>
        </div>
      </details>
    );
  }

  return (
    <>
      <div className="practice-results__backdrop" />
      <div
        className="practice-results"
        role="region"
        aria-label="Exercise results"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button className="practice-results__close" aria-label="Close results" onClick={onDismiss}>
          ×
        </button>

        {/* Score headline */}
        <div className="practice-results__score-block">
          <div className="practice-results__score-ring">
            <span
              className="practice-results__score-number"
              style={{ color: scoreColor(result.score) }}
            >
              {result.score}
            </span>
            <span className="practice-results__score-label">/ 100</span>
          </div>
          <div className="practice-results__score-grade" style={{ color: scoreColor(result.score) }}>
            {scoreGrade(result.score)}
          </div>
          {/* Feature 072: BPM context subtitle */}
          {result.bpm > 0 && (
            <div className="practice-results__tempo-subtitle">
              {result.bpm} BPM
            </div>
          )}
        </div>

        {/* Stats row */}
        <div className="practice-results__stats">
          <div className="practice-results__stat">
            <span className="practice-results__stat-value">{totalNotes}</span>
            <span className="practice-results__stat-label">Notes</span>
          </div>
          <div className="practice-results__stat">
            <span className="practice-results__stat-value">{correctCount}</span>
            <span className="practice-results__stat-label">Correct</span>
          </div>
          <div className="practice-results__stat">
            <span className="practice-results__stat-value practice-results__stat-value--warn">
              {offBeatCount}
            </span>
            <span className="practice-results__stat-label">Off-beat</span>
          </div>
          <div className="practice-results__stat">
            <span className="practice-results__stat-value practice-results__stat-value--error">
              {wrongCount}
            </span>
            <span className="practice-results__stat-label">Wrong</span>
          </div>
        </div>

        {/* Collapsible note-by-note table */}
        <details className="practice-results__details">
          <summary className="practice-results__details-summary">Note-by-note details</summary>
          <div className="practice-results__table-wrapper">
            <table className="practice-results__table" aria-label="Per-note comparison">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Target</th>
                  <th>Detected</th>
                  <th>Status</th>
                  <th>Pitch Δ (¢)</th>
                  <th>Timing Δ (ms)</th>
                </tr>
              </thead>
              <tbody>
                {result.comparisons.map((c: NoteComparison, i: number) => (
                  <tr
                    key={i}
                    className={`practice-results__row ${
                      c.status === 'correct'
                        ? 'practice-results__row--correct'
                        : c.status === 'wrong-timing'
                          ? 'practice-results__row--correct-late'
                          : 'practice-results__row--wrong'
                    }`}
                  >
                    <td>{i + 1}</td>
                    <td>{midiToLabel(c.target.midiPitch)}</td>
                    <td>
                      {c.response
                        ? `${midiToLabel(Math.round(c.response.midiCents / 100))} (${c.response.hz.toFixed(1)} Hz)`
                        : '—'}
                    </td>
                    <td aria-label={c.status}>
                      <span className="practice-results__status-icon">
                        {c.status === 'correct' ? '✅'
                          : c.status === 'wrong-pitch' ? '⚠️'
                          : c.status === 'wrong-timing' ? '⏱️'
                          : c.status === 'missed' ? '❌'
                          : '➕'}
                      </span>{' '}
                      {c.status === 'correct' ? 'Correct'
                        : c.status === 'wrong-pitch' ? 'Wrong pitch'
                        : c.status === 'wrong-timing' ? 'Wrong timing'
                        : c.status === 'missed' ? 'Missed'
                        : 'Extraneous'}
                    </td>
                    <td>
                      {c.pitchDeviationCents !== null ? Math.round(c.pitchDeviationCents) : '—'}
                    </td>
                    <td>
                      {c.timingDeviationMs !== null ? Math.round(c.timingDeviationMs) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.extraneousNotes.length > 0 && (
            <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: '#555' }}>
              <strong>Extraneous notes:</strong>{' '}
              {result.extraneousNotes.length} extra note
              {result.extraneousNotes.length !== 1 ? 's' : ''} played outside beat windows.
            </div>
          )}
        </details>

        {/* Timing deviation graph */}
        {renderTimingChart()}

        {/* Action buttons */}
        <div className="practice-results__replay-row">
          <button
            className="practice-results__repractice-btn"
            onClick={onRetry}
            aria-label="Retry exercise"
            data-testid="train-retry-btn"
            disabled={isReplaying}
          >
            🔁 Retry
          </button>
          {onNew && (
            <button
              className="practice-results__replay-btn"
              onClick={onNew}
              aria-label="New exercise"
              disabled={isReplaying}
            >
              🎲 New
            </button>
          )}
          {onReplay && (
            <button
              className="practice-results__replay-btn"
              onClick={isReplaying ? onReplayStop : onReplay}
              aria-label={isReplaying ? 'Stop replay' : 'Replay notes'}
              data-testid="train-replay-btn"
            >
              {isReplaying ? '⏹ Stop' : '▶ Replay'}
            </button>
          )}
          {onSave && (
            <button
              className={`practice-results__save-btn${isSaved ? ' practice-results__save-btn--saved' : ''}`}
              onClick={isSaved ? undefined : onSave}
              disabled={isSaved || isReplaying}
              aria-label={isSaved ? 'Train result saved' : 'Save train result'}
              data-testid="train-save-btn"
            >
              {isSaved ? '✓ Saved' : '💾 Save'}
            </button>
          )}
          {onReturnToSession && (
            <button
              className="practice-results__session-btn"
              onClick={onReturnToSession}
              aria-label="Return to session"
            >
              ↩ Session
            </button>
          )}
        </div>
        {saveError && (
          <p className="practice-results__save-error" role="alert">
            {saveError}
          </p>
        )}

        {/* Hint */}
        {!onReturnToSession && (
          <p className="practice-results__hint">
            Press <strong>🔁 Retry</strong> to try again
          </p>
        )}
      </div>
    </>
  );
}
