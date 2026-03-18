//! Beam Module
//!
//! Handles beam grouping and geometry generation for connecting eighth notes and shorter durations.
//! Beams are horizontal or slightly sloped rectangular regions connecting stem endpoints.
//!
//! Grouping rules:
//! - Eighth notes (480 ticks) beamed within same beat (960 tick intervals)
//! - Beams have 0.5 staff space thickness (10 logical units)
//! - Beam slope clamped to ±0.5 staff spaces per note

use serde::{Deserialize, Serialize};

/// Beam geometry representation
///
/// Encoded as special glyph with codepoint U+0001 for rendering pipeline.
/// The beam is a filled rectangle connecting stem endpoints.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Beam {
    /// X position of left edge
    pub x_start: f32,
    /// Y position of left edge (at first stem endpoint)
    pub y_start: f32,
    /// X position of right edge
    pub x_end: f32,
    /// Y position of right edge (at last stem endpoint)
    pub y_end: f32,
    /// Beam thickness in logical units
    pub thickness: f32,
    /// Beam level (1=primary, 2=secondary, etc.)
    pub level: u8,
    /// True if this is a partial beam (hook)
    pub is_hook: bool,
}

impl Beam {
    /// Standard beam thickness (0.5 staff spaces = 10 logical units)
    pub const BEAM_THICKNESS: f32 = 10.0;

    /// Maximum beam slope in staff spaces per note
    pub const MAX_SLOPE: f32 = 0.5;

    /// Gap between multiple beam levels (0.25 staff spaces = 5 logical units)
    pub const INTER_BEAM_GAP: f32 = 5.0;

    /// Length of a beam hook (partial beam) in logical units (0.75 staff spaces = 15 logical units)
    pub const BEAM_HOOK_LENGTH: f32 = 15.0;
}

/// Note group eligible for beaming
#[derive(Debug, Clone)]
pub struct BeamableNote {
    pub x: f32,
    pub y: f32,
    pub stem_end_y: f32,
    pub tick: u32,
    pub duration_ticks: u32,
    /// Number of beam levels this note participates in (0 = from algorithmic grouping)
    pub beam_levels: u8,
    /// Beam type per level (Begin/Continue/End/Hook) — empty if algorithmic
    pub beam_types: Vec<String>,
    /// Local event index within the system (used for source_reference mapping)
    pub event_index: usize,
}

/// Group notes that should be beamed together
///
/// # Arguments
/// * `notes` - Vector of notes with positions and timing
/// * `ticks_per_beat` - Ticks per beat (typically 960 for quarter note)
///
/// # Returns
/// Vector of note groups, where each group should be connected with a beam
///
/// # Rules
/// - Only eighth notes (480 ticks) or shorter are beamed
/// - Notes must be in the same beat (within 960 tick interval)
/// - Groups require at least 2 notes
pub fn group_beamable_notes(notes: &[BeamableNote], ticks_per_beat: u32) -> Vec<Vec<BeamableNote>> {
    let mut groups: Vec<Vec<BeamableNote>> = Vec::new();
    let mut current_group: Vec<BeamableNote> = Vec::new();
    let mut current_beat: Option<u32> = None;

    for note in notes {
        // Only beam eighth notes (480 ticks) or shorter
        if note.duration_ticks > 480 {
            // Finish current group if exists
            if current_group.len() >= 2 {
                groups.push(current_group.clone());
            }
            current_group.clear();
            current_beat = None;
            continue;
        }

        // Calculate which beat this note belongs to
        let beat = note.tick / ticks_per_beat;

        // Check if same beat as current group
        match current_beat {
            None => {
                // Start new group
                current_group.push(note.clone());
                current_beat = Some(beat);
            }
            Some(current) if current == beat => {
                // Add to current group
                current_group.push(note.clone());
            }
            Some(_) => {
                // Different beat - finish current group and start new
                if current_group.len() >= 2 {
                    groups.push(current_group.clone());
                }
                current_group.clear();
                current_group.push(note.clone());
                current_beat = Some(beat);
            }
        }
    }

    // Add final group if valid
    if current_group.len() >= 2 {
        groups.push(current_group);
    }

    groups
}

/// Compute beat boundaries for a given time signature
///
/// Returns the tick positions within a measure where beaming groups should break.
/// This handles simple, compound, and asymmetric meters.
///
/// # Arguments
/// * `numerator` - Time signature numerator (e.g., 4 in 4/4)
/// * `denominator` - Time signature denominator (e.g., 4 in 4/4)
///
/// # Returns
/// Vector of beat boundary tick offsets within one measure
///
/// # Meter Types
/// - Simple (2/4, 3/4, 4/4): beat = 960 ticks (quarter note)
/// - Compound (6/8, 9/8, 12/8): beat = 1440 ticks (dotted quarter)
/// - Asymmetric 5/8: beats at 1440 + 960 (3+2 grouping)
/// - Asymmetric 7/8: beats at 960 + 960 + 1440 (2+2+3 grouping)
fn compute_beat_boundaries(numerator: u8, denominator: u8) -> Vec<u32> {
    let mut boundaries = vec![0u32];

    match (numerator, denominator) {
        // Compound meters: dotted quarter = 1440 ticks
        (6, 8) => {
            boundaries.push(1440);
        }
        (9, 8) => {
            boundaries.push(1440);
            boundaries.push(2880);
        }
        (12, 8) => {
            boundaries.push(1440);
            boundaries.push(2880);
            boundaries.push(4320);
        }
        // Asymmetric 5/8: 3+2 grouping
        (5, 8) => {
            boundaries.push(1440); // After dotted quarter
        }
        // Asymmetric 7/8: 2+2+3 grouping
        (7, 8) => {
            boundaries.push(960); // After 2 eighths
            boundaries.push(1920); // After 2 more eighths
        }
        // 3/8: one dotted-quarter beat per measure (all 3 eighths beam together)
        (3, 8) => {
            // No additional boundaries — the entire 1440-tick measure is one beat.
        }
        // Simple meters: quarter note = 960 ticks
        _ => {
            for i in 1..numerator {
                boundaries.push(i as u32 * 960);
            }
        }
    }

    boundaries
}

