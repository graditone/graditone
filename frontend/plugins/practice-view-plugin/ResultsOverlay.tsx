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
import { formatStateLabel } from './stateLabel';
import { PracticeTimingDetails } from './PracticeTimingDetails';

// ---------------------------------------------------------------------------
// Helpers (moved from PracticeViewPlugin.tsx)
// ---------------------------------------------------------------------------

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

    const notes = performanceRecord.notes;

    // Group the notes that sound at each response time, keyed by their noteIds.
    // Practiced entries merge sustained (held) notes into every later onset's
    // midiPitches, so the SAME noteId recurs across consecutive steps while a
    // chord is held. We must NOT re-attack it on every step (that makes a held
    // chord sound like a plucked, re-articulated note each tick).
    type TimeGroup = { midiNotes: number[]; noteIds: string[] };
    const timeGroups = new Map<number, TimeGroup>();
    for (const result of performanceRecord.noteResults) {
      const entry = notes[result.noteIndex];
      if (!entry) continue;
      const group = timeGroups.get(result.responseTimeMs) ?? { midiNotes: [], noteIds: [] };
      const ids = entry.noteIds ?? [];
      const pitches = entry.midiPitches ?? [];
      for (let i = 0; i < pitches.length; i++) {
        group.midiNotes.push(pitches[i]);
        group.noteIds.push(ids[i] ?? `p${pitches[i]}@${result.noteIndex}`);
      }
      timeGroups.set(result.responseTimeMs, group);
    }
    const times = [...timeGroups.keys()].sort((a, b) => a - b);

    // Split each noteId into CONTIGUOUS runs of appearance. A note held across
    // several steps is one run (sustain it, attack only once); a note re-played
    // after a gap (e.g. a new loop iteration) is a fresh run (new attack).
    type Run = { midi: number; attack: number; lastAppear: number; count: number };
    const runs = new Map<string, Run[]>();
    const lastGroupIdx = new Map<string, number>();
    for (let groupIdx = 0; groupIdx < times.length; groupIdx++) {
      const t = times[groupIdx];
      const group = timeGroups.get(t)!;
      for (let i = 0; i < group.noteIds.length; i++) {
        const id = group.noteIds[i];
        const arr = runs.get(id);
        const prevIdx = lastGroupIdx.get(id) ?? -1;
        if (arr && prevIdx === groupIdx - 1) {
          const lastRun = arr[arr.length - 1];
          lastRun.lastAppear = t;
          lastRun.count += 1;
        } else {
          const nextArr = arr ?? [];
          nextArr.push({ midi: group.midiNotes[i], attack: t, lastAppear: t, count: 1 });
          runs.set(id, nextArr);
        }
        lastGroupIdx.set(id, groupIdx);
      }
    }

    // Schedule one attack per note RUN:
    //  - a sustained run (the note recurs across steps, e.g. a held left-hand
    //    chord) sustains until its last appearance — continuous chord sound.
    //  - a one-shot note keeps the previous fixed duration (unchanged).
    // Wrong-note events are appended too; everything is scheduled in one
    // time-sorted pass so the audio order matches the recorded timing.
    const audioSchedule: Array<{ offsetMs: number; midiNote: number; durationMs: number }> = [];
    for (const [, arr] of runs) {
      for (const run of arr) {
        const durationMs = run.count >= 2
          ? Math.max(run.lastAppear + 80, run.attack + msPerNote) - run.attack
          : msPerNote;
        audioSchedule.push({ offsetMs: run.attack, midiNote: run.midi, durationMs });
      }
    }

    // Build the highlight + finish timeline from the recorded results.
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
      audioSchedule.push({ offsetMs: wrong.responseTimeMs, midiNote: wrong.midiNote, durationMs: msPerNote });
    }
    timeline.sort((a, b) => a.responseTimeMs - b.responseTimeMs);

    // Play every scheduled note in ascending time order.
    audioSchedule.sort((a, b) => a.offsetMs - b.offsetMs);
    for (const ev of audioSchedule) {
      context.playNote({
        midiNote: ev.midiNote,
        timestamp: Date.now(),
        type: 'attack',
        offsetMs: ev.offsetMs,
        durationMs: ev.durationMs,
      });
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

  // Complete results overlay — shown after practice completion OR when loading a saved complete practice.
  // Feature 101: a stale complete record must not mask an active tempo-stop partial.
  const showComplete = resultsOverlayVisible && practiceReport &&
    (practiceState.mode === 'complete' || (practiceState.mode === 'inactive' && !!performanceRecord && !partialPerformanceRecord));
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
          {/* Feature 101: strict tempo fails stat, only when any were recorded */}
          {practiceReport.strictFailureCount > 0 && (
            <div className="practice-results__stat" data-testid="strict-fail-count">
              <span className="practice-results__stat-value practice-results__stat-value--error">
                {practiceReport.strictFailureCount}
              </span>
              <span className="practice-results__stat-label">{t('practice.results.tempo_failures')}</span>
            </div>
          )}
        </div>

        {/* Time comparison */}
        <div className="practice-results__time-comparison">
          <span>{t('practice.results.your_time')} <strong>{formatTimeMs(practiceReport.practiceTimeMs)}</strong></span>
          <span className="practice-results__time-separator">vs</span>
          <span>{t('practice.results.score_time')} <strong>{formatTimeMs(practiceReport.scoreTimeMs)}</strong></span>
        </div>

        {/* Per-note table + delay chart (extracted component, also rendered by the partial branch) */}
        <PracticeTimingDetails results={practiceReport.results} />

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
  const isTempoStop = partialPerformanceRecord?.stopReason === 'tempo';

  /** Feature 101: one-line failure description for the tempo-stop banner. */
  const formatFailure = useCallback((r: PracticeNoteResult): string => {
    if (r.outcome === 'early-release' && (r.requiredHoldMs ?? 0) > 0) {
      return t('practice.results.released_early', {
        ms: String(Math.round(r.requiredHoldMs - r.holdDurationMs)),
      });
    }
    return formatStateLabel(r.beatDeltaMs ?? r.relativeDeltaMs);
  }, [t]);

  const lastThreeFailures = isTempoStop && partialReport && !partialReport.zeroProgress
    ? partialReport.results.filter((r) => r.strictFailure === true).slice(-3)
    : [];

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
            {/* Feature 101: tempo-stop banner when strict mode stopped the session */}
            {partialPerformanceRecord?.stopReason === 'tempo' ? (
              <div className="practice-results__tempo-stop" data-testid="tempo-stop-banner" role="status">
                <div className="practice-results__tempo-stop-title">
                  {t('practice.results.tempo_stopped')}
                </div>
                <div className="practice-results__tempo-stop-hint">
                  {t('practice.results.tempo_stopped_hint')}
                </div>
                <ul className="practice-results__tempo-stop-list">
                  {lastThreeFailures.map((r, i) => (
                    <li key={`${r.noteIndex}-${i}`} data-testid="tempo-stop-failure">
                      {t('practice.results.tempo_failure_item', {
                        note: String(r.noteIndex + 1),
                        delta: formatFailure(r),
                      })}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              /* Stopped-at badge */
              <div className="practice-results__stopped-badge">
                {t('practice.results.stopped_at', { x: String(partialReport.stoppedAtIndex), y: String(partialReport.totalNoteCount) })}
              </div>
            )}

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
              {/* Feature 101: strict tempo fails stat, only when any were recorded */}
              {partialReport.strictFailureCount > 0 && (
                <div className="practice-results__stat" data-testid="strict-fail-count">
                  <span className="practice-results__stat-value practice-results__stat-value--error">
                    {partialReport.strictFailureCount}
                  </span>
                  <span className="practice-results__stat-label">{t('practice.results.tempo_failures')}</span>
                </div>
              )}
            </div>

            {/* Time comparison */}
            <div className="practice-results__time-comparison">
              <span>{t('practice.results.your_time')} <strong>{formatTimeMs(partialReport.practiceTimeMs)}</strong></span>
              <span className="practice-results__time-separator">vs</span>
              <span>{t('practice.results.score_time')} <strong>{formatTimeMs(partialReport.scoreTimeMs)}</strong></span>
            </div>

            {/* Feature 101: per-note table + delay chart, marked for strict failures */}
            <PracticeTimingDetails results={partialReport.results} />

            {/* Feature 101: tempo-stop actions — repractice / save / return to session */}
            {isTempoStop && (
              <div className="practice-results__actions practice-results__actions--partial">
                <button
                  className="practice-results__repractice-btn"
                  data-testid="tempo-stop-repractice"
                  onClick={handleRepractice}
                  aria-label={t('practice.results.repractice_aria')}
                >
                  ↺ Repractice
                </button>
                {onSave && (
                  <button
                    className={`practice-results__save-btn${isSaved ? ' practice-results__save-btn--saved' : ''}`}
                    data-testid="tempo-stop-save"
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
                    data-testid="tempo-stop-session"
                    onClick={onReturnToSession}
                    aria-label={t('practice.results.session_aria')}
                  >
                    ↩ Session
                  </button>
                )}
              </div>
            )}
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
