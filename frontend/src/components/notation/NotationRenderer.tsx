import React from 'react';
import type { LayoutGeometry } from '../../types/notation/layout';
import type { Note } from '../../types/score';
import { ChordSymbol } from './ChordSymbol';

/**
 * NotationRenderer - Pure presentational component that renders notation SVG
 * 
 * This component takes pre-calculated layout geometry and renders it as SVG elements.
 * It has no business logic or state - all positioning is determined by the layout engine.
 * 
 * Responsibilities:
 * - Render staff lines (horizontal lines)
 * - Render clef symbol (Music font glyph)
 * - Render note heads (positioned SMuFL glyphs)
 * - Render ledger lines (short lines for notes outside staff range)
 * - Handle note click events (User Story 3)
 * - Apply selection highlighting (User Story 3)
 */

export interface NotationRendererProps {
  /** Pre-calculated layout geometry */
  layout: LayoutGeometry;
  
  /** ID of currently selected note (User Story 3) */
  selectedNoteId?: string | null;
  
  /** Callback when note is clicked (User Story 3) */
  onNoteClick?: (noteId: string) => void;
  
  /** Current horizontal scroll position (deprecated - clef no longer sticky) */
  scrollX?: number;
  
  /** Whether to show the clef (Feature 009: hide during auto-scroll to prevent flickering) */
  showClef?: boolean;
  
  /** Notes for chord symbol detection (T032) */
  notes?: Note[];
  
  /** Pixels per tick for chord positioning */
  pixelsPerTick?: number;
  
  /** Feature 009 - US2 - T021: IDs of currently playing notes to highlight */
  highlightedNoteIds?: string[];

  /** Step-mode: text labels to show above specific note heads, keyed by note id */
  noteLabels?: Record<string, string>;

  /** Step-mode: fill colour for each note label (default #1976d2), keyed by note id */
  noteLabelColors?: Record<string, string>;

  /** Ink colour for staff lines, barlines, clef and note heads (default "black") */
  inkColor?: string;
}

/**
 * NotationRenderer (Internal) - Pure presentational component
 * Wrapped with React.memo for performance optimization (T066)
 */
