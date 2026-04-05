/**
 * SavedPracticeList.tsx — "Saved Practices" section inside the score picker.
 * Feature 056: Save and Load Practices
 *
 * Presentational component: renders saved practices in a collapsible
 * `<details>/<summary>` section, sorted by date descending (most recent first).
 * Returns null when the practices list is empty.
 */
import type { SavedPracticeIndexEntry } from '../../services/savedPractice.types';
import { useTranslation } from '../../i18n/index';
import './SavedPracticeList.css';

export interface SavedPracticeListProps {
  practices: ReadonlyArray<SavedPracticeIndexEntry>;
  disabled?: boolean;
  onSelect: (practice: SavedPracticeIndexEntry) => void;
  onDelete: (id: string) => void;
  /** Feature 060: Practices in this set cannot be deleted (linked to a session). */
  protectedPracticeIds?: ReadonlySet<string>;
  /** Feature 060: Map of savedPracticeId → session info for protected practices. */
  protectedPracticeMap?: ReadonlyMap<string, { sessionName: string; sessionId: string; taskId?: string }>;
  /** Feature 060: Called when the user clicks the session link on a protected practice. */
  onViewSessions?: (sessionId: string, taskId?: string) => void;
}

export function SavedPracticeList({
  practices,
  disabled = false,
  onSelect,
  onDelete,
  protectedPracticeIds,
  protectedPracticeMap,
  onViewSessions,
}: SavedPracticeListProps) {
  const { t } = useTranslation();
  if (practices.length === 0) return null;

  return (
    <details className="saved-practice-list" open>
      <summary className="saved-practice-list__summary">
        {t('saved_practices.summary', { count: practices.length })}
      </summary>
      <ul className="saved-practice-list__items" role="list">
        {practices.map((practice) => {
          const savedDate = new Date(practice.savedAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
          const savedTime = new Date(practice.savedAt).toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
          });
          return (
            <li key={practice.id} className="saved-practice-item">
              <button
                className="saved-practice-item__btn"
                disabled={disabled}
                onClick={() => onSelect(practice)}
                type="button"
              >
                <span className="saved-practice-item__name">{practice.name}</span>
                <span className="saved-practice-item__meta">
                  <span className="saved-practice-item__date">{savedDate} {savedTime}</span>
                  {practice.completionStatus === 'partial' && (
                    <span className="saved-practice-item__badge saved-practice-item__badge--partial">
                      {t('saved_practices.partial')}
                    </span>
                  )}
                </span>
              </button>
              {protectedPracticeIds?.has(practice.id) ? (
                <button
                  className="saved-practice-item__session-link"
                  aria-label={t('saved_practices.linked_session_aria', { name: protectedPracticeMap?.get(practice.id)?.sessionName ?? 'session' })}
                  disabled={disabled}
                  onClick={() => {
                    const info = protectedPracticeMap?.get(practice.id);
                    if (info) onViewSessions?.(info.sessionId, info.taskId);
                  }}
                  type="button"
                  title={`📋 ${protectedPracticeMap?.get(practice.id)?.sessionName ?? 'Session'}`}
                >
                  📋
                </button>
              ) : (
                <button
                  className="saved-practice-item__delete-btn"
                  aria-label={t('saved_practices.delete_aria', { name: practice.name })}
                  disabled={disabled}
                  onClick={() => onDelete(practice.id)}
                  type="button"
                >
                  ×
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}
