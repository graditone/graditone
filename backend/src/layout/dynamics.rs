//! Dynamic symbol and hairpin layout computation
//!
//! Computes (x, y) positions for dynamic markings (ppp–fff) and hairpin
//! wedge segments (crescendo/diminuendo) from score data. Called per-staff
//! in the layout pipeline after annotations.

use std::collections::HashMap;

use crate::layout::metrics;
use crate::layout::types::{DynamicGlyph, HairpinDirection, HairpinLayout};

/// Result container for dynamics layout computation.
pub(crate) struct DynamicsResult {
    pub dynamic_glyphs: Vec<DynamicGlyph>,
    pub hairpin_layouts: Vec<HairpinLayout>,
}

/// SMuFL codepoint for a dynamic level string.
fn dynamic_level_codepoint(level: &str) -> Option<(&'static str, &'static str)> {
    match level {
        "PPP" => Some(("\u{E52A}", "dynamicPPP")),
        "PP" => Some(("\u{E52B}", "dynamicPP")),
        "P" => Some(("\u{E520}", "dynamicPiano")),
        "MP" => Some(("\u{E52C}", "dynamicMP")),
        "MF" => Some(("\u{E52D}", "dynamicMF")),
        "F" => Some(("\u{E522}", "dynamicForte")),
        "FF" => Some(("\u{E52F}", "dynamicFF")),
        "FFF" => Some(("\u{E530}", "dynamicFFF")),
        _ => None,
    }
}

/// Compute dynamic glyph and hairpin positions for a single staff.
///
/// # Arguments
/// * `score` - The full score JSON value
/// * `staff_number` - 1-based staff number for filtering dynamics
/// * `tick_start` - Start tick of the current system (inclusive)
/// * `tick_end` - End tick of the current system (exclusive)
/// * `staff_vertical_offset` - Y offset for the top of the staff
/// * `units_per_space` - Logical units per staff space (typically 20.0)
/// * `note_positions` - Tick-to-x mapping from the note positioning pass
/// * `system_end_x` - Right edge x coordinate of the system
/// * `left_margin` - Left margin x coordinate
pub(crate) fn render_dynamics(
    score: &serde_json::Value,
    staff_number: u8,
    tick_start: u32,
    tick_end: u32,
    staff_vertical_offset: f32,
    units_per_space: f32,
    note_positions: &HashMap<u32, f32>,
    system_end_x: f32,
    left_margin: f32,
) -> DynamicsResult {
    let baseline_y = staff_vertical_offset + 7.5 * units_per_space;

    let dynamic_glyphs = render_static_dynamics(
        score,
        staff_number,
        tick_start,
        tick_end,
        baseline_y,
        note_positions,
    );

    let mut hairpin_layouts = render_hairpins(
        score,
        staff_number,
        tick_start,
        tick_end,
        baseline_y,
        units_per_space,
        note_positions,
        system_end_x,
        left_margin,
    );

    // Post-process: clip hairpin endpoints so they don't overlap dynamic glyphs.
    // g.x is the notehead centre (rendered with text-anchor:middle), so the glyph
    // extends half its width on each side.
    let gap = units_per_space * 0.5; // 10-unit gap between hairpin end and glyph
    let glyph_extents: Vec<(f32, f32)> = dynamic_glyphs
        .iter()
        .map(|g| {
            let half_w = g.bounding_box.width * g.font_size * 0.5;
            (g.x - half_w, g.x + half_w)
        })
        .collect();

    for hp in &mut hairpin_layouts {
        for &(gx_start, gx_end) in &glyph_extents {
            // If a glyph sits near the hairpin's end, pull the end back
            if gx_start > hp.x_start && gx_start < hp.x_end + gap {
                hp.x_end = (gx_start - gap).max(hp.x_start + gap);
            }
            // If a glyph sits near the hairpin's start, push the start forward
            if gx_end > hp.x_start - gap && gx_end < hp.x_end {
                hp.x_start = (gx_end + gap).min(hp.x_end - gap);
            }
        }
    }

    // Remove degenerate hairpins that became too short after clipping
    hairpin_layouts.retain(|hp| hp.x_end - hp.x_start > gap);

    DynamicsResult {
        dynamic_glyphs,
        hairpin_layouts,
    }
}

/// Compute extra measure width needed for dynamics glyphs that extend beyond noteheads.
///
/// For each measure, finds the maximum dynamics glyph half-width that overflows
/// past the notehead on each side. Returns a Vec with one extra width per measure.
pub(crate) fn compute_dynamics_extra_widths(
    score: &serde_json::Value,
    measure_tick_ranges: &[(u32, u32)],
) -> Vec<f32> {
    let dynamics = match score["dynamics"].as_array() {
        Some(arr) => arr,
        None => return vec![0.0; measure_tick_ranges.len()],
    };

    let font_size = 80.0_f32;
    let mut extra_widths = vec![0.0_f32; measure_tick_ranges.len()];

    for dyn_val in dynamics {
        let start_tick = dyn_val["start_tick"].as_u64().unwrap_or(0) as u32;
        let marking = match dyn_val["marking"].as_str() {
            Some(m) => m,
            None => continue,
        };

        let (_codepoint, glyph_name) = match dynamic_level_codepoint(marking) {
            Some(pair) => pair,
            None => continue,
        };

        // Find which measure this dynamic belongs to
        for (mi, &(m_start, m_end)) in measure_tick_ranges.iter().enumerate() {
            if start_tick >= m_start && start_tick < m_end {
                let bbox = metrics::get_glyph_bbox(glyph_name);
                // With text-anchor:middle, the glyph extends half-width on each side
                // of the notehead centre. The overflow beyond the notehead is the
                // glyph full width minus one notehead width.
                let notehead_width = 20.0; // ~1 staff space
                let overflow = (bbox.width * font_size - notehead_width).max(0.0);
                if overflow > extra_widths[mi] {
                    extra_widths[mi] = overflow;
                }
                break;
            }
        }
    }

    extra_widths
}

