import type { ScoreGroup, PreloadedScore } from '../../data/preloadedScores';
import type { DifficultyLevel } from '../../types/score';
import { useTranslation } from '../../i18n/index';
import { DifficultyTag } from './DifficultyTag';
import './ScoreGroupList.css';

interface ScoreGroupListProps {
  group: ScoreGroup;
  selectedId?: string;
  disabled?: boolean;
  onSelect: (score: PreloadedScore) => void;
  /** Map of score ID → difficulty level (Feature 055) */
  difficultyLevels?: Readonly<Record<string, DifficultyLevel>>;
}

/**
 * Renders a single score group as a native <details>/<summary> collapsible.
 * Collapsed by default. No JavaScript toggle state — browser handles open/close.
 *
 * Feature 001: Scales Generation.
 */
export function ScoreGroupList({
  group,
  selectedId,
  disabled = false,
  onSelect,
  difficultyLevels = {},
}: ScoreGroupListProps) {
  const { tDynamic } = useTranslation();
  if (group.scores.length === 0) return null;

  return (
    <details className="score-group">
      <summary className="score-group__summary">{tDynamic(`score_group.${group.id}`, group.displayName)}</summary>
      <ul className="score-group__list" role="list">
        {group.scores.map((score) => {
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
    </details>
  );
}