/// Group beamable notes by time signature beat boundaries
///
/// A more sophisticated version of `group_beamable_notes()` that handles
/// compound meters (6/8, 9/8, 12/8) and asymmetric meters (5/8, 7/8).
///
/// # Arguments
/// * `notes` - Notes with positions and timing
/// * `time_numerator` - Time signature numerator
/// * `time_denominator` - Time signature denominator
///
/// # Returns
/// Vector of note groups, where each group should be connected with a beam
pub fn group_beamable_by_time_signature(
    notes: &[BeamableNote],
    time_numerator: u8,
    time_denominator: u8,
) -> Vec<Vec<BeamableNote>> {
    let beat_boundaries = compute_beat_boundaries(time_numerator, time_denominator);
    let measure_length: u32 = match time_denominator {
        8 => time_numerator as u32 * 480,
        4 => time_numerator as u32 * 960,
        2 => time_numerator as u32 * 1920,
        _ => time_numerator as u32 * 960,
    };

    let mut groups: Vec<Vec<BeamableNote>> = Vec::new();
    let mut current_group: Vec<BeamableNote> = Vec::new();
    let mut current_beat_idx: Option<usize> = None;

    for note in notes {
        // Only beam eighth notes (480 ticks) or shorter
        if note.duration_ticks > 480 {
            if current_group.len() >= 2 {
                groups.push(current_group.clone());
            }
            current_group.clear();
            current_beat_idx = None;
            continue;
        }

        // Determine which beat this note belongs to (within its measure)
        let tick_in_measure = note.tick % measure_length;
        let beat_idx = beat_boundaries
            .iter()
            .rposition(|&b| tick_in_measure >= b)
            .unwrap_or(0);

        match current_beat_idx {
            None => {
                current_group.push(note.clone());
                current_beat_idx = Some(beat_idx);
            }
            Some(current)
                if current == beat_idx
                    && (note.tick / measure_length)
                        == (current_group
                            .last()
                            .map(|n| n.tick / measure_length)
                            .unwrap_or(0)) =>
            {
                current_group.push(note.clone());
            }
            _ => {
                if current_group.len() >= 2 {
                    groups.push(current_group.clone());
                }
                current_group.clear();
                current_group.push(note.clone());
                current_beat_idx = Some(beat_idx);
            }
        }
    }

    if current_group.len() >= 2 {
        groups.push(current_group);
    }

    groups
}

/// Compute beam slope with clamping
///
/// # Arguments
/// * `notes` - Notes in the beamed group (sorted by x position)
/// * `units_per_space` - Logical units per staff space (typically 20)
///
/// # Returns
/// Clamped slope in logical units per horizontal unit
///
/// # Rules
/// - Calculate average pitch difference between first and last note
/// - Clamp to ±0.5 staff spaces (±10 logical units) per note
/// - Distribute slope evenly across horizontal span
pub fn compute_beam_slope(notes: &[BeamableNote], units_per_space: f32) -> f32 {
    if notes.len() < 2 {
        return 0.0;
    }

    let first = &notes[0];
    let last = &notes[notes.len() - 1];

    // Calculate natural slope from stem endpoints
    let dy = last.stem_end_y - first.stem_end_y;
    let dx = last.x - first.x;

    if dx == 0.0 {
        return 0.0;
    }

    let natural_slope = dy / dx;

    // Clamp slope to ±0.5 staff spaces per note
    let max_slope_units = Beam::MAX_SLOPE * units_per_space; // 0.5 * 20 = 10 units
    let max_slope_per_unit = max_slope_units / dx.abs();

    natural_slope.clamp(-max_slope_per_unit, max_slope_per_unit)
}

/// Create beam connecting a group of notes
///
/// # Arguments
/// * `notes` - Notes in the beamed group (must be sorted by x position)
/// * `slope` - Computed slope from compute_beam_slope()
///
/// # Returns
/// Beam struct with calculated geometry
pub fn create_beam(notes: &[BeamableNote], slope: f32) -> Option<Beam> {
    if notes.len() < 2 {
        return None;
    }

    let first = &notes[0];
    let last = &notes[notes.len() - 1];

    let x_start = first.x;
    let y_start = first.stem_end_y;
    let x_end = last.x;
    let y_end = first.stem_end_y + (slope * (x_end - x_start));

    Some(Beam {
        x_start,
        y_start,
        x_end,
        y_end,
        thickness: Beam::BEAM_THICKNESS,
        level: 1,
        is_hook: false,
    })
}

/// Create secondary/tertiary beams for multi-level beam groups (16ths, 32nds, etc.)
///
/// For each beam level > 1, identifies sub-groups of consecutive notes at that level
/// and creates beam segments. The Y offset is computed from the stem direction:
/// - Stem up: beams stack downward from the primary beam
/// - Stem down: beams stack upward from the primary beam
///
/// # Arguments
/// * `group` - The beam group with notes and beam_count
/// * `slope` - Primary beam slope
/// * `stem_direction_up` - Whether stems point up (affects stacking direction)
///
/// # Returns
/// Vector of secondary/tertiary Beam structs
pub fn create_multi_level_beams(
    group: &BeamGroup,
    slope: f32,
    stem_direction_up: bool,
) -> Vec<Beam> {
    let mut beams = Vec::new();

    if group.notes.len() < 2 || group.beam_count <= 1 {
        return beams;
    }

    let first_stem_end_y = group.notes[0].stem_end_y;

    // Process each beam level > 1
    for level in 2..=group.beam_count {
        // Find sub-groups at this level: consecutive notes that have beam_types at this level
        let mut sub_group: Vec<&BeamableNote> = Vec::new();

        for note in &group.notes {
            // A note participates at this level if it has enough beam_types entries
            let has_this_level = note.beam_types.len() >= level as usize;
            let level_type = if has_this_level {
                note.beam_types[(level - 1) as usize].as_str()
            } else {
                ""
            };

            match level_type {
                "Begin" | "Continue" => {
                    sub_group.push(note);
                }
                "End" => {
                    sub_group.push(note);
                    // Finalize sub-group
                    if sub_group.len() >= 2 {
                        if let Some(beam) = create_level_beam(
                            &sub_group,
                            level,
                            slope,
                            first_stem_end_y,
                            stem_direction_up,
                        ) {
                            beams.push(beam);
                        }
                    }
                    sub_group.clear();
                }
                "ForwardHook" | "BackwardHook" => {
                    // Create a beam hook for this note
                    let is_forward = level_type == "ForwardHook";
                    if let Some(hook) = create_beam_hook(
                        note,
                        level,
                        slope,
                        first_stem_end_y,
                        stem_direction_up,
                        is_forward,
                    ) {
                        beams.push(hook);
                    }
                }
                _ => {
                    // Note doesn't participate at this level — finalize any pending sub-group
                    if sub_group.len() >= 2 {
                        if let Some(beam) = create_level_beam(
                            &sub_group,
                            level,
                            slope,
                            first_stem_end_y,
                            stem_direction_up,
                        ) {
                            beams.push(beam);
                        }
                    }
                    sub_group.clear();
                }
            }
        }

        // Handle any remaining sub-group
        if sub_group.len() >= 2 {
            if let Some(beam) = create_level_beam(
                &sub_group,
                level,
                slope,
                first_stem_end_y,
                stem_direction_up,
            ) {
                beams.push(beam);
            }
        }
    }

    beams
}

