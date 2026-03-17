/**
 * Merge practice note entries from multiple staves into a single sorted list.
 *
 * Notes at the same tick are fused into one entry whose `midiPitches` is the
 * union of all per-staff pitches (duplicates removed) and whose `noteIds`
 * concatenates all ids. Used for "Both Clefs" practice mode so the
 * ChordDetector requires every pitch across all staves to be pressed.
 *
 * Principle VI: only integer tick / MIDI values — no coordinates.
 */

import type { PluginPracticeNoteEntry } from '../../src/plugin-api/index';

export function mergePracticeNotesByTick(
  allNotes: PluginPracticeNoteEntry[],
): PluginPracticeNoteEntry[] {
  if (allNotes.length === 0) return [];
  const byTick = new Map<number, { pitches: number[]; sustainedPitches: number[]; noteIds: string[]; durationTicks: number }>();
  for (const entry of allNotes) {
    const group = byTick.get(entry.tick);
    if (group) {
      for (const p of entry.midiPitches) {
        if (!group.pitches.includes(p)) group.pitches.push(p);
      }
      for (const p of (entry.sustainedPitches ?? [])) {
        if (!group.sustainedPitches.includes(p) && !group.pitches.includes(p)) group.sustainedPitches.push(p);
      }
      group.noteIds.push(...entry.noteIds);
      group.durationTicks = Math.max(group.durationTicks, entry.durationTicks);
    } else {
      byTick.set(entry.tick, {
        pitches: [...(entry.midiPitches as number[])],
        sustainedPitches: [...((entry.sustainedPitches ?? []) as number[])],
        noteIds: [...entry.noteIds],
        durationTicks: entry.durationTicks,
      });
    }
  }
  const sorted = Array.from(byTick.entries())
    .sort(([a], [b]) => a - b)
    .map(([tick, { pitches, sustainedPitches, noteIds, durationTicks }]) => ({
      tick, midiPitches: pitches as number[], sustainedPitches, noteIds, durationTicks,
    }));

  // Cross-staff sustained-note pass: use the ORIGINAL per-staff entries
  // (not the merged entries) so each pitch sustains based on its own
  // original duration, not the max across merged staves. E.g. treble G5
  // (dur=240) at tick 0 should NOT be sustained at tick 240+, but bass C3
  // (dur=1920) at tick 0 should be.
  for (const original of allNotes) {
    if (original.durationTicks <= 0) continue;
    const end = original.tick + original.durationTicks;
    for (const merged of sorted) {
      if (original.tick < merged.tick && end > merged.tick) {
        for (const p of original.midiPitches) {
          if (!merged.midiPitches.includes(p) && !merged.sustainedPitches.includes(p)) {
            (merged.sustainedPitches as number[]).push(p);
          }
        }
      }
    }
  }

  // Truncate each entry's durationTicks to the gap before the next onset so
  // long cross-staff notes don't block practice advancement (same logic as
  // extractPracticeNotes within a single staff).
  for (let i = 0; i < sorted.length - 1; i++) {
    const gap = sorted[i + 1].tick - sorted[i].tick;
    if (gap > 0 && gap < sorted[i].durationTicks) {
      sorted[i].durationTicks = gap;
    }
  }

  return sorted;
}
