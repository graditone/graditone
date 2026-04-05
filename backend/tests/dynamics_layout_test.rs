//! Integration tests for dynamics layout rendering (Feature 072)
//!
//! Constitution V: These tests are written BEFORE the implementation.
//! Constitution VII: Regression tests ensure scores without dynamics are unchanged.
//!
//! T008: Single p marking → correct DynamicGlyph
//! T009: Two consecutive dynamics → sorted by ascending x
//! T010: Score with no dynamics → empty dynamic_glyphs
//! T011: DynamicGlyph.y equals staff_vertical_offset + 6 * units_per_space
//! T012: Frontend test (in RenderingPipeline.test.ts)

use musicore_backend::adapters::dtos::ScoreDto;
use musicore_backend::domain::importers::musicxml::{
    ImportContext, MusicXMLConverter, MusicXMLParser,
};
use musicore_backend::layout::{LayoutConfig, compute_layout};
use serde_json::Value;

const CONFIG: LayoutConfig = LayoutConfig {
    max_system_width: 2410.0,
    units_per_space: 20.0,
    system_spacing: 200.0,
    system_height: 200.0,
};

/// Helper: parse inline MusicXML and return a Score
fn parse_score(xml: &str) -> musicore_backend::domain::score::Score {
    let mut ctx = ImportContext::new();
    let doc = MusicXMLParser::parse(xml, &mut ctx).expect("parse");
    MusicXMLConverter::convert(doc, &mut ctx).expect("convert")
}

/// Minimal MusicXML wrapper for a single-part, single-staff score
fn wrap_musicxml(measures_xml: &str) -> String {
    format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1">
      <part-name>Piano</part-name>
    </score-part>
  </part-list>
  <part id="P1">
    {measures_xml}
  </part>
</score-partwise>"#
    )
}

/// Convert a Score to layout JSON via ScoreDto
fn score_to_layout_json(score: &musicore_backend::domain::score::Score) -> Value {
    let dto: ScoreDto = score.into();
    let json = serde_json::to_value(&dto).expect("DTO serialization failed");
    let layout = compute_layout(&json, &CONFIG);
    serde_json::to_value(&layout).expect("layout serialization failed")
}

/// Collect all dynamic_glyphs across all systems/staff_groups/staves
fn collect_dynamic_glyphs(layout_json: &Value) -> Vec<Value> {
    let mut glyphs = Vec::new();
    if let Some(systems) = layout_json["systems"].as_array() {
        for system in systems {
            if let Some(staff_groups) = system["staff_groups"].as_array() {
                for sg in staff_groups {
                    if let Some(staves) = sg["staves"].as_array() {
                        for staff in staves {
                            if let Some(dg) = staff["dynamic_glyphs"].as_array() {
                                glyphs.extend(dg.iter().cloned());
                            }
                        }
                    }
                }
            }
        }
    }
    glyphs
}

/// Collect all hairpin_layouts across all systems/staff_groups/staves
fn collect_hairpin_layouts(layout_json: &Value) -> Vec<Value> {
    let mut layouts = Vec::new();
    if let Some(systems) = layout_json["systems"].as_array() {
        for system in systems {
            if let Some(staff_groups) = system["staff_groups"].as_array() {
                for sg in staff_groups {
                    if let Some(staves) = sg["staves"].as_array() {
                        for staff in staves {
                            if let Some(hl) = staff["hairpin_layouts"].as_array() {
                                layouts.extend(hl.iter().cloned());
                            }
                        }
                    }
                }
            }
        }
    }
    layouts
}

// ============================================================================
// Phase 3: US1 — Static Dynamic Markings
// ============================================================================

