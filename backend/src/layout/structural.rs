//! Structural glyph rendering
//!
//! Positions clef, key signature, and time signature glyphs at system
//! starts and handles mid-system clef and key signature changes.

use std::collections::HashMap;

use crate::layout::extraction::StaffData;
use crate::layout::positioner;
use crate::layout::types::{Glyph, TickRange};

/// Render structural glyphs (clef, key sig, time sig) at the system start
/// and mid-system key/clef changes within a single staff.
#[allow(clippy::too_many_arguments)]
pub(crate) fn render_structural_glyphs(
    staff_data: &StaffData,
    system_tick_range: &TickRange,
    system_index: usize,
    _system_width: f32,
    staff_vertical_offset: f32,
    units_per_space: f32,
    note_positions: &HashMap<u32, f32>,
    measure_x_bounds: &HashMap<u32, (f32, f32)>,
) -> Vec<Glyph> {
    let mut structural_glyphs = Vec::new();

    // Determine the active key signature at this system's start tick
    let system_key_sharps = staff_data.get_key_at_tick(system_tick_range.start_tick);

    // Use the clef active just before the system start so the system-start
    // glyph reflects the "incoming" clef.  A clef change exactly at the
    // system start tick will be rendered as a mid-system change instead.
    // For system 0, use get_clef_at_tick since there is no prior context.
    let system_clef = if system_index == 0 {
        staff_data.get_clef_at_tick(system_tick_range.start_tick)
    } else {
        staff_data.get_clef_before_tick(system_tick_range.start_tick)
    };

    // Position clef at x=60 (left margin with room for brace and glyph extent)
    let clef_glyph =
        positioner::position_clef(system_clef, 60.0, units_per_space, staff_vertical_offset);
    structural_glyphs.push(clef_glyph);

    // Position key signature after clef (x=120)
    let key_sig_glyphs = positioner::position_key_signature(
        system_key_sharps,
        system_clef,
        120.0,
        units_per_space,
        staff_vertical_offset,
    );
    structural_glyphs.extend(key_sig_glyphs);

    // Position time signature after key signature — only on the first system
    // (standard engraving: repeat only when the time signature changes)
    if system_index == 0 {
        let key_sig_width = system_key_sharps.abs() as f32 * 15.0;
        let time_sig_x = 120.0 + key_sig_width + 20.0; // Add 20 unit gap
        let time_sig_glyphs = positioner::position_time_signature(
            staff_data.time_numerator,
            staff_data.time_denominator,
            time_sig_x,
            units_per_space,
            staff_vertical_offset,
        );
        structural_glyphs.extend(time_sig_glyphs);
    }

    // Render key signature changes at mid-system measure boundaries
    if !staff_data.key_signature_events.is_empty() {
        for &(event_tick, event_sharps) in &staff_data.key_signature_events {
            // Skip if event is outside this system's tick range
            if event_tick <= system_tick_range.start_tick
                || event_tick >= system_tick_range.end_tick
            {
                continue;
            }
            // Look up the x position for this tick from measure bounds
            if let Some(&(measure_x_start, _)) = measure_x_bounds.get(&event_tick) {
                // Position the key signature glyphs at the measure start
                // Shift slightly right to leave room after the barline
                let key_x = measure_x_start + 10.0;
                let active_clef = staff_data.get_clef_at_tick(event_tick);
                let mid_key_glyphs = positioner::position_key_signature(
                    event_sharps,
                    active_clef,
                    key_x,
                    units_per_space,
                    staff_vertical_offset,
                );
                structural_glyphs.extend(mid_key_glyphs);
            }
        }
    }

    // Render clef changes within this system.  Events exactly at the
    // system start tick are included when the system-start clef shows
    // the incoming (previous) clef — the change must still be rendered.
    if !staff_data.clef_events.is_empty() {
        for (event_tick, event_clef) in &staff_data.clef_events {
            // Skip events that precede this system.
            if *event_tick < system_tick_range.start_tick {
                continue;
            }

            // On System 0, skip the event at tick 0 — it matches the
            // system-start clef already rendered above.
            if system_index == 0 && *event_tick == system_tick_range.start_tick {
                continue;
            }

            // Skip if the clef at the system start tick is the same as
            // the system-start clef (no visible change needed).
            if *event_tick == system_tick_range.start_tick && event_clef.as_str() == system_clef {
                continue;
            }

            // Skip clef events at or beyond this system's end tick.
            // The next system will render the correct clef at its start.
            if *event_tick >= system_tick_range.end_tick {
                continue;
            }

            // Event is inside this system.  Find the enclosing
            // measure: the one whose start_tick is the largest value
            // that is ≤ event_tick.
            let enclosing = measure_x_bounds
                .iter()
                .filter(|(tick, _)| **tick <= *event_tick)
                .max_by_key(|(tick, _)| *tick);

            if let Some((&_m_tick, &(measure_x_start, _measure_x_end))) = enclosing {
                // Place the clef change just before the first note at
                // or after the event tick.  Use a small offset (-30)
                // so the clef sits between the barline and the first
                // note, not in the preceding measure's visual space.
                // For events at a measure boundary, use the midpoint
                // between the measure's start_x and the first note to
                // ensure the clef falls after the barline.
                let clef_x = if *event_tick == _m_tick {
                    // Measure-start clef change: place before the
                    // first note in this measure.
                    let first_note_x = note_positions
                        .iter()
                        .filter(|(t, _)| **t >= *event_tick && **t < system_tick_range.end_tick)
                        .min_by_key(|(t, _)| *t)
                        .map(|(_, &x)| x);
                    if let Some(nx) = first_note_x {
                        // Place clef close to the note, AFTER the
                        // barline. The barline sits roughly at the
                        // midpoint between the previous measure's
                        // last note and this note, so -30 keeps us
                        // after the barline while leaving room.
                        nx - 30.0
                    } else {
                        measure_x_start + 10.0
                    }
                } else {
                    // Mid-measure: use the pre-computed note position
                    // at the clef change tick and place the clef just
                    // before it.  Fall back to the measure start if no
                    // note exists at the exact tick.
                    if let Some(&note_x) = note_positions.get(event_tick) {
                        // Place clef well before the note (extra 50 units
                        // reserved in spacing + clef glyph width ~30)
                        note_x - 45.0
                    } else {
                        // No note at this exact tick — find the nearest
                        // note after the event tick within this system.
                        let next_note_x = note_positions
                            .iter()
                            .filter(|(t, _)| **t > *event_tick && **t < system_tick_range.end_tick)
                            .min_by_key(|(t, _)| *t)
                            .map(|(_, &x)| x);
                        if let Some(nx) = next_note_x {
                            nx - 45.0
                        } else {
                            measure_x_start + 10.0
                        }
                    }
                };
                let mid_clef_glyph = positioner::position_courtesy_clef(
                    event_clef,
                    clef_x,
                    units_per_space,
                    staff_vertical_offset,
                );
                structural_glyphs.push(mid_clef_glyph);
            }
        }
    }

    structural_glyphs
}
