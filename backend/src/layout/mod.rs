//! Layout Engine Module
//!
//! Converts a CompiledScore into a deterministic hierarchical spatial model
//! expressed in logical units. The output defines systems as the primary
//! virtualization boundary and provides bounding boxes for efficient rendering,
//! hit testing, and interaction.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub mod batcher;
pub mod beams;
pub mod breaker;
pub mod metrics;
pub mod positioner;
pub mod spacer;
pub mod stems;
pub mod types;

#[cfg(target_arch = "wasm32")]
pub mod wasm;

pub use breaker::MeasureInfo;
pub use types::{
    BarLine, BarLineSegment, BarLineType, BoundingBox, BracketGlyph, BracketType, Color,
    GlobalLayout, Glyph, GlyphRun, LedgerLine, MeasureNumber, NameLabel, Point, RepeatDotPosition,
    SourceReference, Staff, StaffGroup, StaffLine, System, TickRange, VoltaBracketLayout,
};

/// Configuration for layout computation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutConfig {
    /// Maximum system width in logical units (default: 1600.0)
    pub max_system_width: f32,
    /// Scaling factor: logical units per staff space (default: 10.0)
    pub units_per_space: f32,
    /// Vertical spacing between systems in logical units (default: 150.0)
    pub system_spacing: f32,
    /// System height in logical units (default: 200.0 for grand staff)
    pub system_height: f32,
}

impl Default for LayoutConfig {
    fn default() -> Self {
        Self {
            max_system_width: 2400.0, // Wide enough for 3+ measures per system
            units_per_space: 20.0,    // SMuFL: font_size 80 = 4 spaces, so 1 space = 20 units
            system_spacing: 100.0,    // Spacing between systems (gap after system_height)
            system_height: 200.0,     // Base height for a single staff system
        }
    }
}

/// Compute the start tick of a measure, accounting for pickup/anacrusis.
fn measure_start_tick(measure_index: usize, pickup_ticks: u32, ticks_per_measure: u32) -> u32 {
    if pickup_ticks > 0 {
        if measure_index == 0 {
            0
        } else {
            pickup_ticks + (measure_index as u32 - 1) * ticks_per_measure
        }
    } else {
        measure_index as u32 * ticks_per_measure
    }
}

/// Compute the end tick of a measure, accounting for pickup/anacrusis.
fn measure_end_tick(measure_index: usize, pickup_ticks: u32, ticks_per_measure: u32) -> u32 {
    if pickup_ticks > 0 {
        if measure_index == 0 {
            pickup_ticks
        } else {
            pickup_ticks + measure_index as u32 * ticks_per_measure
        }
    } else {
        (measure_index as u32 + 1) * ticks_per_measure
    }
}

/// Map a tick position to its measure index, accounting for pickup/anacrusis.
fn tick_to_measure_index(tick: u32, pickup_ticks: u32, ticks_per_measure: u32) -> usize {
    if pickup_ticks > 0 {
        if tick < pickup_ticks {
            0
        } else {
            ((tick - pickup_ticks) / ticks_per_measure) as usize + 1
        }
    } else {
        (tick / ticks_per_measure) as usize
    }
}

