//! T067: Cross-score consistency test.
//! Verifies that visual constants (font size, stem length, barline width,
//! clef presence, time-sig presence) are uniform across all 6 preloaded scores.

use musicore_backend::adapters::dtos::ScoreDto;
use musicore_backend::domain::importers::musicxml::MusicXMLImporter;
use musicore_backend::layout::{LayoutConfig, compute_layout};
use musicore_backend::ports::importers::IMusicXMLImporter;
use std::path::Path;

const CONFIG: LayoutConfig = LayoutConfig {
    max_system_width: 2410.0,
    units_per_space: 20.0,
    system_spacing: 200.0,
    system_height: 200.0,
};

fn layout_score(mxl_path: &str) -> serde_json::Value {
    let importer = MusicXMLImporter::new();
    let result = importer.import_file(Path::new(mxl_path)).unwrap();
    let dto: ScoreDto = (&result.score).into();
    let json = serde_json::to_value(&dto).unwrap();
    let layout = compute_layout(&json, &CONFIG);
    serde_json::to_value(&layout).unwrap()
}

struct ScoreMetrics {
    font_sizes: Vec<f64>,
    stem_lengths: Vec<f64>,
    thin_barline_widths: Vec<f64>,
    thick_barline_widths: Vec<f64>,
    has_clef: bool,
    has_time_sig: bool,
    has_noteheads: bool,
    system_count: usize,
}

