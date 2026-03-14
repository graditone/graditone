#!/usr/bin/env python3
"""
Generate MusicXML (.mxl) scale files for all major and natural minor scales.

Each file contains both octaves (C4 ascending/descending + C5 ascending/descending)
in a single score (8 measures total).

Output: scores/scales/{24 files}
  - 12 major scales = 12 files
  - 12 natural minor scales = 12 files

Run from repo root:
  python3 scripts/generate_scales.py

Feature 001: Scales Generation
"""

import io
import os
import zipfile
from pathlib import Path

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11, 12]   # W-W-H-W-W-W-H
MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10, 12]    # W-H-W-W-H-W-W (natural minor)

# Circle of fifths order: (file_root, display_root, fifths_value)
MAJOR_SCALES_COF = [
    ("C",  "C",   0),
    ("G",  "G",   1),
    ("D",  "D",   2),
    ("A",  "A",   3),
    ("E",  "E",   4),
    ("B",  "B",   5),
    ("Fs", "F#",  6),
    ("Db", "D\u266d", -5),
    ("Ab", "A\u266d", -4),
    ("Eb", "E\u266d", -3),
    ("Bb", "B\u266d", -2),
    ("F",  "F",  -1),
]

MINOR_SCALES_COF = [
    ("C",  "C",   -3),
    ("G",  "G",   -2),
    ("D",  "D",   -1),
    ("A",  "A",    0),
    ("E",  "E",    1),
    ("B",  "B",    2),
    ("Fs", "F#",   3),
    ("Cs", "C#",   4),
    ("Gs", "G#",   5),
    ("Ds", "D#",   6),
    ("Bb", "B\u266d", -5),
    ("F",  "F",   -4),
]

# Semitone offset from C for each file_root key
ROOT_SEMITONES: dict[str, int] = {
    "C": 0, "Cs": 1, "Db": 1, "D": 2, "Ds": 3, "Eb": 3,
    "E": 4, "F": 5, "Fs": 6, "Gb": 6, "G": 7, "Gs": 8,
    "Ab": 8, "A": 9, "As": 10, "Bb": 10, "B": 11,
}

# Semitone → (step, alter) for sharp keys (fifths >= 0)
_SHARP_SPELLING = {
    0:  ("C",  0),
    1:  ("C",  1),   # C#
    2:  ("D",  0),
    3:  ("D",  1),   # D#
    4:  ("E",  0),
    5:  ("F",  0),
    6:  ("F",  1),   # F#
    7:  ("G",  0),
    8:  ("G",  1),   # G#
    9:  ("A",  0),
    10: ("A",  1),   # A#
    11: ("B",  0),
}

# Semitone → (step, alter) for flat keys (fifths < 0)
_FLAT_SPELLING = {
    0:  ("C",  0),
    1:  ("D", -1),   # Db
    2:  ("D",  0),
    3:  ("E", -1),   # Eb
    4:  ("E",  0),
    5:  ("F",  0),
    6:  ("G", -1),   # Gb
    7:  ("G",  0),
    8:  ("A", -1),   # Ab
    9:  ("A",  0),
    10: ("B", -1),   # Bb
    11: ("B",  0),
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def chromatic_step(semitone: int, fifths: int) -> tuple[str, int]:
    """Return (step, alter) for a semitone (0-11) given the key fifths value."""
    table = _FLAT_SPELLING if fifths < 0 else _SHARP_SPELLING
    return table[semitone % 12]


def note_xml(step: str, octave: int, alter: int) -> str:
    """Return a MusicXML <note> fragment for a quarter note."""
    alter_xml = f"<alter>{alter}</alter>" if alter != 0 else ""
    return (
        f"<note>"
        f"<pitch><step>{step}</step>{alter_xml}<octave>{octave}</octave></pitch>"
        f"<duration>1</duration>"
        f"<type>quarter</type>"
        f"</note>"
    )


def build_scale_notes(root_midi: int, intervals: list[int], fifths: int) -> list[str]:
    """
    Build a list of 16 MusicXML <note> elements:
      8 ascending (root → octave) + 8 descending (octave → root).
    """
    ascending_midi = [root_midi + i for i in intervals]          # 8 notes incl. octave
    descending_midi = list(reversed(ascending_midi))             # 8 notes octave → root

    notes = []
    for midi in ascending_midi + descending_midi:
        octave = midi // 12 - 1
        semitone = midi % 12
        step, alter = chromatic_step(semitone, fifths)
        notes.append(note_xml(step, octave, alter))
    return notes


def build_score_xml(
    title: str,
    fifths: int,
    mode: str,
    notes: list[str],
) -> str:
    """
    Build a complete score-partwise MusicXML string.
    4/4 time, quarter notes, single part, treble clef.
    Number of measures is derived from len(notes) // 4.
    """
    return build_multisection_score_xml(title, [((fifths, mode), notes)])


def build_multisection_score_xml(
    title: str,
    sections: list[tuple[tuple[int, str], list[str]]],
) -> str:
    """
    Build a score containing multiple sections, each with its own key signature.
    sections: list of ((fifths, mode), notes) pairs.
    Each section contributes len(notes)//4 measures; the first measure of each
    section emits a key-change <attributes> element.
    """
    measures = []
    measure_num = 1
    for section_index, ((fifths, mode), notes) in enumerate(sections):
        num_measures = len(notes) // 4
        for m in range(num_measures):
            bar_notes = "".join(notes[m * 4 : (m + 1) * 4])
            if section_index == 0 and m == 0:
                # First measure ever: full attributes block
                attrs = (
                    "<attributes>"
                    "<divisions>1</divisions>"
                    f"<key><fifths>{fifths}</fifths><mode>{mode}</mode></key>"
                    "<time><beats>4</beats><beat-type>4</beat-type></time>"
                    "<clef><sign>G</sign><line>2</line></clef>"
                    "</attributes>"
                )
            elif m == 0:
                # First measure of a subsequent section: key change only
                attrs = (
                    "<attributes>"
                    f"<key><fifths>{fifths}</fifths><mode>{mode}</mode></key>"
                    "</attributes>"
                )
            else:
                attrs = ""
            measures.append(
                f'<measure number="{measure_num}">{attrs}{bar_notes}</measure>'
            )
            measure_num += 1

    part_xml = '<part id="P1">' + "".join(measures) + "</part>"
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN"'
        ' "http://www.musicxml.org/dtds/partwise.dtd">'
        '<score-partwise version="4.0">'
        "<work><work-title>" + title + "</work-title></work>"
        "<part-list>"
        '<score-part id="P1"><part-name>Scale</part-name></score-part>'
        "</part-list>"
        + part_xml
        + "</score-partwise>"
    )


