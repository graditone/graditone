#!/usr/bin/env python3
import zipfile
import xml.etree.ElementTree as ET

with zipfile.ZipFile("scores/Chopin_NocturneOp9No2.mxl") as z:
    for name in z.namelist():
        if name.endswith(".xml"):
            tree = ET.parse(z.open(name))
            root = tree.getroot()
            ns = ""
            if root.tag.startswith("{"):
                ns = root.tag.split("}")[0] + "}"
            parts = root.findall(f"{ns}part")
            for part in parts:
                measures = part.findall(f"{ns}measure")
                m2 = measures[1]
                print("=== M2 ===")
                for note in m2.findall(f"{ns}note"):
                    staff = note.findtext(f"{ns}staff", "?")
                    voice = note.findtext(f"{ns}voice", "?")
                    pitch_el = note.find(f"{ns}pitch")
                    pname = ""
                    if pitch_el is not None:
                        step = pitch_el.findtext(f"{ns}step", "")
                        octave = pitch_el.findtext(f"{ns}octave", "")
                        pname = step + octave
                    artic = note.find(f"{ns}notations/{ns}articulations")
                    has_stac = artic is not None and artic.find(f"{ns}staccato") is not None
                    if has_stac:
                        stac_el = artic.find(f"{ns}staccato")
                        placement = stac_el.get("placement", "NONE")
                        stem = note.findtext(f"{ns}stem", "NONE")
                        dur = note.findtext(f"{ns}duration", "?")
                        beam_els = note.findall(f"{ns}beam")
                        beams = [(b.get("number"), b.text) for b in beam_els]
                        print(f"  staff={staff} voice={voice} pitch={pname} stem={stem} dur={dur} beams={beams} STACCATO placement={placement}")
                break
