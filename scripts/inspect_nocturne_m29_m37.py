#!/usr/bin/env python3
"""Inspect Chopin Nocturne Op.9 No.2 MusicXML measures M29-M37."""
import zipfile
import xml.etree.ElementTree as ET

mxl_path = "scores/Chopin_NocturneOp9No2.mxl"

with zipfile.ZipFile(mxl_path) as z:
    tree = ET.parse(z.open("score.xml"))
    root = tree.getroot()

parts = root.findall("part")
if not parts:
    print("No parts found")
    exit(1)

part = parts[0]
measures = part.findall("measure")
print(f"Total measures: {len(measures)}")

for m in measures:
    num = m.get("number")
    if num and int(num) in range(29, 38):
        print(f"\n{'='*60}")
        print(f"=== Measure {num} ===")
        print(f"{'='*60}")

        # Look for key elements
        for note in m.findall("note"):
            pitch = note.find("pitch")
            rest = note.find("rest")
            voice = note.find("voice")
            voice_text = voice.text if voice is not None else "?"

            if rest is not None:
                dur = note.find("type")
                dur_text = dur.text if dur is not None else "?"
                print(f"  REST voice={voice_text} type={dur_text}")

            if pitch is not None:
                step = pitch.find("step").text
                octave = pitch.find("octave").text
                alter_el = pitch.find("alter")
                alter = alter_el.text if alter_el is not None else "0"
                accidental = note.find("accidental")
                acc_text = accidental.text if accidental is not None else None
                dur = note.find("type")
                dur_text = dur.text if dur is not None else "?"
                print(f"  NOTE {step}{alter}/{octave} voice={voice_text} type={dur_text} accidental={acc_text}")

        # Look for direction elements (octave-shift, etc.)
        for direction in m.findall("direction"):
            for dt in direction.findall("direction-type"):
                octave_shift = dt.find("octave-shift")
                if octave_shift is not None:
                    otype = octave_shift.get("type")
                    size = octave_shift.get("size", "?")
                    print(f"  OCTAVE-SHIFT type={otype} size={size}")
                words = dt.find("words")
                if words is not None and words.text:
                    print(f"  WORDS: {words.text}")

        # Look for barline
        for barline in m.findall("barline"):
            loc = barline.get("location", "?")
            print(f"  BARLINE location={loc}")

        # Slurs
        for note in m.findall("note"):
            notations = note.find("notations")
            if notations is not None:
                for slur in notations.findall("slur"):
                    stype = slur.get("type")
                    snum = slur.get("number", "1")
                    placement = slur.get("placement", "?")
                    print(f"  SLUR type={stype} number={snum} placement={placement}")