/// Create a beam at a specific level, offset from the primary beam
///
/// Uses each note's actual stem_end_y (which already includes slope and offset
/// adjustments from the 3-phase stem pipeline) to position the beam accurately.
fn create_level_beam(
    notes: &[&BeamableNote],
    level: u8,
    _slope: f32,
    _first_stem_end_y: f32,
    stem_direction_up: bool,
) -> Option<Beam> {
    if notes.len() < 2 {
        return None;
    }

    let first = notes[0];
    let last = notes[notes.len() - 1];

    // Y offset: stack beams toward noteheads (away from stem tips)
    // Stem up → beams stack downward from stem endpoint (toward noteheads)
    // Stem down → beams stack upward from stem endpoint (toward noteheads)
    let level_offset = (level as f32 - 1.0) * (Beam::BEAM_THICKNESS + Beam::INTER_BEAM_GAP);
    let y_offset = if stem_direction_up {
        level_offset // Move down toward noteheads
    } else {
        -level_offset // Move up toward noteheads
    };

    // Use each note's actual stem_end_y for accurate beam positioning
    let x_start = first.x;
    let y_start = first.stem_end_y + y_offset;
    let x_end = last.x;
    let y_end = last.stem_end_y + y_offset;

    Some(Beam {
        x_start,
        y_start,
        x_end,
        y_end,
        thickness: Beam::BEAM_THICKNESS,
        level,
        is_hook: false,
    })
}

/// Create a beam hook (partial beam) extending from a single note's stem
///
/// Hooks extend in the direction of the adjacent note within the group.
/// Forward hooks extend toward the next note; backward hooks toward the previous.
///
/// # Arguments
/// * `note` - The note at which to create the hook
/// * `level` - Beam level for Y offset
/// * `slope` - Primary beam slope
/// * `first_stem_end_y` - Y position of first note's stem end (for slope reference)
/// * `stem_direction_up` - Stem direction for Y offset stacking
/// * `is_forward` - True for forward hook, false for backward hook
pub fn create_beam_hook(
    note: &BeamableNote,
    level: u8,
    slope: f32,
    _first_stem_end_y: f32,
    stem_direction_up: bool,
    is_forward: bool,
) -> Option<Beam> {
    let level_offset = (level as f32 - 1.0) * (Beam::BEAM_THICKNESS + Beam::INTER_BEAM_GAP);
    let y_offset = if stem_direction_up {
        level_offset
    } else {
        -level_offset
    };

    // Use the note's actual stem_end_y + level offset
    let hook_y = note.stem_end_y + y_offset;

    let (x_start, x_end) = if is_forward {
        (note.x, note.x + Beam::BEAM_HOOK_LENGTH)
    } else {
        (note.x - Beam::BEAM_HOOK_LENGTH, note.x)
    };

    let y_start = hook_y;
    let y_end = hook_y + slope * (x_end - x_start);

    Some(Beam {
        x_start,
        y_start,
        x_end,
        y_end,
        thickness: Beam::BEAM_THICKNESS,
        level,
        is_hook: true,
    })
}

/// Represents a group of notes connected by beams
#[derive(Debug, Clone)]
pub struct BeamGroup {
    /// Notes in the group, ordered by tick
    pub notes: Vec<BeamableNote>,
    /// Number of beam levels (1 for 8ths, 2 for 16ths, etc.)
    pub beam_count: u8,
}

/// Compute uniform stem direction for a beam group using the farthest-note rule
///
/// All notes in a beamed group must have the same stem direction.
/// The direction is determined by the note farthest from the staff middle
/// line (Gould, *Behind Bars*, p. 17). When two notes are equidistant on
/// opposite sides, prefer stems up.
///
/// # Arguments
/// * `notes` - Notes in the beam group
/// * `staff_middle_y` - Y position of the staff's middle line
///
/// # Returns
/// Uniform `StemDirection` for the entire group.
/// Tie-break (equal distance): defaults to `StemDirection::Up`.
pub fn compute_group_stem_direction(
    notes: &[BeamableNote],
    staff_middle_y: f32,
) -> crate::layout::stems::StemDirection {
    use crate::layout::stems::StemDirection;

    if notes.is_empty() {
        return StemDirection::Up;
    }

    // Find the note with the greatest absolute distance from the middle line.
    // In positive-Y-down coords:
    //   y < staff_middle_y ⇒ above middle (stem down)
    //   y > staff_middle_y ⇒ below middle (stem up)
    let mut max_above: f32 = 0.0; // max distance *above* middle (y < middle)
    let mut max_below: f32 = 0.0; // max distance *below* middle (y > middle)

    for note in notes {
        let delta = note.y - staff_middle_y;
        if delta < 0.0 {
            // Above the middle line
            max_above = max_above.max(-delta);
        } else {
            // Below (or on) the middle line
            max_below = max_below.max(delta);
        }
    }

    if max_below > max_above {
        // Farthest note is below middle → stems up
        StemDirection::Up
    } else if max_above > max_below {
        // Farthest note is above middle → stems down
        StemDirection::Down
    } else {
        // Equal distance on both sides → default stems up
        StemDirection::Up
    }
}

/// Build beam groups from MusicXML beam annotations at beam level 1
///
/// Uses a state machine: Begin → starts group, Continue → extends group, End → finalizes group.
/// Groups with fewer than 2 notes are discarded (single notes render with flags).
///
/// # Arguments
/// * `notes` - Notes with beam_types populated from MusicXML parsing
///
/// # Returns
/// Vector of BeamGroups
/// Determine if two ticks fall in different measures given sorted measure start ticks.
fn crosses_barline(tick_a: u32, tick_b: u32, measure_starts: &[u32]) -> bool {
    if measure_starts.is_empty() {
        return false;
    }
    // Find measure index for each tick.  A tick that falls exactly on a
    // measure start belongs to that new measure.
    let idx_a = match measure_starts.binary_search(&tick_a) {
        Ok(i) => i,
        Err(i) => i.saturating_sub(1),
    };
    let idx_b = match measure_starts.binary_search(&tick_b) {
        Ok(i) => i,
        Err(i) => i.saturating_sub(1),
    };
    idx_a != idx_b
}

