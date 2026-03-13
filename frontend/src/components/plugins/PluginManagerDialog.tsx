/**
 * PluginManagerDialog — T019 / Feature 048: Plugin Manager Dialog
 *
 * Thin wrapper over the reusable ListDialog. Adds plugin-specific logic:
 *   - Remove handler (async, with inline error)
 *   - Import state machine (file input, duplicate-overwrite, error recovery)
 *
 * Layout is fully delegated to ListDialog (header, scrollable list, footer slot).
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { PluginManifest, ListDialogItem } from '../../plugin-api/index';
import { importPlugin } from '../../services/plugins/PluginImporter';
import { pluginRegistry } from '../../services/plugins/PluginRegistry';
import { ListDialog } from './ListDialog';
import './PluginManagerDialog.css';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PluginManagerDialogProps {
  /** Only user-imported plugins (origin === 'imported'). */
  importedPlugins: PluginManifest[];
  /** Called when a plugin is successfully removed. */
  onRemoveComplete: (removedId: string) => void;
  /** Called when a plugin is successfully imported. */
  onImportComplete: (manifest: PluginManifest) => void;
  /** Called to close the dialog. */
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PluginManagerDialog({
  importedPlugins,
  onRemoveComplete,
  onImportComplete,
  onClose,
}: PluginManagerDialogProps) {
  // ── Remove state ─────────────────────────────────────────────────────
  const [removing, setRemoving] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  // ── Import state ─────────────────────────────────────────────────────
  const [importPhase, setImportPhase] = useState<'idle' | 'loading' | 'error' | 'duplicate'>('idle');
  const [importError, setImportError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingManifest, setPendingManifest] = useState<PluginManifest | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Map plugins → ListDialogItem[] ───────────────────────────────────
  const items: ListDialogItem[] = useMemo(
    () => importedPlugins.map((m) => ({
      id: m.id,
      label: removing === m.id ? `${m.name} (removing…)` : m.name,
      actionLabel: 'Remove',
    })),
    [importedPlugins, removing],
  );

  // ── Remove handler (wired to ListDialog onAction) ────────────────────
  const handleAction = useCallback(async (id: string) => {
    if (removing) return;
    setRemoving(id);
    setRemoveError(null);
    try {
      await pluginRegistry.remove(id);
      onRemoveComplete(id);
    } catch (e) {
      setRemoveError(`Failed to remove plugin: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRemoving(null);
    }
  }, [removing, onRemoveComplete]);

  // ── Import handlers ──────────────────────────────────────────────────
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportPhase('loading');
    setImportError(null);
    setPendingFile(file);

    const result = await importPlugin(file, pluginRegistry);

    if (result.success) {
      setImportPhase('idle');
      setPendingFile(null);
      onImportComplete(result.manifest);
      if (inputRef.current) inputRef.current.value = '';
    } else if ((result as { duplicate?: boolean }).duplicate) {
      const dup = result as { duplicate: true; manifest: PluginManifest };
      setImportPhase('duplicate');
      setPendingManifest(dup.manifest);
    } else {
      setImportPhase('error');
      setImportError((result as { error?: string }).error ?? 'Unknown error.');
      if (inputRef.current) inputRef.current.value = '';
    }
  }, [onImportComplete]);

  const handleReplace = useCallback(async () => {
    if (!pendingFile) return;
    setImportPhase('loading');
    setImportError(null);

    const result = await importPlugin(pendingFile, pluginRegistry, { overwrite: true });
    if (result.success) {
      setImportPhase('idle');
      setPendingFile(null);
      setPendingManifest(null);
      onImportComplete(result.manifest);
      if (inputRef.current) inputRef.current.value = '';
    } else {
      setImportPhase('error');
      setImportError((result as { error?: string }).error ?? 'Unknown error.');
      if (inputRef.current) inputRef.current.value = '';
    }
  }, [pendingFile, onImportComplete]);

  const handleCancelDuplicate = useCallback(() => {
    setImportPhase('idle');
    setImportError(null);
    setPendingFile(null);
    setPendingManifest(null);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  // ── Build footer content ─────────────────────────────────────────────
  const footer = (
    <>
      {/* Remove error */}
      {removeError && (
        <p role="alert" className="plugin-manager-dialog__error">{removeError}</p>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept=".zip"
        onChange={handleFileChange}
        className="plugin-manager-dialog__file-input--hidden"
        aria-label="Select plugin ZIP file"
        tabIndex={-1}
      />

      {importPhase === 'idle' && (
        <button
          type="button"
          className="plugin-manager-dialog__import-btn"
          onClick={() => inputRef.current?.click()}
          aria-label="Import Plugin"
        >
          📂 Import Plugin…
        </button>
      )}

      {importPhase === 'loading' && (
        <p aria-live="polite" className="plugin-manager-dialog__status">Installing plugin…</p>
      )}

      {importPhase === 'error' && (
        <>
          <p role="alert" className="plugin-manager-dialog__error">{importError}</p>
          <button
            type="button"
            className="plugin-manager-dialog__import-btn"
            onClick={() => { setImportPhase('idle'); setImportError(null); inputRef.current?.click(); }}
            aria-label="Import Plugin"
          >
            📂 Try Again…
          </button>
        </>
      )}

      {importPhase === 'duplicate' && pendingManifest && (
        <div role="alert">
          <p className="plugin-manager-dialog__confirm-text">
            A plugin named <strong>&ldquo;{pendingManifest.name}&rdquo;</strong> is already installed. Replace it?
          </p>
          <div className="plugin-manager-dialog__confirm-actions">
            <button type="button" onClick={handleCancelDuplicate} className="plugin-manager-dialog__btn">
              Cancel
            </button>
            <button type="button" onClick={handleReplace} className="plugin-manager-dialog__btn plugin-manager-dialog__btn--danger">
              Yes, Replace
            </button>
          </div>
        </div>
      )}
    </>
  );

  return (
    <ListDialog
      title="Manage Plugins"
      items={items}
      onAction={handleAction}
      onClose={onClose}
      emptyMessage="No plugins installed yet."
      footer={footer}
    />
  );
}
