// RepeatNoteExpander — Feature 041: Repeat Barlines
//
// Expands a flat Note[] array into a repeat-expanded sequence for playback.
// All tick arithmetic uses integer operations (no floating point).
// Constitution Principle VI: no layout coordinates — this is pure tick scheduling.

import type { Note, RepeatBarline, VoltaBracket } from '../../types/score';

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
 * When volta brackets are provided, first-ending (number=1) notes are skipped
 * on the second pass, and tick offsets are compressed accordingly.
 *
 * @param notes      - Flat sorted Note[] extracted from the score
 * @param repeatBarlines - Repeat barline data from Score.repeat_barlines
 * @param voltaBrackets  - Volta bracket data from Score.volta_brackets (optional)
 * @returns Expanded Note[] ready to be passed to usePlayback()
 */
export function expandNotesWithRepeats(
  notes: Note[],
  repeatBarlines: RepeatBarline[] | undefined,
  voltaBrackets?: VoltaBracket[],
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

    // Find the first-ending bracket for this section (if any)
    const firstEnding = voltaBrackets?.find(
      vb =>
        vb.number === 1 &&
        vb.start_tick >= section.start_tick &&
        vb.end_tick <= section.end_tick
    );
    const feStart = firstEnding?.start_tick ?? null;
    const feEnd = firstEnding?.end_tick ?? null;
    const feDur = firstEnding ? (feEnd! - feStart!) : 0;

    // Pass through notes between the previous section end and this section start
    for (const note of notes) {
      const t = note.start_tick as number;
      if (t >= prevEnd && t < section.start_tick) {
        expanded.push({ ...note, start_tick: t + tickOffset });
      }
    }

    // Play the section twice
    for (let pass = 0; pass < 2; pass++) {
      for (const note of notes) {
        const t = note.start_tick as number;
        if (t < section.start_tick || t >= section.end_tick) continue;

        // On second pass, skip notes inside the first ending
        if (pass === 1 && feStart !== null && t >= feStart && t < feEnd!) continue;

        // On second pass, compress ticks for notes after the first ending
        const compression = (pass === 1 && feEnd !== null && t >= feEnd) ? feDur : 0;
        const passOffset = tickOffset + pass * sectionDuration - compression;
        const id = pass === 0 ? note.id : `${note.id}-r${pass}`;
        expanded.push({ ...note, id, start_tick: t + passOffset });
      }
    }

    // Advance offset: second pass is shorter by the first-ending duration
    tickOffset += sectionDuration - feDur;
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