pub fn build_beam_groups_from_musicxml(
    notes: &[BeamableNote],
    measure_starts: &[u32],
) -> Vec<BeamGroup> {
    let mut groups: Vec<BeamGroup> = Vec::new();
    let mut current_group: Vec<BeamableNote> = Vec::new();
    let mut in_group = false;

    for note in notes {
        // Look for level-1 beam type
        let _level1_type = note.beam_types.iter().find(|_bt| {
            // beam_types stores types as strings for level 1+ in order
            // The first entry corresponds to level 1
            true // We'll match by position
        });

        // Check level-1 beam info: beam_types[0] is level 1
        let has_level1 = !note.beam_types.is_empty();
        let level1_str = if has_level1 {
            note.beam_types[0].as_str()
        } else {
            ""
        };

        match level1_str {
            "Begin" => {
                // Start new group (finalize any dangling group first)
                if current_group.len() >= 2 {
                    let beam_count = current_group
                        .iter()
                        .map(|n| n.beam_levels)
                        .max()
                        .unwrap_or(1)
                        .max(1);
                    groups.push(BeamGroup {
                        notes: current_group.clone(),
                        beam_count,
                    });
                }
                current_group.clear();
                current_group.push(note.clone());
                in_group = true;
            }
            "Continue" => {
                if in_group {
                    // Break beam at barline boundary
                    let prev_tick = current_group.last().map(|n| n.tick).unwrap_or(0);
                    if crosses_barline(prev_tick, note.tick, measure_starts) {
                        if current_group.len() >= 2 {
                            let beam_count = current_group
                                .iter()
                                .map(|n| n.beam_levels)
                                .max()
                                .unwrap_or(1)
                                .max(1);
                            groups.push(BeamGroup {
                                notes: current_group.clone(),
                                beam_count,
                            });
                        }
                        current_group.clear();
                        current_group.push(note.clone());
                    } else {
                        current_group.push(note.clone());
                    }
                }
            }
            "End" => {
                if in_group {
                    // Break beam at barline boundary
                    let prev_tick = current_group.last().map(|n| n.tick).unwrap_or(0);
                    if crosses_barline(prev_tick, note.tick, measure_starts) {
                        if current_group.len() >= 2 {
                            let beam_count = current_group
                                .iter()
                                .map(|n| n.beam_levels)
                                .max()
                                .unwrap_or(1)
                                .max(1);
                            groups.push(BeamGroup {
                                notes: current_group.clone(),
                                beam_count,
                            });
                        }
                        current_group.clear();
                        in_group = false;
                        continue;
                    }
                    current_group.push(note.clone());
                    if current_group.len() >= 2 {
                        let beam_count = current_group
                            .iter()
                            .map(|n| n.beam_levels)
                            .max()
                            .unwrap_or(1)
                            .max(1);
                        groups.push(BeamGroup {
                            notes: current_group.clone(),
                            beam_count,
                        });
                    }
                    current_group.clear();
                    in_group = false;
                }
            }
            _ => {
                // No beam info or unrecognized — not part of a beam group
                if in_group && current_group.len() >= 2 {
                    let beam_count = current_group
                        .iter()
                        .map(|n| n.beam_levels)
                        .max()
                        .unwrap_or(1)
                        .max(1);
                    groups.push(BeamGroup {
                        notes: current_group.clone(),
                        beam_count,
                    });
                }
                current_group.clear();
                in_group = false;
            }
        }
    }

    // Handle any remaining group
    if current_group.len() >= 2 {
        let beam_count = current_group
            .iter()
            .map(|n| n.beam_levels)
            .max()
            .unwrap_or(1)
            .max(1);
        groups.push(BeamGroup {
            notes: current_group,
            beam_count,
        });
    }

    groups
}

#[cfg(test)]
mod tests {
    use super::*;

    /// T043: Unit test for group_beamable_notes() grouping by beat
    #[test]
    fn test_group_beamable_notes_same_beat() {
        let notes = vec![
            BeamableNote {
                x: 100.0,
                y: 60.0,
                stem_end_y: 25.0,
                tick: 0,
                duration_ticks: 480, // Eighth note
                beam_levels: 0,
                beam_types: Vec::new(),
                event_index: 0,
            },
            BeamableNote {
                x: 140.0,
                y: 70.0,
                stem_end_y: 35.0,
                tick: 480,
                duration_ticks: 480,
                beam_levels: 0,
                beam_types: Vec::new(),
                event_index: 0,
            },
            BeamableNote {
                x: 180.0,
                y: 60.0,
                stem_end_y: 25.0,
                tick: 960,
                duration_ticks: 480,
                beam_levels: 0,
                beam_types: Vec::new(),
                event_index: 0,
            },
            BeamableNote {
                x: 220.0,
                y: 80.0,
                stem_end_y: 45.0,
                tick: 1440,
                duration_ticks: 480,
                beam_levels: 0,
                beam_types: Vec::new(),
                event_index: 0,
            },
        ];

        let groups = group_beamable_notes(&notes, 960);

        // Should create 2 groups: [0,480] in beat 0, [960,1440] split across beats
        assert_eq!(groups.len(), 2, "Should create 2 beamed groups");
        assert_eq!(groups[0].len(), 2, "First group should have 2 notes");
        assert_eq!(groups[1].len(), 2, "Second group should have 2 notes");
    }

    #[test]
    fn test_group_beamable_notes_quarter_notes_excluded() {
        let notes = vec![
            BeamableNote {
                x: 100.0,
                y: 60.0,
                stem_end_y: 25.0,
                tick: 0,
                duration_ticks: 960, // Quarter note - should not beam
                beam_levels: 0,
                beam_types: Vec::new(),
                event_index: 0,
            },
            BeamableNote {
                x: 140.0,
                y: 70.0,
                stem_end_y: 35.0,
                tick: 960,
                duration_ticks: 960,
                beam_levels: 0,
                beam_types: Vec::new(),
                event_index: 0,
            },
        ];

        let groups = group_beamable_notes(&notes, 960);

        assert_eq!(groups.len(), 0, "Quarter notes should not be beamed");
    }

