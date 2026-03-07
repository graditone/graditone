/**
 * PluginImporterDialog — T023
 * Feature 030: Plugin Architecture (US2 — Import a Third-Party Plugin)
 *
 * Modal dialog for importing a third-party plugin from a ZIP file.
 *
 * States:
 *  idle     — waiting for the user to choose a file
 *  loading  — ZIP is being processed
 *  success  — plugin imported successfully
 *  error    — import rejected (validation, size, etc.)
 *  duplicate — plugin id already installed; waits for user confirmation
 */

import React, { useRef, useState } from 'react';
import type { PluginManifest } from '../../plugin-api/index';
import { importPlugin } from '../../services/plugins/PluginImporter';
import { pluginRegistry } from '../../services/plugins/PluginRegistry';
import './plugin-dialog.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DialogState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'success'; manifest: PluginManifest }
  | { phase: 'error'; message: string }
  | { phase: 'duplicate'; manifest: PluginManifest; pendingFile: File };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface PluginImporterDialogProps {
  onImportComplete: (manifest: PluginManifest) => void;
  onClose: () => void;
}

export function PluginImporterDialog({
  onImportComplete,
  onClose,
}: PluginImporterDialogProps) {
  const [state, setState] = useState<DialogState>({ phase: 'idle' });
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── File selection ─────────────────────────────────────────────────────

  async function handleFile(file: File) {
    setState({ phase: 'loading' });

    const result = await importPlugin(file, pluginRegistry);

    if (result.success) {
      setState({ phase: 'success', manifest: result.manifest });
      onImportComplete(result.manifest);
    } else if ((result as { duplicate?: boolean }).duplicate) {
      const dup = result as { duplicate: true; manifest: PluginManifest };
      setState({ phase: 'duplicate', manifest: dup.manifest, pendingFile: file });
    } else {
      setState({ phase: 'error', message: (result as { error?: string }).error ?? 'Unknown error.' });
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      handleFile(file);
    }
  }

  // ── Duplicate confirmation ─────────────────────────────────────────────

  async function handleReplace() {
    if (state.phase !== 'duplicate') return;
    const { pendingFile } = state;
    setState({ phase: 'loading' });

    const result = await importPlugin(pendingFile, pluginRegistry, { overwrite: true });
    if (result.success) {
      setState({ phase: 'success', manifest: result.manifest });
      onImportComplete(result.manifest);
    } else {
      setState({ phase: 'error', message: (result as { error?: string }).error ?? 'Unknown error.' });
    }
  }

  function handleCancelDuplicate() {
    setState({ phase: 'idle' });
    setFileName(null);
    // Reset file input so the same file can be re-selected
    if (inputRef.current) inputRef.current.value = '';
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Import Plugin"
      className="plugin-dialog-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="plugin-dialog">
        <header className="plugin-dialog__header">
          <h2 className="plugin-dialog__title">Import Plugin</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="plugin-dialog__close"
          >
            ×
          </button>
        </header>

        <div className="plugin-dialog__body">
          {/* ── File picker ─────────────────────────────────────────────── */}
          {(state.phase === 'idle' || state.phase === 'error') && (
            <>
              {/* Hidden native input keeps testid for tests and handles the OS picker */}
              <input
                ref={inputRef}
                id="plugin-file-input"
                data-testid="plugin-file-input"
                type="file"
                accept=".zip"
                onChange={handleInputChange}
                className="plugin-dialog__file-input--hidden"
                aria-hidden="true"
                tabIndex={-1}
              />
              <div className="plugin-dialog__pick-row">
                <button
                  type="button"
                  className="plugin-dialog__btn plugin-dialog__btn--pick"
                  onClick={() => inputRef.current?.click()}
                >
                  📂 Choose ZIP file…
                </button>
                {fileName && (
                  <span className="plugin-dialog__filename" title={fileName}>{fileName}</span>
                )}
              </div>
              {state.phase === 'error' && (
                <p role="alert" className="plugin-dialog__message plugin-dialog__message--error">
                  {state.message}
                </p>
              )}
            </>
          )}

          {/* ── Loading ─────────────────────────────────────────────────── */}
          {state.phase === 'loading' && (
            <p aria-live="polite" className="plugin-dialog__status">Installing plugin…</p>
          )}

          {/* ── Success ─────────────────────────────────────────────────── */}
          {state.phase === 'success' && (
            <p role="status" className="plugin-dialog__message plugin-dialog__message--success">
              ✓ "{state.manifest.name}" imported successfully!
            </p>
          )}

          {/* ── Duplicate confirm ────────────────────────────────────────── */}
          {state.phase === 'duplicate' && (
            <div role="alert" className="plugin-dialog__confirm">
              <p className="plugin-dialog__confirm-text">
                A plugin named <strong>"{state.manifest.name}"</strong> is already installed.
                Replace it?
              </p>
              <div className="plugin-dialog__actions">
                <button type="button" onClick={handleCancelDuplicate} className="plugin-dialog__btn">
                  Cancel
                </button>
                <button type="button" onClick={handleReplace} className="plugin-dialog__btn plugin-dialog__btn--danger">
                  Replace
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
