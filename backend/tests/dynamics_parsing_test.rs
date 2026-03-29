//! Tests for dynamics parsing and velocity assignment (Feature 063)
//!
//! T016: Static dynamics (pp, ff) extraction
//! T017: Crescendo/diminuendo wedge pairing
//! T018: <sound dynamics="N"/> velocity clamping
//! T019: No-dynamics default velocity (80 = mf)
//! T020: Linear interpolation within crescendo regions

use musicore_backend::domain::importers::musicxml::{
    ImportContext, MusicXMLConverter, MusicXMLParser,
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

// T016: Parse score with static dynamics (pp at m1, ff at m5)
#[test]
fn test_static_dynamics_extraction() {
    let measures = r#"
    <measure number="1">
      <attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
      <direction placement="below">
        <direction-type><dynamics><pp/></dynamics></direction-type>
        <sound dynamics="33"/>
      </direction>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
    <measure number="2">
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
    <measure number="3">
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
    <measure number="4">
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
    <measure number="5">
      <direction placement="below">
        <direction-type><dynamics><ff/></dynamics></direction-type>
        <sound dynamics="112"/>
      </direction>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>"#;

    let score = parse_score(&wrap_musicxml(measures));

    // Should have 2 dynamic markings
    assert_eq!(score.dynamics.len(), 2, "Expected 2 dynamic markings");

    // First: pp at tick 0
    assert_eq!(score.dynamics[0].velocity, 33);
    assert_eq!(score.dynamics[0].start_tick.value(), 0);

    // Second: ff at measure 5 start (4 measures * 3840 ticks = 15360)
    assert_eq!(score.dynamics[1].velocity, 112);
    assert_eq!(score.dynamics[1].start_tick.value(), 15360);

    // Notes in m1-m4 should have pp velocity (33)
    let notes = &score.instruments[0].staves[0].voices[0].interval_events;
    assert_eq!(notes[0].velocity, Some(33), "m1 note should be pp (33)");
    assert_eq!(notes[1].velocity, Some(33), "m2 note should be pp (33)");

    // Note in m5 should have ff velocity (112)
    assert_eq!(notes[4].velocity, Some(112), "m5 note should be ff (112)");
}

// T017: Parse score with crescendo/diminuendo wedges
#[test]
fn test_wedge_pairing() {
    let measures = r#"
    <measure number="1">
      <attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
      <direction placement="below">
        <direction-type><dynamics><p/></dynamics></direction-type>
      </direction>
      <direction>
        <direction-type><wedge type="crescendo" number="1"/></direction-type>
      </direction>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
    <measure number="2">
      <direction>
        <direction-type><wedge type="stop" number="1"/></direction-type>
      </direction>
      <direction placement="below">
        <direction-type><dynamics><f/></dynamics></direction-type>
      </direction>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
    <measure number="3">
      <direction>
        <direction-type><wedge type="diminuendo" number="1"/></direction-type>
      </direction>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
    <measure number="4">
      <direction>
        <direction-type><wedge type="stop" number="1"/></direction-type>
      </direction>
      <direction placement="below">
        <direction-type><dynamics><pp/></dynamics></direction-type>
      </direction>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>"#;

    let score = parse_score(&wrap_musicxml(measures));

    // Should have 2 gradual dynamics
    assert_eq!(score.gradual_dynamics.len(), 2, "Expected 2 wedges");

    // First: crescendo from m1 start to m2 start
    let cresc = &score.gradual_dynamics[0];
    assert_eq!(cresc.start_tick.value(), 0);
    assert_eq!(cresc.stop_tick.value(), 3840);

    // Second: diminuendo from m3 start to m4 start
    let dim = &score.gradual_dynamics[1];
    assert_eq!(dim.start_tick.value(), 7680);
    assert_eq!(dim.stop_tick.value(), 11520);
}

// T018: <sound dynamics="N"/> clamping
#[test]
fn test_sound_dynamics_clamping() {
    let measures = r#"
    <measure number="1">
      <attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
      <direction placement="below">
        <direction-type><dynamics><ff/></dynamics></direction-type>
        <sound dynamics="200"/>
      </direction>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>"#;

    let score = parse_score(&wrap_musicxml(measures));

    // Velocity should be clamped to 127
    assert_eq!(
        score.dynamics[0].velocity, 127,
        "velocity should be clamped to 127"
    );

    let notes = &score.instruments[0].staves[0].voices[0].interval_events;
    assert_eq!(
        notes[0].velocity,
        Some(127),
        "note velocity should be clamped to 127"
    );
}

// T019: No dynamics → all notes get velocity 80 (mf default)
#[test]
fn test_no_dynamics_default_velocity() {
    let measures = r#"
    <measure number="1">
      <attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>"#;

    let score = parse_score(&wrap_musicxml(measures));

    assert!(score.dynamics.is_empty(), "no dynamics expected");
    assert!(score.gradual_dynamics.is_empty(), "no wedges expected");

    let notes = &score.instruments[0].staves[0].voices[0].interval_events;
    for (i, note) in notes.iter().enumerate() {
        assert_eq!(
            note.velocity,
            Some(80),
            "note {i} should default to mf (80)"
        );
    }
}

// T020: Linear interpolation within crescendo region
#[test]
fn test_crescendo_interpolation() {
    // p (49) at tick 0, crescendo from tick 0 to tick 3840, f (96) at tick 3840
    let measures = r#"
    <measure number="1">
      <attributes><divisions>4</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
      <direction placement="below">
        <direction-type><dynamics><p/></dynamics></direction-type>
      </direction>
      <direction>
        <direction-type><wedge type="crescendo" number="1"/></direction-type>
      </direction>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type></note>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type></note>
    </measure>
    <measure number="2">
      <direction>
        <direction-type><wedge type="stop" number="1"/></direction-type>
      </direction>
      <direction placement="below">
        <direction-type><dynamics><f/></dynamics></direction-type>
      </direction>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type></note>
      <note><pitch><step>A</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type></note>
      <note><pitch><step>B</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type></note>
      <note><pitch><step>C</step><octave>5</octave></pitch><duration>4</duration><type>quarter</type></note>
    </measure>"#;

    let score = parse_score(&wrap_musicxml(measures));

    let notes = &score.instruments[0].staves[0].voices[0].interval_events;

    // Note at tick 0: start of crescendo, should be p (49)
    let v0 = notes[0].velocity.unwrap();
    assert_eq!(v0, 49, "first note should be p (49)");

    // Notes within the crescendo should increase monotonically
    let v1 = notes[1].velocity.unwrap();
    let v2 = notes[2].velocity.unwrap();
    let v3 = notes[3].velocity.unwrap();

    assert!(v1 > v0, "velocity should increase: v1={v1} > v0={v0}");
    assert!(v2 > v1, "velocity should increase: v2={v2} > v1={v1}");
    assert!(v3 > v2, "velocity should increase: v3={v3} > v2={v2}");

    // Note at m2 tick 3840: after crescendo ends, should be f (96)
    let v4 = notes[4].velocity.unwrap();
    assert_eq!(v4, 96, "first note of m2 should be f (96)");
}
