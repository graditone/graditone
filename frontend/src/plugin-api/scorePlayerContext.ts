/**
 * useScorePlayerContext — Implementation (T004)
 * useScorePlayerBridge — Host-side bridge exposing internal state (T005)
 * Feature 033: Play Score Plugin
 *
 * React hook that wraps:
 *   - usePlayback (MusicTimeline) — playback engine
 *   - useTempoState (TempoStateContext) — tempo multiplier
 *   - useNoteHighlight — highlighted note IDs
 *   - MusicXMLImportService — score loading
 *
 * Exposes the full PluginScorePlayerContext interface so plugins can
 * load, play, control, and subscribe to score state without importing
 * host services directly.
 *
 * Architecture (research.md R-006, R-007):
 *   - subscribe() uses a push-model: immediate call + on-change via useEffect
 *   - getCurrentTickLive() reads tickSourceRef for 60 Hz resolution without re-renders
 *   - loadScore() resolves catalogue paths internally (FR-013: no paths in plugin code)
 *   - No-op stub available via createNoOpScorePlayer() for v2 plugins
 *
 * Must be called inside a component wrapped with TempoStateProvider.
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import type { PluginScorePlayerContext, PluginPreloadedScore, ScoreLoadSource, ScorePlayerState, PluginScorePitches } from './types';
import { usePlayback } from '../services/playback/MusicTimeline';
import type { PlaybackStatus, ITickSource } from '../types/playback';
import { useTempoState } from '../services/state/TempoStateContext';
import { useNoteHighlight } from '../services/highlight/useNoteHighlight';
import { MusicXMLImportService } from '../services/import/MusicXMLImportService';
import { PRELOADED_SCORES } from '../data/preloadedScores';
import type { Note, Score } from '../types/score';

// ---------------------------------------------------------------------------
// Bridge type (T005) — internal state exposed to the HOST only, never plugins
// ---------------------------------------------------------------------------

/**
 * Host-internal state returned by useScorePlayerBridge().
 * Used by V3PluginWrapper to build BoundScoreRenderer and to pass internal
 * props to ScoreRendererPlugin without leaking them to plugins.
 */
export interface ScorePlayerInternal {
  /** Parsed Score from the last successful loadScore call; null before any load. */
  score: Score | null;
  /** All notes extracted from the score (voice-0 of all staves). */
  notes: readonly Note[];
  /** Raw playback engine status (stopped/playing/paused). */
  playbackStatus: PlaybackStatus;
  /** Live tick source ref for rAF consumers — same ref as LayoutView's tickSourceRef. */
  tickSourceRef: { current: ITickSource };
  /** Note IDs currently highlighted by the rAF loop. */
  highlightedNoteIds: Set<string>;
}

export interface ScorePlayerBridge {
  /** Public plugin-facing API. */
  api: PluginScorePlayerContext;
  /** Internal state for host components (ScoreRendererPlugin, V3PluginWrapper). */
  internal: ScorePlayerInternal;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/** Overlay status for states the playback engine doesn't model */
type OverlayStatus = 'idle' | 'loading' | 'error' | null;

// ---------------------------------------------------------------------------
// getCatalogue — stable reference, created once per module load
// ---------------------------------------------------------------------------

const CATALOGUE: ReadonlyArray<PluginPreloadedScore> = PRELOADED_SCORES.map(
  ({ id, displayName }) => ({ id, displayName } as const)
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract all notes from a Score for use with usePlayback.
 * Mirrors ScoreViewer.tsx's allNotes useMemo — only voice-0 notes.
 */
function extractNotes(score: Score): Note[] {
  const notes: Note[] = [];
  for (const instrument of score.instruments) {
    for (const staff of instrument.staves) {
      const firstVoice = staff.voices[0];
      if (firstVoice) {
        notes.push(...firstVoice.interval_events);
      }
    }
  }
  return notes;
}

/**
 * Extract the initial tempo (BPM) from a Score's global structural events.
 * Defaults to 120 BPM if no Tempo event is found at tick 0.
 */
function extractTempo(score: Score): number {
  for (const event of score.global_structural_events) {
    if ('Tempo' in event && event.Tempo.tick === 0) {
      return event.Tempo.bpm;
    }
  }
  return 120;
}

/**
 * Extract the initial time signature from a Score's global structural events.
 * Defaults to 4/4 if no TimeSignature event is found at tick 0.
 * Mirrors extractTempo pattern — reads global_structural_events.
 */
function extractTimeSignature(score: Score): { numerator: number; denominator: number } {
  for (const event of score.global_structural_events) {
    if ('TimeSignature' in event && event.TimeSignature.tick === 0) {
      return {
        numerator: event.TimeSignature.numerator,
        denominator: event.TimeSignature.denominator,
      };
    }
  }
  return { numerator: 4, denominator: 4 };
}

/**
 * Extract pitched notes for the practice exercise from a Score.
 *
 * Rules (from spec clarifications + FR-004):
 *   1. Source: instruments[0].staves[0].voices[0] (first instrument, topmost staff, first voice)
 *   2. Group by start_tick; keep max pitch per tick (chord reduction — top note of chord)
 *   3. Sort ascending by tick → ordered pitch sequence
 *   4. Clef: read from instruments[0].staves[0].active_clef; normalise to 'Treble' | 'Bass'
 *      (Alto/Tenor → 'Treble' fallback, per R-003)
 *   5. Cap to maxCount; report totalAvailable before cap
 */
function extractPracticeNotesFromScore(
  score: Score,
  maxCount: number,
): PluginScorePitches {
  const instrument = score.instruments[0];
  const staff = instrument?.staves[0];
  const voice = staff?.voices[0];
  const events = voice?.interval_events ?? [];

  // Group by start_tick; retain max pitch per tick (chord dedup)
  const tickMap = new Map<number, number>();
  for (const note of events) {
    // Note.pitch is always a number (no rests in interval_events type)
    const existing = tickMap.get(note.start_tick);
    if (existing === undefined || note.pitch > existing) {
      tickMap.set(note.start_tick, note.pitch);
    }
  }

  // Sort by tick → ordered pitch sequence
  const allPitches = [...tickMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, midiPitch]) => ({ midiPitch }));

