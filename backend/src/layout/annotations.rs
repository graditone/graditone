//! Annotation rendering (ties, slurs, dots, ledger lines)
//!
//! Handles augmentation and staccato dots, tie arcs (same-system and
//! cross-system), slur arcs, and ledger line generation. All annotation
//! types are consolidated in this single module.

use std::collections::{BTreeMap, HashMap, HashSet};

use crate::layout::beams;
use crate::layout::extraction::{NoteEvent, StaffData};
use crate::layout::positioner;
use crate::layout::stems;
use crate::layout::types;
use crate::layout::types::{LedgerLine, TickRange};

type NoteData = (u8, u32, u32, Option<(char, i8)>, bool, u8, bool);

/// Result of annotation rendering for a single staff.
pub(crate) struct AnnotationResult {
    pub ledger_lines: Vec<LedgerLine>,
    pub notation_dots: Vec<types::NotationDot>,
    pub tie_arcs: Vec<types::TieArc>,
    pub slur_arcs: Vec<types::TieArc>,
}

/// Render all annotation elements for a single staff:
/// ledger lines, notation dots (augmentation + staccato), tie arcs,
/// and slur arcs.
#[allow(clippy::too_many_arguments)]
pub(crate) fn render_annotations(
    staff_data: &StaffData,
    tick_range: &TickRange,
    system_index: usize,
    system_width: f32,
    staff_vertical_offset: f32,
    unified_left_margin: f32,
    units_per_space: f32,
    note_positions: &HashMap<u32, f32>,
    measure_starts: &[u32],
) -> AnnotationResult {
    let ledger_lines = render_ledger_lines(
        staff_data,
        tick_range,
        staff_vertical_offset,
        units_per_space,
        note_positions,
    );

    let staff_middle_y = staff_vertical_offset + 1.5 * units_per_space;

    let notation_dots = render_notation_dots(
        staff_data,
        tick_range,
        staff_vertical_offset,
        staff_middle_y,
        units_per_space,
        note_positions,
        measure_starts,
    );

    let (tie_arcs, slur_arcs) = render_ties_and_slurs(
        staff_data,
        tick_range,
        system_index,
        system_width,
        staff_vertical_offset,
        staff_middle_y,
        unified_left_margin,
        units_per_space,
        note_positions,
    );

    AnnotationResult {
        ledger_lines,
        notation_dots,
        tie_arcs,
        slur_arcs,
    }
}

fn render_ledger_lines(
    staff_data: &StaffData,
    tick_range: &TickRange,
    staff_vertical_offset: f32,
    units_per_space: f32,
    note_positions: &HashMap<u32, f32>,
) -> Vec<LedgerLine> {
    let mut ledger_lines = Vec::new();
    for voice in &staff_data.voices {
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
                    note.has_explicit_accidental,
                )
            })
            .collect();
        let offsets: Vec<f32> = notes_in_range
            .iter()
            .map(|(_, tick, _, _, _, _, _)| *note_positions.get(tick).unwrap_or(&0.0))
            .collect();
        let ledger_clefs: Vec<&str> = notes_in_range
            .iter()
            .map(|(_, tick, _, _, _, _, _)| staff_data.get_clef_at_tick(*tick))
            .collect();
        ledger_lines.extend(positioner::position_ledger_lines(
            &notes_in_range,
            &offsets,
            &ledger_clefs,
            units_per_space,
            staff_vertical_offset,
        ));
    }
    ledger_lines
}

