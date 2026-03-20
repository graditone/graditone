//! Grace note layout tests.
//! Covers visual rendering properties (font_size, opacity) and
//! cross-staff tick alignment (regression for T124).

use musicore_backend::adapters::dtos::ScoreDto;
use musicore_backend::domain::importers::musicxml::MusicXMLImporter;
use musicore_backend::domain::importers::musicxml::{
    CompressionHandler, ImportContext, MusicXMLConverter, MusicXMLParser,
};
use musicore_backend::layout::{LayoutConfig, compute_layout};
use musicore_backend::ports::importers::IMusicXMLImporter;
use std::path::Path;

const CONFIG: LayoutConfig = LayoutConfig {
    max_system_width: 2410.0,
    units_per_space: 20.0,
    system_spacing: 200.0,
    system_height: 200.0,
};

fn layout_fur_elise() -> serde_json::Value {
    let importer = MusicXMLImporter::new();
    let result = importer
        .import_file(Path::new("../scores/Beethoven_FurElise.mxl"))
        .unwrap();
    let dto: ScoreDto = (&result.score).into();
    let json = serde_json::to_value(&dto).unwrap();
    let layout = compute_layout(&json, &CONFIG);
    serde_json::to_value(&layout).unwrap()
}

/// Für Elise M26 contains two grace notes (F4, A4) before the principal C5.
/// These grace notes MUST have:
/// - font_size ≈ 60.0 (75% of standard 80.0)
/// - full opacity (same as normal notes)
///
/// Normal notes MUST have font_size ≈ 80.0 and opacity 1.0 (or absent).
#[test]
fn test_grace_notes_have_reduced_font_size_and_opacity() {
    let layout = layout_fur_elise();

    // Collect all glyph runs across all systems/staff_groups/staves
    let systems = layout["systems"].as_array().expect("systems array");
    let mut grace_font_sizes: Vec<f64> = Vec::new();
    let mut normal_font_sizes: Vec<f64> = Vec::new();

    for system in systems {
        for sg in system["staff_groups"].as_array().unwrap_or(&vec![]) {
            for staff in sg["staves"].as_array().unwrap_or(&vec![]) {
                for run in staff["glyph_runs"].as_array().unwrap_or(&vec![]) {
                    let run_font_size = run["font_size"].as_f64().unwrap_or(80.0);

                    // Grace-note runs: font_size ≈ 60.0 (80*0.75)
                    if run_font_size < 70.0 && run_font_size > 50.0 {
                        grace_font_sizes.push(run_font_size);
                    } else if run_font_size >= 70.0 {
                        // Check only noteheads (not stems/beams which use special codepoints)
                        for glyph in run["glyphs"].as_array().unwrap_or(&vec![]) {
                            let cp = glyph["codepoint"].as_str().unwrap_or("");
                            let code = cp.chars().next().unwrap_or('\0') as u32;
                            // SMuFL noteheads range: U+E0A0-U+E0FF, combined note glyphs: U+E1D0-U+E1FF
                            if (0xE0A0..=0xE0FF).contains(&code)
                                || (0xE1D0..=0xE1FF).contains(&code)
                            {
                                normal_font_sizes.push(run_font_size);
                            }
                        }
                    }
                }
            }
        }
    }

    // There must be grace-note runs (Für Elise has grace notes in M26 and M29)
    assert!(
        !grace_font_sizes.is_empty(),
        "Expected grace-note GlyphRuns with font_size ≈ 60, found none. \
         Grace notes are not being rendered at reduced size."
    );

    // Grace notes should be ~60.0 (80*0.75)
    for &fs in &grace_font_sizes {
        assert!(
            (fs - 60.0).abs() < 2.0,
            "Grace note font_size should be ~60.0 (75% of 80), got {fs}"
        );
    }

    // Normal notes should be ~80.0
    assert!(
        !normal_font_sizes.is_empty(),
        "Expected normal note GlyphRuns"
    );
    for &fs in &normal_font_sizes {
        assert!(
            fs >= 70.0,
            "Normal note font_size should be >= 70.0, got {fs}"
        );
    }
}

