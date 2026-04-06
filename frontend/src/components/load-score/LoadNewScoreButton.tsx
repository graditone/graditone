import { useRef } from 'react';
import type { ChangeEvent } from 'react';
import { useImportMusicXML } from '../../hooks/useImportMusicXML';
import { useTranslation } from '../../i18n/index';
import type { ImportResult } from '../../services/import/MusicXMLImportService';

interface LoadNewScoreButtonProps {
  onImportComplete: (result: ImportResult) => void;
  disabled?: boolean;
  /** Called synchronously at the start of the file-change gesture, before any async work.
   * Use this to call requestFullscreen() while still inside the user-gesture window. */
  onWillLoad?: () => void;
}

/**
 * File-picker button for importing a local MusicXML file from within the dialog.
 * Reuses the same useImportMusicXML hook as ImportButton so behaviour is identical.
 * Feature 028: Load Score Dialog — User Story 4 (T020).
 */
export function LoadNewScoreButton({
  onImportComplete,
  disabled = false,
  onWillLoad,
}: LoadNewScoreButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();

  const { importFile, loading, error } = useImportMusicXML({
    onSuccess: (result) => {
      onImportComplete(result);
    },
  });

  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Call before the first await so we're still inside the browser's user-gesture window.
      // This allows requestFullscreen() to succeed (Safari/Firefox are strict about this).
      onWillLoad?.();
      await importFile(file);
    }
    // reset so the same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const isBusy = disabled || loading;

  return (
    <div className="load-new-score-wrapper">
      <input
        ref={fileInputRef}
        type="file"
        accept=".musicxml,.xml,.mxl"
        style={{ display: 'none' }}
        aria-label={t('load_score.file_input_aria')}
        onChange={handleFileChange}
      />
      <button
        className="load-new-score-button"
        onClick={handleButtonClick}
        disabled={isBusy}
        aria-label={t('load_score.load_from_file_aria')}
      >
        {loading ? t('load_score.importing') : t('load_score.load_from_file')}
      </button>
      {error && (
        <p className="load-new-score-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
