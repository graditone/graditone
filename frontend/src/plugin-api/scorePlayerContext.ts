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
import type { PluginScorePlayerContext, PluginPreloadedScore, ScoreLoadSource, ScorePlayerState, PluginScorePitches, PluginPracticeNoteEntry } from './types';
import { usePlayback } from '../services/playback/MusicTimeline';import type { PlaybackStatus, ITickSource } from '../types/playback';
import { useTempoState } from '../services/state/TempoStateContext';
import { useNoteHighlight } from '../services/highlight/useNoteHighlight';
import { MusicXMLImportService } from '../services/import/MusicXMLImportService';
import { PRELOADED_CATALOG } from '../data/preloadedScores';
import type { PreloadedScore } from '../data/preloadedScores';
import { loadScoreFromIndexedDB, deleteScoreFromIndexedDB } from '../services/storage/local-storage';
import { ScoreCache } from '../services/score-cache';
import { addUserScore, getUserScore } from '../services/userScoreIndex';
import { getSchemaVersion } from '../services/wasm/music-engine';
import { computeRegionDifficulty } from '../services/wasm/music-engine';
import type { Note, Score } from '../types/score';
import type { TaggedNote } from '../types/playback';
import { expandNotesWithRepeats } from '../services/playback/RepeatNoteExpander';
import { ToneAdapter } from '../services/playback/ToneAdapter';
import { resolveInstrumentType } from '../services/playback/InstrumentTimbres';

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
  /** All notes extracted from the score (voice-0 of all staves). Expanded with repeats for playback. */
  notes: readonly Note[];
  /** Raw (unexpanded) notes — original ticks matching the layout engine's tick space. */
  rawNotes: readonly Note[];
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

/** All preloaded scores across ungrouped list and subfolder groups. */
const ALL_PRELOADED_SCORES: ReadonlyArray<PreloadedScore> = [
  ...PRELOADED_CATALOG.ungrouped,
  ...PRELOADED_CATALOG.groups.flatMap((g) => g.scores),
];