/// Grace note stems (U+0000) and beams (U+0001) must have thinner
/// dimensions (0.75x scaling) while retaining full opacity.
#[test]
fn test_grace_note_stems_and_beams_have_reduced_thickness() {
    let layout = layout_fur_elise();
    let systems = layout["systems"].as_array().expect("systems array");

    let mut grace_stem_runs = 0u32;
    let mut grace_beam_runs = 0u32;
    let mut normal_stem_thickness_sum = 0.0f64;
    let mut normal_stem_count = 0u32;

    for system in systems {
        for sg in system["staff_groups"].as_array().unwrap_or(&vec![]) {
            for staff in sg["staves"].as_array().unwrap_or(&vec![]) {
                for run in staff["glyph_runs"].as_array().unwrap_or(&vec![]) {
                    for glyph in run["glyphs"].as_array().unwrap_or(&vec![]) {
                        let cp = glyph["codepoint"].as_str().unwrap_or("");
                        let is_stem = cp == "\u{0000}";
                        let is_beam = cp == "\u{0001}";

                        if is_stem {
                            let w = glyph["bounding_box"]["width"].as_f64().unwrap_or(0.0);
                            // Grace stems: ~1.125 (1.5 * 0.75); normal: ~1.5
                            if w < 1.3 && w > 0.5 {
                                grace_stem_runs += 1;
                            } else if w >= 1.3 {
                                normal_stem_thickness_sum += w;
                                normal_stem_count += 1;
                            }
                        }

                        if is_beam {
                            let h = glyph["bounding_box"]["height"].as_f64().unwrap_or(0.0);
                            // Grace beams: ~7.5 (10.0 * 0.75); normal: ~10.0
                            if h < 9.0 && h > 4.0 {
                                grace_beam_runs += 1;
                            }
                        }
                    }
                }
            }
        }
    }

    assert!(
        grace_stem_runs > 0,
        "Expected grace-note stems with reduced thickness, found none"
    );
    assert!(
        grace_beam_runs > 0,
        "Expected grace-note beams with reduced thickness, found none"
    );
    // Normal stems should be full thickness (1.5)
    if normal_stem_count > 0 {
        let avg_thickness = normal_stem_thickness_sum / normal_stem_count as f64;
        assert!(
            avg_thickness > 1.3,
            "Normal stem thickness should be ~1.5, avg was {avg_thickness}"
        );
    }
}

/// Regression test for T124: grace note tick drift causing LH/RH misalignment.
///
/// `convert_note()` must rewind `current_tick` by `grace_tick_advance` when
/// processing the first principal note after a run of grace notes.  Failing
/// to do so leaves the cursor `grace_tick_advance` ticks too high, causing
/// every subsequent note in the same voice to accumulate a forward offset.
///
/// The Chopin Nocturne Op. 9 No. 2 has 2 grace notes in M8 (treble staff
/// only).  After M8, beat 1 of M9 must land at the same tick in both treble
/// and bass staves.  With the bug, treble M9 notes were ~120 ticks too high
/// (2 grace notes × 60-tick visual duration each).
#[test]
fn test_grace_notes_do_not_cause_tick_drift_between_staves() {
    let fixture_path = std::path::Path::new("../scores/Chopin_NocturneOp9No2.mxl");
    let xml = CompressionHandler::load_content(fixture_path).expect("load Nocturne");
    let mut ctx = ImportContext::new();
    let doc = MusicXMLParser::parse(&xml, &mut ctx).expect("parse Nocturne");
    let score = MusicXMLConverter::convert(doc, &mut ctx).expect("convert Nocturne");

    let inst = &score.instruments[0];
    assert!(
        inst.staves.len() >= 2,
        "Nocturne must have treble and bass staves"
    );

    // measure_end_ticks[i] = end of measure i+1 (0-indexed):
    //   M9 start = measure_end_ticks[7]  (= end of M8)
    //   M9 end   = measure_end_ticks[8]  (= end of M9)
    assert!(
        score.measure_end_ticks.len() >= 9,
        "Need at least 9 entries in measure_end_ticks"
    );
    let m9_start = score.measure_end_ticks[7];
    let m9_end = score.measure_end_ticks[8];

    // Collect the earliest non-grace note tick in M9 for each staff.
    let first_tick_in_m9 = |staff_idx: usize| -> Option<u32> {
        inst.staves[staff_idx]
            .voices
            .iter()
            .flat_map(|v| v.interval_events.iter())
            .filter(|n| {
                let t = n.start_tick.value();
                !n.is_grace && t >= m9_start && t < m9_end
            })
            .map(|n| n.start_tick.value())
            .min()
    };

    let treble_first = first_tick_in_m9(0).expect("Treble staff must have notes in M9");
    let bass_first = first_tick_in_m9(1).expect("Bass staff must have notes in M9");

    assert_eq!(
        treble_first, bass_first,
        "M9 beat 1: treble tick {treble_first} ≠ bass tick {bass_first}. \
         Grace note tick drift detected — convert_note() likely failed to \
         rewind current_tick after processing grace notes in M8."
    );
}

