//! Structural analysis — pickup detection, measure boundaries, repeats, voltas, octave shifts, and dynamics.
//!
//! Analyses parsed measure data to detect anacrusis measures, compute
//! actual measure boundary ticks, and collect repeat barlines, volta
//! brackets, octave-shift regions, dynamic markings, and gradual dynamics
//! for the domain `Score`.

use std::collections::HashMap;

use crate::domain::events::dynamics::{
    DynamicLevel, DynamicMarking, GradualDirection, GradualDynamic,
};
use crate::domain::repeat::{RepeatBarline, RepeatBarlineType, VoltaBracket, VoltaEndType};
use crate::domain::score::OctaveShiftRegion;
use crate::domain::value_objects::Tick;

use super::super::timing::Fraction;
use super::super::types::{
    EndingParseType, MeasureData, MeasureElement, OctaveShiftData, PartData,
};
use super::{TimingContext, actual_measure_end, actual_measure_start};

/// Detects if the first measure is a pickup/anacrusis by computing its
/// actual tick duration and comparing to the expected ticks_per_measure.
pub(super) fn detect_pickup_ticks(parts: &[PartData], ticks_per_measure: u32) -> u32 {
    let first_measure = match parts.first().and_then(|p| p.measures.first()) {
        Some(m) => m,
        None => return 0,
    };

    let mut timing = TimingContext::new();
    if let Some(attrs) = &first_measure.attributes {
        if let Some(divisions) = attrs.divisions {
            timing.set_divisions(divisions);
        }
    }

    let mut max_tick: u32 = 0;
    for element in &first_measure.elements {
        match element {
            MeasureElement::Note(note_data) => {
                if !note_data.is_chord && timing.advance_by_duration(note_data.duration).is_ok() {
                    max_tick = max_tick.max(timing.current_tick);
                }
            }
            MeasureElement::Rest(rest_data) => {
                if timing.advance_by_duration(rest_data.duration).is_ok() {
                    max_tick = max_tick.max(timing.current_tick);
                }
            }
            MeasureElement::Backup(duration) => {
                if let Ok(fraction) = Fraction::from_musicxml(*duration, timing.divisions)
                    .to_ticks()
                    .map(|t| t as u32)
                {
                    if timing.current_tick >= fraction {
                        timing.current_tick -= fraction;
                    }
                }
            }
            MeasureElement::Forward(duration) => {
                let _ = timing.advance_by_duration(*duration);
                max_tick = max_tick.max(timing.current_tick);
            }
            MeasureElement::Attributes(_)
            | MeasureElement::OctaveShift(_)
            | MeasureElement::Dynamics(_)
            | MeasureElement::Wedge(_) => {}
        }
    }

    if max_tick > 0 && max_tick < ticks_per_measure {
        max_tick
    } else {
        0
    }
}

/// Computes the actual cumulative end tick of each measure from note content.
///
/// Walks all measures in the first part, tracking the furthest tick position
/// reached in each measure. This handles shortened measures (e.g. first endings
/// that are shorter than the time signature because the pickup borrows time).
pub(super) fn compute_measure_end_ticks(parts: &[PartData]) -> Vec<u32> {
    let first_part = match parts.first() {
        Some(p) => p,
        None => return Vec::new(),
    };

    let mut result = Vec::with_capacity(first_part.measures.len());
    let mut timing = TimingContext::new();

    for measure in &first_part.measures {
        if let Some(attrs) = &measure.attributes {
            if let Some(divisions) = attrs.divisions {
                timing.set_divisions(divisions);
            }
        }

        let mut max_tick = timing.current_tick;
        for element in &measure.elements {
            match element {
                MeasureElement::Note(note_data) => {
                    // Chord notes share the previous note's tick — don't advance
                    if !note_data.is_chord && timing.advance_by_duration(note_data.duration).is_ok()
                    {
                        max_tick = max_tick.max(timing.current_tick);
                    }
                }
                MeasureElement::Rest(rest_data) => {
                    if timing.advance_by_duration(rest_data.duration).is_ok() {
                        max_tick = max_tick.max(timing.current_tick);
                    }
                }
                MeasureElement::Backup(duration) => {
                    if let Ok(ticks) =
                        Fraction::from_musicxml(*duration, timing.divisions).to_ticks()
                    {
                        let ticks = ticks as u32;
                        if timing.current_tick >= ticks {
                            timing.current_tick -= ticks;
                        }
                    }
                }
                MeasureElement::Forward(duration) => {
                    let _ = timing.advance_by_duration(*duration);
                    max_tick = max_tick.max(timing.current_tick);
                }
                MeasureElement::Attributes(_)
                | MeasureElement::OctaveShift(_)
                | MeasureElement::Dynamics(_)
                | MeasureElement::Wedge(_) => {}
            }
        }

        // Advance to the furthest position for the next measure
        timing.current_tick = max_tick;
        result.push(max_tick);
    }

    result
}

