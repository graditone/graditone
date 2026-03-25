//! Tie and slur chain resolution.
//!
//! Walks through notes paired with their MusicXML tie/slur metadata and
//! sets the corresponding domain flags (`is_tied`, `is_slurred`) to
//! connect note sequences.

use crate::domain::events::note::Note;

use super::super::types::{SlurInfo, SlurType, TieType};

/// Resolves tie chains within a voice's note list.
///
/// For each note with tie_type Start or Continue, finds the next note with
/// the same pitch and sets tie_next / is_tie_continuation links.
pub(super) fn resolve_tie_chains(notes: &mut [Note], tie_types: &[Option<TieType>]) {
    if notes.len() != tie_types.len() {
        return;
    }
    let len = notes.len();

    // Build a list of (index, note_id, pitch, start_tick, end_tick, tie_type)
    // for efficient matching
    let info: Vec<(
        usize,
        crate::domain::ids::NoteId,
        u8,
        u32,
        u32,
        Option<TieType>,
    )> = notes
        .iter()
        .enumerate()
        .map(|(i, n)| {
            (
                i,
                n.id,
                n.pitch.value(),
                n.start_tick.value(),
                n.start_tick.value() + n.duration_ticks,
                tie_types[i].clone(),
            )
        })
        .collect();

    for i in 0..len {
        let tt = &info[i].5;
        if matches!(tt, Some(TieType::Start) | Some(TieType::Continue)) {
            let pitch = info[i].2;
            let end_tick = info[i].4;

            // Find the next note with the same pitch that starts at this note's end_tick
            // and has tie_type Stop or Continue
            if let Some(target) = info.iter().find(|t| {
                t.0 > i
                    && t.2 == pitch
                    && t.3 == end_tick
                    && matches!(t.5, Some(TieType::Stop) | Some(TieType::Continue))
            }) {
                let target_idx = target.0;
                let target_id = target.1;

                notes[i].tie_next = Some(target_id);
                notes[target_idx].is_tie_continuation = true;
            }
        }
    }
}

/// Resolves slur chains within a voice's note list.
///
/// For each note with a slur start, finds the next note with a matching
/// slur stop (same number) and sets slur_next on the start note.
/// Also propagates the MusicXML placement (above/below) to slur_above.
pub(super) fn resolve_slur_chains(notes: &mut [Note], slur_infos: &[Vec<SlurInfo>]) {
    if notes.len() != slur_infos.len() {
        return;
    }
    let len = notes.len();

    for i in 0..len {
        for slur in &slur_infos[i] {
            if slur.slur_type == SlurType::Start {
                // Find next note with matching slur stop number
                for j in (i + 1)..len {
                    if slur_infos[j]
                        .iter()
                        .any(|s| s.slur_type == SlurType::Stop && s.number == slur.number)
                    {
                        notes[i].slur_next = Some(notes[j].id);
                        // Copy MusicXML placement into domain Note
                        notes[i].slur_above = slur.placement.as_ref().map(|p| {
                            matches!(
                                p,
                                crate::domain::importers::musicxml::types::SlurPlacement::Above
                            )
                        });
                        break;
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::events::note::Note;
    use crate::domain::importers::musicxml::types::{SlurInfo, SlurType, TieType};
    use crate::domain::value_objects::{Pitch, Tick};

    fn make_note(start: u32, duration: u32, midi: u8) -> Note {
        Note::new(Tick::new(start), duration, Pitch::new(midi).unwrap()).unwrap()
    }

    #[test]
    fn test_resolve_tie_chains_start_stop() {
        let mut notes = vec![make_note(0, 960, 60), make_note(960, 960, 60)];
        let tie_types = vec![Some(TieType::Start), Some(TieType::Stop)];
        resolve_tie_chains(&mut notes, &tie_types);
        assert_eq!(notes[0].tie_next, Some(notes[1].id));
        assert!(notes[1].is_tie_continuation);
    }

    #[test]
    fn test_resolve_slur_chains_start_stop() {
        let mut notes = vec![make_note(0, 960, 60), make_note(960, 960, 62)];
        let slur_infos = vec![
            vec![SlurInfo {
                slur_type: SlurType::Start,
                number: 1,
                placement: None,
            }],
            vec![SlurInfo {
                slur_type: SlurType::Stop,
                number: 1,
                placement: None,
            }],
        ];
        resolve_slur_chains(&mut notes, &slur_infos);
        assert_eq!(notes[0].slur_next, Some(notes[1].id));
    }
}
