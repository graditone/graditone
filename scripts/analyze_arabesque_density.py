#!/usr/bin/env python3
"""Quick diagnostic: compute note density for Arabesque regions to understand difficulty."""
import zipfile
import xml.etree.ElementTree as ET


def analyze():
    with zipfile.ZipFile("scores/Burgmuller_Arabesque.mxl") as z:
        with z.open("score.xml") as f:
            tree = ET.parse(f)

    root = tree.getroot()
    ns = ""
    if root.tag.startswith("{"):
        ns = root.tag.split("}")[0] + "}"

    part = root.findall(f"{ns}part")[0]
    measures = list(part.findall(f"{ns}measure"))

    # Count pitch notes per measure per staff
    print(f"Total measures: {len(measures)}")
    print(f"\n{'Measure':>7} | {'S1 notes':>8} | {'S2 notes':>8} | {'S1 rests':>8}")
    print("-" * 45)

    for m in measures:
        mn = int(m.get("number"))
        s1_notes = 0
        s2_notes = 0
        s1_rests = 0
        for n in m.findall(f"{ns}note"):
            staff_el = n.find(f"{ns}staff")
            staff = staff_el.text if staff_el is not None else "1"
            is_rest = n.find(f"{ns}rest") is not None
            is_chord = n.find(f"{ns}chord") is not None
            if is_chord:
                continue  # chords count as polyphony, not separate density

            if staff == "1":
                if is_rest:
                    s1_rests += 1
                else:
                    s1_notes += 1
            elif staff == "2":
                if not is_rest:
                    s2_notes += 1

        print(f"  m.{mn:>3} | {s1_notes:>8} | {s2_notes:>8} | {s1_rests:>8}")

    # The density-rate formula is approximately:
    # notes_per_beat = pitch_count / (bar_duration_ticks / 960)
    # For 2/4 time: bar_duration = 2 beats
    # So density ~= pitch_count / 2

    print("\n=== Approximate density rates (notes/beat) per measure ===")
    print("Time sig: 2/4, so 2 beats per bar")
    print(f"\n{'Measure':>7} | {'S1 d/beat':>9} | {'S2 d/beat':>9}")
    print("-" * 35)

    for m in measures:
        mn = int(m.get("number"))
        s1_pitch = 0
        s2_pitch = 0
        for n in m.findall(f"{ns}note"):
            staff_el = n.find(f"{ns}staff")
            staff = staff_el.text if staff_el is not None else "1"
            is_rest = n.find(f"{ns}rest") is not None
            is_chord = n.find(f"{ns}chord") is not None

            if not is_rest and not is_chord:
                if staff == "1":
                    s1_pitch += 1
                elif staff == "2":
                    s2_pitch += 1

        s1_dpb = s1_pitch / 2.0
        s2_dpb = s2_pitch / 2.0
        print(f"  m.{mn:>3} | {s1_dpb:>9.1f} | {s2_dpb:>9.1f}")


if __name__ == "__main__":
    analyze()
