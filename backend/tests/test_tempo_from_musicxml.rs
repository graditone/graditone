// Integration tests for Score-Defined Tempo Configuration (001-score-tempo)
// Tests T002, T003, T004: Verify MusicXML <sound tempo="..."/> parsing

use musicore_backend::domain::events::global::GlobalStructuralEvent;
use musicore_backend::domain::importers::musicxml::{
    ImportContext, MusicXMLConverter, MusicXMLParser,
};
/// Helper: parse MusicXML string and convert to Score, return the BPM value
fn extract_bpm_from_musicxml(xml: &str) -> u16 {
    let mut context = ImportContext::new();
    let doc = MusicXMLParser::parse(xml, &mut context).expect("Failed to parse MusicXML");
    let score = MusicXMLConverter::convert(doc, &mut context).expect("Failed to convert to Score");

    score
        .global_structural_events
        .iter()
        .find_map(|event| match event {
            GlobalStructuralEvent::Tempo(tempo) => Some(tempo.bpm.value()),
            _ => None,
        })
        .expect("No tempo event found in score")
}

/// T002: MusicXML with <sound tempo="60"/> at measure level → Score BPM = 60
#[test]
fn tempo_from_sound_element() {
    let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN"
  "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1">
      <part-name>Piano</part-name>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <time>
          <beats>4</beats>
          <beat-type>4</beat-type>
        </time>
        <clef>
          <sign>G</sign>
          <line>2</line>
        </clef>
      </attributes>
      <sound tempo="60"/>
      <note>
        <pitch>
          <step>C</step>
          <octave>4</octave>
        </pitch>
        <duration>4</duration>
        <type>whole</type>
      </note>
    </measure>
  </part>
</score-partwise>"#;

    let bpm = extract_bpm_from_musicxml(xml);
    assert_eq!(bpm, 60, "Expected BPM 60 from <sound tempo=\"60\"/>");
}

/// T003: Out-of-range tempos are clamped: 5 → 20 BPM, 500 → 400 BPM
#[test]
fn tempo_out_of_range_clamped_low() {
    let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN"
  "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1">
      <part-name>Piano</part-name>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <time>
          <beats>4</beats>
          <beat-type>4</beat-type>
        </time>
        <clef>
          <sign>G</sign>
          <line>2</line>
        </clef>
      </attributes>
      <sound tempo="5"/>
      <note>
        <pitch>
          <step>C</step>
          <octave>4</octave>
        </pitch>
        <duration>4</duration>
        <type>whole</type>
      </note>
    </measure>
  </part>
</score-partwise>"#;

    let bpm = extract_bpm_from_musicxml(xml);
    assert_eq!(
        bpm, 20,
        "Expected BPM clamped to 20 from <sound tempo=\"5\"/>"
    );
}

#[test]
fn tempo_out_of_range_clamped_high() {
    let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN"
  "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1">
      <part-name>Piano</part-name>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <time>
          <beats>4</beats>
          <beat-type>4</beat-type>
        </time>
        <clef>
          <sign>G</sign>
          <line>2</line>
        </clef>
      </attributes>
      <sound tempo="500"/>
      <note>
        <pitch>
          <step>C</step>
          <octave>4</octave>
        </pitch>
        <duration>4</duration>
        <type>whole</type>
      </note>
    </measure>
  </part>
</score-partwise>"#;

    let bpm = extract_bpm_from_musicxml(xml);
    assert_eq!(
        bpm, 400,
        "Expected BPM clamped to 400 from <sound tempo=\"500\"/>"
    );
}

/// T004: MusicXML without <sound> → Score BPM defaults to 120 (regression guard)
#[test]
fn tempo_missing_defaults_to_120() {
    let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN"
  "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1">
      <part-name>Piano</part-name>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <time>
          <beats>4</beats>
          <beat-type>4</beat-type>
        </time>
        <clef>
          <sign>G</sign>
          <line>2</line>
        </clef>
      </attributes>
      <note>
        <pitch>
          <step>C</step>
          <octave>4</octave>
        </pitch>
        <duration>4</duration>
        <type>whole</type>
      </note>
    </measure>
  </part>
</score-partwise>"#;

    let bpm = extract_bpm_from_musicxml(xml);
    assert_eq!(bpm, 120, "Expected default BPM 120 when no <sound> element");
}