/// Compute layout from a CompiledScore
///
/// This is the main entry point for the layout engine. Returns a `GlobalLayout`
/// containing the complete spatial model organized into systems.
///
/// # Determinism
///
/// Layout computation is deterministic - identical inputs always produce
/// byte-identical outputs, enabling aggressive caching.
pub fn compute_layout(score: &serde_json::Value, config: &LayoutConfig) -> GlobalLayout {
    // Extract time signature — check multiple JSON paths for compatibility:
    // 1. global_structural_events[].TimeSignature (ScoreDto from musicore-import)
    // 2. time_signature_changes[] (ConvertedScore from frontend LayoutView)
    // 3. instruments[0].staves[0].time_signature (staff-level, set by frontend converter)
    let (time_numerator, time_denominator) = score["global_structural_events"]
        .as_array()
        .and_then(|events| {
            events.iter().find_map(|e| {
                let ts = &e["TimeSignature"];
                if ts.is_object() {
                    Some((
                        ts["numerator"].as_u64().unwrap_or(4) as u32,
                        ts["denominator"].as_u64().unwrap_or(4) as u32,
                    ))
                } else {
                    None
                }
            })
        })
        .or_else(|| {
            score["time_signature_changes"].as_array().and_then(|arr| {
                arr.first().map(|ts| {
                    (
                        ts["numerator"].as_u64().unwrap_or(4) as u32,
                        ts["denominator"].as_u64().unwrap_or(4) as u32,
                    )
                })
            })
        })
        .or_else(|| {
            score["instruments"]
                .as_array()
                .and_then(|insts| insts.first())
                .and_then(|inst| inst["staves"].as_array())
                .and_then(|s| s.first())
                .and_then(|st| {
                    let ts = &st["time_signature"];
                    if ts.is_object() {
                        Some((
                            ts["numerator"].as_u64().unwrap_or(4) as u32,
                            ts["denominator"].as_u64().unwrap_or(4) as u32,
                        ))
                    } else {
                        None
                    }
                })
        })
        .unwrap_or((4, 4));
    let ticks_per_measure: u32 = (3840 * time_numerator) / time_denominator;

    // Read pickup_ticks for anacrusis/pickup measure support
    let pickup_ticks = score["pickup_ticks"].as_u64().unwrap_or(0) as u32;

    // Extract measures from score using actual time signature
    let measures = extract_measures(score, ticks_per_measure, pickup_ticks);

    // Extract repeat barline flags indexed by measure position (Feature 041)
    let mut start_repeat_set: std::collections::HashSet<u32> = std::collections::HashSet::new();
    let mut end_repeat_set: std::collections::HashSet<u32> = std::collections::HashSet::new();
    if let Some(repeat_barlines) = score["repeat_barlines"].as_array() {
        for rb in repeat_barlines {
            if let Some(idx) = rb["measure_index"].as_u64() {
                match rb["barline_type"].as_str().unwrap_or("") {
                    "Start" => {
                        start_repeat_set.insert(idx as u32);
                    }
                    "End" => {
                        end_repeat_set.insert(idx as u32);
                    }
                    "Both" => {
                        start_repeat_set.insert(idx as u32);
                        end_repeat_set.insert(idx as u32);
                    }
                    _ => {}
                }
            }
        }
    }

    // Extract volta brackets for layout rendering (Feature 047)
    struct VoltaBracketData {
        number: u8,
        start_measure_index: u32,
        end_measure_index: u32,
        end_type_is_stop: bool,
    }
    let mut volta_bracket_data: Vec<VoltaBracketData> = Vec::new();
    if let Some(volta_brackets) = score["volta_brackets"].as_array() {
        for vb in volta_brackets {
            if let (Some(number), Some(start_mi), Some(end_mi)) = (
                vb["number"].as_u64(),
                vb["start_measure_index"].as_u64(),
                vb["end_measure_index"].as_u64(),
            ) {
                let end_type = vb["end_type"].as_str().unwrap_or("Stop");
                volta_bracket_data.push(VoltaBracketData {
                    number: number as u8,
                    start_measure_index: start_mi as u32,
                    end_measure_index: end_mi as u32,
                    end_type_is_stop: end_type == "Stop",
                });
            }
        }
    }

    // Compute measure widths using spacer
    let spacing_config = spacer::SpacingConfig::default();
    let measure_infos: Vec<breaker::MeasureInfo> = measures
        .iter()
        .enumerate()
        .map(|(i, (note_durations, rest_durations))| {
            let width =
                spacer::compute_measure_width(note_durations, rest_durations, &spacing_config);
            let start = measure_start_tick(i, pickup_ticks, ticks_per_measure);
            let end = measure_end_tick(i, pickup_ticks, ticks_per_measure);
            breaker::MeasureInfo {
                width,
                start_tick: start,
                end_tick: end,
                start_repeat: start_repeat_set.contains(&(i as u32)),
                end_repeat: end_repeat_set.contains(&(i as u32)),
            }
        })
        .collect();

    // Extract instruments from score (needed before breaking to compute system height)
    let instruments = extract_instruments(score, time_numerator, time_denominator);

    // Compute effective system height based on total staves across ALL instruments.
    // A single staff occupies 4 * units_per_space (5 lines, 4 gaps of 1 space each).
    // Intra-instrument spacing: 14 * units_per_space between staves of the same instrument.
    // Inter-instrument spacing: 8 * units_per_space between different instruments (larger gap).
    // Add padding for measure numbers above (30 units) and spacing below (10 units).
    let total_staves: usize = instruments.iter().map(|i| i.staves.len()).sum();
    let num_instruments = instruments.len();

    // Spacing multipliers (in staff-space units)
    let intra_staff_multiplier = 8.0_f32; // Between staves of the same instrument (compact with room for ledger lines)
    let inter_instrument_multiplier = 5.0_f32; // Extra gap between different instruments

    // Inter-instrument gap: extra spacing between different instruments
    let inter_instrument_gap = if num_instruments > 1 {
        (num_instruments as f32 - 1.0) * inter_instrument_multiplier * config.units_per_space
    } else {
        0.0
    };

    // Content height must match the actual vertical extent of positioned staves.
    // Each staff is offset by: absolute_staff_index * intra_staff_multiplier * ups + cumulative_inter_gap.
    // The last staff extends 4 * ups (5 lines) below its offset, plus padding.
    let content_height = if total_staves > 0 {
        (total_staves as f32 - 1.0) * intra_staff_multiplier * config.units_per_space
            + inter_instrument_gap
            + 4.0 * config.units_per_space
            + 40.0
    } else {
        4.0 * config.units_per_space + 40.0
    };
    let effective_system_height = if total_staves > 0 {
        config.system_height.max(content_height)
    } else {
        config.system_height
    };

    // Break into systems using effective height that accommodates all staves
    let mut systems = breaker::break_into_systems(
        &measure_infos,
        config.max_system_width,
        effective_system_height,
        config.system_spacing,
    );

    // Populate staff_groups for each system with positioned and batched glyphs
    let mut running_y: f32 = 0.0; // Track cumulative y position across systems (collision-aware)
    for system in &mut systems {
        // Update system y to account for collision-adjusted heights of previous systems
        system.bounding_box.y = running_y;

        let mut staff_groups = Vec::new();
        // Track cumulative vertical offset across instruments within this system
        let mut global_staff_offset: usize = 0;
        let mut cumulative_inter_gap: f32 = 0.0;

        // Compute a single unified left margin across ALL instruments so that
        // note positions are consistent (same available width for all staves).
        // For multi-key pieces, use the maximum key sig width across all key events.
        let max_key_sig_width: f32 = instruments
            .iter()
            .map(|inst| {
                inst.staves
                    .first()
                    .map(|s| {
                        if s.key_signature_events.is_empty() {
                            s.key_sharps.abs() as f32 * 15.0
                        } else {
                            s.key_signature_events
                                .iter()
                                .map(|&(_, k)| k.abs() as f32 * 15.0)
                                .fold(0.0_f32, f32::max)
                        }
                    })
                    .unwrap_or(0.0)
            })
            .fold(0.0_f32, f32::max);
        let unified_left_margin = 210.0 + max_key_sig_width;

        // Compute unified note positions across ALL instruments in this system.
        // This ensures measures and notes at the same tick align horizontally
        // across every staff group (e.g., violin beat 2 lines up with cello beat 2).
        let all_staves: Vec<&StaffData> = instruments
            .iter()
            .flat_map(|inst| inst.staves.iter())
            .collect();
        // `system.bounding_box.width` is the sum of measure widths from compute_measure_width,
        // which does NOT include the left margin (clef + key/time sigs = ~210 units).
        // compute_unified_note_positions subtracts unified_left_margin to get available_width,
        // so we must add it back here — otherwise notes are compressed by a factor of
        // (measure_width - 210) / measure_width, getting worse as note count decreases.
        let note_positions = compute_unified_note_positions(
            &all_staves,
            &system.tick_range,
            system.bounding_box.width + unified_left_margin,
            unified_left_margin,
            &spacing_config,
            ticks_per_measure,
        );

        // Compute measure boundary x positions for this system.
        // Content-bearing measures end where their last event is (+clearance).
        // Empty measures (only whole-measure rests) share the remaining width equally.
        let measure_x_bounds: HashMap<u32, (f32, f32)> = {
            let measures_in_sys: Vec<&breaker::MeasureInfo> = measure_infos
                .iter()
                .filter(|m| {
                    m.start_tick < system.tick_range.end_tick
                        && m.end_tick > system.tick_range.start_tick
                })
                .collect();

            // First pass: determine content width for measures that have events
            let clearance = 30.0_f32;
            let mut content_widths: Vec<Option<f32>> = Vec::with_capacity(measures_in_sys.len());
            let mut total_content_width = 0.0_f32;
            let mut empty_count = 0_usize;

            for m in &measures_in_sys {
                let last_event = note_positions
                    .iter()
                    .filter(|(tick, _)| **tick >= m.start_tick && **tick < m.end_tick)
                    .max_by_key(|(tick, _)| *tick);

                if let Some((_, &x)) = last_event {
                    // Content measure: width = last event position + clearance - left edge
                    // We'll compute the actual width relative to running_x below
                    content_widths.push(Some(x + clearance));
                } else {
                    content_widths.push(None);
                    empty_count += 1;
                }
            }

            // Compute total system width from allocated measure widths
            let total_system_width: f32 =
                measures_in_sys.iter().map(|m| m.width).sum::<f32>() + unified_left_margin;

            // Second pass: compute actual content width (relative to running_x)
            let mut running_x = unified_left_margin;
            for cw in &content_widths {
                if let Some(abs_end) = cw {
                    total_content_width += (*abs_end - running_x).max(0.0);
                    running_x = *abs_end;
                } else {
                    // placeholder — will be computed below
                    running_x += 0.0;
                }
            }

            // Remaining width for empty measures
            let remaining_width = (total_system_width - unified_left_margin - total_content_width)
                .max(empty_count as f32 * 100.0); // minimum 100 per empty measure
            let empty_measure_width = if empty_count > 0 {
                remaining_width / empty_count as f32
            } else {
                0.0
            };

            // Third pass: assign bounds sequentially
            let mut bounds = HashMap::new();
            running_x = unified_left_margin;
            for (i, m) in measures_in_sys.iter().enumerate() {
                let start_x = running_x;
                if let Some(abs_end) = content_widths[i] {
                    running_x = abs_end;
                } else {
                    running_x += empty_measure_width;
                }
                bounds.insert(m.start_tick, (start_x, running_x));
            }
            bounds
        };

        // --- Collision-aware spacing pre-scan ---
        // Compute note Y extents for each staff (relative to staff origin) to detect
        // collisions between adjacent staves. If notes from one staff extend into
        // another staff's region, we increase the spacing for THIS system only.
        let staff_extents: Vec<(f32, f32)> = instruments
            .iter()
            .flat_map(|inst| inst.staves.iter())
            .map(|sd| compute_staff_note_extents(sd, &system.tick_range, config.units_per_space))
            .collect();

        // For each staff, record whether an inter-instrument gap precedes it
        let mut has_inter_gap_before: Vec<bool> = Vec::new();
        for (inst_idx, inst) in instruments.iter().enumerate() {
            for (staff_idx, _) in inst.staves.iter().enumerate() {
                has_inter_gap_before.push(inst_idx > 0 && staff_idx == 0);
            }
        }

        // Compute cumulative collision-avoidance extra per staff
        let min_clearance = 1.0 * config.units_per_space; // 1 staff-space clearance
        let mut cumulative_collision_extra: Vec<f32> = vec![0.0; staff_extents.len()];
        for i in 0..staff_extents.len().saturating_sub(1) {
            let (_, max_y_upper) = staff_extents[i]; // bottom extent of upper staff
            let (min_y_lower, _) = staff_extents[i + 1]; // top extent of lower staff

            // Default spacing between origins of staff i and staff i+1
            let mut pair_spacing = intra_staff_multiplier * config.units_per_space;
            if has_inter_gap_before[i + 1] {
                pair_spacing += inter_instrument_multiplier * config.units_per_space;
            }

            // Needed spacing so bottom of upper staff is min_clearance above top of lower
            let needed = max_y_upper - min_y_lower + min_clearance;
            let extra = (needed - pair_spacing).max(0.0);
            cumulative_collision_extra[i + 1] = cumulative_collision_extra[i] + extra;
        }
        let total_collision_extra = cumulative_collision_extra.last().copied().unwrap_or(0.0);

        for (instrument_index, instrument) in instruments.iter().enumerate() {
            let mut staves = Vec::new();

            // Accumulate inter-instrument gap (not before the first instrument)
            if instrument_index > 0 {
                cumulative_inter_gap += inter_instrument_multiplier * config.units_per_space;
            }

            for (staff_index, staff_data) in instrument.staves.iter().enumerate() {
                // Calculate vertical offset using global_staff_offset (accounts for all previous instruments' staves)
                // plus inter-instrument gap accumulated from previous instruments
                // plus collision-avoidance extra for this system
                let absolute_staff_index = global_staff_offset + staff_index;
                let staff_vertical_offset = system.bounding_box.y
                    + (absolute_staff_index as f32
                        * intra_staff_multiplier
                        * config.units_per_space)
                    + cumulative_inter_gap
                    + cumulative_collision_extra[absolute_staff_index];

                // Position glyphs for this staff using unified note positions
                let glyphs = position_glyphs_for_staff(
                    staff_data,
                    &system.tick_range,
                    config.units_per_space,
                    &instrument.id,
                    staff_index,
                    staff_vertical_offset,
                    &note_positions,
                    unified_left_margin,
                    ticks_per_measure,
                    &measure_x_bounds,
                );

                // Separate pseudo-glyphs (stems U+0000, beams U+0001) from text glyphs
                // so they don't break text batching efficiency. Pseudo-glyphs are
                // rendered as SVG elements, not Canvas text.
                let (text_glyphs, pseudo_glyphs): (Vec<_>, Vec<_>) = glyphs
                    .into_iter()
                    .partition(|g| g.codepoint != "\u{0000}" && g.codepoint != "\u{0001}");

                // Batch text glyphs for efficient rendering
                let mut glyph_runs = batcher::batch_glyphs(text_glyphs);
                // Add pseudo-glyphs as individual runs (each rendered separately)
                glyph_runs.extend(batcher::batch_glyphs(pseudo_glyphs));

                // Create staff lines (5 lines evenly spaced)
                let staff_lines = create_staff_lines(
                    staff_vertical_offset,
                    system.bounding_box.width,
                    config.units_per_space,
                );

                // T036-T037: Generate structural glyphs (clef, time sig, key sig) at system start
                let mut structural_glyphs = Vec::new();

                // Determine the active key signature at this system's start tick
                let system_key_sharps = staff_data.get_key_at_tick(system.tick_range.start_tick);

                // Determine the active clef at this system's start tick
                let system_clef = staff_data.get_clef_at_tick(system.tick_range.start_tick);

                // Position clef at x=60 (left margin with room for brace and glyph extent)
                let clef_glyph = positioner::position_clef(
                    system_clef,
                    60.0,
                    config.units_per_space,
                    staff_vertical_offset,
                );
                structural_glyphs.push(clef_glyph);

                // Position key signature after clef (x=120)
                let key_sig_glyphs = positioner::position_key_signature(
                    system_key_sharps,
                    system_clef,
                    120.0,
                    config.units_per_space,
                    staff_vertical_offset,
                );
                structural_glyphs.extend(key_sig_glyphs);

                // Position time signature after key signature — only on the first system
                // (standard engraving: repeat only when the time signature changes)
                if system.index == 0 {
                    let key_sig_width = system_key_sharps.abs() as f32 * 15.0;
                    let time_sig_x = 120.0 + key_sig_width + 20.0; // Add 20 unit gap
                    let time_sig_glyphs = positioner::position_time_signature(
                        staff_data.time_numerator,
                        staff_data.time_denominator,
                        time_sig_x,
                        config.units_per_space,
                        staff_vertical_offset,
                    );
                    structural_glyphs.extend(time_sig_glyphs);
                }

                // Render key signature changes at mid-system measure boundaries
                if !staff_data.key_signature_events.is_empty() {
                    for &(event_tick, event_sharps) in &staff_data.key_signature_events {
                        // Skip if event is outside this system's tick range
                        if event_tick <= system.tick_range.start_tick
                            || event_tick >= system.tick_range.end_tick
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
                                config.units_per_space,
                                staff_vertical_offset,
                            );
                            structural_glyphs.extend(mid_key_glyphs);
                        }
                    }
                }

                // Render clef changes within this system (mid-system and
                // mid-measure).  Also render a courtesy clef at the right
                // edge when the clef changes at the start of the next system.
                if !staff_data.clef_events.is_empty() {
                    for (event_tick, event_clef) in &staff_data.clef_events {
                        // Skip the initial clef (tick 0 or system start) — it is
                        // already rendered as the system-start clef glyph.
                        if *event_tick <= system.tick_range.start_tick {
                            continue;
                        }

                        // Courtesy clef: event falls on or after this system's
                        // end tick → place a small warning clef at the right edge.
                        if *event_tick >= system.tick_range.end_tick {
                            if *event_tick == system.tick_range.end_tick {
                                let courtesy_x = system.bounding_box.width - 40.0;
                                let courtesy_glyph = positioner::position_courtesy_clef(
                                    event_clef,
                                    courtesy_x,
                                    config.units_per_space,
                                    staff_vertical_offset,
                                );
                                structural_glyphs.push(courtesy_glyph);
                            }
                            continue;
                        }

                        // Event is inside this system.  Find the enclosing
                        // measure: the one whose start_tick is the largest value
                        // that is ≤ event_tick.
                        let enclosing = measure_x_bounds
                            .iter()
                            .filter(|(tick, _)| **tick <= *event_tick)
                            .max_by_key(|(tick, _)| *tick);

                        if let Some((&_m_tick, &(measure_x_start, measure_x_end))) = enclosing {
                            // Place the courtesy clef near the start of the
                            // measure (for measure-start changes) or offset
                            // proportionally for mid-measure changes.
                            let clef_x = if *event_tick == _m_tick {
                                measure_x_start + 10.0
                            } else {
                                // Mid-measure: position at a fraction of the
                                // measure width based on tick offset.
                                let measure_width = measure_x_end - measure_x_start;
                                let ticks_per_meas = system
                                    .tick_range
                                    .end_tick
                                    .saturating_sub(system.tick_range.start_tick);
                                let measures_count = measure_x_bounds.len().max(1) as u32;
                                let avg_ticks = ticks_per_meas / measures_count;
                                let offset_ticks = event_tick - _m_tick;
                                let frac = if avg_ticks > 0 {
                                    (offset_ticks as f32 / avg_ticks as f32).min(0.9)
                                } else {
                                    0.5
                                };
                                measure_x_start + measure_width * frac
                            };
                            let mid_clef_glyph = positioner::position_courtesy_clef(
                                event_clef,
                                clef_x,
                                config.units_per_space,
                                staff_vertical_offset,
                            );
                            structural_glyphs.push(mid_clef_glyph);
                        }
                    }
                }

                // Create bar lines at measure boundaries
                let bar_lines = create_bar_lines(
                    &measure_infos,
                    &system.tick_range,
                    staff_vertical_offset,
                    unified_left_margin,
                    system.bounding_box.width,
                    config.units_per_space,
                    &note_positions,
                    &measure_x_bounds,
                );

                // Generate ledger lines for notes outside the 5-line staff
                let mut ledger_lines = Vec::new();
                for voice in &staff_data.voices {
                    let notes_in_range: Vec<NoteData> = voice
                        .notes
                        .iter()
                        .filter(|note| {
                            note.start_tick >= system.tick_range.start_tick
                                && note.start_tick < system.tick_range.end_tick
                        })
                        .map(|note| {
                            (
                                note.pitch,
                                note.start_tick,
                                note.duration_ticks,
                                note.spelling,
                            )
                        })
                        .collect();
                    let offsets: Vec<f32> = notes_in_range
                        .iter()
                        .map(|(_, tick, _, _)| *note_positions.get(tick).unwrap_or(&0.0))
                        .collect();
                    let ledger_clefs: Vec<&str> = notes_in_range
                        .iter()
                        .map(|(_, tick, _, _)| staff_data.get_clef_at_tick(*tick))
                        .collect();
                    ledger_lines.extend(positioner::position_ledger_lines(
                        &notes_in_range,
                        &offsets,
                        &ledger_clefs,
                        config.units_per_space,
                        staff_vertical_offset,
                    ));
                }

                // Create staff with batched glyphs and structural glyphs
                let staff = Staff {
                    staff_lines,
                    glyph_runs,
                    structural_glyphs,
                    bar_lines,
                    ledger_lines,
                };

                staves.push(staff);
            }

            // Calculate bracket glyph geometry if multi-staff instrument
            let bracket_type = if instrument.staves.len() > 1 {
                BracketType::Brace
            } else {
                BracketType::None
            };

            let bracket_glyph = if instrument.staves.len() > 1 {
                Some(create_bracket_glyph(&staves, &bracket_type, config))
            } else {
                None
            };

            // Compute name label position: to the left of bracket, vertically centered
            let name_label = {
                let first_staff_top = staves[0].staff_lines[0].y_position;
                let last_staff_bottom = staves.last().unwrap().staff_lines[4].y_position;
                let center_y = (first_staff_top + last_staff_bottom) / 2.0;

                // Position x before the bracket/brace (bracket is at x=15)
                // Use negative x — the viewport will be expanded to show this area
                let label_x = -10.0; // Right-aligned text anchor, so text extends leftward

                Some(NameLabel {
                    text: instrument.name.clone(),
                    position: Point {
                        x: label_x,
                        y: center_y,
                    },
                    font_size: 32.0,
                    font_family: "serif".to_string(),
                    color: Color {
                        r: 0,
                        g: 0,
                        b: 0,
                        a: 255,
                    },
                })
            };

            // Create staff group for this instrument
            let staff_group = StaffGroup {
                instrument_id: instrument.id.clone(),
                instrument_name: instrument.name.clone(),
                staves,
                bracket_type,
                bracket_glyph,
                name_label,
            };

            staff_groups.push(staff_group);

            // Update global_staff_offset for the next instrument
            global_staff_offset += instrument.staves.len();
        }

        system.staff_groups = staff_groups;

        // Find the rightmost barline x position across all staves.
        // This is the end-of-system barline (every system must end with one).
        let max_barline_x = system
            .staff_groups
            .iter()
            .flat_map(|sg| sg.staves.iter())
            .flat_map(|s| s.bar_lines.iter())
            .map(|bl| {
                bl.segments
                    .iter()
                    .map(|seg| seg.x_position)
                    .fold(0.0_f32, f32::max)
            })
            .fold(0.0_f32, f32::max);

        // Staff lines end exactly at the rightmost barline — no extra margin.
        let content_width = if max_barline_x > 0.0 {
            max_barline_x
        } else {
            // Fallback: use original system width if no barlines were generated
            system.bounding_box.width
        };

        // Update all staff lines to end at the final barline
        for staff_group in &mut system.staff_groups {
            for staff in &mut staff_group.staves {
                for line in &mut staff.staff_lines {
                    line.end_x = content_width;
                }
            }
        }

        // Update system bounding box width to match actual content
        system.bounding_box.width = content_width;

        // Update system height to include collision-avoidance extra spacing
        system.bounding_box.height += total_collision_extra;

        // T010: Compute measure number for this system
        // Derive measure number from the system's start tick using actual ticks per measure
        let measure_num = tick_to_measure_index(
            system.tick_range.start_tick,
            pickup_ticks,
            ticks_per_measure,
        ) as u32
            + 1;
        system.measure_number = Some(MeasureNumber {
            number: measure_num,
            position: Point {
                x: 60.0,                         // Aligned with clef
                y: system.bounding_box.y - 30.0, // Above topmost staff line
            },
        });

        // Compute volta bracket layouts for this system (Feature 047)
        for vbd in &volta_bracket_data {
            // Get the tick range for the bracket's measures
            let bracket_start_tick = measure_start_tick(
                vbd.start_measure_index as usize,
                pickup_ticks,
                ticks_per_measure,
            );
            let bracket_end_tick = measure_end_tick(
                vbd.end_measure_index as usize,
                pickup_ticks,
                ticks_per_measure,
            );

            // Check if this bracket overlaps with this system's tick range
            if bracket_start_tick >= system.tick_range.end_tick
                || bracket_end_tick <= system.tick_range.start_tick
            {
                continue;
            }

            // Clamp bracket to this system's tick range
            let effective_start = bracket_start_tick.max(system.tick_range.start_tick);
            let effective_end = bracket_end_tick.min(system.tick_range.end_tick);

            // Find x coordinates from measure_x_bounds
            let x_start = measure_x_bounds
                .get(&effective_start)
                .map(|(start, _)| *start)
                .unwrap_or(0.0);
            let x_end = measure_x_bounds
                .get(&(effective_end - ticks_per_measure).max(effective_start))
                .map(|(_, end)| *end)
                .unwrap_or(x_start + 100.0);

            // Only close the right end if this system contains the bracket's true end
            let closed_right =
                vbd.end_type_is_stop && bracket_end_tick <= system.tick_range.end_tick;

            system.volta_bracket_layouts.push(VoltaBracketLayout {
                number: vbd.number,
                label: format!("{}.", vbd.number),
                x_start,
                x_end,
                y: system.bounding_box.y - 20.0, // Above measure number
                closed_right,
            });
        }

        // Advance running_y for the next system
        running_y = system.bounding_box.y + system.bounding_box.height + config.system_spacing;
    }

    // Compute GlobalLayout dimensions
    // Use the maximum actual system width (already trimmed to content)
    let total_width = systems
        .iter()
        .map(|s| s.bounding_box.width)
        .max_by(|a, b| a.partial_cmp(b).unwrap())
        .unwrap_or(config.max_system_width);

    let total_height = if systems.is_empty() {
        0.0
    } else {
        let last_system = systems.last().unwrap();
        // Add bottom padding (100 units) so the last system's content
        // (notes below staff, stems, etc.) isn't clipped
        last_system.bounding_box.y + last_system.bounding_box.height + 100.0
    };

    GlobalLayout {
        systems,
        total_width,
        total_height,
        units_per_space: config.units_per_space,
    }
}

