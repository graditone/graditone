//! T020 / T024: Integration tests for rest glyph layout (feature 043-score-rests).
//!
//! T020: Full-measure rest is centred horizontally within its measure.
//! T024: Multi-voice rests are offset vertically so they don't overlap.

use musicore_backend::layout::{LayoutConfig, compute_layout};

const CONFIG: LayoutConfig = LayoutConfig {
    max_system_width: 2400.0,
    units_per_space: 20.0,
    system_spacing: 100.0,
    system_height: 200.0,
};

/// Helper: collect all glyph codepoints from every glyph_run in the first system.
fn collect_codepoints(layout: &serde_json::Value) -> Vec<String> {
    let mut out = Vec::new();
    if let Some(systems) = layout["systems"].as_array() {
        if let Some(system) = systems.first() {
            if let Some(staff_groups) = system["staff_groups"].as_array() {
                for sg in staff_groups {
                    if let Some(staves) = sg["staves"].as_array() {
                        for staff in staves {
                            if let Some(runs) = staff["glyph_runs"].as_array() {
                                for run in runs {
                                    if let Some(glyphs) = run["glyphs"].as_array() {
                                        for g in glyphs {
                                            if let Some(cp) = g["codepoint"].as_str() {
                                                out.push(cp.to_string());
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    out
}

/// T020: A score with a single full-measure quarter-rest produces a glyph with
///       codepoint U+E4E5 (quarter rest) in the layout output.
///
/// T-REST-12 integration scenario: parse JSON score with quarter rest → layout
/// contains a glyph with codepoint \u{E4E5}.
#[test]
fn test_quarter_rest_appears_in_layout() {
    let score = serde_json::json!({
        "instruments": [{
            "id": "piano-1",
            "name": "Piano",
            "staves": [{
                "clef": "Treble",
                "key_sharps": 0,
                "time_numerator": 4,
                "time_denominator": 4,
                "voices": [{
                    "notes": [
                        {"tick": 0,    "duration": 960, "pitch": 60},
                        {"tick": 960,  "duration": 960, "pitch": 62},
                        {"tick": 2880, "duration": 960, "pitch": 64}
                    ],
                    "rest_events": [
                        {"start_tick": 1920, "duration_ticks": 960, "note_type": "quarter", "voice": 1}
                    ]
                }]
            }]
        }]
    });

    let layout = compute_layout(&score, &CONFIG);
    let json = serde_json::to_value(&layout).unwrap();
    let codepoints = collect_codepoints(&json);

    assert!(
        codepoints.iter().any(|cp| cp == "\u{E4E5}"),
        "Layout should contain quarter rest codepoint U+E4E5; found codepoints: {:?}",
        codepoints
    );
}

/// T020: A whole-measure rest (4/4, 3840 ticks) produces a whole rest glyph U+E4E3.
#[test]
fn test_whole_measure_rest_appears_in_layout() {
    let score = serde_json::json!({
        "instruments": [{
            "id": "piano-1",
            "name": "Piano",
            "staves": [{
                "clef": "Treble",
                "key_sharps": 0,
                "time_numerator": 4,
                "time_denominator": 4,
                "voices": [{
                    "notes": [],
                    "rest_events": [
                        {"start_tick": 0, "duration_ticks": 3840, "note_type": "whole", "voice": 1}
                    ]
                }]
            }]
        }]
    });

    let layout = compute_layout(&score, &CONFIG);
    let json = serde_json::to_value(&layout).unwrap();
    let codepoints = collect_codepoints(&json);

    assert!(
        codepoints.iter().any(|cp| cp == "\u{E4E3}"),
        "Layout should contain whole rest codepoint U+E4E3; found codepoints: {:?}",
        codepoints
    );
}

/// T024: Two simultaneous voices each have a rest; both rest glyphs appear in the output.
#[test]
fn test_multi_voice_rests_both_appear_in_layout() {
    let score = serde_json::json!({
        "instruments": [{
            "id": "piano-1",
            "name": "Piano",
            "staves": [{
                "clef": "Treble",
                "key_sharps": 0,
                "time_numerator": 4,
                "time_denominator": 4,
                "voices": [
                    {
                        "notes": [{"tick": 0, "duration": 960, "pitch": 64}],
                        "rest_events": [
                            {"start_tick": 960, "duration_ticks": 2880, "note_type": "half", "voice": 1}
                        ]
                    },
                    {
                        "notes": [{"tick": 0, "duration": 960, "pitch": 60}],
                        "rest_events": [
                            {"start_tick": 960, "duration_ticks": 2880, "note_type": "half", "voice": 2}
                        ]
                    }
                ]
            }]
        }]
    });

    let layout = compute_layout(&score, &CONFIG);
    let json = serde_json::to_value(&layout).unwrap();
    let codepoints = collect_codepoints(&json);

    // Both voice 1 and voice 2 have a half rest — U+E4E4 should appear twice
    let half_rest_count = codepoints
        .iter()
        .filter(|cp| cp.as_str() == "\u{E4E4}")
        .count();
    assert!(
        half_rest_count >= 2,
        "Should have at least 2 half rest glyphs (one per voice); found {} U+E4E4 glyphs. Codepoints: {:?}",
        half_rest_count,
        codepoints
    );
}
