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

import { useMemo, useRef } from 'react';
import { LayoutView } from '../layout/LayoutView';
import type { PluginScoreRendererProps } from '../../plugin-api/types';
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
}: ScoreRendererPluginProps) {

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
          loopRegion={loopRegion}
          playbackStatus={playbackStatus}
          scrollContainerRef={layoutWrapperRef}
          onTogglePlayback={onCanvasTap}
          onNoteClick={(noteId: string) => {
            const tick = noteIdToTick.get(noteId) ?? 0;
            onNoteShortTap(tick, noteId);
          }}
          onPin={(tick: number | null, noteId: string | null) => {
            onNoteLongPress(tick ?? 0, noteId);
          }}
          onSeekAndPlay={(tick: number) => {
            onNoteShortTap(tick, '');
          }}
        />
      </div>

      {/* FR-010: Back to start — outside the scroll wrapper so it stays visible
          at the bottom of the container. play-score__score-area is overflow:hidden
          so layoutWrapperRef is the only scroll container; scrollTop=0 works. */}
      <button
        className="score-renderer-return-btn"
        onClick={() => {
          onReturnToStart();
          if (layoutWrapperRef.current) {
            layoutWrapperRef.current.scrollTop = 0;
          }
        }}
        aria-label="Return to start"
        title="Return to start"
      >
        ⏮ Start
      </button>
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