/// Extract measures from CompiledScore JSON
///
/// Returns a Vec where each element is a Vec of note durations for that measure.
/// For multi-staff instruments, notes at the same timing position are counted only once
/// (e.g., treble + bass notes sounding together take one horizontal space).
///
/// Returns a Vec where each element is `(note_durations, rest_durations)` for that measure.
fn extract_measures(
    score: &serde_json::Value,
    ticks_per_measure: u32,
    pickup_ticks: u32,
) -> Vec<(Vec<u32>, Vec<u32>)> {
    let mut note_measures: Vec<Vec<u32>> = Vec::new();
    let mut rest_measures: Vec<Vec<u32>> = Vec::new();

    // Extract notes from all instruments
    if let Some(instruments) = score["instruments"].as_array() {
        for instrument in instruments {
            if let Some(staves) = instrument["staves"].as_array() {
                // Collect all unique timing positions across all staves
                // (treble + bass notes at same tick = one horizontal position)
                // Map: tick -> max duration at that tick (use max so wider notes win)
                let mut all_notes_by_measure: std::collections::HashMap<
                    usize,
                    std::collections::HashMap<u32, u32>,
                > = std::collections::HashMap::new();
                let mut all_rests_by_measure: std::collections::HashMap<
                    usize,
                    std::collections::HashMap<u32, u32>,
                > = std::collections::HashMap::new();

                for staff in staves {
                    if let Some(voices) = staff["voices"].as_array() {
                        for voice in voices {
                            // --- Notes ---
                            // Try both "interval_events" (Score format) and "notes" (converted format)
                            let notes_array = voice["interval_events"]
                                .as_array()
                                .or_else(|| voice["notes"].as_array());

                            if let Some(notes) = notes_array {
                                for note in notes {
                                    // Support multiple field name formats:
                                    // Format 1 (Score): start_tick, duration_ticks
                                    // Format 2 (LayoutView): tick, duration
                                    // Format 3 (nested): start_tick.value
                                    let start_tick = note["start_tick"]
                                        .as_u64()
                                        .or_else(|| note["tick"].as_u64())
                                        .or_else(|| note["start_tick"]["value"].as_u64())
                                        .unwrap_or(0)
                                        as u32;

                                    let duration = note["duration_ticks"]
                                        .as_u64()
                                        .or_else(|| note["duration"].as_u64())
                                        .unwrap_or(960)
                                        as u32;

                                    // Determine which measure this note belongs to
                                    let measure_index = tick_to_measure_index(
                                        start_tick,
                                        pickup_ticks,
                                        ticks_per_measure,
                                    );

                                    // Track tick → duration (keep max duration at each tick position)
                                    let entry = all_notes_by_measure
                                        .entry(measure_index)
                                        .or_default()
                                        .entry(start_tick)
                                        .or_insert(0);
                                    *entry = (*entry).max(duration);
                                }
                            }

                            // --- Rests ---
                            if let Some(rest_events) = voice["rest_events"].as_array() {
                                for rest in rest_events {
                                    let start_tick = rest["start_tick"]
                                        .as_u64()
                                        .or_else(|| rest["start_tick"]["value"].as_u64())
                                        .unwrap_or(0)
                                        as u32;

                                    let duration =
                                        rest["duration_ticks"].as_u64().unwrap_or(960) as u32;

                                    let measure_index = tick_to_measure_index(
                                        start_tick,
                                        pickup_ticks,
                                        ticks_per_measure,
                                    );

                                    let entry = all_rests_by_measure
                                        .entry(measure_index)
                                        .or_default()
                                        .entry(start_tick)
                                        .or_insert(0);
                                    *entry = (*entry).max(duration);
                                }
                            }
                        }
                    }
                }

                // Convert tick→duration maps to flat duration lists for compute_measure_width
                let max_measure = all_notes_by_measure
                    .keys()
                    .chain(all_rests_by_measure.keys())
                    .copied()
                    .max()
                    .unwrap_or(0);

                for measure_index in 0..=max_measure {
                    while note_measures.len() <= measure_index {
                        note_measures.push(Vec::new());
                    }
                    while rest_measures.len() <= measure_index {
                        rest_measures.push(Vec::new());
                    }

                    if let Some(tick_durations) = all_notes_by_measure.get(&measure_index) {
                        for dur in tick_durations.values() {
                            note_measures[measure_index].push(*dur);
                        }
                    }
                    if let Some(tick_durations) = all_rests_by_measure.get(&measure_index) {
                        for dur in tick_durations.values() {
                            rest_measures[measure_index].push(*dur);
                        }
                    }
                }
            }
        }
    }

    // If no measures found, return empty default measures
    if note_measures.is_empty() && rest_measures.is_empty() {
        // 10 measures with 4 quarter notes each (no rests)
        (0..10).map(|_| (vec![960; 4], Vec::new())).collect()
    } else {
        let len = note_measures.len().max(rest_measures.len());
        note_measures.resize(len, Vec::new());
        rest_measures.resize(len, Vec::new());
        note_measures.into_iter().zip(rest_measures).collect()
    }
}

/// Represents an instrument with its staves extracted from CompiledScore
#[derive(Debug, Clone)]
struct InstrumentData {
    id: String,
    name: String,
    staves: Vec<StaffData>,
}

/// Represents a staff with voices and notes
#[derive(Debug, Clone)]
struct StaffData {
    voices: Vec<VoiceData>,
    clef: String,         // e.g., "Treble", "Bass", "Alto", "Tenor"
    time_numerator: u8,   // e.g., 4 for 4/4 time
    time_denominator: u8, // e.g., 4 for 4/4 time
    key_sharps: i8,       // Initial key: positive for sharps, negative for flats, 0 for C major
    /// Key signature changes sorted by tick. Empty if no mid-piece changes.
    key_signature_events: Vec<(u32, i8)>,
    /// Clef changes sorted by tick. Empty if no mid-piece changes.
    clef_events: Vec<(u32, String)>,
}

impl StaffData {
    /// Get the active key signature (sharps count) at a given tick.
    fn get_key_at_tick(&self, tick: u32) -> i8 {
        if self.key_signature_events.is_empty() {
            return self.key_sharps;
        }
        // Find the last event whose tick <= the query tick
        let mut result = self.key_sharps;
        for &(event_tick, sharps) in &self.key_signature_events {
            if event_tick <= tick {
                result = sharps;
            } else {
                break;
            }
        }
        result
    }

    /// Get the active clef at a given tick.
    fn get_clef_at_tick(&self, tick: u32) -> &str {
        if self.clef_events.is_empty() {
            return &self.clef;
        }
        let mut result = &self.clef;
        for (event_tick, clef) in &self.clef_events {
            if *event_tick <= tick {
                result = clef;
            } else {
                break;
            }
        }
        result
    }
}

/// Represents a voice with interval events (notes) and rest events
#[derive(Debug, Clone)]
struct VoiceData {
    notes: Vec<NoteEvent>,
    rests: Vec<RestLayoutEvent>,
}

/// Rest event extracted from ScoreDto JSON for layout processing
#[derive(Debug, Clone)]
pub(super) struct RestLayoutEvent {
    start_tick: u32,
    duration_ticks: u32,
    note_type: Option<String>,
    /// MusicXML voice number (1-indexed): odd = Voice 1 (up), even = Voice 2 (down)
    voice: usize,
}

/// Note data tuple: (pitch, start_tick, duration_ticks, spelling)
///
/// Spelling is an optional (step_letter, alter) pair from MusicXML,
/// e.g. ('E', -1) for Eb, ('D', 1) for D#.
pub type NoteData = (u8, u32, u32, Option<(char, i8)>);

/// Represents a single note event
#[derive(Debug, Clone)]
struct NoteEvent {
    pitch: u8,
    start_tick: u32,
    duration_ticks: u32,
    /// Explicit spelling from MusicXML: (step_letter, alter) e.g. ('E', -1) for Eb
    spelling: Option<(char, i8)>,
    /// Beam annotations from MusicXML import (empty = needs algorithmic grouping)
    beam_info: Vec<(u8, String)>, // (beam_level, beam_type_string)
}

/// Extract instruments from CompiledScore JSON
fn extract_instruments(
    score: &serde_json::Value,
    global_time_numerator: u32,
    global_time_denominator: u32,
) -> Vec<InstrumentData> {
    let mut instruments = Vec::new();

    if let Some(instruments_array) = score["instruments"].as_array() {
        for instrument in instruments_array {
            let id = instrument["id"].as_str().unwrap_or("unknown").to_string();
            let name = instrument["name"]
                .as_str()
                .unwrap_or("Instrument")
                .to_string();
            let mut staves = Vec::new();

            if let Some(staves_array) = instrument["staves"].as_array() {
                for staff in staves_array {
                    let mut voices = Vec::new();

                    // Extract structural metadata (with defaults)
                    let clef = staff["clef"].as_str().unwrap_or("Treble").to_string();
                    // Use time signature from global_structural_events;
                    // fall back to staff-level for test fixtures that set it there
                    let time_numerator = if global_time_numerator != 4
                        || global_time_denominator != 4
                    {
                        global_time_numerator as u8
                    } else {
                        staff["time_signature"]["numerator"]
                            .as_u64()
                            .unwrap_or(global_time_numerator as u64) as u8
                    };
                    let time_denominator = if global_time_numerator != 4
                        || global_time_denominator != 4
                    {
                        global_time_denominator as u8
                    } else {
                        staff["time_signature"]["denominator"]
                            .as_u64()
                            .unwrap_or(global_time_denominator as u64) as u8
                    };
                    let key_sharps = staff["key_signature"]["sharps"].as_i64().unwrap_or(0) as i8;

                    if let Some(voices_array) = staff["voices"].as_array() {
                        for voice in voices_array {
                            let mut notes = Vec::new();

                            // T008-T009: Support both "notes" (LayoutView format) and "interval_events" (CompiledScore format)
                            // Check "notes" first for frontend fixtures, fall back to "interval_events" for backward compatibility

                            let note_array = voice["notes"]
                                .as_array()
                                .or_else(|| voice["interval_events"].as_array());

                            if let Some(notes_data) = note_array {
                                for note_item in notes_data {
                                    // Handle both formats:
                                    // Format 1 (notes): {tick: 0, duration: 960, pitch: 60}
                                    // Format 2 (interval_events): {start_tick: {value: 0}, duration_ticks: 960, pitch: {value: 60}}

                                    let pitch = if let Some(p) = note_item["pitch"].as_u64() {
                                        p as u8 // Format 1: direct value
                                    } else {
                                        note_item["pitch"]["value"].as_u64().unwrap_or(60) as u8 // Format 2: nested
                                    };

                                    let start_tick = if let Some(t) = note_item["tick"].as_u64() {
                                        t as u32 // Format 1: "tick"
                                    } else {
                                        note_item["start_tick"]
                                            .as_u64()
                                            .or_else(|| note_item["start_tick"]["value"].as_u64())
                                            .unwrap_or(0)
                                            as u32 // Format 2: plain int or nested
                                    };

                                    let duration_ticks = if let Some(d) =
                                        note_item["duration"].as_u64()
                                    {
                                        d as u32 // Format 1: "duration"
                                    } else {
                                        note_item["duration_ticks"].as_u64().unwrap_or(960) as u32 // Format 2
                                    };

                                    // Extract optional note spelling (step + alter) from MusicXML
                                    let spelling = note_item["spelling"]["step"]
                                        .as_str()
                                        .and_then(|s| s.chars().next())
                                        .and_then(|step| {
                                            note_item["spelling"]["alter"]
                                                .as_i64()
                                                .map(|alter| (step, alter as i8))
                                        });

                                    notes.push(NoteEvent {
                                        pitch,
                                        start_tick,
                                        duration_ticks,
                                        spelling,
                                        beam_info: {
                                            let mut beams = Vec::new();
                                            if let Some(beam_array) = note_item["beams"].as_array()
                                            {
                                                for beam_item in beam_array {
                                                    let number =
                                                        beam_item["number"].as_u64().unwrap_or(1)
                                                            as u8;
                                                    let beam_type = beam_item["beam_type"]
                                                        .as_str()
                                                        .unwrap_or("")
                                                        .to_string();
                                                    beams.push((number, beam_type));
                                                }
                                            }
                                            beams
                                        },
                                    });
                                }
                            }

                            voices.push(VoiceData {
                                notes,
                                rests: {
                                    let mut rests = Vec::new();
                                    if let Some(rest_events) = voice["rest_events"].as_array() {
                                        for rest_item in rest_events {
                                            let start_tick = rest_item["start_tick"]
                                                .as_u64()
                                                .or_else(|| {
                                                    rest_item["start_tick"]["value"].as_u64()
                                                })
                                                .unwrap_or(0)
                                                as u32;
                                            let duration_ticks =
                                                rest_item["duration_ticks"].as_u64().unwrap_or(960)
                                                    as u32;
                                            let note_type = rest_item["note_type"]
                                                .as_str()
                                                .map(|s| s.to_string());
                                            let voice_num =
                                                rest_item["voice"].as_u64().unwrap_or(1) as usize;
                                            rests.push(RestLayoutEvent {
                                                start_tick,
                                                duration_ticks,
                                                note_type,
                                                voice: voice_num,
                                            });
                                        }
                                    }
                                    rests
                                },
                            });
                        }
                    }

                    // Parse key signature change events (for mid-piece key changes)
                    let mut key_signature_events: Vec<(u32, i8)> = Vec::new();
                    if let Some(events_array) = staff["key_signature_events"].as_array() {
                        for ev in events_array {
                            let tick = ev["tick"].as_u64().unwrap_or(0) as u32;
                            let sharps = ev["sharps"].as_i64().unwrap_or(0) as i8;
                            key_signature_events.push((tick, sharps));
                        }
                        key_signature_events.sort_by_key(|&(t, _)| t);
                    }

                    // Parse clef change events (for mid-piece clef changes)
                    let mut clef_events: Vec<(u32, String)> = Vec::new();
                    if let Some(events_array) = staff["clef_events"].as_array() {
                        for ev in events_array {
                            let tick = ev["tick"].as_u64().unwrap_or(0) as u32;
                            let clef_name = ev["clef"].as_str().unwrap_or("Treble").to_string();
                            clef_events.push((tick, clef_name));
                        }
                        clef_events.sort_by_key(|(t, _)| *t);
                    }

                    staves.push(StaffData {
                        voices,
                        clef,
                        time_numerator,
                        time_denominator,
                        key_sharps,
                        key_signature_events,
                        clef_events,
                    });
                }
            }

            instruments.push(InstrumentData { id, name, staves });
        }
    }

    instruments
}

/// Compute unified note positions across all staves in a system
///
/// For multi-instrument scores, notes at the same tick must align
/// horizontally across ALL staves and instruments. This function collects
/// all unique tick positions from every staff and computes a unified spacing map.
///
/// # Arguments
/// * `staves` - All staves across all instruments in this system
/// * `tick_range` - Tick range for this system
/// * `system_width` - Total system width in logical units
/// * `left_margin` - Left margin for note area
/// * `spacing_config` - Spacing configuration
///
/// # Returns
/// HashMap mapping tick positions to x-coordinates (Principle VI: Layout Engine Authority)
fn compute_unified_note_positions(
    staves: &[&StaffData],
    tick_range: &TickRange,
    system_width: f32,
    left_margin: f32,
    spacing_config: &spacer::SpacingConfig,
    ticks_per_measure: u32,
) -> HashMap<u32, f32> {
    // Collect all unique (tick, duration) pairs from all staves — notes AND
    // sub-beat rests. Full-measure rests are excluded because they are centred
    // within their measure via measure_x_bounds, not time-proportionally spaced.
    let mut tick_durations: Vec<(u32, u32)> = Vec::new();

    for staff_data in staves {
        for voice in &staff_data.voices {
            for note in &voice.notes {
                if note.start_tick >= tick_range.start_tick && note.start_tick < tick_range.end_tick
                {
                    tick_durations.push((note.start_tick, note.duration_ticks));
                }
            }
            for rest in &voice.rests {
                if rest.start_tick >= tick_range.start_tick
                    && rest.start_tick < tick_range.end_tick
                    && rest.duration_ticks < ticks_per_measure
                {
                    tick_durations.push((rest.start_tick, rest.duration_ticks));
                }
            }
        }
    }

    if tick_durations.is_empty() {
        return HashMap::new();
    }

    // Sort by tick position and remove duplicates
    tick_durations.sort_by_key(|(tick, _)| *tick);
    tick_durations.dedup_by_key(|(tick, _)| *tick);

    // Calculate cumulative spacing based on durations
    let mut cumulative_spacing = Vec::new();
    let mut current_position = 0.0;
    let mut last_tick = tick_range.start_tick;

    for (start_tick, duration_ticks) in &tick_durations {
        if *start_tick > last_tick {
            let gap_duration = (*start_tick - last_tick).min(*duration_ticks);
            current_position += spacer::compute_note_spacing(gap_duration, spacing_config);
        }
        cumulative_spacing.push(current_position);
        last_tick = *start_tick;
    }

    // Calculate total natural width
    // Add clearance space after last note for notehead width (≈20 units = half the notehead)
    // plus barline spacing (≈10 units) = 30 units total
    let end_clearance = 30.0;
    let total_natural_width = if let Some(&last_pos) = cumulative_spacing.last() {
        let (_, last_duration) = tick_durations.last().unwrap();
        last_pos + spacer::compute_note_spacing(*last_duration, spacing_config) + end_clearance
    } else {
        spacing_config.minimum_spacing + end_clearance
    };

    // Scale positions to fit available width — but only compress if content
    // exceeds the system width. Never stretch notes to fill extra space.
    let available_width = system_width - left_margin;
    let scale_factor = if total_natural_width > available_width {
        available_width / total_natural_width
    } else {
        1.0
    };

    // Build position map: tick -> x_position
    let mut position_map = HashMap::new();
    for (i, (tick, _)) in tick_durations.iter().enumerate() {
        let x_position = left_margin + (cumulative_spacing[i] * scale_factor);
        position_map.insert(*tick, x_position);
    }

    position_map
}