    #[test]
    fn test_group_beamable_notes_single_eighth() {
        let notes = vec![BeamableNote {
            x: 100.0,
            y: 60.0,
            stem_end_y: 25.0,
            tick: 0,
            duration_ticks: 480,
            beam_levels: 0,
            beam_types: Vec::new(),
            event_index: 0,
        }];

        let groups = group_beamable_notes(&notes, 960);

        assert_eq!(groups.len(), 0, "Single eighth note should not be beamed");
    }

    /// T044: Unit test for compute_beam_slope() clamping to ±0.5 staff spaces per note
    #[test]
    fn test_compute_beam_slope_flat() {
        let notes = vec![
            BeamableNote {
                x: 100.0,
                y: 60.0,
                stem_end_y: 25.0,
                tick: 0,
                duration_ticks: 480,
                beam_levels: 0,
                beam_types: Vec::new(),
                event_index: 0,
            },
            BeamableNote {
                x: 140.0,
                y: 70.0,
                stem_end_y: 25.0, // Same stem height
                tick: 480,
                duration_ticks: 480,
                beam_levels: 0,
                beam_types: Vec::new(),
                event_index: 0,
            },
        ];

        let slope = compute_beam_slope(&notes, 20.0);

        assert_eq!(slope, 0.0, "Flat beam should have zero slope");
    }

    #[test]
    fn test_compute_beam_slope_ascending() {
        let notes = vec![
            BeamableNote {
                x: 100.0,
                y: 60.0,
                stem_end_y: 25.0,
                tick: 0,
                duration_ticks: 480,
                beam_levels: 0,
                beam_types: Vec::new(),
                event_index: 0,
            },
            BeamableNote {
                x: 140.0,
                y: 70.0,
                stem_end_y: 35.0, // 10 units higher
                tick: 480,
                duration_ticks: 480,
                beam_levels: 0,
                beam_types: Vec::new(),
                event_index: 0,
            },
        ];

        let slope = compute_beam_slope(&notes, 20.0);

        // Natural slope: (35 - 25) / (140 - 100) = 10 / 40 = 0.25
        // Max slope: 10 / 40 = 0.25 (within limit)
        assert_eq!(slope, 0.25, "Ascending beam within limit");
    }

    #[test]
    fn test_compute_beam_slope_clamping() {
        let notes = vec![
            BeamableNote {
                x: 100.0,
                y: 60.0,
                stem_end_y: 25.0,
                tick: 0,
                duration_ticks: 480,
                beam_levels: 0,
                beam_types: Vec::new(),
                event_index: 0,
            },
            BeamableNote {
                x: 120.0, // Short distance
                y: 90.0,
                stem_end_y: 85.0, // Very steep: 60 units over 20 pixels
                tick: 480,
                duration_ticks: 480,
                beam_levels: 0,
                beam_types: Vec::new(),
                event_index: 0,
            },
        ];

        let slope = compute_beam_slope(&notes, 20.0);

        // Natural slope: (85 - 25) / (120 - 100) = 60 / 20 = 3.0
        // Max slope: 10 / 20 = 0.5
        // Should be clamped to 0.5
        assert_eq!(slope, 0.5, "Steep beam should be clamped to max slope");
    }

    #[test]
    fn test_create_beam() {
        let notes = vec![
            BeamableNote {
                x: 100.0,
                y: 60.0,
                stem_end_y: 25.0,
                tick: 0,
                duration_ticks: 480,
                beam_levels: 0,
                beam_types: Vec::new(),
                event_index: 0,
            },
            BeamableNote {
                x: 140.0,
                y: 70.0,
                stem_end_y: 35.0,
                tick: 480,
                duration_ticks: 480,
                beam_levels: 0,
                beam_types: Vec::new(),
                event_index: 0,
            },
        ];

        let slope = 0.25; // From compute_beam_slope
        let beam = create_beam(&notes, slope).expect("Should create beam");

        assert_eq!(beam.x_start, 100.0, "Beam should start at first note x");
        assert_eq!(beam.y_start, 25.0, "Beam should start at first stem end");
        assert_eq!(beam.x_end, 140.0, "Beam should end at last note x");
        assert_eq!(
            beam.y_end, 35.0,
            "Beam end should follow slope: 25 + 0.25 * 40 = 35"
        );
        assert_eq!(beam.thickness, Beam::BEAM_THICKNESS);
    }

    #[test]
    fn test_create_beam_single_note() {
        let notes = vec![BeamableNote {
            x: 100.0,
            y: 60.0,
            stem_end_y: 25.0,
            tick: 0,
            duration_ticks: 480,
            beam_levels: 0,
            beam_types: Vec::new(),
            event_index: 0,
        }];

        let beam = create_beam(&notes, 0.0);

        assert!(beam.is_none(), "Cannot create beam with single note");
    }

    // ========================================================================
    // T014: Tests for build_beam_groups_from_musicxml()
    // ========================================================================

    #[test]
    fn test_build_beam_groups_four_eighths_one_group() {
        // 4 eighth notes with beam Begin/Continue/Continue/End → 1 group
        let notes = vec![
            BeamableNote {
                x: 100.0,
                y: 60.0,
                stem_end_y: 25.0,
                tick: 0,
                duration_ticks: 480,
                beam_levels: 1,
                beam_types: vec!["Begin".to_string()],
                event_index: 0,
            },
            BeamableNote {
                x: 140.0,
                y: 65.0,
                stem_end_y: 30.0,
                tick: 480,
                duration_ticks: 480,
                beam_levels: 1,
                beam_types: vec!["Continue".to_string()],
                event_index: 0,
            },
            BeamableNote {
                x: 180.0,
                y: 70.0,
                stem_end_y: 35.0,
                tick: 960,
                duration_ticks: 480,
                beam_levels: 1,
                beam_types: vec!["Continue".to_string()],
                event_index: 0,
            },
            BeamableNote {
                x: 220.0,
                y: 75.0,
                stem_end_y: 40.0,
                tick: 1440,
                duration_ticks: 480,
                beam_levels: 1,
                beam_types: vec!["End".to_string()],
                event_index: 0,
            },
        ];

        let groups = build_beam_groups_from_musicxml(&notes, &[]);
        assert_eq!(groups.len(), 1, "4 eighth notes should form 1 group");
        assert_eq!(groups[0].notes.len(), 4, "Group should have 4 notes");
        assert_eq!(groups[0].beam_count, 1, "Eighth notes have 1 beam level");
    }