#[allow(clippy::too_many_arguments)]
fn render_notation_dots(
    staff_data: &StaffData,
    tick_range: &TickRange,
    staff_vertical_offset: f32,
    staff_middle_y: f32,
    units_per_space: f32,
    note_positions: &HashMap<u32, f32>,
    measure_starts: &[u32],
) -> Vec<types::NotationDot> {
    let mut notation_dots = Vec::new();
    let dot_radius = 0.18 * units_per_space;
    let num_voices = staff_data.voices.len();
    for (dot_voice_idx, voice) in staff_data.voices.iter().enumerate() {
        // Multi-voice stem rule for dot placement
        let forced_stem_down: Option<bool> = if num_voices > 1 {
            Some(dot_voice_idx > 0)
        } else {
            None
        };
        let voice_notes: Vec<&NoteEvent> = voice
            .notes
            .iter()
            .filter(|n| n.start_tick >= tick_range.start_tick && n.start_tick < tick_range.end_tick)
            .collect();
        // Group notes by tick for chord handling
        let mut tick_groups: BTreeMap<u32, Vec<&NoteEvent>> = BTreeMap::new();
        for note in &voice_notes {
            tick_groups.entry(note.start_tick).or_default().push(note);
        }

        // Pre-compute beam group stem directions so staccato dots on beamed
        // notes use the actual beam group direction, not per-chord heuristics.
        let beam_tick_stem_down: HashMap<u32, bool> = {
            let mut map = HashMap::new();
            if forced_stem_down.is_none() {
                let beamable_raw: Vec<beams::BeamableNote> = voice_notes
                    .iter()
                    .filter(|n| n.duration_ticks <= 480 || !n.beam_info.is_empty())
                    .map(|n| {
                        let clef = staff_data.get_clef_at_tick(n.start_tick);
                        let y = positioner::pitch_to_y_with_spelling(
                            n.pitch,
                            clef,
                            units_per_space,
                            n.spelling,
                        ) + staff_vertical_offset;
                        let beam_types: Vec<String> =
                            n.beam_info.iter().map(|(_, bt)| bt.clone()).collect();
                        beams::BeamableNote {
                            x: *note_positions.get(&n.start_tick).unwrap_or(&0.0),
                            y,
                            stem_end_y: 0.0,
                            tick: n.start_tick,
                            duration_ticks: n.duration_ticks,
                            beam_levels: n.beam_info.len() as u8,
                            beam_types,
                            event_index: 0,
                        }
                    })
                    .collect();
                let mut deduped: Vec<beams::BeamableNote> = Vec::new();
                let mut seen: HashSet<u32> = HashSet::new();
                for n in beamable_raw {
                    if seen.insert(n.tick) {
                        deduped.push(n);
                    }
                }
                let has_beam_info = deduped.iter().any(|n| !n.beam_types.is_empty());
                let groups = if has_beam_info {
                    beams::build_beam_groups_from_musicxml(&deduped, measure_starts)
                } else {
                    let gs = beams::group_beamable_by_time_signature(
                        &deduped,
                        staff_data.time_numerator,
                        staff_data.time_denominator,
                    );
                    gs.into_iter()
                        .map(|notes| beams::BeamGroup {
                            beam_count: 1,
                            notes,
                        })
                        .collect()
                };
                for group in &groups {
                    if group.notes.len() < 2 {
                        continue;
                    }
                    let dir = beams::compute_group_stem_direction(&group.notes, staff_middle_y);
                    let is_down = dir == stems::StemDirection::Down;
                    for note in &group.notes {
                        map.insert(note.tick, is_down);
                    }
                }
            }
            map
        };

        for (_tick, group) in &tick_groups {
            let clef = staff_data.get_clef_at_tick(*_tick);
            let mut note_ys: Vec<(f32, &NoteEvent)> = group
                .iter()
                .map(|n| {
                    let y = positioner::pitch_to_y_with_spelling(
                        n.pitch,
                        clef,
                        units_per_space,
                        n.spelling,
                    ) + staff_vertical_offset;
                    (y, *n)
                })
                .collect();
            note_ys.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap());

            // Determine stem direction for the chord/note
            let explicit_stem_down = group.iter().find_map(|n| n.stem_down);
            let stem_down = if let Some(forced) = forced_stem_down {
                forced
            } else if let Some(explicit) = explicit_stem_down {
                // Use stem direction explicitly encoded in MusicXML <stem> element
                explicit
            } else if let Some(&beamed_down) = beam_tick_stem_down.get(_tick) {
                beamed_down
            } else {
                let most_extreme_y = note_ys
                    .iter()
                    .max_by(|a, b| {
                        let da = (a.0 - staff_middle_y).abs();
                        let db = (b.0 - staff_middle_y).abs();
                        da.partial_cmp(&db).unwrap()
                    })
                    .map(|(y, _)| *y)
                    .unwrap_or(staff_middle_y);
                most_extreme_y <= staff_middle_y
            };

            // Augmentation dots — collect per-note positions first, then
            // de-collide so adjacent chord notes don't share the same space.
            //
            // In chords with a second (adjacent notes), one notehead is
            // displaced sideways.  All dots must align in a single column
            // to the right of the *rightmost* notehead.
            let chord_second_threshold = 0.5 * units_per_space + 0.01;
            let has_second = note_ys.len() > 1
                && note_ys
                    .windows(2)
                    .any(|w| (w[1].0 - w[0].0).abs() <= chord_second_threshold);

            // Extra x-shift so dots clear the displaced notehead.
            let dot_x_extra = if has_second && !stem_down && group.len() > 1 {
                // Stem up: upper note displaced right by 2 × scaled half-width.
                let dur = group[0].duration_ticks;
                let notehead_scale: f32 = if dur >= 3840 {
                    1.0
                } else if dur >= 1920 {
                    345.0 / 300.0
                } else {
                    332.0 / 295.0
                };
                stems::Stem::NOTEHEAD_WIDTH * notehead_scale * 2.0
            } else {
                0.0
            };

            let mut chord_dot_entries: Vec<(f32, f32, u8)> = Vec::new(); // (note_x, dot_y, dot_count)
            for &(y_raw, note) in &note_ys {
                if note.dot_count > 0 {
                    let note_x = *note_positions.get(&note.start_tick).unwrap_or(&0.0);
                    let visual_y = y_raw + 0.5 * units_per_space;
                    let dot_y =
                        shift_dot_to_space(visual_y, staff_vertical_offset, units_per_space);
                    chord_dot_entries.push((note_x + dot_x_extra, dot_y, note.dot_count));
                }
            }
            // note_ys is sorted top-to-bottom (ascending y).  Walk the
            // collected dots in that same order and push any collision down
            // by one staff space so every dot occupies a unique space.
            for i in 1..chord_dot_entries.len() {
                if (chord_dot_entries[i].1 - chord_dot_entries[i - 1].1).abs() < 1.0 {
                    chord_dot_entries[i].1 = chord_dot_entries[i - 1].1 + units_per_space;
                }
            }
            let notehead_half_w = stems::Stem::NOTEHEAD_WIDTH;
            for &(note_x, dot_y, dot_count) in &chord_dot_entries {
                for d in 0..dot_count {
                    let gap = 0.4 * units_per_space;
                    let dot_spacing = 0.6 * units_per_space;
                    notation_dots.push(types::NotationDot {
                        x: note_x + notehead_half_w + gap + d as f32 * dot_spacing,
                        y: dot_y,
                        radius: dot_radius,
                    });
                }
            }

            // Staccato dot
            let has_staccato = group.iter().any(|n| n.staccato);
            if has_staccato {
                let (anchor_y_raw, anchor_note) = if stem_down {
                    note_ys[0]
                } else {
                    *note_ys.last().unwrap()
                };
                let note_x = *note_positions.get(&anchor_note.start_tick).unwrap_or(&0.0);
                let visual_y = anchor_y_raw + 0.5 * units_per_space;
                let staccato_offset = 1.2 * units_per_space;
                // In multi-voice, voice 0 is stem-up: place staccato above
                // (stem side) so it doesn't collide with the staff bottom or
                // with notes from other voices above.
                let dot_above = if stem_down {
                    true
                } else if forced_stem_down == Some(false) {
                    // Voice 0 forced stem up in multi-voice → dot above
                    true
                } else {
                    false
                };
                let staccato_y = if dot_above {
                    visual_y - staccato_offset
                } else {
                    visual_y + staccato_offset
                };
                let staccato_y =
                    shift_dot_to_space(staccato_y, staff_vertical_offset, units_per_space);
                notation_dots.push(types::NotationDot {
                    x: note_x,
                    y: staccato_y,
                    radius: dot_radius,
                });
            }
        }
    }
    notation_dots
}