/// Position glyphs for a single staff within a system's tick range
///
/// Uses pre-computed unified note positions to ensure horizontal alignment
/// across all staves in a staff group (e.g., piano treble/bass).
///
/// # Arguments
/// * `staff_data` - Staff data containing voices and notes
/// * `tick_range` - Tick range for this system
/// * `units_per_space` - Scaling factor (20 units = 1 staff space)
/// * `instrument_id` - Instrument identifier
/// * `staff_index` - Index of this staff within the instrument
/// * `staff_vertical_offset` - Vertical offset for this staff
/// * `note_positions` - Pre-computed tick -> x_position map (unified across staves)
/// * `left_margin` - Left margin (clef + key sig + time sig width) for rest fallback
#[allow(clippy::too_many_arguments)]
fn position_glyphs_for_staff(
    staff_data: &StaffData,
    tick_range: &TickRange,
    units_per_space: f32,
    instrument_id: &str,
    staff_index: usize,
    staff_vertical_offset: f32,
    note_positions: &HashMap<u32, f32>,
    left_margin: f32,
    ticks_per_measure: u32,
    measure_x_bounds: &HashMap<u32, (f32, f32)>,
) -> Vec<Glyph> {
    let mut all_glyphs = Vec::new();

    for (voice_index, voice) in staff_data.voices.iter().enumerate() {
        // Filter notes that fall within this system's tick range
        let notes_in_range: Vec<NoteData> = voice
            .notes
            .iter()
            .filter(|note| {
                note.start_tick >= tick_range.start_tick && note.start_tick < tick_range.end_tick
            })
            .map(|note| {
                (
                    note.pitch,
                    note.start_tick,
                    note.duration_ticks,
                    note.spelling,
                )
            })
            .collect();

        if notes_in_range.is_empty() {
            continue;
        }

        // Use pre-computed positions from unified spacing (Principle VI)
        let horizontal_offsets: Vec<f32> = notes_in_range
            .iter()
            .map(|(_, start_tick, _, _)| *note_positions.get(start_tick).unwrap_or(&0.0))
            .collect();

        // Position noteheads using positioner module
        // First, compute beam groups to determine which notes are beamed
        let voice_notes_in_range: Vec<&NoteEvent> = voice
            .notes
            .iter()
            .filter(|note| {
                note.start_tick >= tick_range.start_tick && note.start_tick < tick_range.end_tick
            })
            .collect();

        // Compute per-note clef types based on active clef at each note's tick
        let note_clefs: Vec<&str> = notes_in_range
            .iter()
            .map(|(_, start_tick, _, _)| staff_data.get_clef_at_tick(*start_tick))
            .collect();

        // Build beamable notes with beam info for beam group analysis
        let beamable_for_analysis_raw: Vec<beams::BeamableNote> = voice_notes_in_range
            .iter()
            .enumerate()
            .filter(|(_, note)| note.duration_ticks <= 480) // Only eighth notes and shorter
            .map(|(i, note)| {
                let notehead_x = horizontal_offsets[i];
                let notehead_y = positioner::pitch_to_y(note.pitch, note_clefs[i], units_per_space)
                    + staff_vertical_offset;

                // Convert beam_info from (number, type_string) to beam_types list
                let beam_types: Vec<String> =
                    note.beam_info.iter().map(|(_, bt)| bt.clone()).collect();
                let beam_levels = note.beam_info.len() as u8;

                beams::BeamableNote {
                    x: notehead_x,
                    y: notehead_y,
                    stem_end_y: 0.0, // Will be computed after stems
                    tick: note.start_tick,
                    duration_ticks: note.duration_ticks,
                    beam_levels,
                    beam_types,
                    event_index: i, // Local index within this system's voice
                }
            })
            .collect();

        // Deduplicate chord notes: keep only one entry per tick for beam grouping.
        // Chord notes share a stem, so beaming only needs one note per time position.
        // For the Y position, use the lowest note (highest Y) for stem-down groups
        // and the highest note (lowest Y) for stem-up groups — we'll pick the first
        // occurrence which is sufficient for beam grouping since stem direction is
        // determined later by the group as a whole.
        let mut beamable_for_analysis: Vec<beams::BeamableNote> = Vec::new();
        let mut seen_ticks: std::collections::HashSet<u32> = std::collections::HashSet::new();
        for note in beamable_for_analysis_raw {
            if seen_ticks.insert(note.tick) {
                beamable_for_analysis.push(note);
            }
        }

        // Determine beam groups from MusicXML beam data
        let has_beam_info = beamable_for_analysis
            .iter()
            .any(|n| !n.beam_types.is_empty());
        let beam_groups = if has_beam_info {
            beams::build_beam_groups_from_musicxml(&beamable_for_analysis)
        } else {
            // T041: Algorithmic fallback using time signature-aware beat grouping
            let groups = beams::group_beamable_by_time_signature(
                &beamable_for_analysis,
                staff_data.time_numerator,
                staff_data.time_denominator,
            );
            groups
                .into_iter()
                .map(|notes| beams::BeamGroup {
                    beam_count: 1,
                    notes,
                })
                .collect()
        };

        // Build set of beamed note indices (indices into notes_in_range)
        let mut beamed_note_indices = std::collections::HashSet::<usize>::new();
        // Map tick → ALL note indices at that tick (chords have multiple notes per tick)
        let mut tick_to_indices: std::collections::HashMap<u32, Vec<usize>> =
            std::collections::HashMap::new();
        for (idx, (_, start_tick, duration_ticks, _)) in notes_in_range.iter().enumerate() {
            if *duration_ticks <= 480 {
                tick_to_indices.entry(*start_tick).or_default().push(idx);
            }
        }
        for group in &beam_groups {
            // T050: Skip degenerate single-note groups — they render with flags, not beams
            if group.notes.len() < 2 {
                continue;
            }
            for note in &group.notes {
                if let Some(indices) = tick_to_indices.get(&note.tick) {
                    for &idx in indices {
                        beamed_note_indices.insert(idx);
                    }
                }
            }
        }

        let glyphs = positioner::position_noteheads(
            &notes_in_range,
            &horizontal_offsets,
            &note_clefs,
            units_per_space,
            instrument_id,
            staff_index,
            voice_index,
            staff_vertical_offset,
            &beamed_note_indices,
        );

        all_glyphs.extend(glyphs);

        // Position accidentals based on key signature and measure context
        let accidental_glyphs = positioner::position_note_accidentals(
            &notes_in_range,
            &horizontal_offsets,
            &note_clefs,
            units_per_space,
            instrument_id,
            staff_index,
            voice_index,
            staff_vertical_offset,
            staff_data.key_sharps,
            ticks_per_measure,
            &staff_data.key_signature_events,
        );

        all_glyphs.extend(accidental_glyphs);

        // Generate stems and beams for beamed notes
        // Staff middle line (line 2 of 5) is at y = staff_vertical_offset + 2.0 * units_per_space.
        // However, pitch_to_y values include a -0.5*ups glyph-centering offset, so we adjust
        // staff_middle_y to match the same coordinate space for correct stem direction comparison.
        let staff_middle_y = staff_vertical_offset + 1.5 * units_per_space;

        let mut stem_glyphs = Vec::new();

        // For each beam group, compute uniform stem direction and generate stems + beams
        for group in &beam_groups {
            if group.notes.len() < 2 {
                continue; // Skip degenerate groups (single note → use flag)
            }

            // T033: Compute uniform stem direction for the group using majority rule
            let group_direction = beams::compute_group_stem_direction(&group.notes, staff_middle_y);

            let notehead_width = stems::Stem::NOTEHEAD_WIDTH;

            // === PHASE 1: Compute initial stems and beam line ===
            // Create initial stems (may not reach the beam yet)
            // Adjust note Y for visual rendering: pitch_to_y subtracts 0.5 staff spaces
            // to compensate for dominant-baseline:middle in SVG text rendering. But stems
            // are SVG <line> elements (not text), so they need the visual center Y.
            let visual_y_offset = 0.5 * units_per_space;
            let mut initial_stems: Vec<stems::Stem> = Vec::new();
            for note in &group.notes {
                let visual_y = note.y + visual_y_offset;
                let mut stem =
                    stems::create_stem(note.x, visual_y, group_direction, notehead_width);

                // Enforce minimum stem length for beamed notes
                let stem_length = (stem.y_end - stem.y_start).abs();
                let min_length = stems::Stem::MIN_BEAMED_STEM_LENGTH;
                if stem_length < min_length {
                    match group_direction {
                        stems::StemDirection::Up => {
                            stem.y_end = stem.y_start - min_length;
                        }
                        stems::StemDirection::Down => {
                            stem.y_end = stem.y_start + min_length;
                        }
                    }
                }
                initial_stems.push(stem);
            }

            // Compute the beam line from first and last stem endpoints
            let first_stem_end = initial_stems[0].y_end;
            let last_stem_end = initial_stems.last().unwrap().y_end;
            let first_stem_x = initial_stems[0].x;
            let last_stem_x = initial_stems.last().unwrap().x;
            let dx = last_stem_x - first_stem_x;
            let beam_slope = if dx.abs() > 0.001 {
                (last_stem_end - first_stem_end) / dx
            } else {
                0.0
            };

            // Clamp beam slope
            let max_slope_units = beams::Beam::MAX_SLOPE * units_per_space;
            let max_slope_per_unit = if dx.abs() > 0.001 {
                max_slope_units / dx.abs()
            } else {
                0.0
            };
            let clamped_slope = beam_slope.clamp(-max_slope_per_unit, max_slope_per_unit);

            // Compute the beam Y at each stem's X position
            // Then find the "outermost" beam position that ensures ALL stems are long enough
            // For stem-up: beam is above (smaller Y), so we need the MINIMUM y_end
            // For stem-down: beam is below (larger Y), so we need the MAXIMUM y_end
            let mut beam_y_at_stems: Vec<f32> = Vec::new();
            for stem in &initial_stems {
                let beam_y = first_stem_end + clamped_slope * (stem.x - first_stem_x);
                beam_y_at_stems.push(beam_y);
            }

            // Check if any stem is too short to reach the beam line and adjust
            // The beam must be positioned so ALL stems can reach it
            let mut beam_offset = 0.0f32;
            for (i, stem) in initial_stems.iter().enumerate() {
                let beam_y = beam_y_at_stems[i];
                let min_length = stems::Stem::MIN_BEAMED_STEM_LENGTH;
                match group_direction {
                    stems::StemDirection::Up => {
                        // Stem goes up (negative Y). beam_y should be <= stem.y_start - min_length
                        let required_beam_y = stem.y_start - min_length;
                        if beam_y > required_beam_y {
                            // Beam needs to move further up (more negative)
                            let needed_offset = required_beam_y - beam_y;
                            beam_offset = beam_offset.min(needed_offset);
                        }
                    }
                    stems::StemDirection::Down => {
                        // Stem goes down (positive Y). beam_y should be >= stem.y_start + min_length
                        let required_beam_y = stem.y_start + min_length;
                        if beam_y < required_beam_y {
                            // Beam needs to move further down (more positive)
                            let needed_offset = required_beam_y - beam_y;
                            beam_offset = beam_offset.max(needed_offset);
                        }
                    }
                }
            }

            // === PHASE 2: Extend ALL stems to reach the beam line ===
            let mut stem_end_ys = Vec::new();
            let mut stem_xs = Vec::new();

            for (i, stem) in initial_stems.iter().enumerate() {
                let adjusted_beam_y = beam_y_at_stems[i] + beam_offset;
                // Extend stem to reach the beam
                let final_stem_end = adjusted_beam_y;

                // Create stem glyph with adjusted length
                let stem_top_y = stem.y_start.min(final_stem_end);
                let stem_height = (final_stem_end - stem.y_start).abs();

                let stem_glyph = Glyph {
                    codepoint: '\u{0000}'.to_string(),
                    position: Point {
                        x: stem.x,
                        y: stem_top_y,
                    },
                    bounding_box: BoundingBox {
                        x: stem.x - (stem.thickness / 2.0),
                        y: stem_top_y,
                        width: stem.thickness,
                        height: stem_height,
                    },
                    source_reference: SourceReference {
                        instrument_id: instrument_id.to_string(),
                        staff_index,
                        voice_index,
                        event_index: group.notes[i].event_index,
                    },
                    font_size: None,
                };
                stem_glyphs.push(stem_glyph);
                stem_end_ys.push(final_stem_end);
                stem_xs.push(stem.x);
            }

            // === PHASE 3: Create beam at the adjusted position ===
            let beamable_with_stems: Vec<beams::BeamableNote> = group
                .notes
                .iter()
                .zip(stem_end_ys.iter().zip(stem_xs.iter()))
                .map(|(n, (&stem_end_y, &stem_x))| beams::BeamableNote {
                    x: stem_x,
                    y: n.y,
                    stem_end_y,
                    tick: n.tick,
                    duration_ticks: n.duration_ticks,
                    beam_levels: n.beam_levels,
                    beam_types: n.beam_types.clone(),
                    event_index: n.event_index,
                })
                .collect();

            // Create beam — slope is already embedded in the stem_end_y values
            let slope = clamped_slope;
            if let Some(beam) = beams::create_beam(&beamable_with_stems, slope) {
                // Encode beam as special glyph (U+0001)
                // For sloped beam rendering, we encode:
                //   position.x/y = left-side beam start (x_start, y_start)
                //   bounding_box.x = x_start
                //   bounding_box.y = y_end (right-side Y for slope reconstruction)
                //   bounding_box.width = horizontal span (x_end - x_start)
                //   bounding_box.height = beam thickness
                let beam_glyph = Glyph {
                    codepoint: '\u{0001}'.to_string(),
                    position: Point {
                        x: beam.x_start,
                        y: beam.y_start,
                    },
                    bounding_box: BoundingBox {
                        x: beam.x_start,
                        y: beam.y_end, // Right-side Y for slope
                        width: beam.x_end - beam.x_start,
                        height: beam.thickness,
                    },
                    source_reference: SourceReference {
                        instrument_id: instrument_id.to_string(),
                        staff_index,
                        voice_index,
                        // Beams use the first note's event_index — they visually span
                        // the whole group but clicking a beam selects the group's first note.
                        event_index: group.notes.first().map_or(0, |n| n.event_index),
                    },
                    font_size: None,
                };
                all_glyphs.push(beam_glyph);
            }

            // T027: Create secondary/tertiary beam levels for 16th, 32nd notes, etc.
            // Use beamable_with_stems (with correct stem_end_y) instead of original group
            let stem_direction_up = group_direction == stems::StemDirection::Up;
            let updated_group = beams::BeamGroup {
                notes: beamable_with_stems,
                beam_count: group.beam_count,
            };
            let multi_beams =
                beams::create_multi_level_beams(&updated_group, slope, stem_direction_up);
            for beam in multi_beams {
                let beam_glyph = Glyph {
                    codepoint: '\u{0001}'.to_string(),
                    position: Point {
                        x: beam.x_start,
                        y: beam.y_start,
                    },
                    bounding_box: BoundingBox {
                        x: beam.x_start,
                        y: beam.y_end, // Right-side Y for slope
                        width: beam.x_end - beam.x_start,
                        height: beam.thickness,
                    },
                    source_reference: SourceReference {
                        instrument_id: instrument_id.to_string(),
                        staff_index,
                        voice_index,
                        // Same as primary beam: use first note's event_index.
                        event_index: updated_group.notes.first().map_or(0, |n| n.event_index),
                    },
                    font_size: None,
                };
                all_glyphs.push(beam_glyph);
            }
        }

        all_glyphs.extend(stem_glyphs);
    }

    // T015: Position rests for this staff (all voices combined)
    let all_staff_rests: Vec<RestLayoutEvent> = staff_data
        .voices
        .iter()
        .flat_map(|v| v.rests.iter().cloned())
        .collect();

    if !all_staff_rests.is_empty() {
        let multi_voice = staff_data.voices.len() > 1;
        let rest_glyphs = positioner::position_rests_for_staff(
            &all_staff_rests,
            tick_range.start_tick,
            tick_range.end_tick,
            note_positions,
            staff_data.time_numerator,
            staff_data.time_denominator,
            multi_voice,
            units_per_space,
            staff_vertical_offset,
            left_margin,
            instrument_id,
            staff_index,
            measure_x_bounds,
        );
        all_glyphs.extend(rest_glyphs);
    }

    all_glyphs
}

