/**
 * LayoutView - Renders score using Feature 017 layout engine
 * 
 * Converts Score data to layout format and displays using LayoutRenderer
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import React from 'react';
import type { Score, GlobalStructuralEvent, StaffStructuralEvent, ClefEvent, Note } from '../../types/score';
import type { PlaybackStatus, ITickSource } from '../../types/playback';
import { ScoreViewer, LABEL_MARGIN } from '../../pages/ScoreViewer';
import type { GlobalLayout } from '../../wasm/layout';
import { computeLayout } from '../../wasm/layout';
import { buildSourceToNoteIdMap } from '../../services/highlight/sourceMapping';
import { useRenderConfig } from '../../contexts/RenderConfigContext';

/**
 * BASE_SCALE mirrors the constant in pages/ScoreViewer: each layout unit = 0.5 CSS px.
 * max_system_width (layout units) = containerWidth (CSS px) / BASE_SCALE - LABEL_MARGIN
 */
const BASE_SCALE = 0.5;
/** Fallback width used only until the container is measured */
const DEFAULT_SYSTEM_WIDTH = 2400;

interface ConvertedScore {
  instruments: Array<{
    id: string;
    name: string;
    staves: Array<{
      clef: string;
      time_signature: { numerator: number; denominator: number };
      key_signature: { sharps: number };
      key_signature_events?: Array<{ tick: number; sharps: number }>;
      clef_events?: Array<{ tick: number; clef: string }>;
      voices: Array<{
        notes: Array<{
          tick: number;
          duration: number;
          pitch: number;
          articulation: null;
          spelling?: { step: string; alter: number };
        }>;
        rest_events?: Array<{
          start_tick: number;
          duration_ticks: number;
          note_type?: string;
          voice: number;
          staff: number;
        }>;
      }>;
    }>;
  }>;
  tempo_changes: unknown[];
  time_signature_changes: unknown[];
  repeat_barlines: unknown[];
  volta_brackets: unknown[];
  pickup_ticks: number;
}