    #[test]
    fn test_build_beam_groups_mixed_quarters_eighths() {
        // Quarter + 2 eighths + Quarter → 1 group of 2
        let notes = vec![
            BeamableNote {
                x: 100.0,
                y: 60.0,
                stem_end_y: 25.0,
                tick: 0,
                duration_ticks: 960,
                beam_levels: 0,
                beam_types: Vec::new(), // quarter, no beams
                event_index: 0,
            },
            BeamableNote {
                x: 140.0,
                y: 65.0,
                stem_end_y: 30.0,
                tick: 960,
                duration_ticks: 480,
                beam_levels: 1,
                beam_types: vec!["Begin".to_string()],
                event_index: 0,
            },
            BeamableNote {
                x: 180.0,
                y: 70.0,
                stem_end_y: 35.0,
                tick: 1440,
                duration_ticks: 480,
                beam_levels: 1,
                beam_types: vec!["End".to_string()],
                event_index: 0,
            },
            BeamableNote {
                x: 220.0,
                y: 75.0,
                stem_end_y: 40.0,
                tick: 1920,
                duration_ticks: 960,
                beam_levels: 0,
                beam_types: Vec::new(), // quarter, no beams
                event_index: 0,
            },
        ];

        let groups = build_beam_groups_from_musicxml(&notes, &[]);
        assert_eq!(groups.len(), 1, "Should form 1 beam group from 2 eighths");
        assert_eq!(groups[0].notes.len(), 2, "Group should have 2 notes");
    }

    #[test]
    fn test_build_beam_groups_single_note_no_group() {
        // A single eighth note cannot form a group → empty
        let notes = vec![BeamableNote {
            x: 100.0,
            y: 60.0,
            stem_end_y: 25.0,
            tick: 0,
            duration_ticks: 480,
            beam_levels: 1,
            beam_types: vec!["Begin".to_string()],
            event_index: 0,
        }];

        let groups = build_beam_groups_from_musicxml(&notes, &[]);
        assert_eq!(groups.len(), 0, "Single note should not form a beam group");
    }

    #[test]
    fn test_build_beam_groups_two_separate_groups() {
        // 2 eighths + 2 eighths → 2 groups
        let notes = vec![
            BeamableNote {
                x: 100.0,
                y: 60.0,
                stem_end_y: 25.0,
                tick: 0,
                duration_ticks: 480,
                beam_levels: 1,
                beam_types: vec!["Begin".to_string()],
                event_index: 0,
            },
            BeamableNote {
                x: 140.0,
                y: 65.0,
                stem_end_y: 30.0,
                tick: 480,
                duration_ticks: 480,
                beam_levels: 1,
                beam_types: vec!["End".to_string()],
                event_index: 0,
            },
            BeamableNote {
                x: 180.0,
                y: 70.0,
                stem_end_y: 35.0,
                tick: 960,
                duration_ticks: 480,
                beam_levels: 1,
                beam_types: vec!["Begin".to_string()],
                event_index: 0,
            },
            BeamableNote {
                x: 220.0,
                y: 75.0,
                stem_end_y: 40.0,
                tick: 1440,
                duration_ticks: 480,
                beam_levels: 1,
                beam_types: vec!["End".to_string()],
                event_index: 0,
            },
        ];

        let groups = build_beam_groups_from_musicxml(&notes, &[]);
        assert_eq!(groups.len(), 2, "Should form 2 separate beam groups");
        assert_eq!(groups[0].notes.len(), 2);
        assert_eq!(groups[1].notes.len(), 2);
    }

    /// T026: Four sixteenth notes → 2 beam lines (level 1 and level 2)
    #[test]
    fn test_multi_level_beams_four_sixteenths() {
        let notes = vec![
            BeamableNote {
                x: 100.0,
                y: 60.0,
                stem_end_y: 25.0,
                tick: 0,
                duration_ticks: 240,
                beam_levels: 2,
                beam_types: vec!["Begin".to_string(), "Begin".to_string()],
                event_index: 0,
            },
            BeamableNote {
                x: 140.0,
                y: 65.0,
                stem_end_y: 30.0,
                tick: 240,
                duration_ticks: 240,
                beam_levels: 2,
                beam_types: vec!["Continue".to_string(), "Continue".to_string()],
                event_index: 0,
            },
            BeamableNote {
                x: 180.0,
                y: 70.0,
                stem_end_y: 35.0,
                tick: 480,
                duration_ticks: 240,
                beam_levels: 2,
                beam_types: vec!["Continue".to_string(), "Continue".to_string()],
                event_index: 0,
            },
            BeamableNote {
                x: 220.0,
                y: 75.0,
                stem_end_y: 40.0,
                tick: 720,
                duration_ticks: 240,
                beam_levels: 2,
                beam_types: vec!["End".to_string(), "End".to_string()],
                event_index: 0,
            },
        ];

        let group = BeamGroup {
            beam_count: 2,
            notes: notes.clone(),
        };

        let secondary_beams = create_multi_level_beams(&group, 0.0, true);

        assert_eq!(secondary_beams.len(), 1, "Should create 1 secondary beam");
        assert_eq!(
            secondary_beams[0].level, 2,
            "Secondary beam should be level 2"
        );
        assert!(!secondary_beams[0].is_hook, "Should not be a hook");
    }

    /// T026: Mixed eighths + sixteenths → primary spans all, secondary spans sixteenths
    #[test]
    fn test_multi_level_beams_mixed_eighths_sixteenths() {
        // 2 eighths + 2 sixteenths: primary beam spans all 4, secondary spans last 2
        let notes = vec![
            BeamableNote {
                x: 100.0,
                y: 60.0,
                stem_end_y: 25.0,
                tick: 0,
                duration_ticks: 480,
                beam_levels: 1,
                beam_types: vec!["Begin".to_string()],
                event_index: 0,
            },
            BeamableNote {
                x: 140.0,
                y: 65.0,
                stem_end_y: 30.0,
                tick: 480,
                duration_ticks: 240,
                beam_levels: 2,
                beam_types: vec!["Continue".to_string(), "Begin".to_string()],
                event_index: 0,
            },
            BeamableNote {
                x: 180.0,
                y: 70.0,
                stem_end_y: 35.0,
                tick: 720,
                duration_ticks: 240,
                beam_levels: 2,
                beam_types: vec!["End".to_string(), "End".to_string()],
                event_index: 0,
            },
        ];

        let group = BeamGroup {
            beam_count: 2,
            notes: notes.clone(),
        };

        let secondary_beams = create_multi_level_beams(&group, 0.0, true);

        assert_eq!(
            secondary_beams.len(),
            1,
            "Should create 1 secondary beam for sixteenths"
        );
        assert_eq!(secondary_beams[0].level, 2);
        // Secondary beam should only span the 2 sixteenth notes
        assert!(
            (secondary_beams[0].x_start - 140.0).abs() < 0.1,
            "Secondary beam should start at second note x=140"
        );
        assert!(
            (secondary_beams[0].x_end - 180.0).abs() < 0.1,
            "Secondary beam should end at third note x=180"
        );
    }

