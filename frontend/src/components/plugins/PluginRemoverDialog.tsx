/**
 * PluginRemoverDialog — remove an installed (imported) plugin.
 *
 * Lists all user-imported plugins with a Remove button per entry.
 * Built-in plugins are excluded — they cannot be uninstalled.
 */

import { useState } from 'react';
import type { PluginManifest } from '../../plugin-api/index';
import { pluginRegistry } from '../../services/plugins/PluginRegistry';
import './plugin-dialog.css';

export interface PluginRemoverDialogProps {
  /** Only user-imported plugins (origin === 'imported'). */
  importedPlugins: PluginManifest[];
  onRemoveComplete: (removedId: string) => void;
  onClose: () => void;
}

export function PluginRemoverDialog({
  importedPlugins,
  onRemoveComplete,
  onClose,
}: PluginRemoverDialogProps) {
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRemove(id: string) {
    setRemoving(id);
    setError(null);
    try {
      await pluginRegistry.remove(id);
      onRemoveComplete(id);
    } catch (e) {
      setError(`Failed to remove plugin: ${e instanceof Error ? e.message : String(e)}`);
      setRemoving(null);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Remove Plugin"
      className="plugin-dialog-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="plugin-dialog">
        {/* Header */}
        <header className="plugin-dialog__header">
          <h2 className="plugin-dialog__title">Remove Plugin</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="plugin-dialog__close"
          >
            ×
          </button>
        </header>

        {/* Body */}
        {importedPlugins.length === 0 ? (
          <p className="plugin-dialog__empty">No user-installed plugins found.</p>
        ) : (
          <ul className="plugin-dialog__list">
            {importedPlugins.map((manifest) => (
              <li key={manifest.id} className="plugin-dialog__item">
                <div className="plugin-dialog__item-info">
                  <span className="plugin-dialog__item-name">{manifest.name}</span>
                  <span className="plugin-dialog__item-meta">v{manifest.version} · {manifest.id}</span>
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${manifest.name}`}
                  disabled={removing !== null}
                  onClick={() => handleRemove(manifest.id)}
                  className="plugin-dialog__btn plugin-dialog__btn--danger"
                >
                  {removing === manifest.id ? 'Removing…' : 'Remove'}
                </button>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p role="alert" className="plugin-dialog__message plugin-dialog__message--error">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
