import { useState, useEffect, useCallback, useMemo } from "react";
import type { Score, Note } from "../types/score";
import { InstrumentList } from "./InstrumentList";
import { useFileState } from "../services/state/FileStateContext";
import type { ImportResult } from "../services/import/MusicXMLImportService";
import { MusicXMLImportService } from "../services/import/MusicXMLImportService";
import { loadScoreFromIndexedDB } from "../services/storage/local-storage";
import { LoadScoreDialog } from "./load-score/LoadScoreDialog";
import { PRELOADED_SCORES } from "../data/preloadedScores";
import { LandingScreen } from "./LandingScreen";
import { DesignNavbar } from "./DesignNavbar";
import { LANDING_THEMES, getThemeById } from "../themes/landing-themes";
import { usePlayback } from "../services/playback/MusicTimeline";
import { expandNotesWithRepeats } from "../services/playback/RepeatNoteExpander";
import { useTempoState } from "../services/state/TempoStateContext";
import "./ScoreViewer.css";

interface ScoreViewerProps {
  scoreId?: string;
  /** Debug mode: shows Record View button when true */
  debugMode?: boolean;
  /** Called when Record View button is pressed (only relevant when debugMode=true) */
  onShowRecording?: () => void;
  /** Core plugins to feature on the landing screen (type === 'core'). */
  corePlugins?: Array<{ id: string; name: string; icon?: string }>;
  /** Called when the user launches a core plugin from the landing screen. */
  onLaunchPlugin?: (pluginId: string) => void;
  /** Feature 039: Active landing theme id — managed by App.tsx */
  activeThemeId?: string;
  /** Feature 039: Called when the user selects a different design variant */
  onThemeChange?: (themeId: string) => void;
  /** Feature 039: Easter-egg — show theme navbar only when a theme hash is in the URL */
  showThemeNavbar?: boolean;
}

/**
 * ScoreViewer - Main component for displaying and interacting with a musical score.
 *
 * Renders either the animated landing screen (no score loaded) or the instruments
 * list view (score loaded). The full-screen play view has moved to the Play Score
 * core plugin (feature 033).
 *
 * Features:
 * - Load existing scores by ID from IndexedDB
 * - Import scores from MusicXML files via the Load Score dialog
 * - Display full score hierarchy (instruments, staves, voices, notes)
 * - Show structural events (tempo, time signature) in the header
 * - Error handling and loading states
 *
 * @example
 * ```tsx
 * <ScoreViewer scoreId="123e4567-e89b-12d3-a456-426614174000" />
 * ```
 */