/// Render static dynamic markings (ppp through fff) as positioned glyphs.
fn render_static_dynamics(
    score: &serde_json::Value,
    staff_number: u8,
    tick_start: u32,
    tick_end: u32,
    baseline_y: f32,
    note_positions: &HashMap<u32, f32>,
) -> Vec<DynamicGlyph> {
    let dynamics = match score["dynamics"].as_array() {
        Some(arr) => arr,
        None => return Vec::new(),
    };

    // note_positions stores the notehead CENTER x (rendered with text-anchor:middle).
    // Frontend also renders dynamics with text-anchor:middle, so we pass the
    // notehead centre x directly — no offset needed.
    let font_size = 80.0_f32;

    let mut glyphs: Vec<DynamicGlyph> = Vec::new();

    for dyn_val in dynamics {
        let staff = dyn_val["staff"].as_u64().unwrap_or(0) as u8;
        if staff != staff_number {
            continue;
        }

        let start_tick = dyn_val["start_tick"].as_u64().unwrap_or(0) as u32;
        if start_tick < tick_start || start_tick >= tick_end {
            continue;
        }

        let marking = match dyn_val["marking"].as_str() {
            Some(m) => m,
            None => continue,
        };

        let (codepoint, glyph_name) = match dynamic_level_codepoint(marking) {
            Some(pair) => pair,
            None => continue,
        };

        let bbox = metrics::get_glyph_bbox(glyph_name);

        // Look up x position from note_positions (notehead centre x).
        // Frontend renders dynamics with text-anchor:middle, so we pass the
        // notehead centre x directly — the browser centres the glyph for us.
        let x = match find_x_for_tick(start_tick, note_positions) {
            Some(x) => x,
            None => continue,
        };

        glyphs.push(DynamicGlyph {
            codepoint: codepoint.to_string(),
            label: String::new(),
            x,
            y: baseline_y,
            font_size,
            bounding_box: bbox,
        });
    }

    // Sort by ascending x
    glyphs.sort_by(|a, b| a.x.partial_cmp(&b.x).unwrap_or(std::cmp::Ordering::Equal));
    glyphs
}

/// Render hairpin crescendo/diminuendo wedge segments.
fn render_hairpins(
    score: &serde_json::Value,
    staff_number: u8,
    tick_start: u32,
    tick_end: u32,
    baseline_y: f32,
    units_per_space: f32,
    note_positions: &HashMap<u32, f32>,
    system_end_x: f32,
    left_margin: f32,
) -> Vec<HairpinLayout> {
    let gradual_dynamics = match score["gradual_dynamics"].as_array() {
        Some(arr) => arr,
        None => return Vec::new(),
    };

    let opening = units_per_space;
    let mut layouts: Vec<HairpinLayout> = Vec::new();

    for gd in gradual_dynamics {
        let staff = gd["staff"].as_u64().unwrap_or(0) as u8;
        if staff != staff_number {
            continue;
        }

        let gd_start_tick = gd["start_tick"].as_u64().unwrap_or(0) as u32;
        let gd_stop_tick = gd["stop_tick"].as_u64().unwrap_or(0) as u32;

        // Skip if entirely outside this system's range
        if gd_stop_tick <= tick_start || gd_start_tick >= tick_end {
            continue;
        }

        let direction = match gd["direction"].as_str() {
            Some("Crescendo") => HairpinDirection::Crescendo,
            Some("Diminuendo") => HairpinDirection::Diminuendo,
            _ => continue,
        };

        let spans_system_start = gd_start_tick < tick_start;
        let spans_system_end = gd_stop_tick > tick_end;

        // Compute x_start
        let x_start = if spans_system_start {
            left_margin
        } else {
            match find_x_for_tick(gd_start_tick, note_positions) {
                Some(x) => x,
                None => continue,
            }
        };

        // Compute x_end
        let x_end = if spans_system_end {
            system_end_x
        } else {
            match find_x_for_tick(gd_stop_tick, note_positions) {
                Some(x) => x + units_per_space, // notehead width offset
                None => system_end_x,
            }
        };

        if x_start >= x_end {
            continue;
        }

        layouts.push(HairpinLayout {
            direction,
            x_start,
            x_end,
            y_center: baseline_y,
            opening,
            continues_left: spans_system_start,
            continues_right: spans_system_end,
        });
    }

    layouts
}

/// Find the x coordinate for a given tick using floor-scan (largest tick <= target).
fn find_x_for_tick(tick: u32, note_positions: &HashMap<u32, f32>) -> Option<f32> {
    // Try exact match first
    if let Some(&x) = note_positions.get(&tick) {
        return Some(x);
    }

    // Floor scan: find the largest tick that is <= the target tick
    let mut best: Option<(u32, f32)> = None;
    for (&t, &x) in note_positions.iter() {
        if t <= tick {
            match best {
                Some((best_t, _)) if t > best_t => best = Some((t, x)),
                None => best = Some((t, x)),
                _ => {}
            }
        }
    }
    best.map(|(_, x)| x)
}