/// Collects repeat barlines from a slice of MeasureData.
///
/// Each measure with `start_repeat` or `end_repeat` produces a `RepeatBarline` entry.
/// Uses actual measure boundaries when available, falls back to formula-based.
pub(super) fn collect_repeat_barlines(
    measures: &[MeasureData],
    ticks_per_measure: u32,
    pickup_ticks: u32,
    measure_end_ticks: &[u32],
) -> Vec<RepeatBarline> {
    let mut result = Vec::new();
    for (i, measure) in measures.iter().enumerate() {
        let start_tick =
            actual_measure_start(i, measure_end_ticks, pickup_ticks, ticks_per_measure);
        let end_tick = actual_measure_end(i, measure_end_ticks, pickup_ticks, ticks_per_measure);
        match (measure.start_repeat, measure.end_repeat) {
            (true, true) => result.push(RepeatBarline {
                measure_index: i as u32,
                start_tick,
                end_tick,
                barline_type: RepeatBarlineType::Both,
            }),
            (true, false) => result.push(RepeatBarline {
                measure_index: i as u32,
                start_tick,
                end_tick,
                barline_type: RepeatBarlineType::Start,
            }),
            (false, true) => result.push(RepeatBarline {
                measure_index: i as u32,
                start_tick,
                end_tick,
                barline_type: RepeatBarlineType::End,
            }),
            (false, false) => {}
        }
    }
    result
}

/// Collects volta brackets from parsed ending data in measures.
///
/// Pairs Start endings with their corresponding Stop/Discontinue endings
/// to produce VoltaBracket entries with full tick ranges.
pub(super) fn collect_volta_brackets(
    measures: &[MeasureData],
    ticks_per_measure: u32,
    pickup_ticks: u32,
    measure_end_ticks: &[u32],
) -> Vec<VoltaBracket> {
    let mut result = Vec::new();
    // Track open brackets: number -> (start_measure_index, start_tick)
    let mut open: HashMap<u8, (u32, u32)> = HashMap::new();

    for (i, measure) in measures.iter().enumerate() {
        let start_tick =
            actual_measure_start(i, measure_end_ticks, pickup_ticks, ticks_per_measure);
        let end_tick = actual_measure_end(i, measure_end_ticks, pickup_ticks, ticks_per_measure);

        for ending in &measure.endings {
            match ending.end_type {
                EndingParseType::Start => {
                    open.insert(ending.number, (i as u32, start_tick));
                }
                EndingParseType::Stop | EndingParseType::Discontinue => {
                    if let Some((start_measure_index, s_tick)) = open.remove(&ending.number) {
                        let end_type = match ending.end_type {
                            EndingParseType::Stop => VoltaEndType::Stop,
                            EndingParseType::Discontinue => VoltaEndType::Discontinue,
                            _ => unreachable!(),
                        };
                        result.push(VoltaBracket {
                            number: ending.number,
                            start_measure_index,
                            end_measure_index: i as u32,
                            start_tick: s_tick,
                            end_tick,
                            end_type,
                        });
                    }
                }
            }
        }
    }

    result
}