export function ScoreViewer({
  scoreId: initialScoreId,
  debugMode = false,
  onShowRecording,
  corePlugins,
  onLaunchPlugin,
  activeThemeId = 'ember',
  onThemeChange,
  showThemeNavbar = false,
}: ScoreViewerProps) {
  const [score, setScore] = useState<Score | null>(null);
  const [scoreId, setScoreId] = useState<string | undefined>(initialScoreId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [skipNextLoad, setSkipNextLoad] = useState(false);
  const [isFileSourced, setIsFileSourced] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // ── Feature 039: Theme handled by App.tsx — use provided prop ───────────
  const handleThemeChange = useCallback((themeId: string) => {
    onThemeChange?.(themeId);
  }, [onThemeChange]);
  const [scoreTitle, setScoreTitle] = useState<string | null>(null);

  // File state management (Feature 004 - Score File Persistence)
  const { fileState, resetFileState } = useFileState();

  /** Unload the score to return to the landing page. */
  const handleReturnToView = useCallback(() => {
    setScore(null);
    setScoreId(undefined);
    setScoreTitle(null);
    setIsFileSourced(false);
  }, []);

  // ── Playback ─────────────────────────────────────────────────────────────────

  /** Flatten all notes from voice 0 of every staff (mirrors LayoutView). */
  const allNotes = useMemo((): Note[] => {
    if (!score) return [];
    const rawNotes: Note[] = [];
    for (const instrument of score.instruments) {
      for (const staff of instrument.staves) {
        const firstVoice = staff.voices[0];
        if (firstVoice) rawNotes.push(...firstVoice.interval_events);
      }
    }
    return expandNotesWithRepeats(rawNotes, score.repeat_barlines);
  }, [score]);

  const initialTempo = (() => {
    if (!score) return 120;
    for (const event of score.global_structural_events) {
      if ("Tempo" in event && event.Tempo.tick === 0) return event.Tempo.bpm;
    }
    return 120;
  })();

  const playbackState = usePlayback(allNotes, initialTempo);
  const { tempoState } = useTempoState();

  // Pause when the browser tab is hidden.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && playbackState.status === 'playing') playbackState.pause();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [playbackState]);

  // Stop playback when the score is unloaded.
  useEffect(() => {
    if (!score) playbackState.resetPlayback();
  }, [score]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Load a score by ID.
   * Feature 013: Try IndexedDB first (for demo scores).
   * Feature 025: Offline Mode — IndexedDB only, no REST API fallback.
   */
  const loadScore = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const indexedDBScore = await loadScoreFromIndexedDB(id);
      if (indexedDBScore) {
        console.log(`[ScoreViewer] Loaded score from IndexedDB: ${id}`);
        setScore(indexedDBScore);
        setScoreTitle(indexedDBScore.instruments[0]?.name ?? null);
        setIsFileSourced(false);
        return;
      }
      console.log(`[ScoreViewer] Score not found in IndexedDB: ${id}`);
      throw new Error("Score not found in local storage. Import a MusicXML file or load the demo.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load score");
      setScore(null);
    } finally {
      setLoading(false);
    }
  };

  // Load score when scoreId changes (only for backend-sourced scores)
  useEffect(() => {
    if (scoreId && !skipNextLoad && !isFileSourced) {
      loadScore(scoreId);
    }
    if (skipNextLoad) {
      setSkipNextLoad(false);
    }
  }, [scoreId, skipNextLoad, isFileSourced]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Handle successful MusicXML import (Feature 006 / Feature 011).
   * WASM parsing creates an in-memory score (not persisted to the backend DB).
   */
  const handleMusicXMLImport = (result: ImportResult) => {
    setScore(result.score);
    setScoreId(result.score.id);
    setIsFileSourced(true);
    resetFileState();

    // Feature 022: Set score title from metadata (work_title > filename fallback)
    const fileName = result.metadata.file_name;
    const strippedName = fileName ? fileName.replace(/\.[^.]+$/, '') : null;
    setScoreTitle(result.metadata.work_title ?? strippedName ?? null);

    setSuccessMessage(
      `Imported ${result.statistics.note_count} notes from ${result.metadata.file_name || 'MusicXML file'}`
    );
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  /**
   * Debug: auto-load the first preloaded score and open in instruments view.
   * Only wired when debugMode=true.
   */
  const handleAutoLoadInstruments = async () => {
    const preset = PRELOADED_SCORES[0]; // Bach — Invention No. 1
    try {
      const response = await fetch(preset.path);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const fileName = preset.path.split('/').pop() ?? 'score.mxl';
      const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
      const importResult = await new MusicXMLImportService().importFile(file);
      handleMusicXMLImport(importResult);
    } catch (err) {
      console.error('[ScoreViewer] Debug auto-load instruments failed:', err);
      setError('Debug auto-load failed. Check the console for details.');
    }
  };

  /** Handle import completion from the Load Score dialog. */
  const handleDialogImportComplete = (result: ImportResult) => {
    handleMusicXMLImport(result);
    setDialogOpen(false);
  };

  /** Get time signature string at tick 0 for display in the score header. */
  const getInitialTimeSignature = (): string => {
    if (!score) return "4/4";
    for (const event of score.global_structural_events) {
      if ("TimeSignature" in event && event.TimeSignature.tick === 0) {
        const ts = event.TimeSignature;
        return `${ts.numerator}/${ts.denominator}`;
      }
    }
    return "4/4";
  };

  // ── Loading state ────────────────────────────────────────────────────────────

  if (loading && !score) {
    return (
      <div className="score-viewer">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  // ── Landing screen (no score loaded) ────────────────────────────────────────

  if (!score) {
    const activeTheme = getThemeById(activeThemeId);
    const noteColors = [
      activeTheme.palette.noteColor1,
      activeTheme.palette.noteColor2,
      activeTheme.palette.noteColor3,
    ] as const;

    return (
      <div className="score-viewer">
        {showThemeNavbar && (
          <DesignNavbar
            themes={LANDING_THEMES}
            activeThemeId={activeThemeId}
            onThemeChange={handleThemeChange}
          />
        )}
        <LandingScreen
          onShowInstruments={debugMode ? handleAutoLoadInstruments : undefined}
          corePlugins={corePlugins}
          onLaunchPlugin={onLaunchPlugin}
          activeThemeId={activeThemeId}
          noteColors={noteColors}
        />
        {error && <div className="error">{error}</div>}
        {successMessage && <div className="success">{successMessage}</div>}
      </div>
    );
  }

  // ── Instruments view (score loaded) ─────────────────────────────────────────

  return (
    <div className="score-viewer">
      <div className="score-header">
        <h1
          title={scoreTitle ?? undefined}
          style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {scoreTitle ?? 'Score'}{' '}
          {fileState.isModified && <span className="unsaved-indicator">*</span>}
        </h1>
        <div className="score-info">
          <span className="score-id">ID: {score.id}</span>
          <span className="tempo">Tempo: {initialTempo} BPM</span>
          <span className="time-sig">Time: {getInitialTimeSignature()}</span>
        </div>
      </div>

      <div className="score-toolbar">
        <div className="toolbar-left">
          <button
            className="score-viewer__back-btn"
            onClick={handleReturnToView}
            aria-label="Back to landing page"
          >
            ← Back
          </button>
        </div>
        <div className="toolbar-right">
          <button
            className="score-viewer__load-btn"
            onClick={() => setDialogOpen(true)}
            aria-label="Load Score"
          >
            Load Score
          </button>
          {debugMode && (
            <button
              className="record-view-debug-btn"
              onClick={onShowRecording}
              aria-label="Record View"
            >
              Record View
            </button>
          )}
        </div>
      </div>

      {/* Playback controls */}
      <div className="score-playback-bar">
        {playbackState.status === 'playing' ? (
          <button className="playback-btn playback-btn--pause" onClick={playbackState.pause} aria-label="Pause">
            ⏸ Pause
          </button>
        ) : (
          <button
            className="playback-btn playback-btn--play"
            onClick={() => { playbackState.play(); }}
            disabled={allNotes.length === 0}
            aria-label="Play"
          >
            ▶ Play
          </button>
        )}
        <button
          className="playback-btn playback-btn--stop"
          onClick={playbackState.stop}
          disabled={playbackState.status === 'stopped'}
          aria-label="Stop"
        >
          ⏹ Stop
        </button>
        <span className="playback-tempo">
          {Math.round(initialTempo * tempoState.tempoMultiplier)} BPM
        </span>
        {playbackState.error && (
          <span className="playback-error">{playbackState.error}</span>
        )}
      </div>

      {error && <div className="error">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}

      {score.instruments.length === 0 ? (
        <div className="no-instruments">
          <p>This score has no instruments. Try importing a MusicXML file or loading the demo.</p>
        </div>
      ) : (
        <InstrumentList
          instruments={score.instruments}
          scoreId={scoreId}
          currentTick={playbackState.currentTick}
          playbackStatus={playbackState.status}
          onSeekToTick={playbackState.seekToTick}
          onUnpinStartTick={playbackState.unpinStartTick}
          onUpdate={(id) => {
            if (id) {
              loadScore(id);
            } else if (!isFileSourced && scoreId) {
              loadScore(scoreId);
            }
          }}
          onScoreCreated={(id) => {
            setSkipNextLoad(true);
            setScoreId(id);
          }}
        />
      )}

      <LoadScoreDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onImportComplete={handleDialogImportComplete}
      />
    </div>
  );
}