/// T008: A score with a single `p` marking at a known tick produces one DynamicGlyph
/// with codepoint = "\u{E520}", y = staff_vertical_offset + 6 * units_per_space,
/// font_size = 80.0
#[test]
fn test_single_p_marking_produces_dynamic_glyph() {
    let measures = r#"
    <measure number="1">
      <attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
      <direction placement="below">
        <direction-type><dynamics><p/></dynamics></direction-type>
      </direction>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>"#;

    let score = parse_score(&wrap_musicxml(measures));
    let layout_json = score_to_layout_json(&score);
    let glyphs = collect_dynamic_glyphs(&layout_json);

    assert_eq!(
        glyphs.len(),
        1,
        "Expected exactly 1 dynamic glyph for single p marking"
    );

    let glyph = &glyphs[0];
    assert_eq!(
        glyph["codepoint"].as_str().unwrap(),
        "\u{E520}",
        "p should use SMuFL codepoint U+E520 (dynamicPiano)"
    );
    assert_eq!(
        glyph["font_size"].as_f64().unwrap(),
        80.0,
        "font_size should be 80.0"
    );

    // x should be > 0 (at the note's x position)
    let x = glyph["x"].as_f64().unwrap();
    assert!(
        x > 0.0,
        "x should be positive (at note position), got {}",
        x
    );
}

/// T009: A score with two consecutive dynamics (p and ff in the same measure)
/// produces two DynamicGlyph entries sorted by ascending x
#[test]
fn test_two_dynamics_sorted_by_x() {
    let measures = r#"
    <measure number="1">
      <attributes><divisions>2</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
      <direction placement="below">
        <direction-type><dynamics><p/></dynamics></direction-type>
      </direction>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>half</type></note>
      <direction placement="below">
        <direction-type><dynamics><ff/></dynamics></direction-type>
      </direction>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>4</duration><type>half</type></note>
    </measure>"#;

    let score = parse_score(&wrap_musicxml(measures));
    let layout_json = score_to_layout_json(&score);
    let glyphs = collect_dynamic_glyphs(&layout_json);

    assert_eq!(glyphs.len(), 2, "Expected 2 dynamic glyphs for p + ff");

    let x0 = glyphs[0]["x"].as_f64().unwrap();
    let x1 = glyphs[1]["x"].as_f64().unwrap();
    assert!(
        x0 < x1,
        "Dynamic glyphs should be sorted by ascending x: {} < {}",
        x0,
        x1
    );

    // Verify codepoints
    assert_eq!(glyphs[0]["codepoint"].as_str().unwrap(), "\u{E520}"); // p
    assert_eq!(glyphs[1]["codepoint"].as_str().unwrap(), "\u{E52F}"); // ff
}

/// T010: A score with no dynamic markings produces empty dynamic_glyphs vec
#[test]
fn test_no_dynamics_produces_empty_glyphs() {
    let measures = r#"
    <measure number="1">
      <attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>"#;

    let score = parse_score(&wrap_musicxml(measures));
    let layout_json = score_to_layout_json(&score);
    let glyphs = collect_dynamic_glyphs(&layout_json);

    assert_eq!(
        glyphs.len(),
        0,
        "Score with no dynamics should produce 0 dynamic_glyphs"
    );

    // Also verify no hairpin_layouts
    let hairpins = collect_hairpin_layouts(&layout_json);
    assert_eq!(
        hairpins.len(),
        0,
        "Score with no dynamics should produce 0 hairpin_layouts"
    );
}

/// T011: Every emitted DynamicGlyph.y equals exactly staff_vertical_offset + 7.5 * units_per_space
/// (dynamics baseline: 3.5 staff spaces below bottom staff line for clearance)
#[test]
fn test_dynamic_glyph_y_position() {
    let measures = r#"
    <measure number="1">
      <attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
      <direction placement="below">
        <direction-type><dynamics><mf/></dynamics></direction-type>
      </direction>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>"#;

    let score = parse_score(&wrap_musicxml(measures));
    let layout_json = score_to_layout_json(&score);
    let glyphs = collect_dynamic_glyphs(&layout_json);

    assert!(!glyphs.is_empty(), "Expected at least one dynamic glyph");

    // Get the staff_lines to determine staff_vertical_offset
    let systems = layout_json["systems"].as_array().unwrap();
    let first_system = &systems[0];
    let staff_groups = first_system["staff_groups"].as_array().unwrap();
    let first_staff = &staff_groups[0]["staves"].as_array().unwrap()[0];
    let staff_lines = first_staff["staff_lines"].as_array().unwrap();

    // staff_vertical_offset is the y_position of the top staff line
    let top_line_y = staff_lines[0]["y_position"].as_f64().unwrap();
    // Expected y = staff_vertical_offset + 7.5 * units_per_space
    //            = top_line_y + 7.5 * 20.0 = top_line_y + 150.0
    let expected_y = top_line_y + 7.5 * CONFIG.units_per_space as f64;

    for glyph in &glyphs {
        let y = glyph["y"].as_f64().unwrap();
        assert!(
            (y - expected_y).abs() < 0.01,
            "DynamicGlyph.y should be {} (staff_top + 7.5 * ups), got {}",
            expected_y,
            y
        );
    }
}

