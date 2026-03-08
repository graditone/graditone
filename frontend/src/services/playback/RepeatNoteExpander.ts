// RepeatNoteExpander — Feature 041: Repeat Barlines
//
// Expands a flat Note[] array into a repeat-expanded sequence for playback.
// All tick arithmetic uses integer operations (no floating point).
// Constitution Principle VI: no layout coordinates — this is pure tick scheduling.

import type { Note, RepeatBarline } from '../../types/score';

interface RepeatSection {
  start_tick: number;
  end_tick: number;
}

/**
 * Pair each end-repeat marker with its nearest preceding start-repeat marker
 * (or tick 0 if no preceding start exists) to form playback sections.
 */
function buildSections(repeatBarlines: RepeatBarline[]): RepeatSection[] {
  const sorted = [...repeatBarlines].sort((a, b) => a.start_tick - b.start_tick);

  const sections: RepeatSection[] = [];
  let sectionStart = 0;

  for (const rb of sorted) {
    if (rb.barline_type === 'Start') {
      sectionStart = rb.start_tick;
    } else if (rb.barline_type === 'End') {
      sections.push({ start_tick: sectionStart, end_tick: rb.end_tick });
      sectionStart = rb.end_tick;
    } else {
      // 'Both': closes active section, next section opens from this position
      sections.push({ start_tick: sectionStart, end_tick: rb.end_tick });
      sectionStart = rb.start_tick;
    }
  }

  return sections;
}

/**
 * Expand a flat Note[] by repeating sections defined by repeat barlines.
 *
 * Each section is played twice: once in its original position, once with a
 * tick_offset applied. Notes outside any repeat section are passed through
 * unchanged (with the accumulated offset from earlier repeats).
 *
 * @param notes      - Flat sorted Note[] extracted from the score
 * @param repeatBarlines - Repeat barline data from Score.repeat_barlines
 * @returns Expanded Note[] ready to be passed to usePlayback()
 */
export function expandNotesWithRepeats(
  notes: Note[],
  repeatBarlines: RepeatBarline[] | undefined,
): Note[] {
  if (!repeatBarlines || repeatBarlines.length === 0) {
    return notes;
  }

  const sections = buildSections(repeatBarlines);
  if (sections.length === 0) {
    return notes;
  }

  const expanded: Note[] = [];
  let tickOffset = 0;
  let prevEnd = 0;

  for (const section of sections) {
    const sectionDuration = section.end_tick - section.start_tick;

    // Pass through notes between the previous section end and this section start
    for (const note of notes) {
      const t = note.start_tick as number;
      if (t >= prevEnd && t < section.start_tick) {
        expanded.push({ ...note, start_tick: t + tickOffset });
      }
    }

    // Play the section twice
    for (let pass = 0; pass < 2; pass++) {
      const passOffset = tickOffset + pass * sectionDuration;
      for (const note of notes) {
        const t = note.start_tick as number;
        if (t >= section.start_tick && t < section.end_tick) {
          const id = pass === 0 ? note.id : `${note.id}-r${pass}`;
          expanded.push({ ...note, id, start_tick: t + passOffset });
        }
      }
    }

    tickOffset += sectionDuration;
    prevEnd = section.end_tick;
  }

  // Pass through notes after the last section
  for (const note of notes) {
    const t = note.start_tick as number;
    if (t >= prevEnd) {
      expanded.push({ ...note, start_tick: t + tickOffset });
    }
  }

  return expanded;
}
