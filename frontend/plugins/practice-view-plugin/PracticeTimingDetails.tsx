/**
 * PracticeTimingDetails — per-note timing table + delay chart (Feature 101, T019)
 *
 * Extracted verbatim from ResultsOverlay so both the complete and partial
 * results branches can render the same details. Presentational only:
 * no storage, audio, or reducer imports (Principle VI).
 *
 * Timing value selection: `beatDeltaMs ?? relativeDeltaMs` — strict-mode
 * results carry the signed deviation from the strict tempo grid; legacy
 * results keep the interval-based relative delta. Strict failure rows and
 * chart points are marked so the three stopping misses are identifiable.
 */

import { useTranslation } from '../../src/i18n';
import type { PracticeNoteResult } from './practiceEngine.types';
import { formatStateLabel } from './stateLabel';

// ---------------------------------------------------------------------------
// Helpers (moved from ResultsOverlay.tsx)
// ---------------------------------------------------------------------------

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

function midiToLabel(midi: number): string {
  const name = NOTE_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

/** Feature 101: signed timing deviation — strict beat delta wins when present. */
function timingDeltaMs(r: PracticeNoteResult): number {
  return r.beatDeltaMs ?? r.relativeDeltaMs;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PracticeTimingDetailsProps {
  results: ReadonlyArray<PracticeNoteResult>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PracticeTimingDetails({ results }: PracticeTimingDetailsProps) {
  const { t } = useTranslation();

  return (
    <>
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
              {results.map((r: PracticeNoteResult, i: number) => {
                const timingMs = timingDeltaMs(r);
                return (
                  <tr
                    key={i}
                    className={`practice-results__row practice-results__row--${r.outcome}${
                      r.strictFailure === true ? ' practice-results__row--strict-failure' : ''
                    }`}
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
                        : r.outcome === 'correct-late'
                          ? formatStateLabel(timingMs)
                        : r.outcome === 'early-release'
                          ? (r.strictFailure === true && r.requiredHoldMs > 0
                            ? t('practice.results.released_early', {
                                ms: String(Math.round(r.requiredHoldMs - r.holdDurationMs)),
                              })
                            : formatStateLabel(r.relativeDeltaMs))
                        : t('practice.results.wrong')}
                    </td>
                    <td>{r.wrongAttempts > 0 ? r.wrongAttempts : '—'}</td>
                    <td>
                      {timingMs !== 0
                        ? `${timingMs > 0 ? '+' : ''}${timingMs} ms`
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>

      {/* Delay evolution graph */}
      {(() => {
        const delayData = results
          .map((r: PracticeNoteResult, i: number) => ({
            index: i, delay: timingDeltaMs(r), timeMs: r.responseTimeMs,
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
                className="practice-results__chart"
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
                {/* Dots for off-beat notes and strict failures */}
                {delayData.map((d, i) => {
                  const r = results[d.index];
                  const isStrict = r.strictFailure === true;
                  if (!isStrict && r.outcome !== 'correct-late') return null;
                  return (
                    <circle
                      key={i}
                      cx={xScale(d.timeMs)}
                      cy={yScale(d.delay)}
                      r="3"
                      fill={isStrict ? '#c62828' : '#f57f17'}
                      className={isStrict ? 'practice-results__chart-dot--strict' : undefined}
                      data-strict-failure={isStrict ? 'true' : undefined}
                    />
                  );
                })}
              </svg>
            </div>
          </details>
        );
      })()}
    </>
  );
}
