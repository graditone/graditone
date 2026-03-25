//! Voice distribution and assignment.
//!
//! `VoiceDistributor` assigns notes to voices while respecting timing
//! constraints (no overlapping notes within a voice). Overflow notes
//! are placed in the closest available voice or a newly created one.

use std::collections::{BTreeMap, HashMap};

use crate::domain::events::note::Note;
use crate::domain::voice::Voice;

use super::super::ImportContext;
use super::super::errors::ImportError;

/// Distributes notes across multiple voices to avoid overlaps.
///
/// Uses deterministic algorithm: sort notes by (start_tick, pitch), then assign
/// to first available voice that doesn't have overlapping notes. Maximum 4 voices.
#[allow(dead_code)]
pub(super) struct VoiceDistributor {
    /// Voices being built, keyed by voice number (1-4)
    voices: HashMap<usize, Voice>,
    /// Maximum number of voices allowed per staff
    max_voices: usize,
}

#[allow(dead_code)]
impl VoiceDistributor {
    /// Create a new voice distributor with maximum 4 voices
    pub(super) fn new() -> Self {
        Self {
            voices: HashMap::new(),
            max_voices: 4,
        }
    }

    /// Assign notes to voices deterministically
    ///
    /// # Algorithm
    /// 1. Sort notes by (start_tick, pitch) using BTreeMap for deterministic iteration
    /// 2. For each note, try voices 1-4 in order
    /// 3. Assign to first voice where note doesn't overlap
    /// 4. If all 4 voices occupied, record warning and skip note
    ///
    /// # Returns
    /// Vec of voices (may be 1-4 voices depending on overlap patterns)
    pub(super) fn assign_voices(
        notes: Vec<Note>,
        context: &mut ImportContext,
    ) -> Result<Vec<Voice>, ImportError> {
        let mut distributor = Self::new();

        // Sort notes by (start_tick, pitch) for deterministic processing
        // BTreeMap provides sorted iteration
        let mut sorted_notes: BTreeMap<(u32, u8), Note> = BTreeMap::new();
        for note in notes {
            let key = (note.start_tick.value(), note.pitch.value());
            sorted_notes.insert(key, note);
        }

        // Assign each note to a voice
        for ((_tick, _pitch), note) in sorted_notes {
            distributor.assign_note(note, context)?;
        }

        // Extract voices in sorted order (1, 2, 3, 4)
        let mut result = Vec::new();
        for voice_num in 1..=distributor.max_voices {
            if let Some(voice) = distributor.voices.remove(&voice_num) {
                result.push(voice);
            }
        }

        // Ensure at least one voice always exists
        if result.is_empty() {
            result.push(Voice::new());
        }

        Ok(result)
    }

    /// Assign a single note to the first available voice
    fn assign_note(&mut self, note: Note, context: &mut ImportContext) -> Result<(), ImportError> {
        // Save tick for warning messages before moving note
        let note_tick = note.start_tick.value();

        // Try voices 1-4 in order
        for voice_num in 1..=self.max_voices {
            let voice = self.voices.entry(voice_num).or_default();

            // Check if note can be added without overlap
            if voice.can_add_note(&note) {
                // Add note (should not fail since we just checked)
                voice.add_note(note)?;

                // Record warning if we're using voice 2+ (indicates overlap resolution)
                if voice_num > 1 {
                    context.warn(
                        super::super::WarningSeverity::Warning,
                        super::super::WarningCategory::OverlapResolution,
                        format!(
                            "Overlapping notes at tick {} - note assigned to voice {}",
                            note_tick, voice_num
                        ),
                    );
                }

                return Ok(());
            }
        }

        // If we get here, all 4 voices are full - skip note with Error warning
        context.warn(
            super::super::WarningSeverity::Error,
            super::super::WarningCategory::OverlapResolution,
            format!(
                "Voice overflow: Note at tick {} could not be assigned (all 4 voices occupied)",
                note_tick
            ),
        );
        context.skip_element();

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::super::ImportContext;
    use super::*;
    use crate::domain::events::note::Note;
    use crate::domain::value_objects::{Pitch, Tick};

    fn make_note(start: u32, duration: u32, midi: u8) -> Note {
        Note::new(Tick::new(start), duration, Pitch::new(midi).unwrap()).unwrap()
    }

    #[test]
    fn test_assign_voices_empty_input() {
        let mut ctx = ImportContext::new();
        let voices = VoiceDistributor::assign_voices(vec![], &mut ctx).unwrap();
        assert_eq!(voices.len(), 1, "Empty input should produce 1 empty voice");
    }

    #[test]
    fn test_assign_voices_no_overlaps() {
        let mut ctx = ImportContext::new();
        let notes = vec![
            make_note(0, 480, 60),
            make_note(480, 480, 62),
            make_note(960, 480, 64),
        ];
        let voices = VoiceDistributor::assign_voices(notes, &mut ctx).unwrap();
        assert_eq!(
            voices.len(),
            1,
            "Non-overlapping notes should fit in 1 voice"
        );
    }

    #[test]
    fn test_assign_voices_with_overlaps() {
        let mut ctx = ImportContext::new();
        // Two notes with same pitch that overlap temporally
        let notes = vec![make_note(0, 960, 60), make_note(480, 960, 60)];
        let voices = VoiceDistributor::assign_voices(notes, &mut ctx).unwrap();
        assert_eq!(
            voices.len(),
            2,
            "Overlapping notes should be split into 2 voices"
        );
    }
}
