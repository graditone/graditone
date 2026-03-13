/**
 * ListDialog — T017 / Feature 048: Reusable List Dialog
 *
 * Purely data-driven presentational component for a single-panel list dialog.
 * Used internally by PluginManagerDialog (which adds plugin-specific logic on top)
 * and exposed to third-party plugins via context.openListDialog().
 */

import { useCallback, useEffect } from 'react';
import type { ListDialogItem } from '../../plugin-api/index';
import './ListDialog.css';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ListDialogProps {
  /** Dialog title shown in the header. */
  title: string;
  /** Items to display in the scrollable list. */
  items: ReadonlyArray<ListDialogItem>;
  /** Called when the user activates a per-item action button. */
  onAction: (id: string) => void;
  /** Called when the dialog is dismissed. */
  onClose: () => void;
  /** Optional content rendered in the footer slot (e.g., Import Plugin button). */
  footer?: React.ReactNode;
  /** Optional message shown when items is empty. Defaults to "No items." */
  emptyMessage?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ListDialog({
  title,
  items,
  onAction,
  onClose,
  footer,
  emptyMessage = 'No items.',
}: ListDialogProps) {
  // ── Escape key ───────────────────────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => { if (e.target === e.currentTarget) onClose(); },
    [onClose],
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="list-dialog"
      onClick={handleBackdropClick}
    >
      <div className="list-dialog__card">
        {/* Header */}
        <header className="list-dialog__header">
          <h2 className="list-dialog__title">{title}</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="list-dialog__close"
          >
            ×
          </button>
        </header>

        {/* Body — scrollable list */}
        {items.length === 0 ? (
          <p className="list-dialog__empty">{emptyMessage}</p>
        ) : (
          <ul className="list-dialog__body">
            {items.map((item) => (
              <li key={item.id} className="list-dialog__item">
                {item.icon && (
                  <span className="list-dialog__item-icon" aria-hidden="true">{item.icon}</span>
                )}
                <span className="list-dialog__item-label">{item.label}</span>
                <button
                  type="button"
                  aria-label={`${item.actionLabel} ${item.label}`}
                  onClick={() => onAction(item.id)}
                  className="list-dialog__action-btn"
                >
                  {item.actionLabel}
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Footer slot */}
        {footer && <footer className="list-dialog__footer">{footer}</footer>}
      </div>
    </div>
  );
}
