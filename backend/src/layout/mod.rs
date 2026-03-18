//! Layout Engine Module
//!
//! Converts a CompiledScore into a deterministic hierarchical spatial model
//! expressed in logical units. The output defines systems as the primary
//! virtualization boundary and provides bounding boxes for efficient rendering,
//! hit testing, and interaction.

use std::collections::HashMap;

pub mod batcher;
pub mod beams;
pub mod breaker;
pub mod metrics;
pub mod positioner;
pub mod spacer;
pub mod stems;
pub mod types;

pub(crate) mod annotations;
pub(crate) mod assembly;
pub(crate) mod barlines;
pub(crate) mod extraction;
pub(crate) mod note_layout;
pub(crate) mod staff_groups;
pub(crate) mod structural;

#[cfg(target_arch = "wasm32")]
pub mod wasm;

pub use breaker::MeasureInfo;
pub use extraction::NoteData;
pub use types::{
    BarLine, BarLineSegment, BarLineType, BoundingBox, BracketGlyph, BracketType, Color,
    GlobalLayout, Glyph, GlyphRun, LayoutConfig, LedgerLine, MeasureNumber, NameLabel, Point,
    RepeatDotPosition, SourceReference, Staff, StaffGroup, StaffLine, System, TickRange,
    VoltaBracketLayout,
};

