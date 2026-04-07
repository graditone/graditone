/**
 * ScoreRendererPlugin — Host-provided `ScoreRenderer` component for v3 plugins (T005)
 * Feature 033: Play Score Plugin
 *
 * Wraps LayoutView and translates between the Plugin API's PluginScoreRendererProps
 * and LayoutView's internal props. Provides the noteId→tick mapping needed because
 * LayoutView.onNoteClick only delivers noteId (not tick), while the plugin API's
 * onNoteShortTap(tick, noteId) requires both.
 *
 * Principles:
 *   - No coordinates / internal types cross the plugin-api boundary (Principle VI)
 *   - All internal props come from ScorePlayerBridge (via V3PluginWrapper in T006)
 *   - Renders a "back to start" button at the bottom of the score area (FR-010)
 */

import { useCallback, useMemo, useRef } from 'react';
import { LayoutView } from '../layout/LayoutView';
import type { PluginScoreRendererProps } from '../../plugin-api/types';
import { usePhraseState } from '../../hooks/usePhraseState';
import { useTranslation } from '../../i18n/index';
import './ScoreRendererPlugin.css';
import type { Note, Score } from '../../types/score';
import type { PlaybackStatus, ITickSource } from '../../types/playback';

// ---------------------------------------------------------------------------
// Internal props (host-to-host, never exposed to plugins)
// ---------------------------------------------------------------------------

export interface ScoreRendererPluginInternalProps {
  /**
   * Parsed Score for rendering. When null (score not yet loaded), a loading
   * placeholder is shown instead of LayoutView.
   */
  score: Score | null;
  /**
   * All notes from the score, used to build the noteId→tick lookup map.
   * Required for translating LayoutView.onNoteClick(noteId) to
   * onNoteShortTap(tick, noteId).
   */
  allNotes: readonly Note[];
  /**
   * Raw (unexpanded) notes — original ticks matching the layout engine.
   * Used for noteId→tick lookups (pin/loop) and loop overlay rendering.
   */
  rawNotes: readonly Note[];
  /**
   * Live tick source ref from the playback engine — forwarded to LayoutView
   * so the rAF-based note highlight loop works at 60 Hz.
   */
  tickSourceRef: { current: ITickSource };
  /**
   * Raw playback status from the engine (stopped/playing/paused).
   * Forwarded to LayoutView.playbackStatus; the plugin-facing status is not
   * used here because LayoutView doesn't know about 'idle'/'loading'/'error'.
   */
  playbackStatus: PlaybackStatus;
  /**
   * Feature 062: Set the loop region to a phrase's tick range.
   * Called when a phrase is selected (startTick, endTick) or deselected (null, null).
   */
  onSetLoopRegion?: (startTick: number | null, endTick: number | null) => void;
}

export type ScoreRendererPluginProps = PluginScoreRendererProps & ScoreRendererPluginInternalProps;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Host-managed ScoreRenderer for v3 plugins.
 *
 * Renders either a loading placeholder (when score is null) or the full
 * LayoutView with mapped callbacks + a "back to start" button.
 */
