/**
 * NoteHistoryList — scrollable bounded list of detected note onsets
 *
 * US5: Shows each note onset with its label and elapsed time.
 * Auto-scrolls to the newest entry. Bounded at 200 entries (hook-side cap).
 * "Clear" button empties the list. Placeholder shown when empty.
 *
 * T028: Core component
 * T029: Wired into RecordingView
 */
import { useEffect, useRef, useState } from 'react';
import type { NoteOnset } from '../../types/recording';

interface NoteHistoryListProps {
  entries: NoteOnset[];
  onClear: () => void;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function NoteHistoryList({ entries, onClear }: NoteHistoryListProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set());

  function toggleExpand(idx: number) {
    setExpandedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  }

  // Auto-scroll to newest entry
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [entries]);

  return (
    <div className="note-history-list">
      <div className="note-history-list__header">
        <span className="note-history-list__title">Note History</span>
        <button
          className="note-history-list__clear-btn"
          onClick={onClear}
          aria-label="Clear note history"
        >
          Clear
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="note-history-list__empty" aria-label="No notes recorded">
          No notes recorded yet
        </p>
      ) : (
        <ul
          ref={listRef}
          className="note-history-list__list"
          aria-label="Note history"
        >
          {entries.map((entry, idx) => (
            <li key={idx} className="note-history-list__entry">
              <span className="note-history-list__entry-label">{entry.label}</span>
              {entry.channel !== undefined && (
                <span className="note-history-list__entry-channel">ch{entry.channel}</span>
              )}
              <span className="note-history-list__entry-time">{formatElapsed(entry.elapsedMs)}</span>
              {entry.velocity !== undefined && (
                <>
                  <span className="note-history-list__entry-velocity">{entry.velocity}</span>
                  <div className="note-history-list__velocity-bar-wrap">
                    <div
                      className="note-history-list__velocity-bar"
                      style={{ width: `${Math.round((entry.velocity / 127) * 100)}%` }}
                    />
                  </div>
                </>
              )}
              {entry.rawBytes !== undefined && (
                <>
                  <button
                    className="note-history-list__expand-btn"
                    onClick={() => toggleExpand(idx)}
                    aria-label="Show bytes"
                  >
                    {expandedIndices.has(idx) ? '▲' : '▼'}
                  </button>
                  {expandedIndices.has(idx) && (
                    <span className="note-history-list__raw-bytes">
                      {entry.rawBytes.map((b) => `0x${b.toString(16).toUpperCase().padStart(2, '0')}`).join(' ')}
                    </span>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