use extraction::{
    RestLayoutEvent, StaffData, actual_end, actual_start, actual_tick_to_measure,
    extract_instruments, extract_measures,
};

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

    // Read actual measure end ticks (for shortened measures like first endings)
    let measure_end_ticks_vec: Vec<u32> = score["measure_end_ticks"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_u64().map(|t| t as u32))
                .collect()
        })
        .unwrap_or_default();

    // Extract measures from score using actual time signature
    let measures = extract_measures(
        score,
        ticks_per_measure,
        pickup_ticks,
        &measure_end_ticks_vec,
    );

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
            let start = actual_start(i, &measure_end_ticks_vec, pickup_ticks, ticks_per_measure);
            let end = actual_end(i, &measure_end_ticks_vec, pickup_ticks, ticks_per_measure);
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
    let intra_staff_multiplier = 10.0_f32; // Between staves of the same instrument (grand-staff standard: ~6-space gap)
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

    // Subtract the left margin from the breaking budget so that
    // measure content + left margin = max_system_width (no overflow).
    let breaking_width = (config.max_system_width - unified_left_margin).max(200.0);

    // Break into systems using effective height that accommodates all staves
    let mut systems = breaker::break_into_systems(
        &measure_infos,
        breaking_width,
        effective_system_height,
        config.system_spacing,
    );

    // After breaking, set every system's bounding box to max_system_width
    // so all systems render at equal width (justified).
    for system in &mut systems {
        system.bounding_box.width = config.max_system_width;
    }

    // Populate staff_groups for each system with positioned and batched glyphs
    // Top margin: leave space above the first system so stems, beams, flags,
    // and measure numbers above the top staff are not clipped by viewport y=0.
    // 4 staff spaces (80 units at ups=20) matches standard engraving practice.
    let top_margin = 4.0 * config.units_per_space;
    let mut running_y: f32 = top_margin; // Track cumulative y position across systems (collision-aware)
    for system in &mut systems {
        // Update system y to account for collision-adjusted heights of previous systems
        system.bounding_box.y = running_y;

        let mut staff_groups = Vec::new();
        // Track cumulative vertical offset across instruments within this system
        let mut global_staff_offset: usize = 0;
        let mut cumulative_inter_gap: f32 = 0.0;

        // Compute unified note positions across ALL instruments in this system.
        // This ensures measures and notes at the same tick align horizontally
        // across every staff group (e.g., violin beat 2 lines up with cello beat 2).
        let all_staves: Vec<&StaffData> = instruments
            .iter()
            .flat_map(|inst| inst.staves.iter())
            .collect();
        // system.bounding_box.width = max_system_width (set above), which is
        // the TOTAL system width including the left margin.  Passing it directly
        // as system_width lets compute_unified_note_positions use
        //   available_width = max_system_width - unified_left_margin
        // and notes are placed from unified_left_margin to max_system_width.
        // Collect all mid-system clef change ticks so the spacing
        // algorithm can insert extra space for the clef glyph.
        let clef_change_ticks: std::collections::HashSet<u32> = all_staves
            .iter()
            .flat_map(|s| s.clef_events.iter())
            .filter(|(t, _)| *t > system.tick_range.start_tick && *t < system.tick_range.end_tick)
            .map(|(t, _)| *t)
            .collect();
        let note_positions = note_layout::compute_unified_note_positions(
            &all_staves,
            &system.tick_range,
            system.bounding_box.width,
            unified_left_margin,
            &spacing_config,
            ticks_per_measure,
            &clef_change_ticks,
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

            // bounding_box.width already equals max_system_width (includes left margin).
            let total_system_width: f32 = system.bounding_box.width;

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
            .map(|sd| {
                note_layout::compute_staff_note_extents(
                    sd,
                    &system.tick_range,
                    config.units_per_space,
                )
            })
            .collect();

        // For each staff, record whether an inter-instrument gap precedes it
        let mut has_inter_gap_before: Vec<bool> = Vec::new();
        for (inst_idx, inst) in instruments.iter().enumerate() {
            for (staff_idx, _) in inst.staves.iter().enumerate() {
                has_inter_gap_before.push(inst_idx > 0 && staff_idx == 0);
            }
        }

        let (cumulative_collision_extra, total_collision_extra) =
            staff_groups::compute_collision_gaps(
                &staff_extents,
                &has_inter_gap_before,
                intra_staff_multiplier,
                inter_instrument_multiplier,
                config.units_per_space,
            );

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
                let glyphs = note_layout::position_glyphs_for_staff(
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
                    pickup_ticks,
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
                let staff_lines = assembly::create_staff_lines(
                    staff_vertical_offset,
                    system.bounding_box.width,
                    config.units_per_space,
                );

                // T036-T037: Generate structural glyphs (clef, time sig, key sig) at system start
                let structural_glyphs = structural::render_structural_glyphs(
                    staff_data,
                    &system.tick_range,
                    system.index,
                    system.bounding_box.width,
                    staff_vertical_offset,
                    config.units_per_space,
                    &note_positions,
                    &measure_x_bounds,
                );

                // Create bar lines at measure boundaries
                let bar_lines = barlines::create_bar_lines(
                    &measure_infos,
                    &system.tick_range,
                    staff_vertical_offset,
                    unified_left_margin,
                    system.bounding_box.width,
                    config.units_per_space,
                    &note_positions,
                    &measure_x_bounds,
                );

                // Render annotation elements (ledger lines, dots, ties, slurs)
                let ann = annotations::render_annotations(
                    staff_data,
                    &system.tick_range,
                    system.index,
                    system.bounding_box.width,
                    staff_vertical_offset,
                    unified_left_margin,
                    config.units_per_space,
                    &note_positions,
                );

                // Create staff with batched glyphs and structural glyphs
                let staff = Staff {
                    staff_lines,
                    glyph_runs,
                    structural_glyphs,
                    bar_lines,
                    ledger_lines: ann.ledger_lines,
                    notation_dots: ann.notation_dots,
                    tie_arcs: ann.tie_arcs,
                    slur_arcs: ann.slur_arcs,
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
                Some(staff_groups::create_bracket_glyph(
                    &staves,
                    &bracket_type,
                    config,
                ))
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
        let _max_barline_x = system
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

        // All systems are justified to max_system_width.  Use that as the
        // authoritative content width so staff lines, barlines, and bounding
        // boxes are identical across systems.
        let content_width = config.max_system_width;

        // Update all staff lines to end at the justified width
        for staff_group in &mut system.staff_groups {
            for staff in &mut staff_group.staves {
                for line in &mut staff.staff_lines {
                    line.end_x = content_width;
                }
            }
        }

        // Ensure bounding box matches the justified width
        system.bounding_box.width = content_width;

        // Join measure barlines within each multi-staff group.
        staff_groups::join_multi_staff_barlines(&mut system.staff_groups);

        // Add a system-end barline at the justified right edge for every
        // staff group.
        barlines::render_system_barlines(
            &mut system.staff_groups,
            &measure_infos,
            system.tick_range.end_tick,
            content_width,
            config.units_per_space,
        );

        // Update system height to include collision-avoidance extra spacing
        system.bounding_box.height += total_collision_extra;

        // T010: Compute measure number for this system
        // Derive measure number from the system's start tick using actual ticks per measure
        let measure_num = actual_tick_to_measure(
            system.tick_range.start_tick,
            &measure_end_ticks_vec,
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
            let bracket_start_tick = actual_start(
                vbd.start_measure_index as usize,
                &measure_end_ticks_vec,
                pickup_ticks,
                ticks_per_measure,
            );
            let bracket_end_tick = actual_end(
                vbd.end_measure_index as usize,
                &measure_end_ticks_vec,
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

        // Expand system bounding box to cover all stem and beam extents.
        // Stems (U+0000) and beams (U+0001) can extend well beyond the staff area
        // (up to 70+ units). The bounding box must include them so the frontend's
        // viewport-based virtualization (getVisibleSystems) renders these elements
        // instead of clipping them at the viewBox edge.
        let mut glyph_min_y = system.bounding_box.y;
        let mut glyph_max_y = system.bounding_box.y + system.bounding_box.height;
        for staff_group in &system.staff_groups {
            for staff in &staff_group.staves {
                for glyph_run in &staff.glyph_runs {
                    for glyph in &glyph_run.glyphs {
                        if glyph.codepoint == "\u{0000}" || glyph.codepoint == "\u{0001}" {
                            let y_top = glyph.position.y.min(glyph.bounding_box.y);
                            let y_bottom = (glyph.position.y + glyph.bounding_box.height)
                                .max(glyph.bounding_box.y + glyph.bounding_box.height);
                            glyph_min_y = glyph_min_y.min(y_top);
                            glyph_max_y = glyph_max_y.max(y_bottom);
                        }
                    }
                }
            }
        }
        if glyph_min_y < system.bounding_box.y {
            let extension = system.bounding_box.y - glyph_min_y;
            system.bounding_box.y = glyph_min_y;
            system.bounding_box.height += extension;
        }
        if glyph_max_y > system.bounding_box.y + system.bounding_box.height {
            system.bounding_box.height = glyph_max_y - system.bounding_box.y;
        }
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

#[cfg(test)]
mod tests {
    use super::*;

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

        // Vertical spacing should be 10 staff spaces (200 units at default units_per_space=20)
        // This matches the standard grand-staff gap (~6 spaces between staff edges).
        let expected_spacing = 10.0 * config.units_per_space; // 200 units
        assert_eq!(
            bass_top - treble_top,
            expected_spacing,
            "Staff vertical spacing should be 10 staff spaces (200 units)"
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

        let default_spacing = 10.0 * config.units_per_space; // 200 units (grand-staff standard)
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