const CATALOGUE: ReadonlyArray<PluginPreloadedScore> = ALL_PRELOADED_SCORES.map(
  ({ id, displayName }) => ({ id, displayName } as const)
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
/**
 * Extract all notes from a Score, tagging each note with its 0-based instrument
 * part index (`_partIndex`) for multi-channel audio routing.
 * Feature 088: Piano and Violin Playback Support
 */
function extractTaggedNotes(score: Score): TaggedNote[] {
  const notes: TaggedNote[] = [];
  score.instruments.forEach((instrument, partIndex) => {
    for (const staff of instrument.staves) {
      for (const voice of staff.voices) {
        for (const note of voice.interval_events) {
          notes.push({ ...note, _partIndex: partIndex });
        }
      }
    }
  });
  return notes;
}

/**
 * Extract notes per staff from a Score (all voices merged), tagging each note
 * with its 0-based instrument part index (`_partIndex`) so audio routing still
 * works when a staff filter is active. Feature 088.
 * Returns an array indexed by staff position across all instruments.
 * Used to build per-staff expanded note lists for practice mode.
 */
function extractNotesByStaff(score: Score): Note[][] {
  const byStaff: Note[][] = [];
  score.instruments.forEach((instrument, partIndex) => {
    for (const staff of instrument.staves) {
      const allNotes: Note[] = [];
      for (const voice of staff.voices) {
        for (const note of voice.interval_events) {
          allNotes.push({ ...note, _partIndex: partIndex } as Note & { _partIndex: number });
        }
      }
      byStaff.push(allNotes);
    }
  });
  return byStaff;
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
  const [rawNotes, setRawNotes] = useState<Note[]>([]);
  /** Expanded notes per staff (indexed by staff position), used by extractPracticeNotes. */
  const [expandedNotesByStaff, setExpandedNotesByStaff] = useState<Note[][]>([]);
  const [scoreTempo, setScoreTempo] = useState<number>(120);
  const [scoreTimeSignature, setScoreTimeSignature] = useState<{ numerator: number; denominator: number }>({ numerator: 4, denominator: 4 });
  const [scorePickupTicks, setScorePickupTicks] = useState<number>(0);
  const [title, setTitle] = useState<string | null>(null);

  /**
   * Feature 083: When non-null, only notes from expandedNotesByStaff[playbackStaffFilter]
   * are fed to usePlayback/useNoteHighlight. internal.notes always holds the full set
   * for score rendering. Default null = all staves play.
   */
  const [playbackStaffFilter, setPlaybackStaffFilterState] = useState<number | null>(null);

  /** Overlay status for transitions the playback engine doesn't model */
  const [overlayStatus, setOverlayStatus] = useState<OverlayStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ─── Filtered notes for playback ─────────────────────────────────────────

  /**
   * Notes fed to the playback engine.  When playbackStaffFilter is set to a
   * valid staff index, only that staff's notes produce audio; all other staves
   * are silent.  Falls back to the full `notes` array when filter is null or
   * out-of-range (feature 083).
   */
  const filteredNotes = useMemo((): Note[] => {
    if (playbackStaffFilter === null) return notes;
    const staffNotes = expandedNotesByStaff[playbackStaffFilter];
    if (!staffNotes) return notes; // out-of-range: fall back to all notes
    return staffNotes;
  }, [notes, expandedNotesByStaff, playbackStaffFilter]);

  // ─── Playback engine ─────────────────────────────────────────────────────

  const playbackState = usePlayback(filteredNotes, scoreTempo);

  // ─── Feature 084: Restart playback when staff filter changes mid-play ────
  // usePlayback receives new notes but does NOT reschedule automatically.
  // We must seek to the current tick and call play() so Tone.js re-schedules
  // only the filtered notes.  Refs avoid adding fast-changing values to the
  // effect dep array (we only want to react to filteredNotes changes).
  const playbackStatusRef = useRef<string>('stopped');
  playbackStatusRef.current = playbackState.status;
  const currentTickLiveRef = useRef<number>(0);
  currentTickLiveRef.current = playbackState.currentTick;

  useEffect(() => {
    if (playbackStatusRef.current !== 'playing') return;
    const tick = currentTickLiveRef.current;
    // seekToTick clears the Tone.js schedule and stops audio, then play()
    // re-schedules using filteredNotes captured in its closure (new notes).
    playbackState.seekToTick(tick);
    void playbackState.play();
  // filteredNotes is the only trigger; seek/play refs are captured via ref.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredNotes]);

  // ─── Tempo context ───────────────────────────────────────────────────────

  const { tempoState, setTempoMultiplier, setOriginalTempo, resetTempo } = useTempoState();

  // ─── Note highlighting ────────────────────────────────────────────────────

  const highlightedNoteIds = useNoteHighlight(
    filteredNotes,
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

  const exactBpm = useMemo(
    () => scoreTempo * tempoState.tempoMultiplier,
    [scoreTempo, tempoState.tempoMultiplier]
  );
  const effectiveBpm = useMemo(
    () => Math.round(exactBpm),
    [exactBpm]
  );

  // ─── Subscribe system ─────────────────────────────────────────────────────

  const subscribersRef = useRef<Set<(state: ScorePlayerState) => void>>(new Set());
  const currentStateRef = useRef<ScorePlayerState>({
    status: 'idle',
    currentTick: 0,
    totalDurationTicks: 0,
    highlightedNoteIds: new Set<string>(),
    bpm: 0,
    exactBpm: 0,
    title: null,
    error: null,
    staffCount: 0,
    timeSignature: { numerator: 4, denominator: 4 },
    pickupTicks: 0,
  });

  // Notify all subscribers when state changes
  useEffect(() => {
    const staffCount = score ? (score.instruments[0]?.staves.length ?? 0) : 0;
    const newState: ScorePlayerState = {
      status: pluginStatus,
      currentTick: playbackState.currentTick,
      totalDurationTicks: playbackState.totalDurationTicks,
      highlightedNoteIds,
      bpm: effectiveBpm,
      exactBpm,
      title,
      error: errorMessage,
      staffCount,
      timeSignature: scoreTimeSignature,
      pickupTicks: scorePickupTicks,
    };
    currentStateRef.current = newState;
    subscribersRef.current.forEach(h => h(newState));
  }, [
    pluginStatus,
    playbackState.currentTick,
    playbackState.totalDurationTicks,
    highlightedNoteIds,
    effectiveBpm,
    exactBpm,
    title,
    errorMessage,
    score,
    scoreTimeSignature,
    scorePickupTicks,
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
      let scoreObject: Score | null = null;
      let parsedTitle: string | null = null;

      if (source.kind === 'catalogue') {
        const preloaded = ALL_PRELOADED_SCORES.find(s => s.id === source.catalogueId);
        if (!preloaded) {
          throw new Error(`Unknown catalogue ID: "${source.catalogueId}"`);
        }
        const response = await fetch(preloaded.path);
        if (!response.ok) {
          throw new Error(`Failed to fetch score: HTTP ${response.status}`);
        }
        const blob = await response.blob();
        const fileName = preloaded.path.split('/').pop() ?? 'score.mxl';
        const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
        const service = new MusicXMLImportService();
        const result = await service.importFile(file);
        scoreObject = result.score;
        parsedTitle = result.metadata?.work_title ?? null;
      } else if (source.kind === 'file') {
        const service = new MusicXMLImportService();
        const result = await service.importFile(source.file);
        scoreObject = result.score;
        parsedTitle = result.metadata?.work_title ?? null;

        // Feature 045: Persist uploaded score + raw blob to IndexedDB + metadata index
        const fileName = result.metadata?.file_name;
        const strippedName = fileName ? fileName.replace(/\.[^.]+$/, '') : null;
        const rawDisplayName = parsedTitle ?? strippedName;
        try {
          await ScoreCache.cache(scoreObject, result.rawFileBlob);
          if (rawDisplayName) {
            const { evictedIds } = addUserScore(scoreObject.id, rawDisplayName, scoreObject.difficulty_rating?.level);
            for (const evictedId of evictedIds) {
              deleteScoreFromIndexedDB(evictedId).catch(() => {});
            }
          }
        } catch {
          // Quota exceeded or storage error — don't block playback
        }
      } else {
        // Feature 045: Load user-uploaded score from IndexedDB.
        // If schema is stale but a raw MXL blob was stored, re-parse it.
        const schemaVersion = await getSchemaVersion();
        const loadResult = await loadScoreFromIndexedDB(source.scoreId, schemaVersion);

        if (loadResult.kind === 'loaded') {
          scoreObject = loadResult.score;
        } else if (loadResult.kind === 'stale') {
          // Re-parse from the stored raw MXL blob
          const blob = new Blob([loadResult.rawMxlBlob], { type: 'application/vnd.recordare.musicxml+xml' });
          const file = new File([blob], 'score.mxl', { type: blob.type });
          const service = new MusicXMLImportService();
          const result = await service.importFile(file);
          scoreObject = result.score;
          // Re-cache with the updated schema, preserving the raw blob
          await ScoreCache.cache(scoreObject, loadResult.rawMxlBlob);
          // Backfill difficulty level in user score index
          const diffLevel = scoreObject.difficulty_rating?.level;
          if (diffLevel !== undefined) {
            const { updateUserScoreDifficulty } = await import('../services/userScoreIndex');
            updateUserScoreDifficulty(source.scoreId, diffLevel);
          }
        }

        if (!scoreObject) {
          throw new Error(`User score not found in local storage: "${source.scoreId}"`);
        }
        // Retrieve title from user score metadata index
        const userScoreMeta = getUserScore(source.scoreId);
        parsedTitle = userScoreMeta?.displayName ?? null;
      }

      const extractedNotes = extractTaggedNotes(scoreObject);
      const parsedNotes = expandNotesWithRepeats(extractedNotes, scoreObject.repeat_barlines, scoreObject.volta_brackets);
      const parsedTempo = extractTempo(scoreObject);
      const parsedTimeSignature = extractTimeSignature(scoreObject);

      // Initialise per-instrument audio channels (Feature 088)
      const toneAdapter = ToneAdapter.getInstance();
      toneAdapter.destroyChannels();
      console.log('[scorePlayerContext] instruments:', scoreObject.instruments.map((inst, i) => {
        const resolved = resolveInstrumentType(inst.instrument_type, inst.name);
        return `${i}:name="${inst.name}" stored="${inst.instrument_type}" resolved="${resolved}"`;
      }));
      scoreObject.instruments.forEach((instrument, partIndex) => {
        const resolvedType = resolveInstrumentType(instrument.instrument_type, instrument.name);
        toneAdapter.initChannel(partIndex, resolvedType);
      });

      // Per-staff expanded notes — used by extractPracticeNotes so the
      // practice engine sees repeat-expanded ticks matching the playback engine.
      const rawNotesByStaff = extractNotesByStaff(scoreObject);
      const parsedNotesByStaff = rawNotesByStaff.map(staffNotes =>
        expandNotesWithRepeats(staffNotes, scoreObject!.repeat_barlines, scoreObject!.volta_brackets)
      );

      // Reset playback state for the new score
      playbackState.resetPlayback();

      setScore(scoreObject);
      setNotes(parsedNotes);
      setRawNotes(extractedNotes);
      setExpandedNotesByStaff(parsedNotesByStaff);
      setScoreTempo(parsedTempo);
      setOriginalTempo(parsedTempo);
      setScoreTimeSignature(parsedTimeSignature);
      setScorePickupTicks(scoreObject.pickup_ticks ?? 0);
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

  const snapToScoreTempoCb = useCallback((): void => {
    resetTempo();
  }, [resetTempo]);

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

  // ─── extractPracticeNotes (v6) ──────────────────────────────────────────────────────────────────────────

  const extractPracticeNotes = useCallback(
    (staffIndex: number, maxCount?: number): PluginScorePitches | null => {
      // Only available when a score is fully loaded
      if (pluginStatus !== 'ready' || !score) return null;

      // Use pre-expanded per-staff notes so the practice engine sees repeat-
      // expanded ticks that match the playback engine tick space.
      const staffNotes = expandedNotesByStaff[staffIndex] ?? expandedNotesByStaff[0] ?? [];

      // Feature 051: Exclude tie continuation notes — only independently-attacked notes
      // should appear as practice steps.
      const attackNotes = staffNotes.filter(n => !n.is_tie_continuation);

      // Group by start_tick; collect ALL pitches + note IDs at each tick (full chord).
      // durationTicks: take the maximum across chord notes (v7, feature 042).
      const tickMap = new Map<number, { midiPitches: number[]; noteIds: string[]; tick: number; durationTicks: number; sustainedPitches: number[]; sustainedNoteIds: string[]; hasStaccato: boolean }>();
      for (const note of attackNotes) {
        const existing = tickMap.get(note.start_tick);
        if (existing) {
          existing.midiPitches.push(note.pitch);
          existing.noteIds.push(note.id);
          existing.durationTicks = Math.max(existing.durationTicks, note.duration_ticks);
          if (note.staccato) existing.hasStaccato = true;
        } else {
          tickMap.set(note.start_tick, {
            midiPitches: [note.pitch],
            noteIds: [note.id],
            tick: note.start_tick,
            durationTicks: note.duration_ticks,
            sustainedPitches: [],
            sustainedNoteIds: [],
            hasStaccato: !!note.staccato,
          });
        }
      }

      // Multi-voice sustained-note pass: if a note's duration extends past a
      // later onset tick, merge its pitch into that onset's midiPitches so
      // the practice engine requires the sustained note to be held (e.g.
      // half-note G5 in voice 1 while eighth notes play in voice 2 →
      // G5 must be held alongside each eighth-note step).
      for (const note of staffNotes) {
        if (note.duration_ticks <= 0) continue;
        const noteEnd = note.start_tick + note.duration_ticks;
        for (const [tick, entry] of tickMap) {
          if (note.start_tick < tick && noteEnd > tick) {
            if (!entry.midiPitches.includes(note.pitch)) {
              entry.midiPitches.push(note.pitch);
              entry.noteIds.push(note.id);
            }
          }
        }
      }

      // Sort entries by tick, then truncate each entry's durationTicks to
      // the gap before the next entry so sustained notes don't block
      // advancement (e.g. G5 half alone should last 1/8 when E5 starts
      // after 1/8 in another voice).
      const sorted = [...tickMap.values()].sort((a, b) => a.tick - b.tick);
      for (let i = 0; i < sorted.length - 1; i++) {
        const gap = sorted[i + 1].tick - sorted[i].tick;
        if (gap > 0 && gap < sorted[i].durationTicks) {
          sorted[i].durationTicks = gap;
        }
      }

      // Staccato: no hold required — pitch-only validation (FR-004)
      for (const entry of sorted) {
        if (entry.hasStaccato) {
          entry.durationTicks = 0;
        }
      }

      const allEntries: PluginPracticeNoteEntry[] = sorted.map(e => ({
        midiPitches: e.midiPitches,
        sustainedPitches: e.sustainedPitches,
        noteIds: e.noteIds,
        tick: e.tick,
        durationTicks: e.durationTicks,
      }));
      const totalAvailable = allEntries.length;
      const notes = maxCount !== undefined ? allEntries.slice(0, maxCount) : allEntries;

      // Clef: read from score structure (unchanged from original)
      const instrument = score.instruments[0];
      const staff = instrument?.staves[staffIndex] ?? instrument?.staves[0];
      const rawClef = staff?.active_clef ?? 'Treble';
      const clef: 'Treble' | 'Bass' = rawClef === 'Bass' ? 'Bass' : 'Treble';

      return { notes, totalAvailable, clef, title };
    },
    [pluginStatus, score, expandedNotesByStaff, title],
  );

  // ─── getMeasureEndTicks (Feature 061) ─────────────────────────────────────

  const getMeasureEndTicks = useCallback(
    (): ReadonlyArray<number> | null => {
      if (!score || !score.measure_end_ticks || score.measure_end_ticks.length === 0) return null;
      return score.measure_end_ticks;
    },
    [score],
  );

  // ─── rawTickToExpandedTick (Feature 077) ──────────────────────────────────
  // Build a sorted table of (rawTick, offset) entries from rawNotes→notes ID matching.
  // Within each repeat section the offset is constant, so binary-searching the
  // nearest preceding entry gives the correct offset for arbitrary raw ticks
  // (including measure boundaries that don't coincide with note onsets).

  const rawToExpandedOffsets = useMemo(() => {
    if (!rawNotes.length || !notes.length) return null;
    const expandedById = new Map<string, number>();
    for (const n of notes) {
      if (!expandedById.has(n.id)) expandedById.set(n.id, n.start_tick);
    }
    const entries: { raw: number; offset: number }[] = [];
    const seen = new Set<number>();
    for (const n of rawNotes) {
      if (seen.has(n.start_tick)) continue;
      seen.add(n.start_tick);
      const exp = expandedById.get(n.id);
      if (exp !== undefined) entries.push({ raw: n.start_tick, offset: exp - n.start_tick });
    }
    entries.sort((a, b) => a.raw - b.raw);
    if (entries.every(e => e.offset === 0)) return null;
    return entries;
  }, [rawNotes, notes]);

  const rawTickToExpandedTick = useCallback(
    (rawTick: number): number => {
      if (!rawToExpandedOffsets || rawToExpandedOffsets.length === 0) return rawTick;
      let lo = 0, hi = rawToExpandedOffsets.length - 1, best = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (rawToExpandedOffsets[mid].raw <= rawTick) { best = mid; lo = mid + 1; }
        else hi = mid - 1;
      }
      const offset = best >= 0 ? rawToExpandedOffsets[best].offset : rawToExpandedOffsets[0].offset;
      return rawTick + offset;
    },
    [rawToExpandedOffsets],
  );

  // ─── getPhrases (Feature 067) ─────────────────────────────────────────────

  const getPhrases = useCallback(
    (): ReadonlyArray<import('../types/score').PhraseRegion> | null => {
      if (!score) return null;
      return score.phrases ?? [];
    },
    [score],
  );

  const getRegionDifficulty = useCallback(
    (startMeasure: number, endMeasure: number, staffIndex: number): import('../types/score').DifficultyRating | null => {
      if (!score) { console.warn('[scorePlayer] getRegionDifficulty: no score loaded'); return null; }
      try {
        const result = computeRegionDifficulty(score, startMeasure, endMeasure, staffIndex);
        return result;
      } catch (error) {
        console.error('[scorePlayer] getRegionDifficulty FAILED:', error);
        return null;
      }
    },
    [score],
  );

  /** Load a catalogue score ad-hoc (no React state change) and compute difficulty. */
  const getRegionDifficultyForScore = useCallback(    async (catalogueId: string, startMeasure: number | null, endMeasure: number | null, staffIndex: number): Promise<import('../types/score').DifficultyRating | null> => {
      const preloaded = ALL_PRELOADED_SCORES.find(s => s.id === catalogueId);
      if (!preloaded) return null;
      try {
        const response = await fetch(preloaded.path);
        if (!response.ok) return null;
        const blob = await response.blob();
        const fileName = preloaded.path.split('/').pop() ?? 'score.mxl';
        const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
        const service = new MusicXMLImportService();
        const result = await service.importFile(file);
        const measureCount = result.score.measure_end_ticks?.length ?? 0;
        if (measureCount === 0) return null;
        const start = startMeasure ?? 0;
        const end = endMeasure ?? (measureCount - 1);
        return computeRegionDifficulty(result.score, start, end, staffIndex) ?? null;
      } catch (error) {
        console.error('[scorePlayer] getRegionDifficultyForScore FAILED:', error);
        return null;
      }
    },
    [],
  );

  // ─── setPlaybackStaffFilter (Feature 083) ────────────────────────────────

  /**
   * Set the staff index whose notes are fed to the playback engine.
   * Pass null to restore full (all-staves) playback.
   */
  const setPlaybackStaffFilter = useCallback((staffIndex: number | null): void => {
    setPlaybackStaffFilterState(staffIndex);
  }, []);

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
    snapToScoreTempo: snapToScoreTempoCb,
    subscribe,
    getCurrentTickLive,
    extractPracticeNotes,
    getMeasureEndTicks,
    rawTickToExpandedTick,
    getPhrases,
    getRegionDifficulty,
    getRegionDifficultyForScore,
    setPlaybackStaffFilter,
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
    snapToScoreTempoCb,
    subscribe,
    getCurrentTickLive,
    extractPracticeNotes,
    getMeasureEndTicks,
    rawTickToExpandedTick,
    getPhrases,
    getRegionDifficulty,
    getRegionDifficultyForScore,
    setPlaybackStaffFilter,
  ]);

  const internal = useMemo((): ScorePlayerInternal => ({
    score,
    notes,
    rawNotes,
    playbackStatus: playbackState.status,
    tickSourceRef: playbackState.tickSourceRef,
    highlightedNoteIds,
  }), [score, notes, rawNotes, playbackState.status, playbackState.tickSourceRef, highlightedNoteIds]);

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
    exactBpm: 0,
    title: null,
    error: null,
    staffCount: 0,
    timeSignature: { numerator: 4, denominator: 4 },
    pickupTicks: 0,
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
    snapToScoreTempo: () => {},
    subscribe: (handler) => {
      handler(idleState);
      return () => {};
    },
    getCurrentTickLive: () => 0,
    extractPracticeNotes: (_staffIndex: number, _maxCount?: number) => null,
    getMeasureEndTicks: () => null,
    rawTickToExpandedTick: (rawTick: number) => rawTick,
    getPhrases: () => null,
    getRegionDifficulty: () => null,
    getRegionDifficultyForScore: async () => null,
    setPlaybackStaffFilter: (_staffIndex: number | null) => {},
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
    snapToScoreTempo: () => proxyRef.current.snapToScoreTempo(),
    subscribe: (...args) => proxyRef.current.subscribe(...args),
    getCurrentTickLive: (...args) => proxyRef.current.getCurrentTickLive(...args),
    extractPracticeNotes: (...args) => proxyRef.current.extractPracticeNotes(...args),
    getMeasureEndTicks: () => proxyRef.current.getMeasureEndTicks(),
    rawTickToExpandedTick: (...args) => proxyRef.current.rawTickToExpandedTick(...args),
    getPhrases: () => proxyRef.current.getPhrases(),
    getRegionDifficulty: (...args) => proxyRef.current.getRegionDifficulty(...args),
    getRegionDifficultyForScore: (...args) => proxyRef.current.getRegionDifficultyForScore(...args),
    setPlaybackStaffFilter: (...args) => proxyRef.current.setPlaybackStaffFilter(...args),
  };
}