    /// T026: Forward/backward hooks at level 2
    #[test]
    fn test_multi_level_beams_hooks() {
        // 1 sixteenth + 1 eighth → primary beam + backward hook on first note
        let notes = vec![
            BeamableNote {
                x: 100.0,
                y: 60.0,
                stem_end_y: 25.0,
                tick: 0,
                duration_ticks: 240,
                beam_levels: 2,
                beam_types: vec!["Begin".to_string(), "BackwardHook".to_string()],
                event_index: 0,
            },
            BeamableNote {
                x: 140.0,
                y: 65.0,
                stem_end_y: 30.0,
                tick: 240,
                duration_ticks: 480,
                beam_levels: 1,
                beam_types: vec!["End".to_string()],
                event_index: 0,
            },
        ];

        let group = BeamGroup {
            beam_count: 2,
            notes: notes.clone(),
        };

        let secondary_beams = create_multi_level_beams(&group, 0.0, true);

        assert_eq!(secondary_beams.len(), 1, "Should create 1 hook");
        assert!(secondary_beams[0].is_hook, "Should be a hook");
        assert_eq!(secondary_beams[0].level, 2, "Hook should be at level 2");
        // Backward hook extends to the left
        assert!(
            secondary_beams[0].x_start < secondary_beams[0].x_end,
            "Hook should have x_start < x_end"
        );
    }

    /// T032: All notes above middle line → stems Down
    #[test]
    fn test_group_stem_direction_all_above() {
        let staff_middle_y = 80.0;
        // All notes at y < 80 (above middle — higher pitch) → stem down
        let notes = vec![
            BeamableNote {
                x: 100.0,
                y: 50.0,
                stem_end_y: 0.0,
                tick: 0,
                duration_ticks: 480,
                beam_levels: 0,
                beam_types: Vec::new(),
                event_index: 0,
            },
            BeamableNote {
                x: 140.0,
                y: 40.0,
                stem_end_y: 0.0,
                tick: 480,
                duration_ticks: 480,
                beam_levels: 0,
                beam_types: Vec::new(),
                event_index: 0,
            },
        ];

        let dir = compute_group_stem_direction(&notes, staff_middle_y);
        assert_eq!(
            dir,
            crate::layout::stems::StemDirection::Down,
            "All notes above middle → Down (y < middle_y in screen coords)"
        );
    }

    /// T032: All notes below middle line → stems Up
    #[test]
    fn test_group_stem_direction_all_below() {
        let staff_middle_y = 80.0;
        // All notes at y > 80 (below middle line) → stem up
        let notes = vec![
            BeamableNote {
                x: 100.0,
                y: 100.0,
                stem_end_y: 0.0,
                tick: 0,
                duration_ticks: 480,
                beam_levels: 0,
                beam_types: Vec::new(),
                event_index: 0,
            },
            BeamableNote {
                x: 140.0,
                y: 120.0,
                stem_end_y: 0.0,
                tick: 480,
                duration_ticks: 480,
                beam_levels: 0,
                beam_types: Vec::new(),
                event_index: 0,
            },
        ];

        let dir = compute_group_stem_direction(&notes, staff_middle_y);
        assert_eq!(
            dir,
            crate::layout::stems::StemDirection::Up,
            "All notes below middle → Up (y > middle_y in screen coords)"
        );
    }

    /// T032: Mixed with farthest note above → Down (farthest-note rule)
    #[test]
    fn test_group_stem_direction_majority_above() {
        let staff_middle_y = 80.0;
        let notes = vec![
            BeamableNote {
                x: 100.0,
                y: 50.0, // 30 above middle (farthest)
                stem_end_y: 0.0,
                tick: 0,
                duration_ticks: 480,
                beam_levels: 0,
                beam_types: Vec::new(),
                event_index: 0,
            },
            BeamableNote {
                x: 140.0,
                y: 60.0, // 20 above middle
                stem_end_y: 0.0,
                tick: 480,
                duration_ticks: 480,
                beam_levels: 0,
                beam_types: Vec::new(),
                event_index: 0,
            },
            BeamableNote {
                x: 180.0,
                y: 100.0, // 20 below middle
                stem_end_y: 0.0,
                tick: 960,
                duration_ticks: 480,
                beam_levels: 0,
                beam_types: Vec::new(),
                event_index: 0,
            },
        ];

        let dir = compute_group_stem_direction(&notes, staff_middle_y);
        // Farthest note is 30 above middle → Down
        assert_eq!(
            dir,
            crate::layout::stems::StemDirection::Down,
            "Farthest note above middle → Down"
        );
    }

    /// T032: Farthest note below middle → Up (even when majority is above)
    #[test]
    fn test_group_stem_direction_farthest_below() {
        let staff_middle_y = 80.0;
        // Two notes slightly above middle (5 and 10 above), one note far below (40 below)
        let notes = vec![
            BeamableNote {
                x: 100.0,
                y: 75.0, // 5 above middle
                stem_end_y: 0.0,
                tick: 0,
                duration_ticks: 480,
                beam_levels: 0,
                beam_types: Vec::new(),
                event_index: 0,
            },
            BeamableNote {
                x: 140.0,
                y: 70.0, // 10 above middle
                stem_end_y: 0.0,
                tick: 480,
                duration_ticks: 480,
                beam_levels: 0,
                beam_types: Vec::new(),
                event_index: 0,
            },
            BeamableNote {
                x: 180.0,
                y: 120.0, // 40 below middle (farthest)
                stem_end_y: 0.0,
                tick: 960,
                duration_ticks: 480,
                beam_levels: 0,
                beam_types: Vec::new(),
                event_index: 0,
            },
        ];

        let dir = compute_group_stem_direction(&notes, staff_middle_y);
        // Farthest note is 40 below → Up (even though 2 of 3 notes are above)
        assert_eq!(
            dir,
            crate::layout::stems::StemDirection::Up,
            "Farthest note below middle → Up (overrides majority above)"
        );
    }