// ============================================================================
// Phase 4: US2 — Hairpin Crescendo and Decrescendo
// ============================================================================

/// T015: A crescendo spanning two measures produces one HairpinLayout
/// with direction = Crescendo, x_start < x_end, correct y_center
#[test]
fn test_crescendo_produces_hairpin_layout() {
    let measures = r#"
    <measure number="1">
      <attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
      <direction placement="below">
        <direction-type><wedge type="crescendo" number="1"/></direction-type>
      </direction>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
    <measure number="2">
      <direction placement="below">
        <direction-type><wedge type="stop" number="1"/></direction-type>
      </direction>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>"#;

    let score = parse_score(&wrap_musicxml(measures));
    let layout_json = score_to_layout_json(&score);
    let hairpins = collect_hairpin_layouts(&layout_json);

    assert_eq!(
        hairpins.len(),
        1,
        "Expected exactly 1 hairpin layout for crescendo"
    );

    let hp = &hairpins[0];
    assert_eq!(
        hp["direction"].as_str().unwrap(),
        "Crescendo",
        "Direction should be Crescendo"
    );

    let x_start = hp["x_start"].as_f64().unwrap();
    let x_end = hp["x_end"].as_f64().unwrap();
    assert!(
        x_start < x_end,
        "x_start ({}) should be less than x_end ({})",
        x_start,
        x_end
    );

    assert!(
        !hp["continues_left"].as_bool().unwrap(),
        "continues_left should be false"
    );
    assert!(
        !hp["continues_right"].as_bool().unwrap(),
        "continues_right should be false"
    );
}

/// T016: A diminuendo hairpin produces HairpinLayout with direction = Diminuendo
#[test]
fn test_diminuendo_produces_hairpin_layout() {
    let measures = r#"
    <measure number="1">
      <attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
      <direction placement="below">
        <direction-type><wedge type="diminuendo" number="1"/></direction-type>
      </direction>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
    <measure number="2">
      <direction placement="below">
        <direction-type><wedge type="stop" number="1"/></direction-type>
      </direction>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>"#;

    let score = parse_score(&wrap_musicxml(measures));
    let layout_json = score_to_layout_json(&score);
    let hairpins = collect_hairpin_layouts(&layout_json);

    assert_eq!(
        hairpins.len(),
        1,
        "Expected exactly 1 hairpin layout for diminuendo"
    );
    assert_eq!(
        hairpins[0]["direction"].as_str().unwrap(),
        "Diminuendo",
        "Direction should be Diminuendo"
    );
}