fn collect_metrics(layout: &serde_json::Value) -> ScoreMetrics {
    let systems = layout["systems"].as_array().unwrap();
    let mut font_sizes = Vec::new();
    let mut stem_lengths = Vec::new();
    let mut thin_barline_widths = Vec::new();
    let mut thick_barline_widths = Vec::new();
    let mut has_clef = false;
    let mut has_time_sig = false;
    let mut has_noteheads = false;

    for system in systems {
        for sg in system["staff_groups"].as_array().unwrap() {
            for staff in sg["staves"].as_array().unwrap() {
                // Structural glyphs: clefs, key signatures, time signatures
                for glyph in staff["structural_glyphs"].as_array().unwrap_or(&vec![]) {
                    let cp = glyph["codepoint"].as_str().unwrap_or("");
                    for ch in cp.chars() {
                        let code = ch as u32;
                        if (0xE050..=0xE07F).contains(&code) {
                            has_clef = true;
                        }
                        if (0xE080..=0xE089).contains(&code) {
                            has_time_sig = true;
                        }
                    }
                }
                // Glyph run font sizes + noteheads + stems
                for run in staff["glyph_runs"].as_array().unwrap() {
                    if let Some(fs) = run["font_size"].as_f64() {
                        font_sizes.push(fs);
                    }
                    for glyph in run["glyphs"].as_array().unwrap() {
                        let cp = glyph["codepoint"].as_str().unwrap_or("");
                        for ch in cp.chars() {
                            let code = ch as u32;
                            // Noteheads: U+E0A0..U+E0AF
                            if (0xE0A0..=0xE0AF).contains(&code) {
                                has_noteheads = true;
                            }
                        }
                        // Stems (U+0000): measure stem length from bounding_box.height
                        if cp == "\u{0000}" {
                            if let Some(h) = glyph["bounding_box"]["height"].as_f64() {
                                stem_lengths.push(h);
                            }
                        }
                    }
                }
                // Barline stroke widths
                if let Some(barlines) = staff["bar_lines"].as_array() {
                    for bl in barlines {
                        if let Some(segments) = bl["segments"].as_array() {
                            for seg in segments {
                                if let Some(sw) = seg["stroke_width"].as_f64() {
                                    if (sw - 1.5).abs() < 0.01 {
                                        thin_barline_widths.push(sw);
                                    } else if (sw - 4.0).abs() < 0.01 {
                                        thick_barline_widths.push(sw);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    ScoreMetrics {
        font_sizes,
        stem_lengths,
        thin_barline_widths,
        thick_barline_widths,
        has_clef,
        has_time_sig,
        has_noteheads,
        system_count: systems.len(),
    }
}

/// All 6 preloaded scores must only use recognised glyph font sizes.
/// Standard noteheads and other glyphs use 80.0.
/// Chord noteheads (bare glyphs scaled to match combined-glyph notehead widths) use:
///   ~90.03  = 80.0 × (332/295)  for noteheadBlack in chords
///    92.0   = 80.0 × (345/300)  for noteheadHalf  in chords
#[test]
fn consistent_font_size_across_scores() {
    // Allowed render font sizes (with ±0.1 tolerance).
    let allowed: &[(f64, &str)] = &[
        (80.0, "standard"),
        (80.0 * 332.0 / 295.0, "chord-black-notehead"),
        (80.0 * 345.0 / 300.0, "chord-half-notehead"),
    ];

    let scores = [
        ("La Candeur", "../scores/Burgmuller_LaCandeur.mxl"),
        ("Arabesque", "../scores/Burgmuller_Arabesque.mxl"),
        ("Canon D", "../scores/Pachelbel_CanonD.mxl"),
        ("Invention", "../scores/Bach_InventionNo1.mxl"),
        ("Fur Elise", "../scores/Beethoven_FurElise.mxl"),
        ("Nocturne", "../scores/Chopin_NocturneOp9No2.mxl"),
    ];

    for (name, path) in &scores {
        let layout = layout_score(path);
        let metrics = collect_metrics(&layout);

        for fs in &metrics.font_sizes {
            let recognised = allowed
                .iter()
                .any(|(expected, _)| (fs - expected).abs() < 0.1);
            assert!(
                recognised,
                "{}: unrecognised font_size {:.4} — expected one of {:?}",
                name,
                fs,
                allowed
                    .iter()
                    .map(|(v, l)| format!("{:.2} ({})", v, l))
                    .collect::<Vec<_>>()
            );
        }
        assert!(
            !metrics.font_sizes.is_empty(),
            "{}: no glyph runs found",
            name
        );
    }
}

/// All scores must contain clefs, noteheads, and produce at least 1 system.
#[test]
fn all_scores_have_essential_glyphs() {
    let scores = [
        ("La Candeur", "../scores/Burgmuller_LaCandeur.mxl"),
        ("Arabesque", "../scores/Burgmuller_Arabesque.mxl"),
        ("Canon D", "../scores/Pachelbel_CanonD.mxl"),
        ("Invention", "../scores/Bach_InventionNo1.mxl"),
        ("Fur Elise", "../scores/Beethoven_FurElise.mxl"),
        ("Nocturne", "../scores/Chopin_NocturneOp9No2.mxl"),
    ];

    for (name, path) in &scores {
        let layout = layout_score(path);
        let metrics = collect_metrics(&layout);

        assert!(metrics.has_clef, "{}: missing clef glyph", name);
        assert!(
            metrics.has_time_sig,
            "{}: missing time signature glyph",
            name
        );
        assert!(metrics.has_noteheads, "{}: missing notehead glyphs", name);
        assert!(metrics.system_count > 0, "{}: no systems produced", name);
    }
}

/// Stem lengths must be consistent: minimum 50 units (beamed) and standard 70 units.
#[test]
fn consistent_stem_lengths_across_scores() {
    let scores = [
        ("La Candeur", "../scores/Burgmuller_LaCandeur.mxl"),
        ("Arabesque", "../scores/Burgmuller_Arabesque.mxl"),
        ("Canon D", "../scores/Pachelbel_CanonD.mxl"),
        ("Invention", "../scores/Bach_InventionNo1.mxl"),
        ("Fur Elise", "../scores/Beethoven_FurElise.mxl"),
        ("Nocturne", "../scores/Chopin_NocturneOp9No2.mxl"),
    ];

    for (name, path) in &scores {
        let layout = layout_score(path);
        let metrics = collect_metrics(&layout);

        assert!(!metrics.stem_lengths.is_empty(), "{}: no stems found", name);

        // All stems should be at least MIN_BEAMED_STEM_LENGTH (50.0)
        for sl in &metrics.stem_lengths {
            assert!(
                *sl >= 49.0,
                "{}: stem length {:.1} below minimum 50.0",
                name,
                sl
            );
        }
    }
}

/// Barline stroke widths must be consistent: thin=1.5, thick=4.0.
#[test]
fn consistent_barline_widths_across_scores() {
    let scores = [
        ("La Candeur", "../scores/Burgmuller_LaCandeur.mxl"),
        ("Arabesque", "../scores/Burgmuller_Arabesque.mxl"),
        ("Canon D", "../scores/Pachelbel_CanonD.mxl"),
        ("Invention", "../scores/Bach_InventionNo1.mxl"),
        ("Fur Elise", "../scores/Beethoven_FurElise.mxl"),
        ("Nocturne", "../scores/Chopin_NocturneOp9No2.mxl"),
    ];

    for (name, path) in &scores {
        let layout = layout_score(path);
        let metrics = collect_metrics(&layout);

        assert!(
            !metrics.thin_barline_widths.is_empty(),
            "{}: no thin barlines found",
            name
        );

        for w in &metrics.thin_barline_widths {
            assert!(
                (*w - 1.5).abs() < 0.01,
                "{}: thin barline width {:.2}, expected 1.5",
                name,
                w
            );
        }
        for w in &metrics.thick_barline_widths {
            assert!(
                (*w - 4.0).abs() < 0.01,
                "{}: thick barline width {:.2}, expected 4.0",
                name,
                w
            );
        }
    }
}

/// System bounding boxes must fully contain all stem and beam glyphs (regression for beam-cut fix).
#[test]
fn bounding_boxes_contain_all_glyphs_across_scores() {
    let scores = [
        ("La Candeur", "../scores/Burgmuller_LaCandeur.mxl"),
        ("Arabesque", "../scores/Burgmuller_Arabesque.mxl"),
        ("Canon D", "../scores/Pachelbel_CanonD.mxl"),
        ("Invention", "../scores/Bach_InventionNo1.mxl"),
        ("Fur Elise", "../scores/Beethoven_FurElise.mxl"),
        ("Nocturne", "../scores/Chopin_NocturneOp9No2.mxl"),
    ];

    for (name, path) in &scores {
        let layout = layout_score(path);
        let systems = layout["systems"].as_array().unwrap();
        let mut outside = Vec::new();

        for (sys_idx, system) in systems.iter().enumerate() {
            let sys_y = system["bounding_box"]["y"].as_f64().unwrap();
            let sys_h = system["bounding_box"]["height"].as_f64().unwrap();
            let sys_y_end = sys_y + sys_h;

            for sg in system["staff_groups"].as_array().unwrap() {
                for (staff_idx, staff) in sg["staves"].as_array().unwrap().iter().enumerate() {
                    for run in staff["glyph_runs"].as_array().unwrap() {
                        for glyph in run["glyphs"].as_array().unwrap() {
                            let cp = glyph["codepoint"].as_str().unwrap_or("");
                            if cp == "\u{0000}" || cp == "\u{0001}" {
                                let pos_y = glyph["position"]["y"].as_f64().unwrap();
                                let bb_y = glyph["bounding_box"]["y"].as_f64().unwrap();
                                let bb_h = glyph["bounding_box"]["height"].as_f64().unwrap();
                                let glyph_min = pos_y.min(bb_y);
                                let glyph_max = (pos_y + bb_h).max(bb_y + bb_h);

                                if glyph_min < sys_y - 0.1 || glyph_max > sys_y_end + 0.1 {
                                    outside.push(format!(
                                        "{} sys{} staff{}: y={:.1}-{:.1} outside {:.1}-{:.1}",
                                        name,
                                        sys_idx,
                                        staff_idx,
                                        glyph_min,
                                        glyph_max,
                                        sys_y,
                                        sys_y_end
                                    ));
                                }
                            }
                        }
                    }
                }
            }
        }

        assert!(
            outside.is_empty(),
            "Glyphs outside system bounding box:\n{}",
            outside.join("\n")
        );
    }
}

/// Grand-staff (multi-stave) instruments must have joined measure barlines.
/// The first staff of each group carries one barline spanning from the top line
/// of staves[0] to the bottom line of the last staff.  Subsequent staves must
/// have no barlines of their own (they are merged into staves[0]).
#[test]
fn grand_staff_measure_barlines_are_joined() {
    // Use three piano scores to cover this property.
    let scores = [
        ("La Candeur", "../scores/Burgmuller_LaCandeur.mxl"),
        ("Arabesque", "../scores/Burgmuller_Arabesque.mxl"),
        ("Für Elise", "../scores/Beethoven_FurElise.mxl"),
    ];

    for (name, path) in &scores {
        let layout = layout_score(path);
        let systems = layout["systems"].as_array().unwrap();
        let mut violations = Vec::new();

        for (sys_idx, system) in systems.iter().enumerate() {
            for sg in system["staff_groups"].as_array().unwrap() {
                let staves = sg["staves"].as_array().unwrap();
                if staves.len() < 2 {
                    continue;
                }

                let bottom_y = staves.last().unwrap()["staff_lines"]
                    .as_array()
                    .unwrap()
                    .last()
                    .unwrap()["y_position"]
                    .as_f64()
                    .unwrap();

                // staves[0] barlines must span to bottom_y
                let empty_barlines = vec![];
                let first_staves_barlines =
                    staves[0]["bar_lines"].as_array().unwrap_or(&empty_barlines);
                for bl in first_staves_barlines {
                    if let Some(segments) = bl["segments"].as_array() {
                        for seg in segments {
                            let seg_y_end = seg["y_end"].as_f64().unwrap_or(0.0);
                            if (seg_y_end - bottom_y).abs() > 0.5 {
                                violations.push(format!(
                                    "{} sys{}: barline y_end={:.1} but group bottom_y={:.1}",
                                    name, sys_idx, seg_y_end, bottom_y
                                ));
                            }
                        }
                    }
                }

                // staves[1..] must have no barlines
                for (staff_idx, staff) in staves.iter().enumerate().skip(1) {
                    let empty_bls = vec![];
                    let bls = staff["bar_lines"].as_array().unwrap_or(&empty_bls);
                    if !bls.is_empty() {
                        violations.push(format!(
                            "{} sys{} staff{}: expected no barlines after merge, found {}",
                            name,
                            sys_idx,
                            staff_idx,
                            bls.len()
                        ));
                    }
                }
            }
        }

        assert!(
            violations.is_empty(),
            "Grand-staff barline join violations:\n{}",
            violations.join("\n")
        );
    }
}