const NotationRendererComponent: React.FC<NotationRendererProps> = ({
  layout,
  selectedNoteId = null,
  onNoteClick,
  showClef = true,
  notes = [],
  pixelsPerTick = 0.1,
  highlightedNoteIds = [],
  noteLabels = {},
  noteLabelColors = {},
  inkColor = 'black',
}) => {
  const handleNoteClick = (noteId: string, e: React.MouseEvent) => {
    // Stop propagation to prevent triggering container's playback toggle
    e.stopPropagation();
    
    if (onNoteClick) {
      onNoteClick(noteId);
    }
  };

  return (
    <svg
      width={layout.totalWidth}
      height={layout.totalHeight}
      xmlns="http://www.w3.org/2000/svg"
      data-testid="notation-svg"
      style={{
        display: 'block',
        userSelect: 'none',
      }}
    >
      {/* Staff lines (5 horizontal lines) */}
      {layout.staffLines.map((line) => (
        <line
          key={`staff-line-${line.lineNumber}`}
          data-testid={`staff-line-${line.lineNumber}`}
          x1={line.x1}
          x2={line.x2}
          y1={line.y}
          y2={line.y}
          stroke={inkColor}
          strokeWidth={line.strokeWidth}
          opacity={0.50}
        />
      ))}

      {/* Ledger lines (short lines for notes outside staff range) */}
      {layout.ledgerLines.map((ledger) => (
        <line
          key={ledger.id}
          data-testid={ledger.id}
          x1={ledger.x1}
          x2={ledger.x2}
          y1={ledger.y}
          y2={ledger.y}
          stroke={inkColor}
          strokeWidth={ledger.strokeWidth}
        />
      ))}

      {/* Clef symbol - Shown only at start of staff (fixed position, not sticky) */}
      {showClef && (
        <text
          data-testid={`clef-${layout.clef.type}`}
          x={layout.clef.x}
          y={layout.clef.y}
          fontSize={layout.clef.fontSize}
          fontFamily="Bravura"
          fill={inkColor}
          textAnchor="middle"
          dominantBaseline="central"
          opacity={0.60}
        >
          {layout.clef.glyphCodepoint}
        </text>
      )}

      {/* Note heads (positioned SMuFL glyphs) - T055: Virtual scrolling */}
      {layout.notes
        .slice(layout.visibleNoteIndices.startIdx, layout.visibleNoteIndices.endIdx)
        .map((note) => (
        <React.Fragment key={note.id}>
          {/* Accidental (sharp/flat) if needed - positioned before note head */}
          {note.accidental && (
            <text
              data-testid={`${note.id}-accidental`}
              x={note.x - note.fontSize * 0.35} // Position closer to note head (avoids barline collisions)
              y={note.y}
              fontSize={note.fontSize * 0.65} // Smaller to fit between barline and note
              fontFamily="Bravura"
              fill={selectedNoteId === note.id ? 'blue' : inkColor}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {note.accidental === 'sharp' ? '\uE262' : '\uE260'}
            </text>
          )}
          
          {/* Note head */}
          <text
            data-testid={note.id}
            className={`note-head${highlightedNoteIds.includes(note.id) ? ' highlighted' : ''}`}
            x={note.x}
            y={note.y}
            fontSize={note.fontSize}
            fontFamily="Bravura"
            fill={selectedNoteId === note.id ? 'blue' : inkColor}
            textAnchor="middle"
            dominantBaseline="central"
            onClick={(e) => handleNoteClick(note.id, e)}
            style={{ cursor: 'pointer' }}
          >
            {note.glyphCodepoint}
          </text>

          {/* Step-mode note label above note head */}
          {noteLabels[note.id] && (
            <text
              x={note.x}
              y={note.y - note.fontSize * 0.85}
              fontSize={Math.max(10, note.fontSize * 0.36)}
              fontFamily="system-ui, sans-serif"
              fontWeight="700"
              fill={noteLabelColors[note.id] ?? '#1976d2'}
              textAnchor="middle"
              dominantBaseline="auto"
            >
              {noteLabels[note.id]}
            </text>
          )}
        </React.Fragment>
      ))}

      {/* Barlines (User Story 2) */}
      {layout.barlines.map((barline) => (
        <line
          key={barline.id}
          data-testid={barline.id}
          x1={barline.x}
          x2={barline.x}
          y1={barline.y1}
          y2={barline.y2}
          stroke={inkColor}
          strokeWidth={barline.strokeWidth}
          opacity={0.60}
        />
      ))}

      {/* Key signature accidentals (User Story 5 - not yet implemented) */}
      {layout.keySignatureAccidentals.map((accidental, index) => (
        <text
          key={`accidental-${index}`}
          data-testid={`accidental-${index}`}
          x={accidental.x}
          y={accidental.y}
          fontSize={accidental.fontSize}
          fontFamily="Bravura"
          fill={inkColor}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {accidental.glyphCodepoint}
        </text>
      ))}

      {/* Chord symbols (T033: Chord symbol layer) */}
      {notes.length > 0 && (
        <ChordSymbol
          notes={notes}
          notePositions={layout.notes}
          staffConfig={{
            pixelsPerTick,
            marginLeft: layout.marginLeft,
            staffSpace: 10,
            minNoteSpacing: 15,
            viewportWidth: 1200,
            viewportHeight: 600,
            scrollX: 0,
            clefWidth: 40,
            keySignatureWidthPerAccidental: 15,
            barlineWidth: 2,
            renderBuffer: 200,
            glyphFontSizeMultiplier: 4.0,
          }}
        />
      )}
    </svg>
  );
};

/**
 * NotationRenderer - Memoized version for performance
 * 
 * T066: Wrapped with React.memo to prevent unnecessary re-renders
 * Only re-renders when props actually change (layout, selectedNoteId, scrollX, showClef, notes)
 */
export const NotationRenderer = React.memo(NotationRendererComponent);
