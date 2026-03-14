import { useEffect, useRef, useState } from 'react';
import { PRELOADED_SCORES, PRELOADED_CATALOG } from '../../data/preloadedScores';
import type { PreloadedScore } from '../../data/preloadedScores';
import type { ImportResult } from '../../services/import/MusicXMLImportService';
import { useImportMusicXML } from '../../hooks/useImportMusicXML';
import { PreloadedScoreList } from './PreloadedScoreList';
import { ScoreGroupList } from './ScoreGroupList';
import { UserScoreList } from './UserScoreList';
import type { UserScore } from '../../services/userScoreIndex';
import { LoadNewScoreButton } from './LoadNewScoreButton';
import './LoadScoreDialog.css';

interface LoadScoreDialogProps {
  open: boolean;
  onClose: () => void;
  onImportComplete: (result: ImportResult) => void;
  /** Called synchronously at the very start of any load gesture (preset click or file select),
   * before async work begins. Use this to call requestFullscreen() while still inside the
   * browser's user-gesture window (Safari / Firefox require this). */
  onWillLoad?: () => void;
  /** Feature 045: User-uploaded scores to show under "My Scores" section. */
  userScores?: ReadonlyArray<UserScore>;
  /** Feature 045: Called when user selects one of their uploaded scores. */
  onSelectUserScore?: (id: string) => void;
  /** Feature 045: Called when user deletes one of their uploaded scores. */
  onDeleteUserScore?: (id: string) => void;
}

/**
 * Two-panel modal for selecting a preloaded or local score.
 * Left panel: list of bundled scores.
 * Right panel: "Load from file" button.
 *
 * Feature 028: Load Score Dialog — User Stories 2–5.
 */
export function LoadScoreDialog({
  open,
  onClose,
  onImportComplete,
  onWillLoad,
  userScores = [],
  onSelectUserScore,
  onDeleteUserScore,
}: LoadScoreDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [presetLoading, setPresetLoading] = useState(false);
  const [presetError, setPresetError] = useState<string | null>(null);
  // Keep track of the last selected score to support Retry
  const lastSelectedRef = useRef<PreloadedScore | null>(null);

  // Shared WASM import hook — onSuccess fires when parsing completes
  const { importFile, loading: wasmLoading, error: wasmError } = useImportMusicXML({
    onSuccess: (result: ImportResult) => {
      onImportComplete(result);
      onClose();
    },
  });

  const isBusy = presetLoading || wasmLoading;
  const displayError = presetError ?? wasmError ?? null;

  // Sync dialog open/close state to native <dialog>
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [open]);

  // Close dialog on native <dialog> cancel event (Escape key)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, [onClose]);

  /**
   * Load a preloaded score via fetch → Blob → File → WASM import pipeline.
   * Feature 028, US3 (T017).
   */
  const loadPresetScore = async (score: PreloadedScore) => {
    // Call before the first await so we're still inside the browser's user-gesture window.
    // This allows requestFullscreen() to succeed (Safari / Firefox are strict about this).
    onWillLoad?.();
    setSelectedId(score.id);
    setPresetError(null);
    setPresetLoading(true);
    lastSelectedRef.current = score;

    try {
      const response = await fetch(score.path);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const blob = await response.blob();
      const fileName = score.path.split('/').pop() ?? `${score.id}.mxl`;
      const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });

      // importFile completes asynchronously; onSuccess fires on completion
      await importFile(file);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[LoadScoreDialog] Failed to load ${score.displayName}:`, message);
      setPresetError(`Could not load "${score.displayName}". ${message}`);
    } finally {
      setPresetLoading(false);
    }
  };

  const handleRetry = () => {
    if (lastSelectedRef.current) {
      loadPresetScore(lastSelectedRef.current);
    }
  };

  const handleLocalImportComplete = (result: ImportResult) => {
    onImportComplete(result);
    onClose();
  };

  return (
    <dialog ref={dialogRef} className="load-score-dialog">
      <div className="load-score-dialog__header">
        <h2 className="load-score-dialog__title">Load Score</h2>
        <button
          className="load-score-dialog__close-btn"
          onClick={onClose}
          aria-label="Close"
          disabled={isBusy}
        >
          ✕
        </button>
      </div>

      <div className="load-score-dialog__body">
        {/* Left panel — preloaded scores */}
        <section className="load-score-dialog__panel load-score-dialog__panel--left">
          <h3 className="load-score-dialog__panel-heading">Preloaded Scores</h3>
          <PreloadedScoreList
            scores={PRELOADED_SCORES}
            selectedId={selectedId}
            disabled={isBusy}
            onSelect={loadPresetScore}
          />
          {/* Feature 001: Scales group — collapsible subfolder group */}
          {PRELOADED_CATALOG.groups.map((group) => (
            <ScoreGroupList
              key={group.id}
              group={group}
              selectedId={selectedId}
              disabled={isBusy}
              onSelect={loadPresetScore}
            />
          ))}
          {/* Feature 045: User-uploaded scores below built-in catalogue */}
          <UserScoreList
            scores={userScores}
            selectedId={selectedId}
            disabled={isBusy}
            onSelect={(score) => onSelectUserScore?.(score.id)}
            onDelete={(id) => onDeleteUserScore?.(id)}
          />
        </section>

        {/* Right panel — file picker */}
        <section className="load-score-dialog__panel load-score-dialog__panel--right">
          <LoadNewScoreButton
            onImportComplete={handleLocalImportComplete}
            disabled={isBusy}
            onWillLoad={onWillLoad}
          />
        </section>
      </div>

      {/* Status: loading spinner */}
      {isBusy && (
        <div className="load-score-dialog__status" role="status" aria-live="polite">
          Loading…
        </div>
      )}

      {/* Error message with Retry */}
      {displayError && !isBusy && (
        <div className="load-score-dialog__error" role="alert">
          <span>{displayError}</span>
          <button
            className="load-score-dialog__retry-btn"
            onClick={handleRetry}
            aria-label="Retry"
          >
            Retry
          </button>
        </div>
      )}

      <div className="load-score-dialog__footer">
        <button
          className="load-score-dialog__cancel-btn"
          onClick={onClose}
          disabled={isBusy}
        >
          Cancel
        </button>
      </div>
    </dialog>
  );
}