interface LayoutViewProps {
  score: Score;
  /** Feature 019: Set of note IDs to highlight during playback */
  highlightedNoteIds?: Set<string>;
  /** Toggle playback on click/touch */
  onTogglePlayback?: () => void;
  /** Callback when a note glyph is clicked */
  onNoteClick?: (noteId: string) => void;
  /** ID of the currently selected note */
  selectedNoteId?: string;
  /** Feature 022: Playback status for disabling TempoControl during playback */
  playbackStatus?: PlaybackStatus;
  /** Feature 024: Tick source ref for rAF-driven highlights in LayoutRenderer.
   * Must be a ref object (not a value) so the rAF loop reads live tick data
   * even when shouldComponentUpdate blocks React re-renders. */
  tickSourceRef?: { current: ITickSource };
  /** Feature 024: All notes for building HighlightIndex in LayoutRenderer */
  allNotes?: ReadonlyArray<{ id: string; start_tick: number; duration_ticks: number }>;
  /** Raw (unexpanded) notes — original ticks matching the layout engine's tick space.
   * Used for loop overlay rendering and tick lookups in ScoreViewer. */
  rawNotes?: ReadonlyArray<{ id: string; start_tick: number; duration_ticks: number }>;
  /** Green pinned highlight note IDs — permanent until unpinned */
  pinnedNoteIds?: Set<string>;
  /** Note IDs for auto-scroll targeting (overrides highlightedNoteIds for scroll) */
  scrollTargetNoteIds?: Set<string>;
  /** Current pinned note ID (null = not pinned) — forwarded to pages/ScoreViewer for unpin detection */
  pinnedNoteId?: string | null;
  /** Long-press pin: seek to tick and highlight noteId. Both null = unpin. */
  onPin?: (tick: number | null, noteId: string | null) => void;
  /** Short tap far from current position: seek + auto-play */
  onSeekAndPlay?: (tick: number) => void;
  /** Loop region: when both pins are set, overlay rect + rAF loop-back */
  loopRegion?: { startTick: number; endTick: number } | null;
  /**
   * When the score is inside an overflow:auto container (e.g. plugin view),
   * pass a ref to that container so ScoreViewer can drive scroll on it
   * instead of window.
   */
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Convert Score to format expected by computeLayout
 * Processes all instruments and their staves for multi-instrument layout
 */
// eslint-disable-next-line react-refresh/only-export-components
export function convertScoreToLayoutFormat(score: Score): ConvertedScore {
  if (score.instruments.length === 0) {
    throw new Error('No instruments in score');
  }

  // Extract time signature from global structural events (default to 4/4)
  let timeSignature = { numerator: 4, denominator: 4 };
  const firstTimeSigEvent = score.global_structural_events.find((e: GlobalStructuralEvent) => 'TimeSignature' in e);
  if (firstTimeSigEvent && 'TimeSignature' in firstTimeSigEvent) {
    const timeSig = firstTimeSigEvent.TimeSignature;
    timeSignature = {
      numerator: timeSig.numerator,
      denominator: timeSig.denominator,
    };
  }

  // Process ALL instruments (not just the first)
  const convertedInstruments = score.instruments.map(instrument => {
    // Process all staves from this instrument
    const convertedStaves = instrument.staves.map(staff => {
      if (staff.voices.length === 0) {
        throw new Error('No voices in staff');
      }

      // Extract key signature from staff structural events (default to 0 = C major)
      let keySharps = 0;
      const firstKeySigEvent = staff.staff_structural_events.find((e: StaffStructuralEvent) => 'KeySignature' in e);
      if (firstKeySigEvent && 'KeySignature' in firstKeySigEvent) {
        const keySig = firstKeySigEvent.KeySignature.key;
        // Rust KeySignature(i8) serializes as a JSON number directly
        keySharps = typeof keySig === 'number' ? keySig : 0;
      }

      // Extract ALL key signature events for mid-piece key changes
      const keySigEvents = staff.staff_structural_events
        .filter((e: StaffStructuralEvent) => 'KeySignature' in e)
        .map((e: StaffStructuralEvent) => {
          const ks = (e as { KeySignature: { tick: number; key: number } }).KeySignature;
          return {
            tick: typeof ks.tick === 'number' ? ks.tick : 0,
            sharps: typeof ks.key === 'number' ? ks.key : 0,
          };
        });

      // Extract ALL clef events for mid-piece clef changes
      const clefEvents = staff.staff_structural_events
        .filter((e: StaffStructuralEvent) => 'Clef' in e)
        .map((e: StaffStructuralEvent) => {
          const ce = (e as { Clef: ClefEvent }).Clef;
          // Support both Rust serialization ("clef") and TS fixtures ("clef_type")
          const clefValue = ce.clef_type ?? (ce as unknown as { clef: string }).clef ?? 'Treble';
          return {
            tick: typeof ce.tick === 'number' ? ce.tick : 0,
            clef: clefValue,
          };
        });

      return {
        clef: staff.active_clef,
        time_signature: timeSignature,
        key_signature: { sharps: keySharps },
        // Pass all key change events so the layout engine can render mid-piece changes
        ...(keySigEvents.length > 1 ? { key_signature_events: keySigEvents } : {}),
        // Pass all clef change events so the layout engine can render mid-piece clef changes
        ...(clefEvents.length > 1 ? { clef_events: clefEvents } : {}),
        voices: staff.voices.map(voice => ({
          notes: voice.interval_events.map((note: Note) => ({
            tick: note.start_tick,
            duration: note.duration_ticks,
            pitch: note.pitch,
            articulation: null,
            spelling: note.spelling,
            // Forward MusicXML beam annotations to layout engine
            ...(note.beams && note.beams.length > 0 ? { beams: note.beams } : {}),
          })),
          // Forward rest events so the layout engine can produce rest glyphs
          ...(voice.rest_events && voice.rest_events.length > 0
            ? { rest_events: voice.rest_events }
            : {}),
        })),
      };
    });

    return {
      id: instrument.id,
      name: instrument.name,
      staves: convertedStaves,
    };
  });

  // Create score structure matching Rust WASM expectations
  return {
    instruments: convertedInstruments,
    // Extract tempo and time signature from global_structural_events
    tempo_changes: score.global_structural_events
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((e): e is any => 'Tempo' in e)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((e: any) => e.Tempo),
    time_signature_changes: score.global_structural_events
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((e): e is any => 'TimeSignature' in e)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((e: any) => e.TimeSignature),
    repeat_barlines: score.repeat_barlines ?? [],
    volta_brackets: score.volta_brackets ?? [],
    pickup_ticks: score.pickup_ticks ?? 0,
  };
}

export function LayoutView({ score, highlightedNoteIds, onTogglePlayback, playbackStatus, onNoteClick, selectedNoteId, tickSourceRef, allNotes, rawNotes, pinnedNoteIds, scrollTargetNoteIds, pinnedNoteId, onPin, onSeekAndPlay, loopRegion, scrollContainerRef }: LayoutViewProps) {
  const [layout, setLayout] = useState<GlobalLayout | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * Responsive system width: measure the container's CSS pixel width and convert
   * to layout units so the layout engine always fills the available horizontal space.
   * Formula: max_system_width = containerWidth / BASE_SCALE - LABEL_MARGIN
   * This ensures ≥4 measures per system on a 10" tablet in landscape (≈1366px wide).
   */
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    // Use viewport width directly — DOM elements (self or parent) can be wider
    // than the viewport if they contain a previously-rendered wide score, creating
    // a feedback loop. window.innerWidth is always the true available CSS width.
    const measure = () => {
      const width = document.documentElement.clientWidth;
      setContainerWidth(width);
    };

    measure(); // initial read

    let debounceTimer: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(measure, 100);
    };
    window.addEventListener('resize', onResize);
    return () => {
      clearTimeout(debounceTimer);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  /**
   * Layout units available for note content (adapts to container width).
   * Uses the measured width when available; falls back to DEFAULT_SYSTEM_WIDTH
   * before the first measurement.
   *
   * Clamped between 800 (narrow phones) and MAX_SYSTEM_WIDTH (prevents
   * ultra-wide monitors from stretching measures across too few systems).
   * MAX_SYSTEM_WIDTH 3000 ≈ 1575 CSS px — generous for tablets/laptops.
   */
  const MAX_SYSTEM_WIDTH = 3000;
  const maxSystemWidth = containerWidth > 0
    ? Math.min(MAX_SYSTEM_WIDTH, Math.max(800, Math.floor(containerWidth / BASE_SCALE) - LABEL_MARGIN))
    : DEFAULT_SYSTEM_WIDTH;

  // Consume theme-derived render config from context (provided by App.tsx).
  // Falls back to undefined so pages/ScoreViewer uses its own default.
  const renderConfig = useRenderConfig();

  /**
   * Feature 019: Build mapping from layout source references to note IDs
   * Must use layout's instrument_ids (not score's) to match glyph source_references
   */
  const sourceToNoteIdMap = useMemo(() => {
    return buildSourceToNoteIdMap(score, layout);
  }, [score, layout]);

  useEffect(() => {
    // Wait for container measurement before computing layout — avoids computing
    // with the fallback width then immediately recomputing with the real width.
    if (containerWidth === 0) return;

    const computeAndSetLayout = async () => {
      try {
        setLoading(true);
        setError(null);

        // Convert score to layout format
        const layoutInput = convertScoreToLayoutFormat(score);

        // Compute layout filling the measured container width.
        // max_system_width is in layout units; at BASE_SCALE=0.5 this equals
        // the full container CSS width in pixels.
        const result = await computeLayout(layoutInput, {
          max_system_width: maxSystemWidth,
          system_height: 200,
          system_spacing: 100,
          units_per_space: 20, // 20 logical units = 1 staff space
        });

        // Check if staff_groups are populated
        if (result.systems?.length > 0 && result.systems[0].staff_groups.length === 0) {
          throw new Error('Layout engine computed systems but did not generate staff content (staff lines, glyphs, etc.). The Rust layout engine needs additional implementation to convert notes into positioned glyphs.');
        }
        
        setLayout(result);
        setLoading(false);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error('[LayoutView] Failed to compute layout:', errorMessage, err);
        setError(errorMessage);
        setLoading(false);
      }
    };

    computeAndSetLayout();
  }, [score, maxSystemWidth]);

  if (loading) {
    return (
      <div ref={containerRef} style={styles.container}>
        <div style={styles.message}>
          <div style={styles.spinner}>🎼</div>
          <p>Computing layout from first voice...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div ref={containerRef} style={styles.container}>
        <div style={styles.error}>
          <h3>⚠️ Layout Error</h3>
          <p>{error}</p>
          <details style={{ marginTop: '1rem', textAlign: 'left' }}>
            <summary style={{ cursor: 'pointer' }}>Debug Info</summary>
            <pre style={styles.debug}>
              {JSON.stringify({ score, error }, null, 2)}
            </pre>
          </details>
        </div>
      </div>
    );
  }

  if (!layout) {
    return (
      <div ref={containerRef} style={styles.container}>
        <div style={styles.message}>
          <p>No layout available</p>
        </div>
      </div>
    );
  }

  // Feature 027 (T022): Removed blue info bar (instrument count + TempoControl).
  // TempoControl moved to PlaybackControls compact strip (T025).
  return (
    <div ref={containerRef} style={styles.container}>
      <ScoreViewer 
        layout={layout} 
        config={renderConfig}
        highlightedNoteIds={highlightedNoteIds}
        sourceToNoteIdMap={sourceToNoteIdMap}
        onTogglePlayback={onTogglePlayback}
        playbackStatus={playbackStatus}
        onNoteClick={onNoteClick}
        selectedNoteId={selectedNoteId}
        tickSourceRef={tickSourceRef}
        notes={allNotes}
        rawNotes={rawNotes}
        pinnedNoteIds={pinnedNoteIds}
        scrollTargetNoteIds={scrollTargetNoteIds}
        pinnedNoteId={pinnedNoteId}
        onPin={onPin}
        onSeekAndPlay={onSeekAndPlay}
        loopRegion={loopRegion}
        scrollContainerRef={scrollContainerRef}
      />
    </div>
  );
}

const styles = {
  container: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  message: {
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
    alignItems: 'center',
    height: '60vh',
    color: '#666',
  },
  spinner: {
    fontSize: '3rem',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  error: {
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
    alignItems: 'center',
    height: '60vh',
    color: '#f44336',
    padding: '2rem',
  },
  debug: {
    background: '#f5f5f5',
    padding: '1rem',
    borderRadius: '4px',
    overflow: 'auto',
    maxHeight: '300px',
    fontSize: '0.875rem',
  },
};
