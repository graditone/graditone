#!/usr/bin/env python3
"""Inspect M2 slur data from Nocturne MusicXML."""
import zipfile
import xml.etree.ElementTree as ET

with zipfile.ZipFile("scores/Chopin_NocturneOp9No2.mxl") as z:
    for name in z.namelist():
        if name == "score.xml":
            root = ET.parse(z.open(name)).getroot()
            ns = ""
            if root.tag.startswith("{"):
                ns = root.tag.split("}")[0] + "}"
            for part in root.findall(f"{ns}part"):
                if part.get("id") != "P1":
                    continue
                for measure in part.findall(f"{ns}measure"):
                    mnum = measure.get("number")
                    if mnum not in ("1", "2", "3"):
                        continue
                    print(f"\n=== M{mnum} P1 ===")
                    for note in measure.findall(f"{ns}note"):
                        pitch = note.find(f"{ns}pitch")
                        rest = note.find(f"{ns}rest")
                        voice = note.find(f"{ns}voice")
                        staff = note.find(f"{ns}staff")
                        dur = note.find(f"{ns}duration")
                        ntype = note.find(f"{ns}type")
                        slurs = note.findall(f".//{ns}slur")
                        stem = note.find(f"{ns}stem")
                        
                        if pitch is not None:
                            step = pitch.find(f"{ns}step").text
                            octave = pitch.find(f"{ns}octave").text
                            alter = pitch.find(f"{ns}alter")
                            alter_v = alter.text if alter is not None else "0"
                            p_str = f"{step}{octave} alter={alter_v}"
                        elif rest is not None:
                            p_str = "REST"
                        else:
                            p_str = "???"
                        
                        v = voice.text if voice is not None else "?"
                        s = staff.text if staff is not None else "?"
                        d = dur.text if dur is not None else "?"
                        t = ntype.text if ntype is not None else "NONE"
                        st = stem.text if stem is not None else "?"
                        
                        slur_info = ""
                        for sl in slurs:
                            attrs = []
                            for a in ("type", "number", "placement", "bezier-y", "default-y"):
                                val = sl.get(a)
                                if val is not None:
                                    attrs.append(f"{a}={val}")
                            slur_info += f" slur({', '.join(attrs)})"
                        
                        chord = note.find(f"{ns}chord")
                        chord_str = " [CHORD]" if chord is not None else ""
                        
                        print(f"  {p_str} v={v} s={s} dur={d} type={t} stem={st}{chord_str}{slur_info}")
            break
