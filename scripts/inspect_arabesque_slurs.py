#!/usr/bin/env python3
"""Inspect slur structure in Burgmuller Arabesque MusicXML."""
import zipfile
import xml.etree.ElementTree as ET

with zipfile.ZipFile("scores/Burgmuller_Arabesque.mxl") as z:
    for name in z.namelist():
        if name.endswith(".xml"):
            with z.open(name) as f:
                tree = ET.parse(f)
                root = tree.getroot()
                ns = ""
                if root.tag.startswith("{"):
                    ns = root.tag.split("}")[0] + "}"

                for i, part in enumerate(root.findall(f"{ns}part")):
                    if i > 0:
                        break
                    print(f"Part {part.get('id')} (first staff):")
                    for measure in list(part.findall(f"{ns}measure"))[:20]:
                        mnum = measure.get("number")
                        slurs = []
                        for note in measure.findall(f"{ns}note"):
                            for notations in note.findall(f"{ns}notations"):
                                for slur in notations.findall(f"{ns}slur"):
                                    stype = slur.get("type")
                                    snum = slur.get("number", "1")
                                    pitch = note.find(f"{ns}pitch")
                                    if pitch is not None:
                                        step = pitch.find(f"{ns}step").text
                                        octave = pitch.find(f"{ns}octave").text
                                        pname = f"{step}{octave}"
                                    else:
                                        pname = "R"
                                    slurs.append(f"{stype}({snum})@{pname}")
                        if slurs:
                            print(f"  m.{mnum}: {', '.join(slurs)}")
                        else:
                            print(f"  m.{mnum}: (no slurs)")
            break