    /// T032: One note above, one below — farthest decides (not a true even split)
    #[test]
    fn test_group_stem_direction_unequal_spread() {
        let staff_middle_y = 80.0;
        let notes = vec![
            BeamableNote {
                x: 100.0,
                y: 50.0, // 30 above middle (farthest)
                stem_end_y: 0.0,
                tick: 0,
                duration_ticks: 480,
                beam_levels: 0,
                beam_types: Vec::new(),
                event_index: 0,
            },
            BeamableNote {
                x: 140.0,
                y: 100.0, // 20 below middle
                stem_end_y: 0.0,
                tick: 480,
                duration_ticks: 480,
                beam_levels: 0,
                beam_types: Vec::new(),
                event_index: 0,
            },
        ];

        let dir = compute_group_stem_direction(&notes, staff_middle_y);
        // Farthest = 30 above > 20 below → stems Down
        assert_eq!(
            dir,
            crate::layout::stems::StemDirection::Down,
            "Farthest note above middle → Down"
        );
    }

    /// T032: True equal distance → defaults to Up
    #[test]
    fn test_group_stem_direction_true_even_split() {
        let staff_middle_y = 80.0;
        let notes = vec![
            BeamableNote {
                x: 100.0,
                y: 50.0, // 30 above middle
                stem_end_y: 0.0,
                tick: 0,
                duration_ticks: 480,
                beam_levels: 0,
                beam_types: Vec::new(),
                event_index: 0,
            },
            BeamableNote {
                x: 140.0,
                y: 110.0, // 30 below middle
                stem_end_y: 0.0,
                tick: 480,
                duration_ticks: 480,
                beam_levels: 0,
                beam_types: Vec::new(),
                event_index: 0,
            },
        ];

        let dir = compute_group_stem_direction(&notes, staff_middle_y);
        assert_eq!(
            dir,
            crate::layout::stems::StemDirection::Up,
            "Equal distance from middle defaults to Up"
        );
    }

    // Helper to create a simple BeamableNote for time signature tests
    fn make_note(tick: u32, duration: u32) -> BeamableNote {
        BeamableNote {
            x: tick as f32,
            y: 60.0,
            stem_end_y: 25.0,
            tick,
            duration_ticks: duration,
            beam_levels: 0,
            beam_types: Vec::new(),
            event_index: 0,
        }
    }

    /// T040: 4/4 time — groups of 2 eighths per beat
    #[test]
    fn test_group_by_time_sig_4_4() {
        let notes = vec![
            make_note(0, 480),
            make_note(480, 480), // beat 0
            make_note(960, 480),
            make_note(1440, 480), // beat 1
            make_note(1920, 480),
            make_note(2400, 480), // beat 2
            make_note(2880, 480),
            make_note(3360, 480), // beat 3
        ];

        let groups = group_beamable_by_time_signature(&notes, 4, 4);

        assert_eq!(
            groups.len(),
            4,
            "4/4: should produce 4 groups (one per beat)"
        );
        for g in &groups {
            assert_eq!(g.len(), 2, "Each group should have 2 eighths");
        }
    }

    /// T040: 6/8 compound time — groups of 3 eighths per dotted quarter beat
    #[test]
    fn test_group_by_time_sig_6_8() {
        let notes = vec![
            make_note(0, 480),
            make_note(480, 480),
            make_note(960, 480), // beat 0 (0-1439)
            make_note(1440, 480),
            make_note(1920, 480),
            make_note(2400, 480), // beat 1 (1440-2879)
        ];

        let groups = group_beamable_by_time_signature(&notes, 6, 8);

        assert_eq!(
            groups.len(),
            2,
            "6/8: should produce 2 groups (one per dotted-quarter beat)"
        );
        assert_eq!(groups[0].len(), 3, "First group should have 3 eighths");
        assert_eq!(groups[1].len(), 3, "Second group should have 3 eighths");
    }

    /// T040: 3/4 simple time — groups of 2 eighths per beat
    #[test]
    fn test_group_by_time_sig_3_4() {
        let notes = vec![
            make_note(0, 480),
            make_note(480, 480), // beat 0
            make_note(960, 480),
            make_note(1440, 480), // beat 1
            make_note(1920, 480),
            make_note(2400, 480), // beat 2
        ];

        let groups = group_beamable_by_time_signature(&notes, 3, 4);

        assert_eq!(groups.len(), 3, "3/4: should produce 3 groups");
        for g in &groups {
            assert_eq!(g.len(), 2, "Each group should have 2 eighths");
        }
    }

    /// T040: 5/8 asymmetric — 3+2 grouping
    #[test]
    fn test_group_by_time_sig_5_8() {
        let notes = vec![
            make_note(0, 480),
            make_note(480, 480),
            make_note(960, 480), // beat 0 (3 eighths)
            make_note(1440, 480),
            make_note(1920, 480), // beat 1 (2 eighths)
        ];

        let groups = group_beamable_by_time_signature(&notes, 5, 8);

        assert_eq!(groups.len(), 2, "5/8: should produce 2 groups (3+2)");
        assert_eq!(groups[0].len(), 3, "First group should have 3 eighths");
        assert_eq!(groups[1].len(), 2, "Second group should have 2 eighths");
    }

    /// T057 (spec 050, Issue 05-B): 3/8 compound meter — all 3 eighths must beam together.
    ///
    /// In 3/8 the entire measure is ONE dotted-quarter beat (1 440 ticks).
    /// The algorithmic fallback `group_beamable_by_time_signature(notes, 3, 8)` must
    /// therefore return exactly ONE group containing all three eighth notes.
    ///
    /// FAILS before fix (`compute_beat_boundaries` falls into the default branch and
    /// emits boundaries at 960 + 1 920, splitting the 3rd eighth into its own beat).
    /// PASSES after adding `(3, 8) =>` to `compute_beat_boundaries` with no extra boundaries.
    #[test]
    fn test_group_by_time_sig_3_8_one_beam_group() {
        let notes = vec![
            make_note(0, 480),   // beat 1
            make_note(480, 480), // beat 2
            make_note(960, 480), // beat 3 — must stay in the SAME group
        ];

        let groups = group_beamable_by_time_signature(&notes, 3, 8);

        assert_eq!(
            groups.len(),
            1,
            "3/8: all 3 eighth notes form a single dotted-quarter beat and must \
             beam together. Got {} group(s). \
             Fix: add `(3, 8) =>` case to `compute_beat_boundaries()` in beams.rs \
             returning no additional boundaries.",
            groups.len()
        );
        assert_eq!(
            groups[0].len(),
            3,
            "The single 3/8 beam group must contain all 3 eighth notes"
        );
    }
}