/// Collects octave-shift regions (8va/8vb/15ma brackets) from measure data.
pub(super) fn collect_octave_shift_regions(
    measures: &[MeasureData],
    ticks_per_measure: u32,
    pickup_ticks: u32,
    measure_end_ticks: &[u32],
) -> Vec<OctaveShiftRegion> {
    let mut result = Vec::new();
    // Track open shifts: (staff) -> (start_tick, OctaveShiftData)
    let mut open: HashMap<usize, (u32, OctaveShiftData)> = HashMap::new();

    let mut timing = TimingContext::new();

    for (i, measure) in measures.iter().enumerate() {
        let measure_start =
            actual_measure_start(i, measure_end_ticks, pickup_ticks, ticks_per_measure);
        timing.current_tick = measure_start;

        if let Some(attrs) = &measure.attributes {
            if let Some(divisions) = attrs.divisions {
                timing.set_divisions(divisions);
            }
        }

        for element in &measure.elements {
            match element {
                MeasureElement::Note(note_data) => {
                    if !note_data.is_chord {
                        let _ = timing.advance_by_duration(note_data.duration);
                    }
                }
                MeasureElement::Rest(rest_data) => {
                    let _ = timing.advance_by_duration(rest_data.duration);
                }
                MeasureElement::Backup(dur) => {
                    if let Ok(ticks) = Fraction::from_musicxml(*dur, timing.divisions)
                        .to_ticks()
                        .map(|t| t as u32)
                    {
                        timing.current_tick = timing.current_tick.saturating_sub(ticks);
                    }
                }
                MeasureElement::Forward(dur) => {
                    let _ = timing.advance_by_duration(*dur);
                }
                MeasureElement::Attributes(attrs) => {
                    if let Some(divisions) = attrs.divisions {
                        timing.set_divisions(divisions);
                    }
                }
                MeasureElement::OctaveShift(os) => {
                    let staff_index = os.staff.saturating_sub(1); // 1-indexed → 0-indexed
                    if os.shift_type == "stop" {
                        if let Some((start_tick, start_data)) = open.remove(&staff_index) {
                            let display_shift: i8 = match start_data.shift_type.as_str() {
                                "down" => -(start_data.size as i8), // 8va: display lower
                                "up" => start_data.size as i8,      // 8vb: display higher
                                _ => 0,
                            };
                            if display_shift != 0 {
                                result.push(OctaveShiftRegion {
                                    start_tick,
                                    end_tick: timing.current_tick,
                                    display_shift,
                                    staff_index,
                                });
                            }
                        }
                    } else {
                        open.insert(staff_index, (timing.current_tick, os.clone()));
                    }
                }
                MeasureElement::Dynamics(_) | MeasureElement::Wedge(_) => {}
            }
        }
    }

    result
}

/// Collects dynamic markings from parsed measures, converting MeasureElement::Dynamics
/// into domain DynamicMarking entities with resolved tick positions.
///
/// If a measure has an associated `sound_dynamics` value, it overrides the standard
/// velocity mapping for that marking.
pub(super) fn collect_dynamics(
    measures: &[MeasureData],
    ticks_per_measure: u32,
    pickup_ticks: u32,
    measure_end_ticks: &[u32],
) -> Vec<DynamicMarking> {
    let mut result = Vec::new();
    let mut timing = TimingContext::new();

    for (i, measure) in measures.iter().enumerate() {
        let measure_start =
            actual_measure_start(i, measure_end_ticks, pickup_ticks, ticks_per_measure);
        timing.current_tick = measure_start;

        if let Some(attrs) = &measure.attributes {
            if let Some(divisions) = attrs.divisions {
                timing.set_divisions(divisions);
            }
        }

        for element in &measure.elements {
            match element {
                MeasureElement::Note(note_data) => {
                    if !note_data.is_chord {
                        let _ = timing.advance_by_duration(note_data.duration);
                    }
                }
                MeasureElement::Rest(rest_data) => {
                    let _ = timing.advance_by_duration(rest_data.duration);
                }
                MeasureElement::Backup(dur) => {
                    if let Ok(ticks) = Fraction::from_musicxml(*dur, timing.divisions)
                        .to_ticks()
                        .map(|t| t as u32)
                    {
                        timing.current_tick = timing.current_tick.saturating_sub(ticks);
                    }
                }
                MeasureElement::Forward(dur) => {
                    let _ = timing.advance_by_duration(*dur);
                }
                MeasureElement::Attributes(attrs) => {
                    if let Some(divisions) = attrs.divisions {
                        timing.set_divisions(divisions);
                    }
                }
                MeasureElement::Dynamics(dd) => {
                    if let Some(level) = DynamicLevel::from_musicxml(&dd.marking) {
                        // Use sound_dynamics from the measure if present, otherwise standard mapping
                        let velocity = measure
                            .sound_dynamics
                            .map(|d| (d.round() as u8).clamp(1, 127))
                            .unwrap_or_else(|| level.default_velocity());

                        result.push(DynamicMarking::new(
                            level,
                            velocity,
                            Tick::new(timing.current_tick),
                            dd.staff as u8,
                        ));
                    }
                }
                _ => {}
            }
        }
    }

    // Sort by start_tick ascending (contract requirement)
    result.sort_by_key(|dm| dm.start_tick);
    result
}

