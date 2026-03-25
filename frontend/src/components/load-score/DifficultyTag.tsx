import type { DifficultyLevel } from '../../types/score';
import './DifficultyTag.css';

const LABELS: Record<DifficultyLevel, string> = {
  1: 'Easy',
  2: 'Medium',
  3: 'Hard',
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
  if (level === undefined) return null;

  const label = LABELS[level];

  return (
    <span
      className={`difficulty-tag difficulty-tag--${label.toLowerCase()}`}
      aria-label={`Difficulty: ${label}`}
    >
      {label}
    </span>
  );
}