/// T017: A hairpin spanning a system line break produces exactly 2 HairpinLayout entries —
/// first segment with continues_right = true, second with continues_left = true
#[test]
fn test_hairpin_spanning_system_break() {
    // Use a narrow system width to force a system break with fewer measures
    let narrow_config = LayoutConfig {
        max_system_width: 800.0,
        units_per_space: 20.0,
        system_spacing: 200.0,
        system_height: 200.0,
    };

    // Create a score with many measures to force a system break,
    // with a crescendo spanning across the break.
    let mut measures = String::new();
    measures.push_str(r#"
    <measure number="1">
      <attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
      <direction placement="below">
        <direction-type><wedge type="crescendo" number="1"/></direction-type>
      </direction>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>"#);

    // Add enough measures to force a system break at 800px width
    for i in 2..=8 {
        measures.push_str(&format!(
            r#"
    <measure number="{}">
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>"#,
            i
        ));
    }

    // Stop the wedge in the last measure (which should be on a different system)
    measures.push_str(r#"
    <measure number="9">
      <direction placement="below">
        <direction-type><wedge type="stop" number="1"/></direction-type>
      </direction>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>"#);

    let score = parse_score(&wrap_musicxml(&measures));
    let dto: ScoreDto = (&score).into();
    let json = serde_json::to_value(&dto).expect("DTO serialization failed");
    let layout = compute_layout(&json, &narrow_config);
    let layout_json = serde_json::to_value(&layout).expect("layout serialization failed");

    // Verify we have multiple systems
    let systems = layout_json["systems"].as_array().unwrap();
    assert!(
        systems.len() >= 2,
        "Expected at least 2 systems to test cross-system hairpin, got {}",
        systems.len()
    );

    let hairpins = collect_hairpin_layouts(&layout_json);

    // A cross-system hairpin should produce 2 entries
    assert_eq!(
        hairpins.len(),
        2,
        "Expected 2 hairpin segments for cross-system crescendo, got {}. Hairpins: {:?}",
        hairpins.len(),
        hairpins
    );

    // First segment: continues_right = true
    let first = &hairpins[0];
    assert!(
        first["continues_right"].as_bool().unwrap(),
        "First segment should have continues_right = true"
    );
    assert!(
        !first["continues_left"].as_bool().unwrap(),
        "First segment should have continues_left = false"
    );

    // Second segment: continues_left = true
    let second = &hairpins[1];
    assert!(
        second["continues_left"].as_bool().unwrap(),
        "Second segment should have continues_left = true"
    );
    assert!(
        !second["continues_right"].as_bool().unwrap(),
        "Second segment should have continues_right = false"
    );
}

// ============================================================================
// Phase 5: US3 — Consistency
// ============================================================================

/// T022: Integration test verifying visual layout and audio playback read from
/// the same DynamicMarking data.
#[test]
fn test_dynamics_visual_and_audio_consistency() {
    let measures = r#"
    <measure number="1">
      <attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
      <direction placement="below">
        <direction-type><dynamics><ff/></dynamics></direction-type>
        <sound dynamics="112"/>
      </direction>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>"#;

    let score = parse_score(&wrap_musicxml(measures));

    // Audio side: check dynamics in domain score
    assert!(
        !score.dynamics.is_empty(),
        "Score should have dynamics for audio playback"
    );
    let audio_dynamic = &score.dynamics[0];
    assert_eq!(
        audio_dynamic.start_tick.value(),
        0,
        "Audio ff should be at tick 0"
    );

    // Visual side: check dynamic_glyphs in layout output
    let layout_json = score_to_layout_json(&score);
    let glyphs = collect_dynamic_glyphs(&layout_json);
    assert!(
        !glyphs.is_empty(),
        "Layout should have dynamic glyphs for visual display"
    );

    // Both should reference ff at tick 0 from the same ScoreDto data
    assert_eq!(
        glyphs[0]["codepoint"].as_str().unwrap(),
        "\u{E52F}",
        "Visual glyph should be ff (U+E52F)"
    );
}

// ============================================================================
// Phase 6: Regression
// ============================================================================

/// T025: A score containing no dynamics and no hairpins produces a GlobalLayout
/// JSON output with no dynamic_glyphs or hairpin_layouts keys present
/// (regression test — Principle VII, backward compatibility via skip_serializing_if)
#[test]
fn test_no_dynamics_regression_no_keys_in_json() {
    let measures = r#"
    <measure number="1">
      <attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>"#;

    let score = parse_score(&wrap_musicxml(measures));
    let layout_json = score_to_layout_json(&score);

    // Walk all staves and ensure dynamic_glyphs / hairpin_layouts keys are absent
    // (not just empty — they should be skipped by #[serde(skip_serializing_if)])
    let systems = layout_json["systems"].as_array().unwrap();
    for system in systems {
        if let Some(staff_groups) = system["staff_groups"].as_array() {
            for sg in staff_groups {
                if let Some(staves) = sg["staves"].as_array() {
                    for staff in staves {
                        let obj = staff.as_object().unwrap();
                        assert!(
                            !obj.contains_key("dynamic_glyphs"),
                            "dynamic_glyphs key should be absent when empty (skip_serializing_if)"
                        );
                        assert!(
                            !obj.contains_key("hairpin_layouts"),
                            "hairpin_layouts key should be absent when empty (skip_serializing_if)"
                        );
                    }
                }
            }
        }
    }
}
