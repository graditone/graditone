/**
 * UserScoreList.tsx — "My Scores" section inside the score picker.
 * Feature 045: Persist Uploaded Scores
 *
 * Presentational component: renders uploaded scores below built-in scores.
 * Returns null when the scores list is empty.
 */
import type { UserScore } from '../../services/userScoreIndex';
import './UserScoreList.css';

interface UserScoreListProps {
  scores: ReadonlyArray<UserScore>;
  selectedId?: string;
  disabled?: boolean;
  onSelect: (score: UserScore) => void;
  onDelete: (id: string) => void;
}

/**
 * Renders the "My Scores" section with uploaded scores.
 * Returns null when the scores array is empty.
 */
export function UserScoreList({
  scores,
  selectedId,
  disabled = false,
  onSelect,
  onDelete,
}: UserScoreListProps) {
  if (scores.length === 0) return null;

  return (
    <section className="user-score-list">
      <h3 className="user-score-list__heading">My Scores</h3>
      <ul className="user-score-list__items" role="list">
        {scores.map((score) => {
          const isSelected = score.id === selectedId;
          const uploadedDate = new Date(score.uploadedAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
          return (
            <li key={score.id} className="user-score-item">
              <button
                className={`user-score-item__btn${isSelected ? ' user-score-item--selected' : ''}`}
                data-selected={isSelected ? 'true' : 'false'}
                disabled={disabled}
                onClick={() => onSelect(score)}
              >
                <span className="user-score-item__name">{score.displayName}</span>
                <span className="user-score-item__date">{uploadedDate}</span>
              </button>
              <button
                className="user-score-item__delete-btn"
                aria-label={`Remove ${score.displayName}`}
                disabled={disabled}
                onClick={() => onDelete(score.id)}
                type="button"
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