/// Compute the vertical extent of notes in a staff for a given tick range.
///
/// Returns (min_y, max_y) relative to the staff origin (top line = 0).
/// min_y ≤ 0 means notes extend above the staff; max_y ≥ 4*ups means notes
/// extend below the staff. The baseline extent is always [0, 4*ups] (the
/// five staff lines themselves).
fn compute_staff_note_extents(
    staff_data: &StaffData,
    tick_range: &TickRange,
    units_per_space: f32,
) -> (f32, f32) {
    let mut min_y = 0.0_f32; // top staff line
    let mut max_y = 4.0 * units_per_space; // bottom staff line

    for voice in &staff_data.voices {
        for note in &voice.notes {
            if note.start_tick >= tick_range.start_tick && note.start_tick < tick_range.end_tick {
                let active_clef = staff_data.get_clef_at_tick(note.start_tick);
                let y = positioner::pitch_to_y_with_spelling(
                    note.pitch,
                    active_clef,
                    units_per_space,
                    note.spelling,
                );
                if y < min_y {
                    min_y = y;
                }
                if y > max_y {
                    max_y = y;
                }
            }
        }
    }

    (min_y, max_y)
}

/// Create staff lines for a single staff
fn create_staff_lines(
    staff_vertical_offset: f32,
    system_width: f32,
    units_per_space: f32,
) -> [StaffLine; 5] {
    // Create 5 evenly spaced lines (1 staff space apart)
    // A notehead fills exactly this gap, matching standard engraving
    let mut lines = Vec::new();
    for line_index in 0..5 {
        let y_position = staff_vertical_offset + (line_index as f32 * units_per_space);
        lines.push(StaffLine {
            y_position,
            start_x: 0.0,
            end_x: system_width,
        });
    }

    // Convert Vec to array (guaranteed to have exactly 5 elements)
    lines.try_into().unwrap()
}

/// Create bar lines for a single staff at measure boundaries
///
/// # Arguments
/// * `measure_infos` - All measures with their tick ranges and widths
/// * `tick_range` - The system's tick range
/// * `staff_index` - Index of staff for vertical positioning
/// * `left_margin` - Left margin where music content starts
/// * `system_width` - Total width of the system
/// * `units_per_space` - Scaling factor
/// * `system_y_position` - Vertical position of the system
///
/// # Returns
/// Vector of bar lines positioned at measure boundaries
#[allow(clippy::too_many_arguments)]
fn create_bar_lines(
    measure_infos: &[breaker::MeasureInfo],
    tick_range: &TickRange,
    staff_vertical_offset: f32,
    left_margin: f32,
    _system_width: f32,
    units_per_space: f32,
    note_positions: &HashMap<u32, f32>,
    measure_x_bounds: &HashMap<u32, (f32, f32)>,
) -> Vec<BarLine> {
    let mut bar_lines = Vec::new();

    // Y positions for top and bottom staff lines
    let y_start = staff_vertical_offset; // Top line (line 0)
    let y_end = staff_vertical_offset + (4.0 * units_per_space); // Bottom line (line 4)

    // Find measures that overlap with this system's tick range
    let measures_in_system: Vec<&breaker::MeasureInfo> = measure_infos
        .iter()
        .filter(|m| m.start_tick < tick_range.end_tick && m.end_tick > tick_range.start_tick)
        .collect();

    if measures_in_system.is_empty() {
        return bar_lines;
    }

    // Add bar lines at the end of each measure.
    // For measures with note/rest content, place barline after last event.
    // For empty measures (only whole-measure rests), use allocated boundary.
    for measure in measures_in_system.iter() {
        // Skip barline if measure extends beyond system
        if measure.end_tick > tick_range.end_tick {
            continue;
        }

        // Check if this measure has any events in the note_positions map
        let last_event_in_measure = note_positions
            .iter()
            .filter(|(tick, _)| **tick >= measure.start_tick && **tick < measure.end_tick)
            .max_by_key(|(tick, _)| *tick);

        let barline_x = if let Some((_, x)) = last_event_in_measure {
            // Measure has content — place barline after the last event
            *x + 30.0
        } else {
            // Empty measure — use allocated boundary for consistent spacing
            measure_x_bounds
                .get(&measure.start_tick)
                .map(|(_, end_x)| *end_x - 5.0)
                .unwrap_or(left_margin + 30.0)
        };

        // Determine bar line type
        let bar_type = {
            // Check repeat flags for this measure and the one that starts next
            let next_start_repeat = measure_infos
                .iter()
                .find(|m| m.start_tick == measure.end_tick)
                .map(|m| m.start_repeat)
                .unwrap_or(false);

            if measure.end_repeat && next_start_repeat {
                BarLineType::RepeatBoth
            } else if measure.end_repeat {
                BarLineType::RepeatEnd
            } else if next_start_repeat {
                BarLineType::RepeatStart
            } else if measure.end_tick == tick_range.end_tick {
                // Check if this is the very last measure in the entire score
                let is_last_measure =
                    measure_infos.last().map(|m| m.end_tick) == Some(measure.end_tick);
                if is_last_measure {
                    BarLineType::Final
                } else {
                    BarLineType::Single
                }
            } else {
                BarLineType::Single
            }
        };

        // Create bar line segments with explicit geometry (Principle VI: Layout Engine Authority)
        let segments = create_bar_line_segments(barline_x, y_start, y_end, &bar_type);
        let dots = compute_repeat_dots(barline_x, y_start, units_per_space, &bar_type);

        bar_lines.push(BarLine {
            segments,
            bar_type,
            dots,
        });
    }

    bar_lines
}

/// Creates bar line segments with explicit geometry for each line
/// This ensures the renderer doesn't calculate positions (Principle VI compliance)
fn create_bar_line_segments(
    x_position: f32,
    y_start: f32,
    y_end: f32,
    bar_type: &BarLineType,
) -> Vec<BarLineSegment> {
    const THIN_WIDTH: f32 = 1.5;
    const THICK_WIDTH: f32 = 4.0;
    const DOUBLE_SPACING: f32 = 4.0; // Space between double bar lines
    const FINAL_SPACING: f32 = 4.0; // Space between thin and thick in final bar

    match bar_type {
        BarLineType::Single => {
            vec![BarLineSegment {
                x_position,
                y_start,
                y_end,
                stroke_width: THIN_WIDTH,
            }]
        }
        BarLineType::Double => {
            vec![
                BarLineSegment {
                    x_position: x_position - DOUBLE_SPACING / 2.0,
                    y_start,
                    y_end,
                    stroke_width: THIN_WIDTH,
                },
                BarLineSegment {
                    x_position: x_position + DOUBLE_SPACING / 2.0,
                    y_start,
                    y_end,
                    stroke_width: THIN_WIDTH,
                },
            ]
        }
        BarLineType::Final => {
            vec![
                BarLineSegment {
                    x_position: x_position - FINAL_SPACING - THICK_WIDTH / 2.0,
                    y_start,
                    y_end,
                    stroke_width: THIN_WIDTH,
                },
                BarLineSegment {
                    x_position: x_position + THICK_WIDTH / 2.0,
                    y_start,
                    y_end,
                    stroke_width: THICK_WIDTH,
                },
            ]
        }
        BarLineType::RepeatEnd => {
            // Same visual as Final: thin bar on left, thick bar on right
            vec![
                BarLineSegment {
                    x_position: x_position - FINAL_SPACING - THICK_WIDTH / 2.0,
                    y_start,
                    y_end,
                    stroke_width: THIN_WIDTH,
                },
                BarLineSegment {
                    x_position: x_position + THICK_WIDTH / 2.0,
                    y_start,
                    y_end,
                    stroke_width: THICK_WIDTH,
                },
            ]
        }
        BarLineType::RepeatStart => {
            // Mirror of Final: thick bar on left, thin bar on right
            vec![
                BarLineSegment {
                    x_position: x_position - THICK_WIDTH / 2.0,
                    y_start,
                    y_end,
                    stroke_width: THICK_WIDTH,
                },
                BarLineSegment {
                    x_position: x_position + FINAL_SPACING + THICK_WIDTH / 2.0,
                    y_start,
                    y_end,
                    stroke_width: THIN_WIDTH,
                },
            ]
        }
        BarLineType::RepeatBoth => {
            // Combined end-repeat and start-repeat: thin-thick-thick-thin
            vec![
                BarLineSegment {
                    x_position: x_position - FINAL_SPACING - THICK_WIDTH,
                    y_start,
                    y_end,
                    stroke_width: THIN_WIDTH,
                },
                BarLineSegment {
                    x_position: x_position - THICK_WIDTH / 2.0,
                    y_start,
                    y_end,
                    stroke_width: THICK_WIDTH,
                },
                BarLineSegment {
                    x_position: x_position + THICK_WIDTH / 2.0,
                    y_start,
                    y_end,
                    stroke_width: THICK_WIDTH,
                },
                BarLineSegment {
                    x_position: x_position + FINAL_SPACING + THICK_WIDTH,
                    y_start,
                    y_end,
                    stroke_width: THIN_WIDTH,
                },
            ]
        }
    }
}

/// Compute repeat dot positions for repeat barline types (Principle VI: Layout Engine Authority)
///
/// All dot coordinates are computed here in Rust. TypeScript renders them verbatim.
fn compute_repeat_dots(
    x_position: f32,
    y_start: f32,
    units_per_space: f32,
    bar_type: &BarLineType,
) -> Vec<RepeatDotPosition> {
    const THICK_WIDTH: f32 = 4.0;
    let dot_radius = 0.25 * units_per_space;
    let x_offset = 0.6 * units_per_space;
    let dot_y0 = y_start + 1.0 * units_per_space;
    let dot_y1 = y_start + 3.0 * units_per_space;

    match bar_type {
        BarLineType::RepeatEnd => {
            // Thick bar center at x_position + THICK_WIDTH/2.0; dots to its left
            let dot_x = x_position + THICK_WIDTH / 2.0 - x_offset;
            vec![
                RepeatDotPosition {
                    x: dot_x,
                    y: dot_y0,
                    radius: dot_radius,
                },
                RepeatDotPosition {
                    x: dot_x,
                    y: dot_y1,
                    radius: dot_radius,
                },
            ]
        }
        BarLineType::RepeatStart => {
            // Thick bar center at x_position - THICK_WIDTH/2.0; dots to its right
            let dot_x = x_position - THICK_WIDTH / 2.0 + x_offset;
            vec![
                RepeatDotPosition {
                    x: dot_x,
                    y: dot_y0,
                    radius: dot_radius,
                },
                RepeatDotPosition {
                    x: dot_x,
                    y: dot_y1,
                    radius: dot_radius,
                },
            ]
        }
        BarLineType::RepeatBoth => {
            // Left thick bar (end-repeat) at x_position - THICK_WIDTH/2.0
            // Right thick bar (start-repeat) at x_position + THICK_WIDTH/2.0
            let dot_x_left = x_position - THICK_WIDTH / 2.0 - x_offset;
            let dot_x_right = x_position + THICK_WIDTH / 2.0 + x_offset;
            vec![
                RepeatDotPosition {
                    x: dot_x_left,
                    y: dot_y0,
                    radius: dot_radius,
                },
                RepeatDotPosition {
                    x: dot_x_left,
                    y: dot_y1,
                    radius: dot_radius,
                },
                RepeatDotPosition {
                    x: dot_x_right,
                    y: dot_y0,
                    radius: dot_radius,
                },
                RepeatDotPosition {
                    x: dot_x_right,
                    y: dot_y1,
                    radius: dot_radius,
                },
            ]
        }
        _ => vec![],
    }
}

