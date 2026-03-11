/**
 * Play Score Plugin — Score Selection Screen (T010)
 * Feature 033: Play Score Plugin
 *
 * Displays all catalogue entries from context.scorePlayer.getCatalogue()
 * as a tappable list. Tapping an entry calls onSelectScore(catalogueId).
 * "Load from file" item is present but wired in T025 (US6).
 *
 * Design: No Back button (FR-002, Q4) — plugin opens directly to this screen.
 */

import { useRef } from 'react';
import type { PluginPreloadedScore } from '../../src/plugin-api/index';

export interface ScoreSelectionScreenProps {
  catalogue: readonly PluginPreloadedScore[];
  /** Feature 045: User-uploaded scores to show under "My Scores" section. */
  userScores: readonly PluginPreloadedScore[];
  onSelectScore: (catalogueId: string) => void;
  /** Called when user selects a user-uploaded score by id. */
  onSelectUserScore: (scoreId: string) => void;
  /** Called with the selected File when user picks a file (US6 / T025). */
  onLoadFile: (file: File) => void;
}

export function ScoreSelectionScreen({ catalogue, userScores, onSelectScore, onSelectUserScore, onLoadFile }: ScoreSelectionScreenProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onLoadFile(file);
      // Reset so selecting the same file again triggers onChange
      e.target.value = '';
    }
  };

  return (
    <div className="play-score__selection-screen">
      <p className="play-score__section-label">PRELOADED SCORES</p>

      <ul className="play-score__score-list" role="list">
        {catalogue.map(entry => (
          <li key={entry.id}>
            <button
              className="play-score__score-item"
              onClick={() => onSelectScore(entry.id)}
            >
              {entry.displayName}
            </button>
          </li>
        ))}

        <li className="play-score__score-item-separator" role="separator" />

        <li>
          <button
            className="play-score__score-item play-score__score-item--file"
            onClick={() => fileInputRef.current?.click()}
          >
            📁 Load from file…
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".mxl,.xml,.musicxml"
            style={{ display: 'none' }}
            onChange={handleFileChange}
            data-testid="file-input"
          />
        </li>
      </ul>

      {/* Feature 045: User-uploaded scores */}
      {userScores.length > 0 && (
        <>
          <p className="play-score__section-label">MY SCORES</p>
          <ul className="play-score__score-list" role="list">
            {userScores.map(entry => (
              <li key={entry.id}>
                <button
                  className="play-score__score-item"
                  onClick={() => onSelectUserScore(entry.id)}
                >
                  {entry.displayName}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