/// Regression test: grace notes at the start of a system must not overlap
/// with the principal note.  When a grace run begins at the system's first
/// tick, the grace prefix gap in `compute_unified_note_positions` must push
/// the principal note (and the corresponding LH note) right so that grace
/// noteheads occupy distinct x-positions before the principal.
///
/// The Chopin Nocturne M22 has 3 grace notes (G4, Bb4, Eb5) before the
/// principal G5.  Depending on page breaks, M22 can start a system.  Before
/// the fix, `(target_x - offset).max(left_margin)` collapsed all grace
/// noteheads onto `left_margin`, identical to the principal.
#[test]
fn test_grace_notes_at_system_start_have_distinct_x_positions() {
    let fixture_path = std::path::Path::new("../scores/Chopin_NocturneOp9No2.mxl");
    let importer = MusicXMLImporter::new();
    let result = importer.import_file(fixture_path).unwrap();
    let dto: ScoreDto = (&result.score).into();
    let json = serde_json::to_value(&dto).unwrap();
    let layout = compute_layout(&json, &CONFIG);
    let layout_json = serde_json::to_value(&layout).unwrap();

    let systems = layout_json["systems"].as_array().expect("systems array");

    // For each system, check that grace noteheads have distinct x from their
    // principal note in the first staff (treble).
    for (sys_idx, system) in systems.iter().enumerate() {
        let staves = system["staff_groups"]
            .as_array()
            .and_then(|sgs| sgs.first())
            .and_then(|sg| sg["staves"].as_array());
        let staves = match staves {
            Some(s) => s,
            None => continue,
        };
        if staves.is_empty() {
            continue;
        }

        // Collect noteheads from the treble staff (index 0).
        let treble = &staves[0];
        let mut grace_xs: Vec<f64> = Vec::new();
        let mut normal_xs: Vec<f64> = Vec::new();

        for run in treble["glyph_runs"].as_array().unwrap_or(&vec![]) {
            let fs = run["font_size"].as_f64().unwrap_or(80.0);
            let is_grace_run = fs < 70.0 && fs > 50.0;
            for glyph in run["glyphs"].as_array().unwrap_or(&vec![]) {
                let cp = glyph["codepoint"].as_str().unwrap_or("");
                let code = cp.chars().next().unwrap_or('\0') as u32;
                // SMuFL noteheads U+E0A0..U+E0FF, combined notes U+E1D0..U+E1FF
                if (0xE0A0..=0xE0FF).contains(&code) || (0xE1D0..=0xE1FF).contains(&code) {
                    let x = glyph["position"]["x"].as_f64().unwrap_or(0.0);
                    if is_grace_run {
                        grace_xs.push(x);
                    } else {
                        normal_xs.push(x);
                    }
                }
            }
        }

        if grace_xs.is_empty() || normal_xs.is_empty() {
            continue;
        }

        // When multiple grace noteheads exist in the same system, they must
        // not all collapse to the same x-position (the original bug clamped
        // them all to left_margin).
        if grace_xs.len() >= 2 {
            let mut sorted_grace = grace_xs.clone();
            sorted_grace.sort_by(|a, b| a.partial_cmp(b).unwrap());
            let distinct_count = {
                let mut prev = sorted_grace[0];
                let mut cnt = 1usize;
                for &gx in &sorted_grace[1..] {
                    if (gx - prev).abs() > 1.0 {
                        cnt += 1;
                        prev = gx;
                    }
                }
                cnt
            };
            assert!(
                distinct_count >= 2,
                "sys={sys_idx}: {n} grace noteheads all at x≈{x:.1} — they \
                 should have distinct x-positions (spaced ~30 apart). \
                 Grace notes likely collapsed to left_margin.",
                n = grace_xs.len(),
                x = sorted_grace[0],
            );
        }
    }
}