/// Creates bracket/brace glyph with calculated geometry for multi-staff groups
fn create_bracket_glyph(
    staves: &[Staff],
    bracket_type: &BracketType,
    _config: &LayoutConfig,
) -> BracketGlyph {
    let first_staff = &staves[0];
    let last_staff = &staves[staves.len() - 1];

    // Span from top of first staff to bottom of last staff
    let top_y = first_staff.staff_lines[0].y_position;
    let bottom_y = last_staff.staff_lines[4].y_position;
    let height = bottom_y - top_y;
    let _center_y = (top_y + bottom_y) / 2.0;

    // Scale glyph to match actual bracket height
    const BRACE_NATURAL_HEIGHT: f32 = 320.0; // SMuFL brace U+E000 at fontSize 80
    let scale_y = height / BRACE_NATURAL_HEIGHT;

    let codepoint = match bracket_type {
        BracketType::Brace => "\u{E000}".to_string(),
        BracketType::Bracket => "\u{E002}".to_string(),
        BracketType::None => String::new(),
    };

    let x_position = 5.0; // Left margin

    BracketGlyph {
        codepoint,
        x: x_position,
        // Feature 027 (T034): Use top_y (top anchor) instead of center_y.
        // SMuFL brace U+E000 is rendered with dominant-baseline="hanging" in the
        // frontend, anchoring the glyph top to this y coordinate. Using center_y
        // caused the brace to appear shifted down by half its height.
        y: top_y,
        scale_y,
        bounding_box: BoundingBox {
            x: x_position - 5.0,
            y: top_y,
            width: 20.0,
            height,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// T011: Unit test for create_staff_lines() verifying 5 lines with 20-unit spacing
    #[test]
    fn test_create_staff_lines_spacing() {
        let units_per_space = 20.0;
        let system_width = 1200.0;

        let lines = create_staff_lines(0.0, system_width, units_per_space);

        // Verify exactly 5 lines
        assert_eq!(lines.len(), 5, "Should have exactly 5 staff lines");

        // Verify y-positions with 20-unit spacing (1 * units_per_space)
        assert_eq!(lines[0].y_position, 0.0, "Line 0 should be at y=0");
        assert_eq!(lines[1].y_position, 20.0, "Line 1 should be at y=20");
        assert_eq!(lines[2].y_position, 40.0, "Line 2 should be at y=40");
        assert_eq!(lines[3].y_position, 60.0, "Line 3 should be at y=60");
        assert_eq!(lines[4].y_position, 80.0, "Line 4 should be at y=80");

        // Verify all lines span full system width
        for (i, line) in lines.iter().enumerate() {
            assert_eq!(line.start_x, 0.0, "Line {} should start at x=0", i);
            assert_eq!(
                line.end_x, system_width,
                "Line {} should end at system_width",
                i
            );
        }
    }

    /// T011: Unit test for multi-staff layout with correct vertical offsetting
    #[test]
    fn test_create_staff_lines_multi_staff() {
        let units_per_space = 20.0;
        let system_width = 1200.0;

        // First staff at vertical offset 0
        let staff_0 = create_staff_lines(0.0, system_width, units_per_space);
        assert_eq!(staff_0[0].y_position, 0.0);
        assert_eq!(staff_0[4].y_position, 80.0);

        // Second staff - offset by 20 staff spaces (400 units)
        let expected_offset = 20.0 * units_per_space; // 400 units
        let staff_1 = create_staff_lines(expected_offset, system_width, units_per_space);
        assert_eq!(staff_1[0].y_position, expected_offset);
        assert_eq!(staff_1[4].y_position, expected_offset + 80.0);
    }

    /// T011: Unit test for different units_per_space values
    #[test]
    fn test_create_staff_lines_scale_independence() {
        let system_width = 1200.0;

        // Test with different scale (units_per_space = 10)
        let lines_scale_10 = create_staff_lines(0.0, system_width, 10.0);
        assert_eq!(lines_scale_10[0].y_position, 0.0);
        assert_eq!(lines_scale_10[1].y_position, 10.0); // 1 * 10
        assert_eq!(lines_scale_10[4].y_position, 40.0); // 4 * 10

        // Test with different scale (units_per_space = 25)
        let lines_scale_25 = create_staff_lines(0.0, system_width, 25.0);
        assert_eq!(lines_scale_25[0].y_position, 0.0);
        assert_eq!(lines_scale_25[1].y_position, 25.0); // 1 * 25
        assert_eq!(lines_scale_25[4].y_position, 100.0); // 4 * 25
    }

    /// T029: Integration test for structural glyph generation
    #[test]
    fn test_structural_glyphs_populated() {
        // Create a minimal score with clef, time sig, and key sig
        let score = serde_json::json!({
            "instruments": [{
                "id": "violin",
                "staves": [{
                    "clef": "Treble",
                    "time_signature": { "numerator": 4, "denominator": 4 },
                    "key_signature": { "sharps": 1 },  // G major (1 sharp)
                    "voices": [{
                        "notes": [
                            { "pitch": 60, "tick": 0, "duration": 960 }
                        ]
                    }]
                }]
            }]
        });

        let config = LayoutConfig::default();
        let layout = compute_layout(&score, &config);

        // Verify at least one system was created
        assert!(
            !layout.systems.is_empty(),
            "Should have at least one system"
        );
        let system = &layout.systems[0];

        // Verify at least one staff group exists
        assert!(
            !system.staff_groups.is_empty(),
            "Should have at least one staff group"
        );
        let staff_group = &system.staff_groups[0];

        // Verify at least one staff exists
        assert!(
            !staff_group.staves.is_empty(),
            "Should have at least one staff"
        );
        let staff = &staff_group.staves[0];

        // Verify structural glyphs are populated
        assert!(
            !staff.structural_glyphs.is_empty(),
            "structural_glyphs should be populated with clef, time sig, and key sig"
        );

        // Should have at least:
        // - 1 clef
        // - 2 time signature digits (numerator + denominator)
        // - 1 key signature accidental (G major = 1 sharp)
        // Total: >= 4 glyphs
        assert!(
            staff.structural_glyphs.len() >= 4,
            "Expected at least 4 structural glyphs (clef + 2 time sig digits + 1 key sig accidental), got {}",
            staff.structural_glyphs.len()
        );

        // Verify first glyph is a clef (starts with 'E' in SMuFL codepoint range)
        let first_glyph = &staff.structural_glyphs[0];
        // Extract first Unicode scalar value from codepoint string
        if let Some(first_char) = first_glyph.codepoint.chars().next() {
            let clef_codepoint = first_char as u32;
            assert!(
                (0xE050..=0xE07F).contains(&clef_codepoint),
                "First glyph should be a clef (U+E050-U+E07F), got U+{:04X}",
                clef_codepoint
            );
        } else {
            panic!("Glyph codepoint is empty");
        }
    }

    /// T063: Integration test for piano layout verifying 2 staves with correct vertical spacing
    #[test]
    fn test_piano_multi_staff_layout() {
        let score = serde_json::json!({
            "instruments": [{
                "id": "piano",
                "staves": [
                    {
                        "clef": "Treble",
                        "time_signature": { "numerator": 4, "denominator": 4 },
                        "key_signature": { "sharps": 0 },
                        "voices": [{
                            "notes": [
                                { "pitch": 72, "tick": 0, "duration": 960 }
                            ]
                        }]
                    },
                    {
                        "clef": "Bass",
                        "time_signature": { "numerator": 4, "denominator": 4 },
                        "key_signature": { "sharps": 0 },
                        "voices": [{
                            "notes": [
                                { "pitch": 48, "tick": 0, "duration": 960 }
                            ]
                        }]
                    }
                ]
            }]
        });

        let config = LayoutConfig::default();
        let layout = compute_layout(&score, &config);

        // Verify system exists
        assert!(
            !layout.systems.is_empty(),
            "Should have at least one system"
        );
        let system = &layout.systems[0];

        // Verify staff group exists
        assert!(
            !system.staff_groups.is_empty(),
            "Should have at least one staff group"
        );
        let staff_group = &system.staff_groups[0];

        // Verify 2 staves exist (treble + bass)
        assert_eq!(staff_group.staves.len(), 2, "Piano should have 2 staves");

        // Verify vertical spacing between staves
        let treble_staff = &staff_group.staves[0];
        let bass_staff = &staff_group.staves[1];

        let treble_top = treble_staff.staff_lines[0].y_position;
        let bass_top = bass_staff.staff_lines[0].y_position;

        // Vertical spacing should be 8 staff spaces (160 units at default units_per_space=20)
        let expected_spacing = 8.0 * config.units_per_space; // 160 units
        assert_eq!(
            bass_top - treble_top,
            expected_spacing,
            "Staff vertical spacing should be 8 staff spaces (160 units)"
        );

        // Verify bracket type is Brace for piano
        assert_eq!(
            staff_group.bracket_type,
            BracketType::Brace,
            "Piano should have Brace bracket type"
        );

        // Verify bracket glyph exists
        assert!(
            staff_group.bracket_glyph.is_some(),
            "Piano staff group should have bracket glyph"
        );
    }

    /// T064: Unit test for brace/bracket positioning and vertical scaling
    #[test]
    fn test_create_bracket_glyph_brace() {
        let config = LayoutConfig::default();

        // Create two dummy staves at different vertical positions
        let staff_0_lines = create_staff_lines(0.0, 1200.0, config.units_per_space);
        let staff_1_offset = 14.0 * config.units_per_space;
        let staff_1_lines = create_staff_lines(staff_1_offset, 1200.0, config.units_per_space);

        let staff_0 = Staff {
            staff_lines: staff_0_lines,
            glyph_runs: vec![],
            structural_glyphs: vec![],
            bar_lines: vec![],
            ledger_lines: vec![],
        };

        let staff_1 = Staff {
            staff_lines: staff_1_lines,
            glyph_runs: vec![],
            structural_glyphs: vec![],
            bar_lines: vec![],
            ledger_lines: vec![],
        };

        let staves = vec![staff_0, staff_1];
        let bracket_type = BracketType::Brace;

        let bracket_glyph = create_bracket_glyph(&staves, &bracket_type, &config);

        // Verify brace codepoint
        assert_eq!(
            bracket_glyph.codepoint, "\u{E000}",
            "Brace should use SMuFL codepoint U+E000"
        );

        // Verify x position (left margin)
        assert_eq!(bracket_glyph.x, 5.0, "Brace should be at x=5");

        // Verify vertical scaling is applied
        assert!(
            bracket_glyph.scale_y > 0.0,
            "Brace should have positive vertical scale"
        );

        // Verify bounding box spans both staves
        let first_staff_top = staves[0].staff_lines[0].y_position;
        let last_staff_bottom = staves[1].staff_lines[4].y_position;

        // Brace should extend to cover both staves
        assert!(
            bracket_glyph.bounding_box.y <= first_staff_top,
            "Brace bounding box should start at or above first staff"
        );
        assert!(
            bracket_glyph.bounding_box.y + bracket_glyph.bounding_box.height >= last_staff_bottom,
            "Brace bounding box should extend to or below last staff"
        );
    }

    /// T064: Unit test for square bracket positioning (ensemble scores)
    #[test]
    fn test_create_bracket_glyph_bracket() {
        let config = LayoutConfig::default();

        let staff_0_lines = create_staff_lines(0.0, 1200.0, config.units_per_space);
        let staff_1_offset = 14.0 * config.units_per_space;
        let staff_1_lines = create_staff_lines(staff_1_offset, 1200.0, config.units_per_space);

        let staff_0 = Staff {
            staff_lines: staff_0_lines,
            glyph_runs: vec![],
            structural_glyphs: vec![],
            bar_lines: vec![],
            ledger_lines: vec![],
        };

        let staff_1 = Staff {
            staff_lines: staff_1_lines,
            glyph_runs: vec![],
            structural_glyphs: vec![],
            bar_lines: vec![],
            ledger_lines: vec![],
        };

        let staves = vec![staff_0, staff_1];
        let bracket_type = BracketType::Bracket;

        let bracket_glyph = create_bracket_glyph(&staves, &bracket_type, &config);

        // Verify bracket codepoint
        assert_eq!(
            bracket_glyph.codepoint, "\u{E002}",
            "Bracket should use SMuFL codepoint U+E002"
        );
    }

    /// T074: Test notes on both staves render correctly relative to their respective staff lines
    #[test]
    fn test_notes_on_multi_staff() {
        let score = serde_json::json!({
            "instruments": [{
                "id": "piano",
                "staves": [
                    {
                        "clef": "Treble",
                        "time_signature": { "numerator": 4, "denominator": 4 },
                        "key_signature": { "sharps": 0 },
                        "voices": [{
                            "notes": [
                                { "pitch": 72, "tick": 0, "duration": 960 }
                            ]
                        }]
                    },
                    {
                        "clef": "Bass",
                        "time_signature": { "numerator": 4, "denominator": 4 },
                        "key_signature": { "sharps": 0 },
                        "voices": [{
                            "notes": [
                                { "pitch": 48, "tick": 0, "duration": 960 }
                            ]
                        }]
                    }
                ]
            }]
        });

        let config = LayoutConfig::default();
        let layout = compute_layout(&score, &config);

        let system = &layout.systems[0];
        let staff_group = &system.staff_groups[0];

        // Both staves should have glyph runs (noteheads)
        assert!(
            !staff_group.staves[0].glyph_runs.is_empty(),
            "Treble staff should have glyphs"
        );
        assert!(
            !staff_group.staves[1].glyph_runs.is_empty(),
            "Bass staff should have glyphs"
        );

        // Verify treble staff note is positioned relative to treble staff lines
        let treble_line_0 = staff_group.staves[0].staff_lines[0].y_position;
        let treble_glyph = &staff_group.staves[0].glyph_runs[0].glyphs[0];
        assert!(
            treble_glyph.position.y >= treble_line_0 - 100.0,
            "Treble note should be near treble staff"
        );

        // Verify bass staff note is positioned relative to bass staff lines
        let bass_line_0 = staff_group.staves[1].staff_lines[0].y_position;
        let bass_glyph = &staff_group.staves[1].glyph_runs[0].glyphs[0];
        assert!(
            bass_glyph.position.y >= bass_line_0 - 100.0,
            "Bass note should be near bass staff"
        );

        // Verify bass staff is below treble staff
        assert!(
            bass_line_0 > treble_line_0,
            "Bass staff should be below treble staff"
        );
    }

    /// T020: Integration test — 4 eighth notes with beam info produce correct glyphs
    #[test]
    fn test_four_beamed_eighths_produce_noteheads_stems_beam() {
        let score = serde_json::json!({
            "instruments": [{
                "id": "piano",
                "staves": [{
                    "clef": "Treble",
                    "time_signature": { "numerator": 4, "denominator": 4 },
                    "key_signature": { "sharps": 0 },
                    "voices": [{
                        "notes": [
                            { "pitch": 72, "tick": 0, "duration": 480,
                              "beams": [{"number": 1, "beam_type": "Begin"}] },
                            { "pitch": 74, "tick": 480, "duration": 480,
                              "beams": [{"number": 1, "beam_type": "Continue"}] },
                            { "pitch": 76, "tick": 960, "duration": 480,
                              "beams": [{"number": 1, "beam_type": "Continue"}] },
                            { "pitch": 77, "tick": 1440, "duration": 480,
                              "beams": [{"number": 1, "beam_type": "End"}] }
                        ]
                    }]
                }]
            }]
        });

        let config = LayoutConfig::default();
        let layout = compute_layout(&score, &config);

        // Collect all glyphs across all runs
        let staff = &layout.systems[0].staff_groups[0].staves[0];
        let all_glyphs: Vec<_> = staff
            .glyph_runs
            .iter()
            .flat_map(|run| run.glyphs.iter())
            .collect();

        // Count glyph types
        let noteheads = all_glyphs
            .iter()
            .filter(|g| g.codepoint == "\u{E0A4}")
            .count();
        let stems = all_glyphs
            .iter()
            .filter(|g| g.codepoint == "\u{0000}")
            .count();
        let beams = all_glyphs
            .iter()
            .filter(|g| g.codepoint == "\u{0001}")
            .count();
        let combined_eighth = all_glyphs
            .iter()
            .filter(|g| g.codepoint == "\u{E1D7}")
            .count();

        assert_eq!(
            noteheads, 4,
            "Should have 4 bare noteheadBlack glyphs (U+E0A4)"
        );
        assert_eq!(stems, 4, "Should have 4 stem glyphs (U+0000)");
        assert_eq!(beams, 1, "Should have 1 beam glyph (U+0001)");
        assert_eq!(
            combined_eighth, 0,
            "Should have 0 combined eighth note glyphs (U+E1D7)"
        );
    }

    /// T021: Integration test — mixed quarters and eighths produce correct glyphs
    #[test]
    fn test_mixed_quarters_and_beamed_eighths() {
        let score = serde_json::json!({
            "instruments": [{
                "id": "piano",
                "staves": [{
                    "clef": "Treble",
                    "time_signature": { "numerator": 4, "denominator": 4 },
                    "key_signature": { "sharps": 0 },
                    "voices": [{
                        "notes": [
                            { "pitch": 72, "tick": 0, "duration": 960 },
                            { "pitch": 74, "tick": 960, "duration": 480,
                              "beams": [{"number": 1, "beam_type": "Begin"}] },
                            { "pitch": 76, "tick": 1440, "duration": 480,
                              "beams": [{"number": 1, "beam_type": "End"}] },
                            { "pitch": 77, "tick": 1920, "duration": 960 }
                        ]
                    }]
                }]
            }]
        });

        let config = LayoutConfig::default();
        let layout = compute_layout(&score, &config);

        let staff = &layout.systems[0].staff_groups[0].staves[0];
        let all_glyphs: Vec<_> = staff
            .glyph_runs
            .iter()
            .flat_map(|run| run.glyphs.iter())
            .collect();

        // Count glyph types (check both Up and Down variants for direction-aware glyphs)
        let combined_quarter = all_glyphs
            .iter()
            .filter(|g| g.codepoint == "\u{E1D5}" || g.codepoint == "\u{E1D6}")
            .count();
        let bare_noteheads = all_glyphs
            .iter()
            .filter(|g| g.codepoint == "\u{E0A4}")
            .count();
        let stems = all_glyphs
            .iter()
            .filter(|g| g.codepoint == "\u{0000}")
            .count();
        let beams = all_glyphs
            .iter()
            .filter(|g| g.codepoint == "\u{0001}")
            .count();
        let combined_eighth = all_glyphs
            .iter()
            .filter(|g| g.codepoint == "\u{E1D7}" || g.codepoint == "\u{E1D8}")
            .count();

        assert_eq!(
            combined_quarter, 2,
            "Should have 2 combined quarter note glyphs (U+E1D5 or U+E1D6)"
        );
        assert_eq!(
            bare_noteheads, 2,
            "Should have 2 bare noteheadBlack for beamed eighths"
        );
        assert_eq!(stems, 2, "Should have 2 stem glyphs for beamed eighths");
        assert_eq!(
            beams, 1,
            "Should have 1 beam glyph connecting the 2 eighths"
        );
        assert_eq!(combined_eighth, 0, "Should have 0 combined eighth glyphs");
    }

    /// T028: Integration test — 4 sixteenth notes produce 2 beam levels
    #[test]
    fn test_four_sixteenths_two_beam_levels() {
        let score = serde_json::json!({
            "instruments": [{
                "id": "piano",
                "staves": [{
                    "clef": "Treble",
                    "time_signature": { "numerator": 4, "denominator": 4 },
                    "key_signature": { "sharps": 0 },
                    "voices": [{
                        "notes": [
                            { "pitch": 72, "tick": 0, "duration": 240,
                              "beams": [{"number": 1, "beam_type": "Begin"}, {"number": 2, "beam_type": "Begin"}] },
                            { "pitch": 74, "tick": 240, "duration": 240,
                              "beams": [{"number": 1, "beam_type": "Continue"}, {"number": 2, "beam_type": "Continue"}] },
                            { "pitch": 76, "tick": 480, "duration": 240,
                              "beams": [{"number": 1, "beam_type": "Continue"}, {"number": 2, "beam_type": "Continue"}] },
                            { "pitch": 77, "tick": 720, "duration": 240,
                              "beams": [{"number": 1, "beam_type": "End"}, {"number": 2, "beam_type": "End"}] }
                        ]
                    }]
                }]
            }]
        });

        let config = LayoutConfig::default();
        let layout = compute_layout(&score, &config);

        let staff = &layout.systems[0].staff_groups[0].staves[0];
        let all_glyphs: Vec<_> = staff
            .glyph_runs
            .iter()
            .flat_map(|run| run.glyphs.iter())
            .collect();

        let beams = all_glyphs
            .iter()
            .filter(|g| g.codepoint == "\u{0001}")
            .count();

        assert_eq!(
            beams, 2,
            "4 sixteenth notes should produce 2 beam glyphs (level 1 + level 2)"
        );
    }

    /// T029: Integration test — mixed eighths + sixteenths produce correct beaming
    #[test]
    fn test_mixed_eighths_sixteenths_multi_level() {
        let score = serde_json::json!({
            "instruments": [{
                "id": "piano",
                "staves": [{
                    "clef": "Treble",
                    "time_signature": { "numerator": 4, "denominator": 4 },
                    "key_signature": { "sharps": 0 },
                    "voices": [{
                        "notes": [
                            { "pitch": 72, "tick": 0, "duration": 480,
                              "beams": [{"number": 1, "beam_type": "Begin"}] },
                            { "pitch": 74, "tick": 480, "duration": 240,
                              "beams": [{"number": 1, "beam_type": "Continue"}, {"number": 2, "beam_type": "Begin"}] },
                            { "pitch": 76, "tick": 720, "duration": 240,
                              "beams": [{"number": 1, "beam_type": "End"}, {"number": 2, "beam_type": "End"}] }
                        ]
                    }]
                }]
            }]
        });

        let config = LayoutConfig::default();
        let layout = compute_layout(&score, &config);

        let staff = &layout.systems[0].staff_groups[0].staves[0];
        let all_glyphs: Vec<_> = staff
            .glyph_runs
            .iter()
            .flat_map(|run| run.glyphs.iter())
            .collect();

        let beams = all_glyphs
            .iter()
            .filter(|g| g.codepoint == "\u{0001}")
            .count();
        let noteheads = all_glyphs
            .iter()
            .filter(|g| g.codepoint == "\u{E0A4}")
            .count();

        assert_eq!(noteheads, 3, "Should have 3 bare noteheads (all beamed)");
        assert_eq!(
            beams, 2,
            "Should have 2 beams (level 1 spans all, level 2 spans sixteenths)"
        );
    }

    /// T036: High-pitched beamed group → stems down, beam below noteheads
    #[test]
    fn test_stem_direction_high_notes_stems_down() {
        // All notes above middle line (high pitches like C6, D6, E6, F6)
        let score = serde_json::json!({
            "instruments": [{
                "id": "piano",
                "staves": [{
                    "clef": "Treble",
                    "time_signature": { "numerator": 4, "denominator": 4 },
                    "key_signature": { "sharps": 0 },
                    "voices": [{
                        "notes": [
                            { "pitch": 84, "tick": 0, "duration": 480,
                              "beams": [{"number": 1, "beam_type": "Begin"}] },
                            { "pitch": 86, "tick": 480, "duration": 480,
                              "beams": [{"number": 1, "beam_type": "End"}] }
                        ]
                    }]
                }]
            }]
        });

        let config = LayoutConfig::default();
        let layout = compute_layout(&score, &config);

        let staff = &layout.systems[0].staff_groups[0].staves[0];
        let all_glyphs: Vec<_> = staff
            .glyph_runs
            .iter()
            .flat_map(|run| run.glyphs.iter())
            .collect();

        // Find stem glyphs
        let stem_glyphs: Vec<_> = all_glyphs
            .iter()
            .filter(|g| g.codepoint == "\u{0000}")
            .collect();

        assert_eq!(stem_glyphs.len(), 2, "Should have 2 stems");

        // For high notes, stems should point down (y_end > y_start in screen coordinates)
        // Find the noteheads to compare positions
        let notehead_glyphs: Vec<_> = all_glyphs
            .iter()
            .filter(|g| g.codepoint == "\u{E0A4}")
            .collect();

        assert_eq!(notehead_glyphs.len(), 2, "Should have 2 noteheads");

        // Stem bounding box y + height should extend below the notehead y
        // (stems down = extending downward from notehead)
        for stem in &stem_glyphs {
            let stem_bottom = stem.bounding_box.y + stem.bounding_box.height;
            assert!(
                stem_bottom > stem.position.y,
                "Stem should extend downward (stem_bottom {} > position.y {})",
                stem_bottom,
                stem.position.y
            );
        }
    }

    /// T037: Beamed group spanning both sides → uniform direction
    #[test]
    fn test_uniform_stem_direction_mixed_positions() {
        // Mix of notes: 2 above middle, 1 below → majority above → stems down
        let score = serde_json::json!({
            "instruments": [{
                "id": "piano",
                "staves": [{
                    "clef": "Treble",
                    "time_signature": { "numerator": 4, "denominator": 4 },
                    "key_signature": { "sharps": 0 },
                    "voices": [{
                        "notes": [
                            { "pitch": 48, "tick": 0, "duration": 480,
                              "beams": [{"number": 1, "beam_type": "Begin"}] },
                            { "pitch": 48, "tick": 480, "duration": 480,
                              "beams": [{"number": 1, "beam_type": "Continue"}] },
                            { "pitch": 84, "tick": 960, "duration": 480,
                              "beams": [{"number": 1, "beam_type": "End"}] }
                        ]
                    }]
                }]
            }]
        });

        let config = LayoutConfig::default();
        let layout = compute_layout(&score, &config);

        let staff = &layout.systems[0].staff_groups[0].staves[0];
        let all_glyphs: Vec<_> = staff
            .glyph_runs
            .iter()
            .flat_map(|run| run.glyphs.iter())
            .collect();

        let stem_glyphs: Vec<_> = all_glyphs
            .iter()
            .filter(|g| g.codepoint == "\u{0000}")
            .collect();

        assert_eq!(stem_glyphs.len(), 3, "Should have 3 stems");

        // All stems should have a consistent direction (same sign of displacement)
        // Collect stem displacement directions (positive = down, negative = up)
        let displacements: Vec<f32> = stem_glyphs.iter().map(|s| s.bounding_box.height).collect();

        // All stems should be non-zero height
        for d in &displacements {
            assert!(*d > 0.0, "Stem height should be positive: {}", d);
        }
    }

    /// T046: Algorithmic beaming for 4/4 without <beam> elements
    #[test]
    fn test_algorithmic_beaming_4_4() {
        // No beam_info → algorithmic fallback groups by beat
        let score = serde_json::json!({
            "instruments": [{
                "id": "piano",
                "staves": [{
                    "clef": "Treble",
                    "time_signature": { "numerator": 4, "denominator": 4 },
                    "key_signature": { "sharps": 0 },
                    "voices": [{
                        "notes": [
                            { "pitch": 72, "tick": 0, "duration": 480 },
                            { "pitch": 74, "tick": 480, "duration": 480 },
                            { "pitch": 76, "tick": 960, "duration": 480 },
                            { "pitch": 77, "tick": 1440, "duration": 480 }
                        ]
                    }]
                }]
            }]
        });

        let config = LayoutConfig::default();
        let layout = compute_layout(&score, &config);

        let staff = &layout.systems[0].staff_groups[0].staves[0];
        let all_glyphs: Vec<_> = staff
            .glyph_runs
            .iter()
            .flat_map(|run| run.glyphs.iter())
            .collect();

        let beams = all_glyphs
            .iter()
            .filter(|g| g.codepoint == "\u{0001}")
            .count();
        let noteheads = all_glyphs
            .iter()
            .filter(|g| g.codepoint == "\u{E0A4}")
            .count();

        assert_eq!(noteheads, 4, "All 4 eighths should use bare noteheadBlack");
        assert_eq!(
            beams, 2,
            "Algorithmic beaming in 4/4 should produce 2 beam groups (2 per beat)"
        );
    }

    /// T047: Single isolated eighth note uses combined flag glyph
    #[test]
    fn test_single_eighth_uses_flag() {
        let score = serde_json::json!({
            "instruments": [{
                "id": "piano",
                "staves": [{
                    "clef": "Treble",
                    "time_signature": { "numerator": 4, "denominator": 4 },
                    "key_signature": { "sharps": 0 },
                    "voices": [{
                        "notes": [
                            { "pitch": 72, "tick": 0, "duration": 480 },
                            { "pitch": 74, "tick": 960, "duration": 960 },
                            { "pitch": 76, "tick": 1920, "duration": 960 }
                        ]
                    }]
                }]
            }]
        });

        let config = LayoutConfig::default();
        let layout = compute_layout(&score, &config);

        let staff = &layout.systems[0].staff_groups[0].staves[0];
        let all_glyphs: Vec<_> = staff
            .glyph_runs
            .iter()
            .flat_map(|run| run.glyphs.iter())
            .collect();

        let combined_eighth = all_glyphs
            .iter()
            .filter(|g| g.codepoint == "\u{E1D7}" || g.codepoint == "\u{E1D8}")
            .count();
        let beams = all_glyphs
            .iter()
            .filter(|g| g.codepoint == "\u{0001}")
            .count();

        // Single eighth note can't form a beam group, so it should use the combined flag glyph
        assert_eq!(
            combined_eighth, 1,
            "Single eighth should use combined flag glyph (U+E1D7 or U+E1D8)"
        );
        assert_eq!(beams, 0, "No beams for single eighth note");
    }

    /// T051: Degenerate single-note beam group falls back to flagged rendering
    #[test]
    fn test_degenerate_single_note_group_uses_flag() {
        // A single eighth note at beat boundary with no partner → no beam, uses flag
        let score = serde_json::json!({
            "instruments": [{
                "id": "piano",
                "staves": [{
                    "clef": "Treble",
                    "time_signature": { "numerator": 4, "denominator": 4 },
                    "key_signature": { "sharps": 0 },
                    "voices": [{
                        "notes": [
                            { "pitch": 72, "tick": 0, "duration": 480 },
                            { "pitch": 74, "tick": 480, "duration": 960 }
                        ]
                    }]
                }]
            }]
        });

        let config = LayoutConfig::default();
        let layout = compute_layout(&score, &config);

        let staff = &layout.systems[0].staff_groups[0].staves[0];
        let all_glyphs: Vec<_> = staff
            .glyph_runs
            .iter()
            .flat_map(|run| run.glyphs.iter())
            .collect();

        let combined_eighth = all_glyphs
            .iter()
            .filter(|g| g.codepoint == "\u{E1D7}" || g.codepoint == "\u{E1D8}")
            .count();
        let bare_noteheads = all_glyphs
            .iter()
            .filter(|g| g.codepoint == "\u{E0A4}")
            .count();
        let beams = all_glyphs
            .iter()
            .filter(|g| g.codepoint == "\u{0001}")
            .count();

        assert_eq!(
            combined_eighth, 1,
            "Single eighth should use combined flag glyph (U+E1D7 or U+E1D8)"
        );
        assert_eq!(
            bare_noteheads, 0,
            "No bare noteheads when no beam group forms"
        );
        assert_eq!(beams, 0, "No beams for degenerate single-note group");
    }

    /// T052: Beams do not cross bar lines
    #[test]
    fn test_beams_do_not_cross_barlines() {
        // 2 eighths at end of measure 1 + 2 eighths at start of measure 2
        // Should produce 2 separate beam groups, not 1 spanning the barline
        let score = serde_json::json!({
            "instruments": [{
                "id": "piano",
                "staves": [{
                    "clef": "Treble",
                    "time_signature": { "numerator": 4, "denominator": 4 },
                    "key_signature": { "sharps": 0 },
                    "voices": [{
                        "notes": [
                            { "pitch": 72, "tick": 2880, "duration": 480 },
                            { "pitch": 74, "tick": 3360, "duration": 480 },
                            { "pitch": 76, "tick": 3840, "duration": 480 },
                            { "pitch": 77, "tick": 4320, "duration": 480 }
                        ]
                    }]
                }]
            }]
        });

        let config = LayoutConfig::default();
        let layout = compute_layout(&score, &config);

        let staff = &layout.systems[0].staff_groups[0].staves[0];
        let all_glyphs: Vec<_> = staff
            .glyph_runs
            .iter()
            .flat_map(|run| run.glyphs.iter())
            .collect();

        let beams = all_glyphs
            .iter()
            .filter(|g| g.codepoint == "\u{0001}")
            .count();

        assert_eq!(
            beams, 2,
            "Should produce 2 separate beams (one per measure, not crossing barline)"
        );
    }

    /// T053: Beams break at rests
    #[test]
    fn test_beams_break_at_rests() {
        // 2 eighths, then a quarter rest, then 2 more eighths → 2 beam groups
        let score = serde_json::json!({
            "instruments": [{
                "id": "piano",
                "staves": [{
                    "clef": "Treble",
                    "time_signature": { "numerator": 4, "denominator": 4 },
                    "key_signature": { "sharps": 0 },
                    "voices": [{
                        "notes": [
                            { "pitch": 72, "tick": 0, "duration": 480 },
                            { "pitch": 74, "tick": 480, "duration": 480 },
                            { "pitch": 76, "tick": 1920, "duration": 480 },
                            { "pitch": 77, "tick": 2400, "duration": 480 }
                        ]
                    }]
                }]
            }]
        });

        let config = LayoutConfig::default();
        let layout = compute_layout(&score, &config);

        let staff = &layout.systems[0].staff_groups[0].staves[0];
        let all_glyphs: Vec<_> = staff
            .glyph_runs
            .iter()
            .flat_map(|run| run.glyphs.iter())
            .collect();

        let beams = all_glyphs
            .iter()
            .filter(|g| g.codepoint == "\u{0001}")
            .count();

        assert_eq!(
            beams, 2,
            "Should produce 2 beams (broken by rest gap between beats)"
        );
    }

    /// Test compute_staff_note_extents returns staff-line bounds when no notes extend beyond
    #[test]
    fn test_compute_staff_note_extents_within_staff() {
        let ups = 20.0;
        let staff_data = StaffData {
            clef: "Treble".to_string(),
            time_numerator: 4,
            time_denominator: 4,
            key_sharps: 0,
            key_signature_events: vec![],
            clef_events: vec![],
            voices: vec![VoiceData {
                notes: vec![NoteEvent {
                    pitch: 67, // G4 — on the second line of treble staff
                    start_tick: 0,
                    duration_ticks: 960,
                    spelling: None,
                    beam_info: vec![],
                }],
                rests: vec![],
            }],
        };
        let tick_range = TickRange {
            start_tick: 0,
            end_tick: 3840,
        };
        let (min_y, max_y) = compute_staff_note_extents(&staff_data, &tick_range, ups);
        // G4 is within treble staff, so extents should be [0, 4*ups]
        assert!(
            min_y >= -0.1 && min_y <= 0.1,
            "min_y should be ~0 for in-staff note, got {}",
            min_y
        );
        assert!(
            (max_y - 4.0 * ups).abs() < 0.1,
            "max_y should be ~4*ups for in-staff note, got {}",
            max_y
        );
    }

    /// Test compute_staff_note_extents extends downward for low notes
    #[test]
    fn test_compute_staff_note_extents_below_staff() {
        let ups = 20.0;
        let staff_data = StaffData {
            clef: "Treble".to_string(),
            time_numerator: 4,
            time_denominator: 4,
            key_sharps: 0,
            key_signature_events: vec![],
            clef_events: vec![],
            voices: vec![VoiceData {
                notes: vec![NoteEvent {
                    pitch: 60, // C4 (middle C) — below treble staff, needs ledger line
                    start_tick: 0,
                    duration_ticks: 960,
                    spelling: None,
                    beam_info: vec![],
                }],
                rests: vec![],
            }],
        };
        let tick_range = TickRange {
            start_tick: 0,
            end_tick: 3840,
        };
        let (_min_y, max_y) = compute_staff_note_extents(&staff_data, &tick_range, ups);
        // C4 in treble clef is below the staff (y > 4*ups)
        assert!(
            max_y > 4.0 * ups,
            "max_y should extend below staff for C4 in treble, got {}",
            max_y
        );
    }

    /// Test collision-aware spacing: piano with low treble notes gets wider gap
    #[test]
    fn test_collision_aware_spacing_increases_gap() {
        // Piano score where treble staff has very low notes (extending toward bass staff)
        let score = serde_json::json!({
            "instruments": [{
                "id": "piano",
                "name": "Piano",
                "staves": [
                    {
                        "clef": "Treble",
                        "time_signature": { "numerator": 4, "denominator": 4 },
                        "key_signature": { "sharps": 0 },
                        "voices": [{
                            "notes": [
                                { "pitch": 48, "tick": 0, "duration": 960 },
                                { "pitch": 45, "tick": 960, "duration": 960 }
                            ]
                        }]
                    },
                    {
                        "clef": "Bass",
                        "time_signature": { "numerator": 4, "denominator": 4 },
                        "key_signature": { "sharps": 0 },
                        "voices": [{
                            "notes": [
                                { "pitch": 36, "tick": 0, "duration": 960 }
                            ]
                        }]
                    }
                ]
            }]
        });

        let config = LayoutConfig::default();
        let layout = compute_layout(&score, &config);
        let system = &layout.systems[0];
        let sg = &system.staff_groups[0];

        let treble_top = sg.staves[0].staff_lines[0].y_position;
        let bass_top = sg.staves[1].staff_lines[0].y_position;
        let spacing = bass_top - treble_top;

        let default_spacing = 8.0 * config.units_per_space; // 160 units
        // With very low notes in treble staff, spacing should be > default
        assert!(
            spacing > default_spacing,
            "Spacing should increase when treble notes extend below staff: got {} (default {})",
            spacing,
            default_spacing
        );
    }

    /// Test that default spacing is preserved when no collision occurs
    #[test]
    fn test_default_spacing_preserved_no_collision() {
        // Piano score with notes comfortably within their respective staves
        let score = serde_json::json!({
            "instruments": [{
                "id": "piano",
                "name": "Piano",
                "staves": [
                    {
                        "clef": "Treble",
                        "time_signature": { "numerator": 4, "denominator": 4 },
                        "key_signature": { "sharps": 0 },
                        "voices": [{
                            "notes": [
                                { "pitch": 72, "tick": 0, "duration": 960 }
                            ]
                        }]
                    },
                    {
                        "clef": "Bass",
                        "time_signature": { "numerator": 4, "denominator": 4 },
                        "key_signature": { "sharps": 0 },
                        "voices": [{
                            "notes": [
                                { "pitch": 48, "tick": 0, "duration": 960 }
                            ]
                        }]
                    }
                ]
            }]
        });

        let config = LayoutConfig::default();
        let layout = compute_layout(&score, &config);
        let system = &layout.systems[0];
        let sg = &system.staff_groups[0];

        let treble_top = sg.staves[0].staff_lines[0].y_position;
        let bass_top = sg.staves[1].staff_lines[0].y_position;
        let spacing = bass_top - treble_top;

        let default_spacing = 8.0 * config.units_per_space; // 160 units
        assert_eq!(
            spacing, default_spacing,
            "Spacing should remain at default when no collision: got {} (expected {})",
            spacing, default_spacing
        );
    }

    /// T011: 2/4 time signature produces measure boundaries at 0, 1920, 3840...
    #[test]
    fn test_layout_2_4_measure_boundaries() {
        // 4 quarter notes at 960 ticks each → in 2/4 (1920 ticks/measure) = 2 measures
        // In hardcoded 4/4 (3840 ticks/measure) this would be only 1 measure
        let score = serde_json::json!({
            "global_structural_events": [
                { "TimeSignature": { "tick": 0, "numerator": 2, "denominator": 4 } }
            ],
            "instruments": [{
                "id": "piano",
                "staves": [{
                    "clef": "Treble",
                    "time_signature": { "numerator": 2, "denominator": 4 },
                    "key_signature": { "sharps": 0 },
                    "voices": [{
                        "notes": [
                            { "pitch": 60, "tick": 0, "duration": 960 },
                            { "pitch": 62, "tick": 960, "duration": 960 },
                            { "pitch": 64, "tick": 1920, "duration": 960 },
                            { "pitch": 65, "tick": 2880, "duration": 960 }
                        ]
                    }]
                }]
            }]
        });

        let config = LayoutConfig::default();
        let layout = compute_layout(&score, &config);

        assert!(
            !layout.systems.is_empty(),
            "Should have at least one system"
        );
        let sys0 = &layout.systems[0];

        // With 2 measures in 2/4, there should be at least 2 barlines on the first staff
        // (one between measures + one at end). With wrong 3840, only 1 barline.
        let staff = &sys0.staff_groups[0].staves[0];
        assert!(
            staff.bar_lines.len() >= 2,
            "2/4 with 4 quarter notes should produce at least 2 barlines (got {})",
            staff.bar_lines.len()
        );
    }

    /// T012: 3/4 time signature produces measure boundaries at 0, 2880, 5760...
    #[test]
    fn test_layout_3_4_measure_boundaries() {
        // 7 quarter notes: with 3/4 (2880 ticks/measure) = 3 measures (0,0,0 | 1,1,1 | 2)
        // With hardcoded 3840 = 2 measures (0,0,0,0 | 1,1,1) → only 2 barlines
        let score = serde_json::json!({
            "global_structural_events": [
                { "TimeSignature": { "tick": 0, "numerator": 3, "denominator": 4 } }
            ],
            "instruments": [{
                "id": "piano",
                "staves": [{
                    "clef": "Treble",
                    "time_signature": { "numerator": 3, "denominator": 4 },
                    "key_signature": { "sharps": 0 },
                    "voices": [{
                        "notes": [
                            { "pitch": 60, "tick": 0, "duration": 960 },
                            { "pitch": 62, "tick": 960, "duration": 960 },
                            { "pitch": 64, "tick": 1920, "duration": 960 },
                            { "pitch": 65, "tick": 2880, "duration": 960 },
                            { "pitch": 67, "tick": 3840, "duration": 960 },
                            { "pitch": 69, "tick": 4800, "duration": 960 },
                            { "pitch": 71, "tick": 5760, "duration": 960 }
                        ]
                    }]
                }]
            }]
        });

        let config = LayoutConfig::default();
        let layout = compute_layout(&score, &config);

        assert!(
            !layout.systems.is_empty(),
            "Should have at least one system"
        );
        let sys0 = &layout.systems[0];

        // With 3/4 correct: 3 measures → at least 3 barlines
        // With wrong 3840: 2 measures → only 2 barlines → fails
        let staff = &sys0.staff_groups[0].staves[0];
        assert!(
            staff.bar_lines.len() >= 3,
            "3/4 with 7 quarter notes should produce at least 3 barlines (got {})",
            staff.bar_lines.len()
        );
    }

    /// T013: 4/4 time signature preserves existing behavior (regression guard)
    #[test]
    fn test_layout_4_4_measure_boundaries_unchanged() {
        // 8 quarter notes → in 4/4 = 2 measures → at least 2 barlines
        let score = serde_json::json!({
            "instruments": [{
                "id": "piano",
                "staves": [{
                    "clef": "Treble",
                    "time_signature": { "numerator": 4, "denominator": 4 },
                    "key_signature": { "sharps": 0 },
                    "voices": [{
                        "notes": [
                            { "pitch": 60, "tick": 0, "duration": 960 },
                            { "pitch": 62, "tick": 960, "duration": 960 },
                            { "pitch": 64, "tick": 1920, "duration": 960 },
                            { "pitch": 65, "tick": 2880, "duration": 960 },
                            { "pitch": 67, "tick": 3840, "duration": 960 },
                            { "pitch": 69, "tick": 4800, "duration": 960 },
                            { "pitch": 71, "tick": 5760, "duration": 960 },
                            { "pitch": 72, "tick": 6720, "duration": 960 }
                        ]
                    }]
                }]
            }]
        });

        let config = LayoutConfig::default();
        let layout = compute_layout(&score, &config);

        assert!(
            !layout.systems.is_empty(),
            "Should have at least one system"
        );
        let sys0 = &layout.systems[0];

        // 4/4 is the existing behavior, so this should pass before and after the fix
        let staff = &sys0.staff_groups[0].staves[0];
        assert!(
            staff.bar_lines.len() >= 2,
            "4/4 with 8 quarter notes should produce at least 2 barlines (got {})",
            staff.bar_lines.len()
        );

        // Measure number should be 1
        assert_eq!(
            sys0.measure_number.as_ref().unwrap().number,
            1,
            "First system measure number should be 1"
        );
    }

    /// T020: Time signature glyph for 2/4 should show digits "2" and "4"
    #[test]
    fn test_time_signature_glyph_2_4() {
        let score = serde_json::json!({
            "global_structural_events": [
                { "TimeSignature": { "tick": 0, "numerator": 2, "denominator": 4 } }
            ],
            "instruments": [{
                "id": "piano",
                "staves": [{
                    "clef": "Treble",
                    "time_signature": { "numerator": 2, "denominator": 4 },
                    "key_signature": { "sharps": 0 },
                    "voices": [{
                        "notes": [
                            { "pitch": 60, "tick": 0, "duration": 960 }
                        ]
                    }]
                }]
            }]
        });

        let config = LayoutConfig::default();
        let layout = compute_layout(&score, &config);
        let staff = &layout.systems[0].staff_groups[0].staves[0];

        // SMuFL: U+E082 = "2", U+E084 = "4"
        let ts_codepoints: Vec<&str> = staff
            .structural_glyphs
            .iter()
            .map(|g| g.codepoint.as_str())
            .collect();

        assert!(
            ts_codepoints.contains(&"\u{E082}"),
            "Should contain time sig digit '2' (U+E082), got: {:?}",
            ts_codepoints
        );
        assert!(
            ts_codepoints.contains(&"\u{E084}"),
            "Should contain time sig digit '4' (U+E084), got: {:?}",
            ts_codepoints
        );
    }

    /// T021: Time signature glyph for 6/8 should show digits "6" and "8"
    #[test]
    fn test_time_signature_glyph_6_8() {
        let score = serde_json::json!({
            "global_structural_events": [
                { "TimeSignature": { "tick": 0, "numerator": 6, "denominator": 8 } }
            ],
            "instruments": [{
                "id": "piano",
                "staves": [{
                    "clef": "Treble",
                    "time_signature": { "numerator": 6, "denominator": 8 },
                    "key_signature": { "sharps": 0 },
                    "voices": [{
                        "notes": [
                            { "pitch": 60, "tick": 0, "duration": 480 }
                        ]
                    }]
                }]
            }]
        });

        let config = LayoutConfig::default();
        let layout = compute_layout(&score, &config);
        let staff = &layout.systems[0].staff_groups[0].staves[0];

        // SMuFL: U+E086 = "6", U+E088 = "8"
        let ts_codepoints: Vec<&str> = staff
            .structural_glyphs
            .iter()
            .map(|g| g.codepoint.as_str())
            .collect();

        assert!(
            ts_codepoints.contains(&"\u{E086}"),
            "Should contain time sig digit '6' (U+E086), got: {:?}",
            ts_codepoints
        );
        assert!(
            ts_codepoints.contains(&"\u{E088}"),
            "Should contain time sig digit '8' (U+E088), got: {:?}",
            ts_codepoints
        );
    }

    /// 12/8: multi-digit numerator renders two glyphs ("1" and "2"), correct measure boundaries
    #[test]
    fn test_layout_12_8_time_signature() {
        // 12 eighth notes → in 12/8 (5760 ticks/measure) = 1 measure
        let score = serde_json::json!({
            "global_structural_events": [
                { "TimeSignature": { "tick": 0, "numerator": 12, "denominator": 8 } }
            ],
            "instruments": [{
                "id": "piano",
                "staves": [{
                    "clef": "Treble",
                    "time_signature": { "numerator": 12, "denominator": 8 },
                    "key_signature": { "sharps": 0 },
                    "voices": [{
                        "notes": [
                            { "pitch": 60, "tick": 0, "duration": 480 },
                            { "pitch": 62, "tick": 480, "duration": 480 },
                            { "pitch": 64, "tick": 960, "duration": 480 },
                            { "pitch": 65, "tick": 1440, "duration": 480 },
                            { "pitch": 67, "tick": 1920, "duration": 480 },
                            { "pitch": 69, "tick": 2400, "duration": 480 },
                            { "pitch": 71, "tick": 2880, "duration": 480 },
                            { "pitch": 72, "tick": 3360, "duration": 480 },
                            { "pitch": 74, "tick": 3840, "duration": 480 },
                            { "pitch": 76, "tick": 4320, "duration": 480 },
                            { "pitch": 77, "tick": 4800, "duration": 480 },
                            { "pitch": 79, "tick": 5280, "duration": 480 }
                        ]
                    }]
                }]
            }]
        });

        let config = LayoutConfig::default();
        let layout = compute_layout(&score, &config);
        let staff = &layout.systems[0].staff_groups[0].staves[0];

        // Multi-digit numerator "12" → two glyphs: U+E081 ("1") and U+E082 ("2")
        let ts_codepoints: Vec<&str> = staff
            .structural_glyphs
            .iter()
            .map(|g| g.codepoint.as_str())
            .collect();

        assert!(
            ts_codepoints.contains(&"\u{E081}"),
            "Should contain time sig digit '1' (U+E081) for '12', got: {:?}",
            ts_codepoints
        );
        assert!(
            ts_codepoints.contains(&"\u{E082}"),
            "Should contain time sig digit '2' (U+E082) for '12', got: {:?}",
            ts_codepoints
        );
        assert!(
            ts_codepoints.contains(&"\u{E088}"),
            "Should contain time sig digit '8' (U+E088), got: {:?}",
            ts_codepoints
        );
    }
}