/// Collects gradual dynamics (crescendo/diminuendo wedges) from parsed measures,
/// matching start/stop pairs by wedge number.
pub(super) fn collect_gradual_dynamics(
    measures: &[MeasureData],
    ticks_per_measure: u32,
    pickup_ticks: u32,
    measure_end_ticks: &[u32],
) -> Vec<GradualDynamic> {
    let mut result = Vec::new();
    // Track open wedges: (number) -> (direction, start_tick, staff)
    let mut open: HashMap<u8, (GradualDirection, u32, u8)> = HashMap::new();
    let mut timing = TimingContext::new();

    for (i, measure) in measures.iter().enumerate() {
        let measure_start =
            actual_measure_start(i, measure_end_ticks, pickup_ticks, ticks_per_measure);
        timing.current_tick = measure_start;

        if let Some(attrs) = &measure.attributes {
            if let Some(divisions) = attrs.divisions {
                timing.set_divisions(divisions);
            }
        }

        for element in &measure.elements {
            match element {
                MeasureElement::Note(note_data) => {
                    if !note_data.is_chord {
                        let _ = timing.advance_by_duration(note_data.duration);
                    }
                }
                MeasureElement::Rest(rest_data) => {
                    let _ = timing.advance_by_duration(rest_data.duration);
                }
                MeasureElement::Backup(dur) => {
                    if let Ok(ticks) = Fraction::from_musicxml(*dur, timing.divisions)
                        .to_ticks()
                        .map(|t| t as u32)
                    {
                        timing.current_tick = timing.current_tick.saturating_sub(ticks);
                    }
                }
                MeasureElement::Forward(dur) => {
                    let _ = timing.advance_by_duration(*dur);
                }
                MeasureElement::Attributes(attrs) => {
                    if let Some(divisions) = attrs.divisions {
                        timing.set_divisions(divisions);
                    }
                }
                MeasureElement::Wedge(wd) => {
                    if wd.wedge_type == "stop" {
                        if let Some((direction, start_tick, staff)) = open.remove(&wd.number) {
                            // Only emit complete wedges where stop > start
                            if timing.current_tick > start_tick {
                                result.push(GradualDynamic::new(
                                    direction,
                                    Tick::new(start_tick),
                                    Tick::new(timing.current_tick),
                                    staff,
                                    wd.number,
                                ));
                            }
                        }
                    } else {
                        let direction = match wd.wedge_type.as_str() {
                            "crescendo" => GradualDirection::Crescendo,
                            "diminuendo" => GradualDirection::Diminuendo,
                            _ => continue,
                        };
                        open.insert(wd.number, (direction, timing.current_tick, wd.staff as u8));
                    }
                }
                _ => {}
            }
        }
    }

    // Sort by start_tick ascending (contract requirement)
    result.sort_by_key(|gd| gd.start_tick);
    result
}