/// Metronome marking should be preferred over <sound tempo> when they disagree
#[test]
fn metronome_preferred_over_sound_tempo() {
    let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN"
  "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1">
      <part-name>Piano</part-name>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <time>
          <beats>4</beats>
          <beat-type>4</beat-type>
        </time>
        <clef>
          <sign>G</sign>
          <line>2</line>
        </clef>
      </attributes>
      <direction placement="above">
        <direction-type>
          <metronome>
            <beat-unit>quarter</beat-unit>
            <per-minute>132</per-minute>
          </metronome>
        </direction-type>
        <sound tempo="120"/>
      </direction>
      <note>
        <pitch>
          <step>C</step>
          <octave>4</octave>
        </pitch>
        <duration>4</duration>
        <type>whole</type>
      </note>
    </measure>
  </part>
</score-partwise>"#;

    let bpm = extract_bpm_from_musicxml(xml);
    assert_eq!(
        bpm, 132,
        "Expected BPM 132 from <metronome> over <sound tempo=\"120\"/>"
    );
}

/// Metronome-only (no <sound>) should set tempo
#[test]
fn metronome_only_without_sound() {
    let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN"
  "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1">
      <part-name>Piano</part-name>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <time>
          <beats>4</beats>
          <beat-type>4</beat-type>
        </time>
        <clef>
          <sign>G</sign>
          <line>2</line>
        </clef>
      </attributes>
      <direction placement="above">
        <direction-type>
          <metronome>
            <beat-unit>quarter</beat-unit>
            <per-minute>88</per-minute>
          </metronome>
        </direction-type>
      </direction>
      <note>
        <pitch>
          <step>C</step>
          <octave>4</octave>
        </pitch>
        <duration>4</duration>
        <type>whole</type>
      </note>
    </measure>
  </part>
</score-partwise>"#;

    let bpm = extract_bpm_from_musicxml(xml);
    assert_eq!(bpm, 88, "Expected BPM 88 from <metronome> without <sound>");
}

/// Load the actual Arabesque score file and verify it yields 132 BPM
#[test]
fn arabesque_real_file_tempo() {
    use std::io::Read;
    let mxl_path = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../scores/Burgmuller_Arabesque.mxl"
    );
    let file = std::fs::File::open(mxl_path).expect("Cannot open Arabesque file");
    let mut zip = zip::ZipArchive::new(file).expect("Not a zip");
    let mut xml_content = String::new();
    for i in 0..zip.len() {
        let mut f = zip.by_index(i).unwrap();
        if f.name().ends_with(".xml") && !f.name().contains("META-INF") {
            f.read_to_string(&mut xml_content).unwrap();
            break;
        }
    }
    let mut context = ImportContext::new();
    let doc = MusicXMLParser::parse(&xml_content, &mut context).expect("Parse failed");

    // Debug output
    if let Some(part) = doc.parts.first() {
        if let Some(m) = part.measures.first() {
            eprintln!("measure[0].sound_tempo = {:?}", m.sound_tempo);
            eprintln!("measure[0].metronome_tempo = {:?}", m.metronome_tempo);
        }
    }
    eprintln!("doc.default_tempo = {}", doc.default_tempo);

    let score = MusicXMLConverter::convert(doc, &mut context).expect("Convert failed");
    let bpm = score
        .global_structural_events
        .iter()
        .find_map(|ev| {
            if let GlobalStructuralEvent::Tempo(t) = ev {
                Some(t.bpm.value())
            } else {
                None
            }
        })
        .expect("No tempo event");

    assert_eq!(
        bpm, 132,
        "Arabesque should be 132 BPM from metronome marking"
    );
}
