import type { PreloadedScore } from '../../data/preloadedScores';
import type { DifficultyLevel } from '../../types/score';
import { DifficultyTag } from './DifficultyTag';

interface PreloadedScoreListProps {
  scores: ReadonlyArray<PreloadedScore>;
  selectedId?: string;
  disabled?: boolean;
  onSelect: (score: PreloadedScore) => void;
  /** Map of score ID → difficulty level, built from cached scores in IndexedDB (Feature 055) */
  difficultyLevels?: Readonly<Record<string, DifficultyLevel>>;
}

/**
 * Renders the left-panel list of bundled scores inside LoadScoreDialog.
 * Feature 028: Load Score Dialog — User Story 2.
 */
export function PreloadedScoreList({
  scores,
  selectedId,
  disabled = false,
  onSelect,
  difficultyLevels = {},
}: PreloadedScoreListProps) {
  return (
    <ul className="preloaded-score-list" role="list">
      {scores.map((score) => {
        const isSelected = score.id === selectedId;
        return (
          <li key={score.id}>
            <button
              className={`preloaded-score-item${isSelected ? ' preloaded-score-item--selected' : ''}`}
              data-selected={isSelected ? 'true' : 'false'}
              disabled={disabled}
              onClick={() => onSelect(score)}
            >
              {score.displayName}
              <DifficultyTag level={difficultyLevels[score.id]} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