export function ScoreRendererPlugin({
  // Plugin-facing props (PluginScoreRendererProps)
  // currentTick: available via tickSourceRef at 60 Hz; not read directly here
  currentTick: _currentTick,
  highlightedNoteIds,
  loopRegion,
  pinnedNoteIds,
  errorNoteIds,
  expectedNoteIds,
  scrollTargetNoteIds,
  onNoteShortTap,
  onNoteLongPress,
  onCanvasTap,
  onReturnToStart,
  // Internal props
  score,
  allNotes,
  rawNotes,
  tickSourceRef,
  playbackStatus,
  onSetLoopRegion,
}: ScoreRendererPluginProps) {
  const { t } = useTranslation();

  // Build noteId → startTick lookup from the expanded notes array.
  // Expanded ticks are needed because playback engine (MusicTimeline) operates
  // in expanded tick space for seek, pin, and loop-end calls.
  const noteIdToTick = useMemo(
    () => new Map<string, number>(allNotes.map(n => [n.id, n.start_tick])),
    [allNotes]
  );

  // Derive a single pinnedNoteId from the set for LayoutView's unpin-detection.
  // The play-score plugin uses at most one pin marker at a time.
  const pinnedNoteId = pinnedNoteIds.size > 0
    ? [...pinnedNoteIds][0]
    : null;

  // Ref to the scrollable wrapper — passed to LayoutView so ScoreViewer
  // drives scroll on this element instead of window.
  const layoutWrapperRef = useRef<HTMLDivElement>(null);

  // Feature 062: Filter phrases to primary instrument (index 0) so that
  // multi-instrument scores (e.g. piano with treble+bass) don't produce
  // overlapping click targets that misroute the selected phrase index.
  const instrumentPhrases = useMemo(() =>
    score?.phrases?.filter(p => p.instrument_index === 0) ?? [],
    [score?.phrases]
  );

  // Feature 062: Raw→expanded tick conversion for scores with repeats.
  // Phrase regions carry raw ticks (from measure_end_ticks) but the playback
  // engine operates in expanded (repeat-unfolded) tick space.  Without this
  // conversion, selecting a phrase after a repeat section (e.g. M13 in La
  // Candeur which repeats M1-M8) would send the raw tick to the playback
  // engine, which interprets it in expanded space and lands at the wrong measure.
  const rawToExpandedOffsets = useMemo(() => {
    if (!rawNotes?.length || !allNotes?.length) return null;
    // Map note ID → first expanded tick (first pass for repeated notes)
    const expandedById = new Map<string, number>();
    for (const n of allNotes) {
      if (!expandedById.has(n.id)) expandedById.set(n.id, n.start_tick);
    }
    // Collect (rawTick, offset) pairs sorted by rawTick
    const entries: { raw: number; offset: number }[] = [];
    const seen = new Set<number>();
    for (const n of rawNotes) {
      if (seen.has(n.start_tick)) continue;
      seen.add(n.start_tick);
      const exp = expandedById.get(n.id);
      if (exp !== undefined) entries.push({ raw: n.start_tick, offset: exp - n.start_tick });
    }
    entries.sort((a, b) => a.raw - b.raw);
    // If all offsets are 0 (no repeats), skip conversion
    if (entries.every(e => e.offset === 0)) return null;
    return entries;
  }, [rawNotes, allNotes]);

  /** Convert a raw tick to expanded tick space using the offset from the
   *  nearest preceding note.  Within each repeat section the offset is
   *  constant, so this correctly handles measure boundaries and rests. */
  const toExpandedTick = useCallback((rawTick: number): number => {
    if (!rawToExpandedOffsets || rawToExpandedOffsets.length === 0) return rawTick;
    // Binary search for the last entry with raw <= rawTick
    let lo = 0, hi = rawToExpandedOffsets.length - 1, best = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (rawToExpandedOffsets[mid].raw <= rawTick) { best = mid; lo = mid + 1; }
      else hi = mid - 1;
    }
    const offset = best >= 0 ? rawToExpandedOffsets[best].offset : rawToExpandedOffsets[0].offset;
    return rawTick + offset;
  }, [rawToExpandedOffsets]);

  // Feature 062: Phrase overlay state — wrap onSetLoopRegion to convert
  // raw phrase ticks to expanded ticks before reaching the playback engine.
  const phraseOptions = useMemo(() => ({
    onPhraseSelect: onSetLoopRegion
      ? (startTick: number | null, endTick: number | null) => {
          if (startTick !== null && endTick !== null) {
            onSetLoopRegion(toExpandedTick(startTick), toExpandedTick(endTick));
          } else {
            onSetLoopRegion(null, null);
          }
        }
      : undefined,
  }), [onSetLoopRegion, toExpandedTick]);
  const { phrasesVisible, togglePhrases, hasPhrases, selectedPhraseIndex, selectPhrase, goToNextPhrase, goToPreviousPhrase } = usePhraseState(instrumentPhrases.length > 0 ? instrumentPhrases : undefined, phraseOptions);

  // Feature 062: Derive a loop region from the selected phrase (if any).
  // NOT gated on phrasesVisible — the loop region persists even when phrase
  // bands are hidden, matching the UX of manually created loop regions.
  // Ticks are converted to expanded space so the LoopOverlayRenderer's
  // expanded→raw conversion works correctly and the region is consistent
  // with manual loop regions from PlayScorePlugin.
  const phraseLoopRegion = useMemo(() => {
    if (selectedPhraseIndex != null && instrumentPhrases[selectedPhraseIndex]) {
      const phrase = instrumentPhrases[selectedPhraseIndex];
      return { startTick: toExpandedTick(phrase.start_tick), endTick: toExpandedTick(phrase.end_tick) };
    }
    return null;
  }, [selectedPhraseIndex, instrumentPhrases, toExpandedTick]);

  // Merge: phrase-derived loop takes precedence over parent's manual loop.
  const effectiveLoopRegion = phraseLoopRegion ?? loopRegion;

  // Intercept long-press to clear phrase-selected loop when tapping inside it.
  // PlayScorePlugin's own handleNoteLongPress checks its own loopRegion state
  // (which is null for phrase-derived loops), so we handle clearing here.
  const handlePin = useCallback((tick: number | null, noteId: string | null) => {
    if (tick != null && phraseLoopRegion && tick >= phraseLoopRegion.startTick && tick <= phraseLoopRegion.endTick) {
      // Clear phrase selection → clears phraseLoopRegion
      selectPhrase(null);
      return;
    }
    onNoteLongPress(tick ?? 0, noteId);
  }, [phraseLoopRegion, selectPhrase, onNoteLongPress]);

  // ─── Loading placeholder ─────────────────────────────────────────────────

  if (!score) {
    return (
      <div style={styles.placeholder}>
        <p style={styles.placeholderText}>Select a score to begin</p>
      </div>
    );
  }

  // ─── Full score renderer ──────────────────────────────────────────────────

  return (
    <div style={styles.container} onContextMenu={e => e.preventDefault()}>
      <div ref={layoutWrapperRef} style={styles.layoutViewWrapper}>
        <LayoutView
          score={score}
          allNotes={allNotes}
          rawNotes={rawNotes}
          tickSourceRef={tickSourceRef}
          highlightedNoteIds={highlightedNoteIds instanceof Set ? highlightedNoteIds : new Set(highlightedNoteIds)}
          pinnedNoteIds={pinnedNoteIds instanceof Set ? pinnedNoteIds : new Set(pinnedNoteIds)}
          errorNoteIds={errorNoteIds ? (errorNoteIds instanceof Set ? errorNoteIds : new Set(errorNoteIds)) : undefined}
          expectedNoteIds={expectedNoteIds ? (expectedNoteIds instanceof Set ? expectedNoteIds : new Set(expectedNoteIds)) : undefined}
          scrollTargetNoteIds={scrollTargetNoteIds ? (scrollTargetNoteIds instanceof Set ? scrollTargetNoteIds : new Set(scrollTargetNoteIds)) : undefined}
          pinnedNoteId={pinnedNoteId}
          loopRegion={effectiveLoopRegion}
          phrasesVisible={phrasesVisible}
          selectedPhraseIndex={selectedPhraseIndex}
          onPhraseClick={selectPhrase}
          phrases={instrumentPhrases}
          scrollToTick={phrasesVisible && selectedPhraseIndex != null && instrumentPhrases[selectedPhraseIndex] ? instrumentPhrases[selectedPhraseIndex].start_tick : null}
          playbackStatus={playbackStatus}
          scrollContainerRef={layoutWrapperRef}
          onTogglePlayback={onCanvasTap}
          onNoteClick={(noteId: string) => {
            const tick = noteIdToTick.get(noteId) ?? 0;
            onNoteShortTap(tick, noteId);
          }}
          onPin={handlePin}
          onSeekAndPlay={(tick: number) => {
            onNoteShortTap(tick, '');
          }}
        />
      </div>

      {/* Feature 062: Phrases toggle + FR-010: Back to start */}
      <div className="score-renderer-bottom-bar">
        <button
          className={`score-renderer-phrases-btn${phrasesVisible ? ' active' : ''}`}
          onClick={togglePhrases}
          disabled={!hasPhrases}
          aria-label={phrasesVisible ? t('score.phrases.hide_aria') : t('score.phrases.show_aria')}
          aria-pressed={phrasesVisible}
          title={hasPhrases ? (phrasesVisible ? t('score.phrases.hide_aria') : t('score.phrases.show_aria')) : t('score.phrases.none_title')}
        >
          {t('score.phrases.toggle')}
        </button>
        {phrasesVisible && (
          <>
            <button
              className="score-renderer-nav-btn"
              onClick={goToPreviousPhrase}
              aria-label={t('score.phrases.prev_aria')}
              title={t('score.phrases.prev_aria')}
            >
              {t('score.phrases.prev')}
            </button>
            <button
              className="score-renderer-nav-btn"
              onClick={goToNextPhrase}
              aria-label={t('score.phrases.next_aria')}
              title={t('score.phrases.next_aria')}
            >
              {t('score.phrases.next')}
            </button>
          </>
        )}
        <button
          className="score-renderer-return-btn"
          onClick={() => {
            onReturnToStart();
            if (layoutWrapperRef.current) {
              layoutWrapperRef.current.scrollTop = 0;
            }
          }}
          aria-label={t('score.return_to_start_aria')}
          title={t('score.return_to_start_aria')}
        >
          {t('score.return_to_start')}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = {
  container: {
    position: 'relative' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    width: '100%',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  layoutViewWrapper: {
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
    // Suppress the OS blue tap-highlight and text-selection box on the score canvas.
    userSelect: 'none' as const,
    WebkitUserSelect: 'none' as const,
    WebkitTapHighlightColor: 'transparent',
  },
  placeholder: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '200px',
    background: '#f9f9f9',
  },
  placeholderText: {
    fontSize: '1.1rem',
    color: '#888',
  },

} as const;
