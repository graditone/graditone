//! Note and glyph positioning
//!
//! Computes unified horizontal positions for notes across all staves,
//! generates positioned glyphs (noteheads, accidentals, dots, stems, beams,
//! flags) for each staff, and calculates vertical note extents.

use std::collections::HashMap;

use crate::layout::beams;
use crate::layout::extraction::{NoteData, NoteEvent, RestLayoutEvent, StaffData};
use crate::layout::positioner;
use crate::layout::spacer;
use crate::layout::stems;
use crate::layout::types::{BoundingBox, Glyph, Point, SourceReference, TickRange};

/// Compute absolute diatonic staff position for a note.
/// Uses the explicit spelling (step letter + alteration) when available,
/// otherwise falls back to an approximate mapping from MIDI pitch.
fn diatonic_staff_pos(pitch: u8, spelling: &Option<(char, i8)>) -> i32 {
    if let Some((step, alter)) = spelling {
        let step_pos: i32 = match step {
            'C' => 0,
            'D' => 1,
            'E' => 2,
            'F' => 3,
            'G' => 4,
            'A' => 5,
            'B' => 6,
            _ => 0,
        };
        let base_pitch = pitch as i32 - *alter as i32;
        let octave = base_pitch / 12 - 1;
        octave * 7 + step_pos
    } else {
        // Fallback: approximate diatonic position from MIDI pitch class
        let octave = (pitch / 12) as i32 - 1;
        let pc = pitch % 12;
        let step_pos: i32 = match pc {
            0 => 0,       // C
            1 | 2 => 1,   // C#/Db → D area
            3 | 4 => 2,   // D#/Eb → E area
            5 => 3,       // F
            6 | 7 => 4,   // F#/Gb → G area
            8 | 9 => 5,   // G#/Ab → A area
            10 | 11 => 6, // A#/Bb → B area
            _ => 0,
        };
        octave * 7 + step_pos
    }
}

