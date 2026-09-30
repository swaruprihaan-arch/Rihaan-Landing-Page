#!/usr/bin/env python3
"""Embed Orbit Sans and Orbit Display into index.html as base64 @font-face data URLs.

The poster kit's PROMPT.md says to pull the two faces out of the original
index.html, but that file was not included. Run this once you have either
the original file or the two TrueType files:

  python3 embed-fonts.py --from-html /path/to/original/index.html
  python3 embed-fonts.py --sans OrbitSans.ttf --display OrbitDisplay.ttf

It rewrites the `src:` line of each @font-face block in ./index.html and
./css/site.css in place.
"""
import argparse
import base64
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
TARGETS = [HERE / "index.html", HERE / "css" / "site.css"]
FAMILIES = ("Orbit Sans", "Orbit Display")


def fonts_from_html(path: str) -> dict:
    text = pathlib.Path(path).read_text(encoding="utf-8", errors="ignore")
    found = {}
    for block in re.findall(r"@font-face\s*\{[^}]*\}", text, flags=re.S):
        fam = re.search(r"""font-family\s*:\s*["']?([^"';]+)""", block)
        data = re.search(r"""url\(\s*["']?(data:[^)"']+)""", block)
        if fam and data and fam.group(1).strip() in FAMILIES:
            found[fam.group(1).strip()] = data.group(1)
    return found


def font_from_ttf(path: str) -> str:
    raw = pathlib.Path(path).read_bytes()
    return "data:font/ttf;base64," + base64.b64encode(raw).decode("ascii")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--from-html", help="original index.html that already embeds both faces")
    ap.add_argument("--sans", help="Orbit Sans .ttf")
    ap.add_argument("--display", help="Orbit Display .ttf")
    args = ap.parse_args()

    fonts = {}
    if args.from_html:
        fonts.update(fonts_from_html(args.from_html))
    if args.sans:
        fonts["Orbit Sans"] = font_from_ttf(args.sans)
    if args.display:
        fonts["Orbit Display"] = font_from_ttf(args.display)

    missing = [f for f in FAMILIES if f not in fonts]
    if missing:
        sys.exit("No font data for: " + ", ".join(missing))

    for target in TARGETS:
        html = target.read_text(encoding="utf-8")
        for fam, data in fonts.items():
            pattern = re.compile(
                r'(@font-face\s*\{[^}]*?font-family:\s*"' + re.escape(fam) + r'"[^}]*?src:\s*)[^;]+;',
                re.S,
            )
            html, count = pattern.subn(lambda m, d=data: m.group(1) + "url(" + d + ') format("truetype");', html)
            if count != 1:
                sys.exit(f"Expected exactly one @font-face block for {fam} in {target.name}, found {count}")
        target.write_text(html, encoding="utf-8")
        print("Embedded " + ", ".join(fonts) + " into " + str(target))


if __name__ == "__main__":
    main()