def write_mxl(output_path: Path, score_xml: str) -> None:
    """Write a .mxl file (ZIP containing META-INF/container.xml + score.xml)."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        container = (
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<container>'
            '<rootfiles>'
            '<rootfile full-path="score.xml"'
            ' media-type="application/vnd.recordare.musicxml+xml"/>'
            '</rootfiles>'
            '</container>'
        )
        zf.writestr("META-INF/container.xml", container)
        zf.writestr("score.xml", score_xml)
    output_path.write_bytes(buf.getvalue())


# ---------------------------------------------------------------------------
# Scale generators
# ---------------------------------------------------------------------------

def generate_major_scale(
    file_root: str,
    display_root: str,
    fifths: int,
    output_dir: Path,
) -> None:
    """Generate one .mxl covering oct4 then oct5 (8 measures total)."""
    semitone = ROOT_SEMITONES[file_root]
    notes = (
        build_scale_notes(60 + semitone, MAJOR_INTERVALS, fifths)  # C4 base
        + build_scale_notes(72 + semitone, MAJOR_INTERVALS, fifths)  # C5 base
    )
    xml = build_score_xml(f"{display_root} Major", fifths, "major", notes)
    write_mxl(output_dir / f"{file_root}_major.mxl", xml)


def generate_minor_scale(
    file_root: str,
    display_root: str,
    fifths: int,
    output_dir: Path,
) -> None:
    """Generate one .mxl covering oct4 then oct5 (8 measures total)."""
    semitone = ROOT_SEMITONES[file_root]
    notes = (
        build_scale_notes(60 + semitone, MINOR_INTERVALS, fifths)  # C4 base
        + build_scale_notes(72 + semitone, MINOR_INTERVALS, fifths)  # C5 base
    )
    xml = build_score_xml(f"{display_root} Minor", fifths, "minor", notes)
    write_mxl(output_dir / f"{file_root}_minor.mxl", xml)


def generate_all_major_scales(output_dir: Path) -> None:
    """Generate one .mxl with all 12 major scales in circle-of-fifths order.

    Each scale occupies 8 measures (oct4 asc/desc + oct5 asc/desc).
    A key-change attribute is emitted at the start of each new scale.
    """
    sections: list[tuple[tuple[int, str], list[str]]] = []
    for file_root, _display_root, fifths in MAJOR_SCALES_COF:
        semitone = ROOT_SEMITONES[file_root]
        notes = (
            build_scale_notes(60 + semitone, MAJOR_INTERVALS, fifths)
            + build_scale_notes(72 + semitone, MAJOR_INTERVALS, fifths)
        )
        sections.append(((fifths, "major"), notes))
    xml = build_multisection_score_xml("All Major Scales", sections)
    write_mxl(output_dir / "All_major_scales.mxl", xml)


def generate_all_minor_scales(output_dir: Path) -> None:
    """Generate one .mxl with all 12 natural minor scales in circle-of-fifths order.

    Each scale occupies 8 measures (oct4 asc/desc + oct5 asc/desc).
    A key-change attribute is emitted at the start of each new scale.
    """
    sections: list[tuple[tuple[int, str], list[str]]] = []
    for file_root, _display_root, fifths in MINOR_SCALES_COF:
        semitone = ROOT_SEMITONES[file_root]
        notes = (
            build_scale_notes(60 + semitone, MINOR_INTERVALS, fifths)
            + build_scale_notes(72 + semitone, MINOR_INTERVALS, fifths)
        )
        sections.append(((fifths, "minor"), notes))
    xml = build_multisection_score_xml("All Minor Scales", sections)
    write_mxl(output_dir / "All_minor_scales.mxl", xml)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    repo_root = Path(__file__).parent.parent
    output_dir = repo_root / "scores" / "scales"
    output_dir.mkdir(parents=True, exist_ok=True)

    count = 0
    for file_root, display_root, fifths in MAJOR_SCALES_COF:
        generate_major_scale(file_root, display_root, fifths, output_dir)
        count += 1

    for file_root, display_root, fifths in MINOR_SCALES_COF:
        generate_minor_scale(file_root, display_root, fifths, output_dir)
        count += 1

    generate_all_major_scales(output_dir)
    generate_all_minor_scales(output_dir)
    count += 2

    print(f"Generated {count} scale files in {output_dir}")


if __name__ == "__main__":
    main()
