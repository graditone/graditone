import type { DifficultyLevel } from '../../types/score';
import { useTranslation } from '../../i18n/index';
import type { TranslationKey } from '../../i18n/index';
import './DifficultyTag.css';

const LABEL_KEYS: Record<DifficultyLevel, TranslationKey> = {
  1: 'difficulty.easy',
  2: 'difficulty.medium',
  3: 'difficulty.hard',
};

const CSS_CLASSES: Record<DifficultyLevel, string> = {
  1: 'easy',
  2: 'medium',
  3: 'hard',
};

interface DifficultyTagProps {
  level: DifficultyLevel | undefined;
}

/**
 * Renders a difficulty badge (Easy / Medium / Hard) for scores.
 * Returns null when level is undefined (no rating available).
 * Feature 055: Score Difficulty Rate for Note Density.
 */
export function DifficultyTag({ level }: DifficultyTagProps) {
  const { t } = useTranslation();
  if (level === undefined) return null;

  const label = t(LABEL_KEYS[level]);

  return (
    <span
      className={`difficulty-tag difficulty-tag--${CSS_CLASSES[level]}`}
      aria-label={t('difficulty.aria', { level: label })}
    >
      {label}
    </span>
  );
}
