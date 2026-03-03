/**
 * PluginRemoverDialog — remove an installed (imported) plugin.
 *
 * Lists all user-imported plugins with a Remove button per entry.
 * Built-in plugins are excluded — they cannot be uninstalled.
 */

import { useState } from 'react';
import type { PluginManifest } from '../../plugin-api/index';
import { pluginRegistry } from '../../services/plugins/PluginRegistry';

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
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(2px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: '#fff',
          color: '#222',
          borderRadius: '10px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
          width: 'min(420px, 92vw)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {/* Header */}
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1a1a1a' }}>
            Remove Plugin
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.4rem',
              lineHeight: 1,
              cursor: 'pointer',
              color: '#666',
              padding: '2px 6px',
              borderRadius: '4px',
            }}
          >
            ×
          </button>
        </header>

        {/* Body */}
        {importedPlugins.length === 0 ? (
          <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
            No user-installed plugins found.
          </p>
        ) : (
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {importedPlugins.map((manifest) => (
              <li
                key={manifest.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  padding: '10px 12px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  background: '#fafafa',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {manifest.name}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#888' }}>
                    v{manifest.version} · {manifest.id}
                  </span>
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${manifest.name}`}
                  disabled={removing !== null}
                  onClick={() => handleRemove(manifest.id)}
                  style={{
                    flexShrink: 0,
                    padding: '6px 14px',
                    border: 'none',
                    borderRadius: '6px',
                    background: removing === manifest.id ? '#ccc' : '#e74c3c',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    cursor: removing !== null ? 'not-allowed' : 'pointer',
                    transition: 'background 0.15s',
                    minHeight: '32px',
                  }}
                >
                  {removing === manifest.id ? 'Removing…' : 'Remove'}
                </button>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p
            role="alert"
            style={{
              margin: 0,
              padding: '10px 12px',
              background: '#fff0f0',
              border: '1px solid #f5c6c6',
              borderRadius: '6px',
              color: '#c0392b',
              fontSize: '0.875rem',
            }}
          >
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