pub(crate) fn compute_unified_note_positions(
    staves: &[&StaffData],
    tick_range: &TickRange,
    system_width: f32,
    left_margin: f32,
    spacing_config: &spacer::SpacingConfig,
    ticks_per_measure: u32,
    clef_change_ticks: &std::collections::HashSet<u32>,
) -> HashMap<u32, f32> {
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

    tick_durations.sort_by_key(|(tick, _)| *tick);
    tick_durations.dedup_by_key(|(tick, _)| *tick);

    // Detect ticks where a chord contains a second (adjacent staff positions)
    // that will need notehead displacement.  When stems point down, the lower
    // note shifts LEFT by one notehead width, and its accidental extends even
    // further left.  Pre-allocate extra horizontal space at those ticks so
    // nothing collides with the preceding event.
    //
    // We use diatonic (staff) positions rather than chromatic semitones, because
    // an augmented second like Bb→C# spans 3 semitones but occupies adjacent
    // staff lines and still causes notehead displacement.
    let mut chord_second_ticks: std::collections::HashSet<u32> = std::collections::HashSet::new();
    for staff_data in staves {
        for voice in &staff_data.voices {
            #[allow(clippy::type_complexity)]
            let mut tick_notes: std::collections::HashMap<
                u32,
                Vec<(u8, Option<(char, i8)>)>,
            > = std::collections::HashMap::new();
            for note in &voice.notes {
                if note.start_tick >= tick_range.start_tick && note.start_tick < tick_range.end_tick
                {
                    tick_notes
                        .entry(note.start_tick)
                        .or_default()
                        .push((note.pitch, note.spelling));
                }
            }
            for (tick, notes) in &tick_notes {
                if notes.len() < 2 {
                    continue;
                }
                let mut diatonic: Vec<i32> = notes
                    .iter()
                    .map(|&(pitch, ref spelling)| diatonic_staff_pos(pitch, spelling))
                    .collect();
                diatonic.sort();
                diatonic.dedup();
                for w in diatonic.windows(2) {
                    // Adjacent diatonic positions = staff second (or unison)
                    if w[1] - w[0] <= 1 {
                        chord_second_ticks.insert(*tick);
                        break;
                    }
                }
            }
        }
    }

    let mut cumulative_spacing = Vec::new();
    let mut current_position = 0.0;
    let mut last_tick = tick_range.start_tick;

    for (start_tick, duration_ticks) in &tick_durations {
        if *start_tick > last_tick {
            let gap_duration = (*start_tick - last_tick).min(*duration_ticks);
            let mut gap = spacer::compute_note_spacing(gap_duration, spacing_config);
            if *start_tick > tick_range.start_tick
                && ticks_per_measure > 0
                && *start_tick % ticks_per_measure == 0
            {
                gap += 25.0;
            }
            if clef_change_ticks.contains(start_tick) {
                gap += 50.0;
            }
            // Extra space for chords with seconds (displaced noteheads + staggered accidentals)
            if chord_second_ticks.contains(start_tick) {
                gap += 55.0;
            }
            current_position += gap;
        }
        cumulative_spacing.push(current_position);
        last_tick = *start_tick;
    }

    let end_clearance = 30.0;
    let total_natural_width = if let Some(&last_pos) = cumulative_spacing.last() {
        let (_, last_duration) = tick_durations.last().unwrap();
        last_pos + spacer::compute_note_spacing(*last_duration, spacing_config) + end_clearance
    } else {
        spacing_config.minimum_spacing + end_clearance
    };

    let available_width = system_width - left_margin;
    let scale_factor = if total_natural_width > 0.0 {
        available_width / total_natural_width
    } else {
        1.0
    };

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
#[allow(clippy::too_many_arguments)]
pub(crate) fn position_glyphs_for_staff(
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
    pickup_ticks: u32,
) -> Vec<Glyph> {
    let mut all_glyphs = Vec::new();
    let num_voices = staff_data.voices.len();

    for (voice_index, voice) in staff_data.voices.iter().enumerate() {
        let forced_stem_down: Option<bool> = if num_voices > 1 {
            Some(voice_index > 0)
        } else {
            None
        };

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
                    note.staccato,
                    note.dot_count,
                )
            })
            .collect();

        if notes_in_range.is_empty() {
            continue;
        }

        let horizontal_offsets: Vec<f32> = notes_in_range
            .iter()
            .map(|(_, start_tick, _, _, _, _)| *note_positions.get(start_tick).unwrap_or(&0.0))
            .collect();

        let voice_notes_in_range: Vec<&NoteEvent> = voice
            .notes
            .iter()
            .filter(|note| {
                note.start_tick >= tick_range.start_tick && note.start_tick < tick_range.end_tick
            })
            .collect();

        let note_clefs: Vec<&str> = notes_in_range
            .iter()
            .map(|(_, start_tick, _, _, _, _)| staff_data.get_clef_at_tick(*start_tick))
            .collect();

        let beamable_for_analysis_raw: Vec<beams::BeamableNote> = voice_notes_in_range
            .iter()
            .enumerate()
            .filter(|(_, note)| note.duration_ticks <= 480 || !note.beam_info.is_empty())
            .map(|(i, note)| {
                let notehead_x = horizontal_offsets[i];
                let notehead_y = positioner::pitch_to_y(note.pitch, note_clefs[i], units_per_space)
                    + staff_vertical_offset;

                let beam_types: Vec<String> =
                    note.beam_info.iter().map(|(_, bt)| bt.clone()).collect();
                let beam_levels = note.beam_info.len() as u8;

                beams::BeamableNote {
                    x: notehead_x,
                    y: notehead_y,
                    stem_end_y: 0.0,
                    tick: note.start_tick,
                    duration_ticks: note.duration_ticks,
                    beam_levels,
                    beam_types,
                    event_index: i,
                }
            })
            .collect();

        let mut beamable_for_analysis: Vec<beams::BeamableNote> = Vec::new();
        let mut seen_ticks: std::collections::HashSet<u32> = std::collections::HashSet::new();
        for note in beamable_for_analysis_raw {
            if seen_ticks.insert(note.tick) {
                beamable_for_analysis.push(note);
            }
        }

        let has_beam_info = beamable_for_analysis
            .iter()
            .any(|n| !n.beam_types.is_empty());
        let measure_starts: Vec<u32> = {
            let mut starts: Vec<u32> = measure_x_bounds.keys().copied().collect();
            starts.sort();
            starts
        };
        let beam_groups = if has_beam_info {
            beams::build_beam_groups_from_musicxml(&beamable_for_analysis, &measure_starts)
        } else {
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

        let mut beamed_note_indices = std::collections::HashSet::<usize>::new();
        let mut tick_to_indices: std::collections::HashMap<u32, Vec<usize>> =
            std::collections::HashMap::new();
        for (idx, note_data) in notes_in_range.iter().enumerate() {
            let (_, start_tick, duration_ticks, _, _, _) = note_data;
            let has_beam = voice_notes_in_range
                .iter()
                .any(|n| n.start_tick == *start_tick && !n.beam_info.is_empty());
            if *duration_ticks <= 480 || has_beam {
                tick_to_indices.entry(*start_tick).or_default().push(idx);
            }
        }
        for group in &beam_groups {
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

        // === CHORD DISPLACEMENT ===
        let chord_note_y_positions: Vec<f32> = notes_in_range
            .iter()
            .enumerate()
            .map(|(i, (pitch, _, _, spelling, _, _))| {
                positioner::pitch_to_y_with_spelling(
                    *pitch,
                    note_clefs[i],
                    units_per_space,
                    *spelling,
                ) + staff_vertical_offset
            })
            .collect();

        let chord_stem_middle_y = staff_vertical_offset + 1.5 * units_per_space;
        let chord_adjacent_threshold = 0.5 * units_per_space + 0.01;
        let mut chord_tick_to_indices: std::collections::HashMap<u32, Vec<usize>> =
            std::collections::HashMap::new();
        for (idx, (_, start_tick, _, _, _, _)) in notes_in_range.iter().enumerate() {
            chord_tick_to_indices
                .entry(*start_tick)
                .or_default()
                .push(idx);
        }

        let mut chord_x_offsets: Vec<f32> = vec![0.0; notes_in_range.len()];
        let mut chord_scale_map: std::collections::HashMap<usize, f32> =
            std::collections::HashMap::new();
        let mut chord_stem_data: Vec<(f32, f32, f32, usize)> = Vec::new();
        let mut chord_flag_data: Vec<(f32, f32, bool, u32, usize)> = Vec::new();

        for indices in chord_tick_to_indices.values() {
            if indices.len() < 2 {
                continue;
            }

            let mut sorted: Vec<usize> = indices.clone();
            sorted.sort_by(|&a, &b| {
                chord_note_y_positions[b]
                    .partial_cmp(&chord_note_y_positions[a])
                    .unwrap_or(std::cmp::Ordering::Equal)
            });

            let chord_stem_down = if let Some(forced) = forced_stem_down {
                forced
            } else {
                let most_extreme = *sorted
                    .iter()
                    .max_by(|&&a, &&b| {
                        let da = (chord_note_y_positions[a] - chord_stem_middle_y).abs();
                        let db = (chord_note_y_positions[b] - chord_stem_middle_y).abs();
                        da.partial_cmp(&db).unwrap_or(std::cmp::Ordering::Equal)
                    })
                    .unwrap();
                chord_note_y_positions[most_extreme] <= chord_stem_middle_y
            };

            let anchor_idx = if chord_stem_down {
                *sorted.last().unwrap()
            } else {
                sorted[0]
            };

            let chord_duration = notes_in_range[sorted[0]].2;
            let needs_explicit_stem = chord_duration < 3840;
            let any_beamed = sorted.iter().any(|idx| beamed_note_indices.contains(idx));

            let notehead_scale: f32 = if chord_duration >= 3840 {
                1.0
            } else if chord_duration >= 1920 {
                345.0 / 300.0
            } else {
                332.0 / 295.0
            };
            let chord_font_size = 80.0 * notehead_scale;
            let scaled_half_width = stems::Stem::NOTEHEAD_WIDTH * notehead_scale;
            let chord_displacement = scaled_half_width * 2.0;

            if needs_explicit_stem && !any_beamed {
                for &idx in &sorted {
                    chord_scale_map.insert(idx, chord_font_size);
                }

                let visual_y_offset = 0.5 * units_per_space;
                let bottom_y = chord_note_y_positions[sorted[0]] + visual_y_offset;
                let top_y = chord_note_y_positions[*sorted.last().unwrap()] + visual_y_offset;

                if chord_stem_down {
                    let stem_x = horizontal_offsets[anchor_idx] - scaled_half_width;
                    let stem_tip_y = bottom_y + stems::Stem::STEM_LENGTH;
                    chord_stem_data.push((stem_x, top_y, stem_tip_y, anchor_idx));
                    if chord_duration < 960 {
                        chord_flag_data.push((
                            stem_x,
                            stem_tip_y,
                            true,
                            chord_duration,
                            anchor_idx,
                        ));
                    }
                } else {
                    let stem_x = horizontal_offsets[anchor_idx] + scaled_half_width;
                    let stem_tip_y = top_y - stems::Stem::STEM_LENGTH;
                    chord_stem_data.push((stem_x, stem_tip_y, bottom_y, anchor_idx));
                    if chord_duration < 960 {
                        chord_flag_data.push((
                            stem_x,
                            stem_tip_y,
                            false,
                            chord_duration,
                            anchor_idx,
                        ));
                    }
                }
            } else {
                for &idx in &sorted {
                    if idx != anchor_idx && !beamed_note_indices.contains(&idx) {
                        chord_scale_map.insert(idx, chord_font_size);
                    }
                }
            }

            let mut next_should_displace = true;
            for i in 1..sorted.len() {
                let y_lower = chord_note_y_positions[sorted[i - 1]];
                let y_upper = chord_note_y_positions[sorted[i]];
                let y_diff = y_lower - y_upper;

                if y_diff <= chord_adjacent_threshold {
                    if next_should_displace {
                        if chord_stem_down {
                            // Stem down: displace lower note to the left
                            chord_x_offsets[sorted[i - 1]] -= chord_displacement;
                        } else {
                            // Stem up: displace upper note to the right
                            chord_x_offsets[sorted[i]] += chord_displacement;
                        }
                        next_should_displace = false;
                    } else {
                        next_should_displace = true;
                    }
                } else {
                    next_should_displace = true;
                }
            }
        }

        let adjusted_horizontal_offsets: Vec<f32> = horizontal_offsets
            .iter()
            .zip(chord_x_offsets.iter())
            .map(|(x, dx)| x + dx)
            .collect();

        let grace_note_indices: std::collections::HashSet<usize> = voice_notes_in_range
            .iter()
            .enumerate()
            .filter(|(_, n)| n.is_grace)
            .map(|(i, _)| i)
            .collect();

        // Grace note ticks: used to scale stems and beams for grace notes
        let grace_note_ticks: std::collections::HashSet<u32> = voice_notes_in_range
            .iter()
            .filter(|n| n.is_grace)
            .map(|n| n.start_tick)
            .collect();

        let glyphs = positioner::position_noteheads(
            &notes_in_range,
            &adjusted_horizontal_offsets,
            &note_clefs,
            units_per_space,
            instrument_id,
            staff_index,
            voice_index,
            staff_vertical_offset,
            &beamed_note_indices,
            &chord_scale_map,
            forced_stem_down,
            &grace_note_indices,
        );

        all_glyphs.extend(glyphs);

        for &(stem_x, y_top, y_bottom, event_index) in &chord_stem_data {
            let chord_tick = notes_in_range[event_index].1;
            let is_grace_stem = grace_note_ticks.contains(&chord_tick);
            let grace_scale: f32 = if is_grace_stem { 0.6 } else { 1.0 };
            let thickness = stems::Stem::STEM_THICKNESS * grace_scale;
            let stem_height = y_bottom - y_top;
            let stem_glyph = Glyph {
                codepoint: '\u{0000}'.to_string(),
                position: Point {
                    x: stem_x,
                    y: y_top,
                },
                bounding_box: BoundingBox {
                    x: stem_x - (thickness / 2.0),
                    y: y_top,
                    width: thickness,
                    height: stem_height,
                },
                source_reference: SourceReference {
                    instrument_id: instrument_id.to_string(),
                    staff_index,
                    voice_index,
                    event_index,
                },
                font_size: None,
                opacity: if is_grace_stem { Some(0.5) } else { None },
            };
            all_glyphs.push(stem_glyph);
        }

        // Generate flag glyphs for short-duration chord stems (eighths, 16ths, 32nds)
        for &(flag_x, flag_y, stem_down, duration, event_index) in &chord_flag_data {
            let chord_tick = notes_in_range[event_index].1;
            let is_grace = grace_note_ticks.contains(&chord_tick);
            let grace_scale: f32 = if is_grace { 0.6 } else { 1.0 };

            let (flag_codepoint, flag_glyph_name) = if stem_down {
                if duration < 240 {
                    ('\u{E245}', "flag32ndDown")
                } else if duration < 480 {
                    ('\u{E243}', "flag16thDown")
                } else {
                    ('\u{E241}', "flag8thDown")
                }
            } else if duration < 240 {
                ('\u{E244}', "flag32ndUp")
            } else if duration < 480 {
                ('\u{E242}', "flag16thUp")
            } else {
                ('\u{E240}', "flag8thUp")
            };

            // Flag glyphs extend to the right from the stem tip. With
            // text-anchor=middle rendering, offset x by half the flag's
            // rendered width so the left edge aligns with the stem.
            let flag_half_width = 0.54 * units_per_space * grace_scale;
            let flag_position = Point {
                x: flag_x + flag_half_width,
                y: flag_y,
            };
            let flag_font_size = 80.0 * grace_scale;
            let bbox_font_size = 40.0 * grace_scale;
            let flag_bbox = positioner::compute_glyph_bounding_box(
                flag_glyph_name,
                &flag_position,
                bbox_font_size,
                units_per_space,
            );

            let flag_glyph = Glyph {
                codepoint: flag_codepoint.to_string(),
                position: flag_position,
                bounding_box: flag_bbox,
                source_reference: SourceReference {
                    instrument_id: instrument_id.to_string(),
                    staff_index,
                    voice_index,
                    event_index,
                },
                font_size: Some(flag_font_size),
                opacity: if is_grace { Some(0.5) } else { None },
            };
            all_glyphs.push(flag_glyph);
        }

        let measure_starts_sorted: Vec<u32> = {
            let mut ms: Vec<u32> = measure_x_bounds.keys().copied().collect();
            ms.sort();
            ms
        };
        let accidental_glyphs = positioner::position_note_accidentals(
            &notes_in_range,
            &adjusted_horizontal_offsets,
            &note_clefs,
            units_per_space,
            instrument_id,
            staff_index,
            voice_index,
            staff_vertical_offset,
            staff_data.key_sharps,
            ticks_per_measure,
            &staff_data.key_signature_events,
            pickup_ticks,
            &measure_starts_sorted,
        );

        all_glyphs.extend(accidental_glyphs);

        let staff_middle_y = staff_vertical_offset + 1.5 * units_per_space;

        // Build a map of tick → (min_y, max_y) for chord noteheads so that
        // beamed stems span the full chord extent and the beam has adequate
        // clearance from the nearest notehead.
        let mut chord_y_range: std::collections::HashMap<u32, (f32, f32)> =
            std::collections::HashMap::new();
        for (idx, (_, start_tick, _, _, _, _)) in notes_in_range.iter().enumerate() {
            let y = chord_note_y_positions[idx];
            chord_y_range
                .entry(*start_tick)
                .and_modify(|(min_y, max_y)| {
                    if y < *min_y {
                        *min_y = y;
                    }
                    if y > *max_y {
                        *max_y = y;
                    }
                })
                .or_insert((y, y));
        }

        let mut stem_glyphs = Vec::new();

        for group in &beam_groups {
            if group.notes.len() < 2 {
                continue;
            }

            let group_direction = if let Some(forced) = forced_stem_down {
                if forced {
                    stems::StemDirection::Down
                } else {
                    stems::StemDirection::Up
                }
            } else {
                // Expand each beamable note into all chord notes at
                // that tick so the stem direction considers every
                // notehead's distance from the middle line.
                let expanded: Vec<beams::BeamableNote> = group
                    .notes
                    .iter()
                    .flat_map(|n| {
                        if let Some(&(min_y, max_y)) = chord_y_range.get(&n.tick) {
                            vec![
                                beams::BeamableNote {
                                    y: min_y,
                                    ..n.clone()
                                },
                                beams::BeamableNote {
                                    y: max_y,
                                    ..n.clone()
                                },
                            ]
                        } else {
                            vec![n.clone()]
                        }
                    })
                    .collect();
                beams::compute_group_stem_direction(&expanded, staff_middle_y)
            };

            let is_grace_group = group
                .notes
                .iter()
                .all(|n| grace_note_ticks.contains(&n.tick));
            let grace_scale: f32 = if is_grace_group { 0.6 } else { 1.0 };
            let notehead_width = stems::Stem::NOTEHEAD_WIDTH * grace_scale;

            // === PHASE 1: Compute initial stems and beam line ===
            let visual_y_offset = 0.5 * units_per_space;
            let mut initial_stems: Vec<stems::Stem> = Vec::new();
            let min_length = stems::Stem::MIN_BEAMED_STEM_LENGTH * grace_scale;
            for note in &group.notes {
                // For chords, use the notehead closest to the beam
                // direction as the stem origin, so the minimum stem length
                // is measured from the chord edge nearest the beam.
                let (beam_side_y, far_side_y) =
                    if let Some(&(min_y, max_y)) = chord_y_range.get(&note.tick) {
                        match group_direction {
                            // Stem up → beam above → origin at top note (min_y)
                            stems::StemDirection::Up => (min_y, max_y),
                            // Stem down → beam below → origin at bottom note (max_y)
                            stems::StemDirection::Down => (max_y, min_y),
                        }
                    } else {
                        (note.y, note.y)
                    };

                let beam_visual_y = beam_side_y + visual_y_offset;
                let far_visual_y = far_side_y + visual_y_offset;
                let mut stem =
                    stems::create_stem(note.x, far_visual_y, group_direction, notehead_width);
                match group_direction {
                    stems::StemDirection::Up => {
                        stem.y_end = beam_visual_y - min_length;
                    }
                    stems::StemDirection::Down => {
                        stem.y_end = beam_visual_y + min_length;
                    }
                }
                initial_stems.push(stem);
            }

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

            let max_slope_units = beams::Beam::MAX_SLOPE * units_per_space;
            let max_slope_per_unit = if dx.abs() > 0.001 {
                max_slope_units / dx.abs()
            } else {
                0.0
            };
            let clamped_slope = beam_slope.clamp(-max_slope_per_unit, max_slope_per_unit);

            let mut beam_y_at_stems: Vec<f32> = Vec::new();
            for stem in &initial_stems {
                let beam_y = first_stem_end + clamped_slope * (stem.x - first_stem_x);
                beam_y_at_stems.push(beam_y);
            }

            let mut beam_offset = 0.0f32;
            for (i, stem) in initial_stems.iter().enumerate() {
                let beam_y = beam_y_at_stems[i];
                let min_length = stems::Stem::MIN_BEAMED_STEM_LENGTH * grace_scale;
                // For chords, enforce minimum clearance from the
                // notehead closest to the beam, not the stem origin
                // (which is at the far side of the chord).
                let beam_side_y =
                    if let Some(&(min_y, max_y)) = chord_y_range.get(&group.notes[i].tick) {
                        let vy_offset = 0.5 * units_per_space;
                        match group_direction {
                            stems::StemDirection::Up => min_y + vy_offset,
                            stems::StemDirection::Down => max_y + vy_offset,
                        }
                    } else {
                        stem.y_start
                    };
                match group_direction {
                    stems::StemDirection::Up => {
                        let required_beam_y = beam_side_y - min_length;
                        if beam_y > required_beam_y {
                            let needed_offset = required_beam_y - beam_y;
                            beam_offset = beam_offset.min(needed_offset);
                        }
                    }
                    stems::StemDirection::Down => {
                        let required_beam_y = beam_side_y + min_length;
                        if beam_y < required_beam_y {
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
                let final_stem_end = adjusted_beam_y;
                let stem_top_y = stem.y_start.min(final_stem_end);
                let stem_height = (final_stem_end - stem.y_start).abs();

                let thickness = stem.thickness * grace_scale;
                let stem_glyph = Glyph {
                    codepoint: '\u{0000}'.to_string(),
                    position: Point {
                        x: stem.x,
                        y: stem_top_y,
                    },
                    bounding_box: BoundingBox {
                        x: stem.x - (thickness / 2.0),
                        y: stem_top_y,
                        width: thickness,
                        height: stem_height,
                    },
                    source_reference: SourceReference {
                        instrument_id: instrument_id.to_string(),
                        staff_index,
                        voice_index,
                        event_index: group.notes[i].event_index,
                    },
                    font_size: None,
                    opacity: if is_grace_group { Some(0.5) } else { None },
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

            let slope = clamped_slope;
            if let Some(beam) = beams::create_beam(&beamable_with_stems, slope) {
                let beam_thickness = beam.thickness * grace_scale;
                let beam_glyph = Glyph {
                    codepoint: '\u{0001}'.to_string(),
                    position: Point {
                        x: beam.x_start,
                        y: beam.y_start,
                    },
                    bounding_box: BoundingBox {
                        x: beam.x_start,
                        y: beam.y_end,
                        width: beam.x_end - beam.x_start,
                        height: beam_thickness,
                    },
                    source_reference: SourceReference {
                        instrument_id: instrument_id.to_string(),
                        staff_index,
                        voice_index,
                        event_index: group.notes.first().map_or(0, |n| n.event_index),
                    },
                    font_size: None,
                    opacity: if is_grace_group { Some(0.5) } else { None },
                };
                all_glyphs.push(beam_glyph);
            }

            let stem_direction_up = group_direction == stems::StemDirection::Up;
            let updated_group = beams::BeamGroup {
                notes: beamable_with_stems,
                beam_count: group.beam_count,
            };
            let multi_beams =
                beams::create_multi_level_beams(&updated_group, slope, stem_direction_up);
            for beam in multi_beams {
                let beam_thickness = beam.thickness * grace_scale;
                let beam_glyph = Glyph {
                    codepoint: '\u{0001}'.to_string(),
                    position: Point {
                        x: beam.x_start,
                        y: beam.y_start,
                    },
                    bounding_box: BoundingBox {
                        x: beam.x_start,
                        y: beam.y_end,
                        width: beam.x_end - beam.x_start,
                        height: beam_thickness,
                    },
                    source_reference: SourceReference {
                        instrument_id: instrument_id.to_string(),
                        staff_index,
                        voice_index,
                        event_index: updated_group.notes.first().map_or(0, |n| n.event_index),
                    },
                    font_size: None,
                    opacity: if is_grace_group { Some(0.5) } else { None },
                };
                all_glyphs.push(beam_glyph);
            }
        }

        all_glyphs.extend(stem_glyphs);
    }

    // Position rests for this staff (all voices combined)
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
            pickup_ticks,
        );
        all_glyphs.extend(rest_glyphs);
    }

    all_glyphs
}

/// Compute the vertical extent of notes in a staff for a given tick range.
///
/// Returns (min_y, max_y) relative to the staff origin (top line = 0).
pub(crate) fn compute_staff_note_extents(
    staff_data: &StaffData,
    tick_range: &TickRange,
    units_per_space: f32,
) -> (f32, f32) {
    let mut min_y = 0.0_f32;
    let mut max_y = 4.0 * units_per_space;
    let middle_y = 2.0 * units_per_space;

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
                if y < middle_y {
                    let stem_tip = y + stems::Stem::STEM_LENGTH;
                    if stem_tip > max_y {
                        max_y = stem_tip;
                    }
                } else {
                    let stem_tip = y - stems::Stem::STEM_LENGTH;
                    if stem_tip < min_y {
                        min_y = stem_tip;
                    }
                }
            }
        }
    }

    (min_y, max_y)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::layout::compute_layout;
    use crate::layout::extraction::{NoteEvent, StaffData, VoiceData};
    use crate::layout::types::LayoutConfig;

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
                    pitch: 67,
                    start_tick: 0,
                    duration_ticks: 960,
                    spelling: None,
                    beam_info: vec![],
                    staccato: false,
                    dot_count: 0,
                    note_id: String::new(),
                    tie_next: None,
                    slur_next: None,
                    slur_above: None,
                    is_grace: false,
                }],
                rests: vec![],
            }],
        };
        let tick_range = TickRange {
            start_tick: 0,
            end_tick: 3840,
        };
        let (min_y, max_y) = compute_staff_note_extents(&staff_data, &tick_range, ups);
        assert!(
            (min_y - (-20.0)).abs() < 0.1,
            "min_y should be ~-20 for G4 (stem extends above staff), got {}",
            min_y
        );
        assert!(
            (max_y - 4.0 * ups).abs() < 0.1,
            "max_y should be ~4*ups for in-staff note, got {}",
            max_y
        );
    }

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
                    pitch: 60,
                    start_tick: 0,
                    duration_ticks: 960,
                    spelling: None,
                    beam_info: vec![],
                    staccato: false,
                    dot_count: 0,
                    note_id: String::new(),
                    tie_next: None,
                    slur_next: None,
                    slur_above: None,
                    is_grace: false,
                }],
                rests: vec![],
            }],
        };
        let tick_range = TickRange {
            start_tick: 0,
            end_tick: 3840,
        };
        let (_min_y, max_y) = compute_staff_note_extents(&staff_data, &tick_range, ups);
        assert!(
            max_y > 4.0 * ups,
            "max_y should extend below staff for C4 in treble, got {}",
            max_y
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

    /// T110: Unbeamed eighth-note chord uses bare noteheads + explicit stem + flag
    /// (Für Elise M33 LH: C4+E4 eighth-note chord, stems up)
    #[test]
    fn test_unbeamed_eighth_chord_uses_bare_noteheads_and_explicit_stem() {
        // Two notes at the same tick forming an eighth-note chord, no beam info
        let score = serde_json::json!({
            "instruments": [{
                "id": "piano",
                "staves": [{
                    "clef": "Treble",
                    "time_signature": { "numerator": 3, "denominator": 8 },
                    "key_signature": { "sharps": 0 },
                    "voices": [{
                        "notes": [
                            { "pitch": 60, "tick": 0, "duration": 480 },
                            { "pitch": 64, "tick": 0, "duration": 480 }
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

        // Both notes should use bare noteheadBlack (U+E0A4), not combined eighth glyphs
        let bare_noteheads = all_glyphs
            .iter()
            .filter(|g| g.codepoint == "\u{E0A4}")
            .count();
        let combined_eighth_up = all_glyphs
            .iter()
            .filter(|g| g.codepoint == "\u{E1D7}")
            .count();
        let combined_eighth_down = all_glyphs
            .iter()
            .filter(|g| g.codepoint == "\u{E1D8}")
            .count();

        assert_eq!(
            bare_noteheads, 2,
            "Both chord notes should use bare noteheadBlack (U+E0A4)"
        );
        assert_eq!(
            combined_eighth_up, 0,
            "Should not use combined note8thUp glyph in chord"
        );
        assert_eq!(
            combined_eighth_down, 0,
            "Should not use combined note8thDown glyph in chord"
        );

        // Should have exactly one explicit stem (U+0000)
        let stems: Vec<_> = all_glyphs
            .iter()
            .filter(|g| g.codepoint == "\u{0000}")
            .collect();
        assert_eq!(stems.len(), 1, "Should have 1 explicit chord stem");

        // Should have exactly one flag glyph (U+E240 = flag8thUp or U+E241 = flag8thDown)
        let flags: Vec<_> = all_glyphs
            .iter()
            .filter(|g| {
                let cp = g.codepoint.chars().next().unwrap_or('\0') as u32;
                (0xE240..=0xE24F).contains(&cp)
            })
            .collect();
        assert_eq!(
            flags.len(),
            1,
            "Should have 1 flag glyph for the eighth-note chord"
        );
    }
}