/// Shift dot y-position to nearest space if it sits on a staff line.
fn shift_dot_to_space(y: f32, staff_offset: f32, units_per_space: f32) -> f32 {
    let relative = y - staff_offset;
    let line_index = relative / units_per_space;
    let frac = line_index - line_index.floor();
    if !(0.15..=0.85).contains(&frac) {
        // On or very near a line → shift up to the space above
        let nearest_line = line_index.round();
        staff_offset + (nearest_line - 0.5) * units_per_space
    } else {
        y
    }
}

#[allow(clippy::too_many_arguments)]
fn render_ties_and_slurs(
    staff_data: &StaffData,
    tick_range: &TickRange,
    _system_index: usize,
    system_width: f32,
    staff_vertical_offset: f32,
    staff_middle_y: f32,
    unified_left_margin: f32,
    units_per_space: f32,
    note_positions: &HashMap<u32, f32>,
) -> (Vec<types::TieArc>, Vec<types::TieArc>) {
    let mut tie_arcs: Vec<types::TieArc> = Vec::new();
    let mut slur_arcs: Vec<types::TieArc> = Vec::new();
    let notehead_half_w = stems::Stem::NOTEHEAD_WIDTH;

    // Build a lookup: note_id → (x, visual_y, pitch, start_tick)
    let mut note_lookup: HashMap<&str, (f32, f32, u8, u32)> = HashMap::new();

    // Compute grace note x positions per voice (mirrors note_layout logic).
    let mut grace_x_by_tick: HashMap<u32, f32> = HashMap::new();
    for voice in &staff_data.voices {
        let notes_in_range: Vec<&crate::layout::extraction::NoteEvent> = voice
            .notes
            .iter()
            .filter(|n| n.start_tick >= tick_range.start_tick && n.start_tick < tick_range.end_tick)
            .collect();
        let n = notes_in_range.len();
        let mut i = 0;
        while i < n {
            if notes_in_range[i].is_grace {
                let run_start = i;
                while i < n && notes_in_range[i].is_grace {
                    i += 1;
                }
                let run_end = i;
                let target_x = if run_end < n {
                    *note_positions
                        .get(&notes_in_range[run_end].start_tick)
                        .unwrap_or(&unified_left_margin)
                } else {
                    unified_left_margin
                };
                let run_len = (run_end - run_start) as f32;
                let first_x = target_x - run_len * 30.0;
                if first_x >= unified_left_margin {
                    for (k, idx) in (run_start..run_end).enumerate() {
                        let offset = (run_len - k as f32) * 30.0;
                        let x = target_x - offset;
                        grace_x_by_tick.insert(notes_in_range[idx].start_tick, x);
                    }
                } else {
                    for (k, idx) in (run_start..run_end).enumerate() {
                        let x = unified_left_margin + k as f32 * 30.0;
                        grace_x_by_tick.insert(notes_in_range[idx].start_tick, x);
                    }
                }
            } else {
                i += 1;
            }
        }
    }

    for voice in &staff_data.voices {
        for n in &voice.notes {
            if n.note_id.is_empty() {
                continue;
            }
            let in_range =
                n.start_tick >= tick_range.start_tick && n.start_tick < tick_range.end_tick;
            if !in_range {
                continue;
            }
            let clef = staff_data.get_clef_at_tick(n.start_tick);
            let y_raw =
                positioner::pitch_to_y_with_spelling(n.pitch, clef, units_per_space, n.spelling)
                    + staff_vertical_offset;
            let visual_y = y_raw + 0.5 * units_per_space;
            let note_x = if n.is_grace {
                *grace_x_by_tick.get(&n.start_tick).unwrap_or(&0.0)
            } else {
                *note_positions.get(&n.start_tick).unwrap_or(&0.0)
            };
            note_lookup.insert(&n.note_id, (note_x, visual_y, n.pitch, n.start_tick));
        }
    }

    // Collect tied note pitches per tick for chord tie detection
    let mut tied_pitches_per_tick: HashMap<u32, Vec<u8>> = HashMap::new();
    for voice in &staff_data.voices {
        for n in &voice.notes {
            if n.tie_next.is_some() && !n.note_id.is_empty() {
                let in_range =
                    n.start_tick >= tick_range.start_tick && n.start_tick < tick_range.end_tick;
                if in_range {
                    tied_pitches_per_tick
                        .entry(n.start_tick)
                        .or_default()
                        .push(n.pitch);
                }
            }
        }
    }

    // Helper: determine tie arc direction (above/below notehead)
    let determine_tie_above = |pitch: u8,
                               start_tick: u32,
                               spelling: Option<(char, i8)>,
                               tied_pitches: &HashMap<u32, Vec<u8>>|
     -> bool {
        if let Some(pitches) = tied_pitches.get(&start_tick) {
            if pitches.len() > 1 {
                let max_pitch = pitches.iter().copied().max().unwrap_or(0);
                let min_pitch = pitches.iter().copied().min().unwrap_or(0);
                if pitch == max_pitch {
                    return true;
                } else if pitch == min_pitch {
                    return false;
                }
            }
        }
        let clef = staff_data.get_clef_at_tick(start_tick);
        let y_raw = positioner::pitch_to_y_with_spelling(pitch, clef, units_per_space, spelling)
            + staff_vertical_offset;
        y_raw <= staff_middle_y
    };

    let system_right_edge = system_width;

    // Tie arcs: same-system and cross-system outgoing
    for voice in &staff_data.voices {
        for n in &voice.notes {
            let tie_target_id = match &n.tie_next {
                Some(id) => id.as_str(),
                None => continue,
            };
            if n.note_id.is_empty() {
                continue;
            }
            let in_range =
                n.start_tick >= tick_range.start_tick && n.start_tick < tick_range.end_tick;
            if !in_range {
                continue;
            }

            let start_info = match note_lookup.get(n.note_id.as_str()) {
                Some(info) => *info,
                None => continue,
            };
            let (start_x, start_y, _start_pitch, start_tick) = start_info;
            let above =
                determine_tie_above(n.pitch, start_tick, n.spelling, &tied_pitches_per_tick);

            match note_lookup.get(tie_target_id) {
                Some(&(end_x, end_y, _end_pitch, _end_tick)) => {
                    // Same-system tie
                    let arc_start_x = start_x + notehead_half_w;
                    let arc_end_x = end_x - notehead_half_w;
                    let span_x = (arc_end_x - arc_start_x).abs();
                    let arc_height = span_x.mul_add(0.15, 0.0).clamp(4.0, 30.0);
                    let y_offset = if above { -arc_height } else { arc_height };
                    let mid_y = (start_y + end_y) / 2.0 + y_offset;

                    tie_arcs.push(types::TieArc {
                        start: types::Point {
                            x: arc_start_x,
                            y: start_y,
                        },
                        end: types::Point {
                            x: arc_end_x,
                            y: end_y,
                        },
                        cp1: types::Point {
                            x: arc_start_x + span_x * 0.2,
                            y: mid_y,
                        },
                        cp2: types::Point {
                            x: arc_end_x - span_x * 0.2,
                            y: mid_y,
                        },
                        above,
                        note_id_start: n.note_id.clone(),
                        note_id_end: tie_target_id.to_string(),
                    });
                }
                None => {
                    // Cross-system outgoing tie
                    let arc_start_x = start_x + notehead_half_w;
                    let arc_end_x = system_right_edge;
                    let span_x = arc_end_x - arc_start_x;
                    let arc_height = span_x.mul_add(0.15, 0.0).clamp(4.0, 30.0);
                    let y_offset = if above { -arc_height } else { arc_height };
                    let mid_y = start_y + y_offset;

                    tie_arcs.push(types::TieArc {
                        start: types::Point {
                            x: arc_start_x,
                            y: start_y,
                        },
                        end: types::Point {
                            x: arc_end_x,
                            y: start_y,
                        },
                        cp1: types::Point {
                            x: arc_start_x + span_x * 0.2,
                            y: mid_y,
                        },
                        cp2: types::Point {
                            x: arc_end_x - span_x * 0.2,
                            y: mid_y,
                        },
                        above,
                        note_id_start: n.note_id.clone(),
                        note_id_end: tie_target_id.to_string(),
                    });
                }
            }
        }
    }

    // Cross-system incoming ties
    {
        let system_note_ids: HashSet<&str> = note_lookup.keys().copied().collect();
        for voice in &staff_data.voices {
            for n in &voice.notes {
                let tie_target_id = match &n.tie_next {
                    Some(id) => id.as_str(),
                    None => continue,
                };
                if n.start_tick >= tick_range.start_tick {
                    continue;
                }
                if !system_note_ids.contains(tie_target_id) {
                    continue;
                }
                let (end_x, end_y, _end_pitch, end_tick) = *note_lookup.get(tie_target_id).unwrap();
                let above =
                    determine_tie_above(n.pitch, end_tick, n.spelling, &tied_pitches_per_tick);

                let arc_end_x = end_x - notehead_half_w;
                let incoming_offset = 3.0 * notehead_half_w;
                let arc_start_x = (unified_left_margin - incoming_offset)
                    .min(arc_end_x - 20.0)
                    .max(0.0);
                let span_x = (arc_end_x - arc_start_x).max(1.0);
                let arc_height = span_x.mul_add(0.15, 0.0).clamp(4.0, 30.0);
                let y_offset = if above { -arc_height } else { arc_height };
                let mid_y = end_y + y_offset;

                tie_arcs.push(types::TieArc {
                    start: types::Point {
                        x: arc_start_x,
                        y: end_y,
                    },
                    end: types::Point {
                        x: arc_end_x,
                        y: end_y,
                    },
                    cp1: types::Point {
                        x: arc_start_x + span_x * 0.2,
                        y: mid_y,
                    },
                    cp2: types::Point {
                        x: arc_end_x - span_x * 0.2,
                        y: mid_y,
                    },
                    above,
                    note_id_start: n.note_id.clone(),
                    note_id_end: tie_target_id.to_string(),
                });
            }
        }
    }

    // Slur arcs
    {
        let system_note_ids: HashSet<&str> = note_lookup.keys().copied().collect();
        let notehead_half_h = units_per_space * 0.5;
        let num_voices = staff_data.voices.len();

        for (voice_idx, voice) in staff_data.voices.iter().enumerate() {
            for n in &voice.notes {
                let slur_target_id = match &n.slur_next {
                    Some(id) => id.as_str(),
                    None => continue,
                };
                if n.note_id.is_empty() {
                    continue;
                }

                let above = match n.slur_above {
                    Some(v) => v,
                    None => {
                        // Standard engraving: slur on opposite side of stems.
                        // In multi-voice context, stem direction is forced:
                        // voice 0 = stem up → slur below; voice 1+ = stem down → slur above.
                        if num_voices > 1 {
                            // voice_idx > 0 → stem down → slur above
                            voice_idx > 0
                        } else {
                            // Single voice: stem direction determined by chord
                            // (most extreme note from staff middle).
                            let clef = staff_data.get_clef_at_tick(n.start_tick);
                            let chord_ys: Vec<f32> = voice
                                .notes
                                .iter()
                                .filter(|cn| cn.start_tick == n.start_tick)
                                .map(|cn| {
                                    positioner::pitch_to_y_with_spelling(
                                        cn.pitch,
                                        clef,
                                        units_per_space,
                                        cn.spelling,
                                    ) + staff_vertical_offset
                                })
                                .collect();
                            let most_extreme_y = chord_ys
                                .iter()
                                .copied()
                                .max_by(|a, b| {
                                    let da = (*a - staff_middle_y).abs();
                                    let db = (*b - staff_middle_y).abs();
                                    da.partial_cmp(&db).unwrap_or(std::cmp::Ordering::Equal)
                                })
                                .unwrap_or(staff_middle_y);
                            // most extreme above middle → stem down → slur above
                            most_extreme_y <= staff_middle_y
                        }
                    }
                };
                let y_edge = if above {
                    // Offset to reach the notehead top edge from visual_y.
                    // visual_y = y_raw + 0.5*ups, so -2*half_h brings us to
                    // y_raw − half_h, i.e. the physical top of the notehead.
                    -2.0 * notehead_half_h
                } else {
                    2.0 * notehead_half_h
                };

                let in_range =
                    n.start_tick >= tick_range.start_tick && n.start_tick < tick_range.end_tick;

                if in_range {
                    let start_info = match note_lookup.get(n.note_id.as_str()) {
                        Some(info) => *info,
                        None => continue,
                    };
                    let (start_x, start_y, _sp, _st) = start_info;

                    match note_lookup.get(slur_target_id) {
                        Some(&(end_x, end_y, _ep, end_tick)) => {
                            // Same-system slur
                            let arc_start_x = start_x;
                            let arc_end_x = end_x;
                            // Small gap so endpoints sit just above the notehead top.
                            let endpoint_gap = notehead_half_h * 0.15;

                            // For chords, move endpoint to the outermost note
                            // edge at the same tick so the slur doesn't cross
                            // other chord notes.
                            let start_tick = n.start_tick;
                            let mut adj_start_y =
                                start_y + y_edge + if above { -endpoint_gap } else { endpoint_gap };
                            for &(_nx, ny, _np, nt) in note_lookup.values() {
                                if nt == start_tick {
                                    let edge = ny + y_edge;
                                    if above && edge < adj_start_y {
                                        adj_start_y = edge - endpoint_gap;
                                    } else if !above && edge > adj_start_y {
                                        adj_start_y = edge + endpoint_gap;
                                    }
                                }
                            }
                            let mut adj_end_y =
                                end_y + y_edge + if above { -endpoint_gap } else { endpoint_gap };
                            for &(_nx, ny, _np, nt) in note_lookup.values() {
                                if nt == end_tick {
                                    let edge = ny + y_edge;
                                    if above && edge < adj_end_y {
                                        adj_end_y = edge - endpoint_gap;
                                    } else if !above && edge > adj_end_y {
                                        adj_end_y = edge + endpoint_gap;
                                    }
                                }
                            }

                            let span_x = (arc_end_x - arc_start_x).abs().max(1.0);

                            // Collect intermediate notes for clearance checks.
                            let clearance = notehead_half_h + 4.0;
                            let intermediates: Vec<(f32, f32)> = note_lookup
                                .values()
                                .filter(|&&(nx, _ny, _np, nt)| {
                                    nt > start_tick
                                        && nt < end_tick
                                        && nx > arc_start_x
                                        && nx < arc_end_x
                                })
                                .map(|&(nx, ny, _np, _nt)| (nx, ny + y_edge))
                                .collect();

                            // Phase 1: compute baseline arc height and push
                            // control-point Y so the arc clears every notehead.
                            let arc_height = (5.0 * span_x.sqrt()).clamp(15.0, 80.0);
                            let y_offset = if above { -arc_height } else { arc_height };
                            let baseline_mid_y = (adj_start_y + adj_end_y) / 2.0 + y_offset;
                            let mut mid_y = baseline_mid_y;
                            for &(_, edge_y) in &intermediates {
                                if above && edge_y - clearance < mid_y {
                                    mid_y = edge_y - clearance;
                                } else if !above && edge_y + clearance > mid_y {
                                    mid_y = edge_y + clearance;
                                }
                            }

                            // Phase 2: verify actual Bézier at each intermediate
                            // note's x.  If the curve still crosses a note (common
                            // when the start or end sits much lower than neighbours),
                            // pull the nearer endpoint up to eliminate the deficit.
                            for _ in 0..4 {
                                let mut ok = true;
                                for &(nx, edge_y) in &intermediates {
                                    let t = ((nx - arc_start_x) / span_x).clamp(0.01, 0.99);
                                    let u = 1.0 - t;
                                    let curve_y = u * u * u * adj_start_y
                                        + 3.0 * u * u * t * mid_y
                                        + 3.0 * u * t * t * mid_y
                                        + t * t * t * adj_end_y;
                                    let target = if above {
                                        edge_y - clearance
                                    } else {
                                        edge_y + clearance
                                    };
                                    let crossed = if above {
                                        curve_y > target
                                    } else {
                                        curve_y < target
                                    };
                                    if crossed {
                                        ok = false;
                                        let deficit = (curve_y - target).abs();
                                        // Weight adjustment toward the nearer endpoint.
                                        if t < 0.5 {
                                            let w = 1.0 - t; // heavier near start
                                            if above {
                                                adj_start_y -= deficit * w;
                                            } else {
                                                adj_start_y += deficit * w;
                                            }
                                        } else {
                                            let w = t;
                                            if above {
                                                adj_end_y -= deficit * w;
                                            } else {
                                                adj_end_y += deficit * w;
                                            }
                                        }
                                    }
                                }
                                if ok {
                                    break;
                                }
                                // Recompute mid_y with updated endpoints.
                                mid_y = (adj_start_y + adj_end_y) / 2.0 + y_offset;
                                for &(_, edge_y) in &intermediates {
                                    if above && edge_y - clearance < mid_y {
                                        mid_y = edge_y - clearance;
                                    } else if !above && edge_y + clearance > mid_y {
                                        mid_y = edge_y + clearance;
                                    }
                                }
                            }

                            slur_arcs.push(types::TieArc {
                                start: types::Point {
                                    x: arc_start_x,
                                    y: adj_start_y,
                                },
                                end: types::Point {
                                    x: arc_end_x,
                                    y: adj_end_y,
                                },
                                cp1: types::Point {
                                    x: arc_start_x + span_x * 0.2,
                                    y: mid_y,
                                },
                                cp2: types::Point {
                                    x: arc_end_x - span_x * 0.2,
                                    y: mid_y,
                                },
                                above,
                                note_id_start: n.note_id.clone(),
                                note_id_end: slur_target_id.to_string(),
                            });
                        }
                        None => {
                            // Cross-system outgoing slur
                            let arc_start_x = start_x;
                            let arc_end_x = system_right_edge;
                            let endpoint_gap = notehead_half_h * 0.5;
                            let adj_start_y =
                                start_y + y_edge + if above { -endpoint_gap } else { endpoint_gap };
                            let span_x = arc_end_x - arc_start_x;
                            let arc_height = (3.5 * span_x.sqrt()).clamp(12.0, 50.0);
                            let y_offset = if above { -arc_height } else { arc_height };
                            let mid_y = adj_start_y + y_offset;

                            slur_arcs.push(types::TieArc {
                                start: types::Point {
                                    x: arc_start_x,
                                    y: adj_start_y,
                                },
                                end: types::Point {
                                    x: arc_end_x,
                                    y: adj_start_y,
                                },
                                cp1: types::Point {
                                    x: arc_start_x + span_x * 0.2,
                                    y: mid_y,
                                },
                                cp2: types::Point {
                                    x: arc_end_x - span_x * 0.2,
                                    y: mid_y,
                                },
                                above,
                                note_id_start: n.note_id.clone(),
                                note_id_end: slur_target_id.to_string(),
                            });
                        }
                    }
                } else if n.start_tick < tick_range.start_tick
                    && system_note_ids.contains(slur_target_id)
                {
                    // Cross-system incoming slur
                    let (end_x, end_y, _ep, _et) = *note_lookup.get(slur_target_id).unwrap();
                    let endpoint_gap = notehead_half_h * 0.5;
                    let adj_end_y =
                        end_y + y_edge + if above { -endpoint_gap } else { endpoint_gap };
                    let arc_end_x = end_x;
                    let incoming_offset = 3.0 * notehead_half_w;
                    let arc_start_x = (unified_left_margin - incoming_offset)
                        .min(arc_end_x - 20.0)
                        .max(0.0);
                    let span_x = (arc_end_x - arc_start_x).max(1.0);
                    let arc_height = (3.5 * span_x.sqrt()).clamp(12.0, 50.0);
                    let y_offset = if above { -arc_height } else { arc_height };
                    let mid_y = adj_end_y + y_offset;

                    slur_arcs.push(types::TieArc {
                        start: types::Point {
                            x: arc_start_x,
                            y: adj_end_y,
                        },
                        end: types::Point {
                            x: arc_end_x,
                            y: adj_end_y,
                        },
                        cp1: types::Point {
                            x: arc_start_x + span_x * 0.2,
                            y: mid_y,
                        },
                        cp2: types::Point {
                            x: arc_end_x - span_x * 0.2,
                            y: mid_y,
                        },
                        above,
                        note_id_start: n.note_id.clone(),
                        note_id_end: slur_target_id.to_string(),
                    });
                }
            }
        }
    }

    (tie_arcs, slur_arcs)
}