  const totalAvailable = allPitches.length;
  const notes = allPitches.slice(0, maxCount);

  // Clef normalisation: Treble (G) and Bass (F) pass through; Alto/Tenor → Treble fallback
  const rawClef = staff?.active_clef ?? 'Treble';
  const clef: 'Treble' | 'Bass' = rawClef === 'Bass' ? 'Bass' : 'Treble';

  return { notes, totalAvailable, clef, title: null };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * React hook that creates both the public PluginScorePlayerContext API
 * and exposes internal playback state for host-side components.
 *
 * Must be called inside a component rendered within TempoStateProvider.
 *
 * @returns ScorePlayerBridge — { api: PluginScorePlayerContext, internal: ScorePlayerInternal }
 */
export function useScorePlayerBridge(): ScorePlayerBridge {
  // ─── Score state ────────────────────────────────────────────────────────

  const [score, setScore] = useState<Score | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [scoreTempo, setScoreTempo] = useState<number>(120);
  const [scoreTimeSignature, setScoreTimeSignature] = useState<{ numerator: number; denominator: number }>({ numerator: 4, denominator: 4 });
  const [title, setTitle] = useState<string | null>(null);

  /** Overlay status for transitions the playback engine doesn't model */
  const [overlayStatus, setOverlayStatus] = useState<OverlayStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ─── Playback engine ─────────────────────────────────────────────────────

  const playbackState = usePlayback(notes, scoreTempo);

  // ─── Tempo context ───────────────────────────────────────────────────────

  const { tempoState, setTempoMultiplier } = useTempoState();

  // ─── Note highlighting ────────────────────────────────────────────────────

  const highlightedNoteIds = useNoteHighlight(
    notes,
    playbackState.currentTick,
    playbackState.status
  );

  // ─── Computed plugin-level status ────────────────────────────────────────

  const pluginStatus = useMemo((): import('./types').PluginPlaybackStatus => {
    if (overlayStatus === 'idle') return 'idle';
    if (overlayStatus === 'loading') return 'loading';
    if (overlayStatus === 'error') return 'error';
    // overlayStatus is null → use underlying playback status
    if (playbackState.status === 'playing') return 'playing';
    if (playbackState.status === 'paused') return 'paused';
    return 'ready'; // 'stopped' → 'ready'
  }, [overlayStatus, playbackState.status]);

  // ─── Effective BPM ───────────────────────────────────────────────────────

  const effectiveBpm = useMemo(
    () => Math.round(scoreTempo * tempoState.tempoMultiplier),
    [scoreTempo, tempoState.tempoMultiplier]
  );

  // ─── Subscribe system ─────────────────────────────────────────────────────

  const subscribersRef = useRef<Set<(state: ScorePlayerState) => void>>(new Set());
  const currentStateRef = useRef<ScorePlayerState>({
    status: 'idle',
    currentTick: 0,
    totalDurationTicks: 0,
    highlightedNoteIds: new Set<string>(),
    bpm: 0,
    title: null,
    error: null,
    timeSignature: { numerator: 4, denominator: 4 },
  });

  // Notify all subscribers when state changes
  useEffect(() => {
    const newState: ScorePlayerState = {
      status: pluginStatus,
      currentTick: playbackState.currentTick,
      totalDurationTicks: playbackState.totalDurationTicks,
      highlightedNoteIds,
      bpm: effectiveBpm,
      title,
      error: errorMessage,
      timeSignature: scoreTimeSignature,
    };
    currentStateRef.current = newState;
    subscribersRef.current.forEach(h => h(newState));
  }, [
    pluginStatus,
    playbackState.currentTick,
    playbackState.totalDurationTicks,
    highlightedNoteIds,
    effectiveBpm,
    title,
    errorMessage,
    scoreTimeSignature,
  ]);

  // ─── getCatalogue ─────────────────────────────────────────────────────────

  const getCatalogue = useCallback(
    (): ReadonlyArray<PluginPreloadedScore> => CATALOGUE,
    []
  );

  // ─── loadScore ────────────────────────────────────────────────────────────

  const loadScore = useCallback(async (source: ScoreLoadSource): Promise<void> => {
    setOverlayStatus('loading');
    setErrorMessage(null);
    try {
      let file: File;

      if (source.kind === 'catalogue') {
        const preloaded = PRELOADED_SCORES.find(s => s.id === source.catalogueId);
        if (!preloaded) {
          throw new Error(`Unknown catalogue ID: "${source.catalogueId}"`);
        }
        const response = await fetch(preloaded.path);
        if (!response.ok) {
          throw new Error(`Failed to fetch score: HTTP ${response.status}`);
        }
        const blob = await response.blob();
        const fileName = preloaded.path.split('/').pop() ?? 'score.mxl';
        file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
      } else {
        file = source.file;
      }

      const service = new MusicXMLImportService();
      const result = await service.importFile(file);

      const parsedNotes = extractNotes(result.score);
      const parsedTempo = extractTempo(result.score);
      const parsedTimeSignature = extractTimeSignature(result.score);
      const parsedTitle =
        result.metadata.work_title ??
        result.metadata.file_name?.replace(/\.[^.]+$/, '') ??
        null;

      // Reset playback state for the new score
      playbackState.resetPlayback();

      setScore(result.score);
      setNotes(parsedNotes);
      setScoreTempo(parsedTempo);
      setScoreTimeSignature(parsedTimeSignature);
      setTitle(parsedTitle);
      setOverlayStatus(null); // reverts to playback-engine status ('stopped' → 'ready')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load score';
      setErrorMessage(message);
      setOverlayStatus('error');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [/* playbackState.resetPlayback is stable */]);

  // ─── Playback controls ────────────────────────────────────────────────────

  const play = useCallback((): Promise<void> => {
    return playbackState.play();
  }, [playbackState]);

  const pause = useCallback((): void => {
    playbackState.pause();
  }, [playbackState]);

  const stop = useCallback((): void => {
    playbackState.stop();
  }, [playbackState]);

  const seekToTick = useCallback((tick: number): void => {
    playbackState.seekToTick(tick);
  }, [playbackState]);

  // ─── Pin / loop ───────────────────────────────────────────────────────────

  const setPinnedStart = useCallback((tick: number | null): void => {
    playbackState.setPinnedStart(tick);
  }, [playbackState]);

  const setLoopEnd = useCallback((tick: number | null): void => {
    playbackState.setLoopEnd(tick);
  }, [playbackState]);

  // ─── Tempo ────────────────────────────────────────────────────────────────

  const setTempoMultiplierCb = useCallback((multiplier: number): void => {
    setTempoMultiplier(multiplier);
  }, [setTempoMultiplier]);

  // ─── subscribe ────────────────────────────────────────────────────────────

  const subscribe = useCallback(
    (handler: (state: ScorePlayerState) => void): () => void => {
      // Immediate synchronous call with current state
      handler(currentStateRef.current);
      subscribersRef.current.add(handler);
      return () => {
        subscribersRef.current.delete(handler);
      };
    },
    [] // stable — no deps; reads current state via ref
  );

  // ─── getCurrentTickLive ───────────────────────────────────────────────────

  const getCurrentTickLive = useCallback((): number => {
    return playbackState.tickSourceRef.current.currentTick;
  }, [playbackState.tickSourceRef]);

  // ─── extractPracticeNotes (v4) ──────────────────────────────────────────────────────

  const extractPracticeNotes = useCallback(
    (maxCount: number): PluginScorePitches | null => {
      // Only available when a score is fully loaded
      if (pluginStatus !== 'ready' || !score) return null;
      const result = extractPracticeNotesFromScore(score, maxCount);
      // Include the display title from the loaded score metadata
      return { ...result, title };
    },
    [pluginStatus, score, title],
  );

  // ─── Return the bridge object ─────────────────────────────────────────────

  const api = useMemo((): PluginScorePlayerContext => ({
    getCatalogue,
    loadScore,
    play,
    pause,
    stop,
    seekToTick,
    setPinnedStart,
    setLoopEnd,
    setTempoMultiplier: setTempoMultiplierCb,
    subscribe,
    getCurrentTickLive,
    extractPracticeNotes,
  }), [
    getCatalogue,
    loadScore,
    play,
    pause,
    stop,
    seekToTick,
    setPinnedStart,
    setLoopEnd,
    setTempoMultiplierCb,
    subscribe,
    getCurrentTickLive,
    extractPracticeNotes,
  ]);

  const internal = useMemo((): ScorePlayerInternal => ({
    score,
    notes,
    playbackStatus: playbackState.status,
    tickSourceRef: playbackState.tickSourceRef,
    highlightedNoteIds,
  }), [score, notes, playbackState.status, playbackState.tickSourceRef, highlightedNoteIds]);

  return useMemo((): ScorePlayerBridge => ({ api, internal }), [api, internal]);
}

// ---------------------------------------------------------------------------
// Public hook (T004 contract — tests call this directly)
// ---------------------------------------------------------------------------

/**
 * React hook that creates a PluginScorePlayerContext for the active plugin.
 *
 * Delegates to useScorePlayerBridge() and returns only the public API.
 * Must be called inside a component rendered within TempoStateProvider.
 *
 * @returns PluginScorePlayerContext — the full v3 score player API
 */
export function useScorePlayerContext(): PluginScorePlayerContext {
  return useScorePlayerBridge().api;
}

// ---------------------------------------------------------------------------
// No-op stub for v2 plugins
// ---------------------------------------------------------------------------

/**
 * Create a no-op stub PluginScorePlayerContext for v2 plugins.
 * All methods are no-ops; getCatalogue() returns an empty array;
 * subscribe() calls the handler immediately with an idle state and returns a
 * no-op unsubscribe function.
 */
export function createNoOpScorePlayer(): PluginScorePlayerContext {
  const idleState: ScorePlayerState = {
    status: 'idle' as const,
    currentTick: 0,
    totalDurationTicks: 0,
    highlightedNoteIds: new Set<string>(),
    bpm: 0,
    title: null,
    error: null,
    timeSignature: { numerator: 4, denominator: 4 },
  };

  return {
    getCatalogue: () => [],
    loadScore: async () => {},
    play: async () => {},
    pause: () => {},
    stop: () => {},
    seekToTick: () => {},
    setPinnedStart: () => {},
    setLoopEnd: () => {},
    setTempoMultiplier: () => {},
    subscribe: (handler) => {
      handler(idleState);
      return () => {};
    },
    getCurrentTickLive: () => 0,
    extractPracticeNotes: (_maxCount: number) => null,
  };
}

// ---------------------------------------------------------------------------
// Proxy factory for v3 context injection (T006)
// ---------------------------------------------------------------------------

/**
 * Creates a PluginScorePlayerContext proxy that delegates all calls to a ref.
 *
 * Used by App.tsx to inject a stable context object into plugin.init() that
 * can be "updated" by V3PluginWrapper without re-running init().
 * V3PluginWrapper sets proxyRef.current = bridge.api during render, so all
 * subsequent calls through the proxy go to the real hook-backed implementation.
 *
 * @param proxyRef - A ref whose `.current` is updated by V3PluginWrapper.
 */
export function createScorePlayerProxy(
  proxyRef: { current: PluginScorePlayerContext }
): PluginScorePlayerContext {
  return {
    getCatalogue: (...args) => proxyRef.current.getCatalogue(...args),
    loadScore: (...args) => proxyRef.current.loadScore(...args),
    play: (...args) => proxyRef.current.play(...args),
    pause: () => proxyRef.current.pause(),
    stop: () => proxyRef.current.stop(),
    seekToTick: (...args) => proxyRef.current.seekToTick(...args),
    setPinnedStart: (...args) => proxyRef.current.setPinnedStart(...args),
    setLoopEnd: (...args) => proxyRef.current.setLoopEnd(...args),
    setTempoMultiplier: (...args) => proxyRef.current.setTempoMultiplier(...args),
    subscribe: (...args) => proxyRef.current.subscribe(...args),
    getCurrentTickLive: (...args) => proxyRef.current.getCurrentTickLive(...args),
    extractPracticeNotes: (...args) => proxyRef.current.extractPracticeNotes(...args),
  };
}
