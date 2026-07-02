#!/usr/bin/env python3
"""Generates ride-ribbon.svg: a cycling infographic prototype.

A winding "route" line descends the canvas, colored by altitude through a
fixed vertical gradient. Below it hangs a curtain of offset copies,
occlusion-culled so only the stroke from the nearest line section above
survives at any point (no crosshatch where the route doubles back).
"""

import os
from collections import defaultdict

OUT = os.path.join(os.path.dirname(__file__), "ride-ribbon.svg")

# Main route: starts top-right, hooks left, bulges right, calm slope to
# bottom-left. Each entry is one cubic (p0, c1, c2, p1).
SEGS = [
    ((400, 90), (370, 135), (330, 175), (280, 208)),
    ((280, 208), (230, 240), (155, 235), (152, 265)),
    ((152, 265), (150, 295), (235, 302), (285, 332)),
    ((285, 332), (330, 360), (330, 395), (365, 425)),
    ((365, 425), (400, 452), (430, 460), (427, 490)),
    ((427, 490), (423, 520), (370, 525), (352, 555)),
    ((352, 555), (335, 583), (355, 600), (350, 630)),
    ((350, 630), (342, 670), (290, 690), (235, 710)),
    ((235, 710), (185, 728), (130, 738), (95, 748)),
]

PALETTE = [  # altitude gradient, top -> bottom
    (0.00, "#EDBB43"),
    (0.14, "#EE6055"),
    (0.32, "#BE3A38"),
    (0.50, "#C2379B"),
    (0.66, "#8A1FC8"),
    (0.84, "#2823D6"),
    (1.00, "#171655"),
]

N = 48        # samples per cubic; keeps x-gaps under the occlusion bin window
W = 20        # index window treated as "same branch" when looking for occluders
DY = 8        # curtain stroke spacing
MAXDY = 768
GAP = 3       # stop strokes this far above the occluding branch


def cubic(p0, p1, p2, p3, t):
    mt = 1 - t
    x = mt**3 * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t**3 * p3[0]
    y = mt**3 * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t**3 * p3[1]
    return x, y


def sample_path():
    pts = []
    for si, (p0, p1, p2, p3) in enumerate(SEGS):
        start = 0 if si == 0 else 1
        for k in range(start, N + 1):
            pts.append(cubic(p0, p1, p2, p3, k / N))
    return pts


def curtain_paths(pts):
    bins = defaultdict(list)
    for i, (x, y) in enumerate(pts):
        bins[int(x)].append((y, i))

    def next_below(i):
        x, y = pts[i]
        best = None
        for b in range(int(x) - 2, int(x) + 3):
            for (yj, j) in bins.get(b, []):
                if yj > y + 4 and abs(j - i) > W:
                    if best is None or yj < best:
                        best = yj
        return best

    nb = [next_below(i) for i in range(len(pts))]

    polys = []
    for step in range(1, MAXDY // DY + 1):
        dy = step * DY
        run = []
        for i, (x, y) in enumerate(pts):
            if nb[i] is None or y + dy < nb[i] - GAP:
                run.append((x, y + dy))
            else:
                if len(run) > 1:
                    polys.append(run)
                run = []
        if len(run) > 1:
            polys.append(run)
    return polys


def fmt_poly(run):
    return "M" + "L".join(f"{x:.0f} {y:.0f}" for x, y in run)


FONT = "Helvetica Neue, Helvetica, Arial, sans-serif"


def caption(x, y, lines):
    tspans = "".join(
        f'<tspan x="{x}" dy="{0 if i == 0 else 9}">{ln}</tspan>'
        for i, ln in enumerate(lines)
    )
    return (
        f'<text x="{x}" y="{y}" text-anchor="middle" font-family="{FONT}" '
        f'font-size="7" letter-spacing="1.2" fill="#a8a8a8">{tspans}</text>'
    )


def leader(x1, y1, x2, y2):
    return (
        f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#cfcfcf" '
        f'stroke-width="1" stroke-dasharray="0.5 4" stroke-linecap="round"/>'
        f'<circle cx="{x2}" cy="{y2}" r="2.4" fill="none" stroke="#cfcfcf" stroke-width="1"/>'
    )


def callout(cx, cy, glyph, lines, tx, ty):
    """Circle with a glyph, caption below, dotted leader to (tx, ty)."""
    # leader leaves the circle edge toward the target
    import math
    ang = math.atan2(ty - cy, tx - cx)
    sx, sy = cx + 27 * math.cos(ang), cy + 27 * math.sin(ang)
    return (
        f'<g>'
        f'<circle cx="{cx}" cy="{cy}" r="26" fill="#1a1a1a" stroke="#e8e8e8" stroke-width="1.3"/>'
        f'<g transform="translate({cx} {cy})">{glyph}</g>'
        f'{caption(cx, cy + 38, lines)}'
        f'{leader(sx, sy, tx, ty)}'
        f'</g>'
    )


GLYPH_WATTS = (
    '<text y="-4" text-anchor="middle" font-family="' + FONT + '" font-size="10" '
    'font-weight="600" fill="#fff">220</text>'
    + "".join(
        f'<rect x="{-7 + c * 5}" y="{2 + r * 5}" width="3.4" height="3.4" fill="#fff"/>'
        for r in range(2) for c in range(3)
    )
)
GLYPH_DIST = (
    '<text y="1" text-anchor="middle" font-family="' + FONT + '" font-size="11" '
    'font-weight="600" fill="#fff">32</text>'
    '<text y="10" text-anchor="middle" font-family="' + FONT + '" font-size="7" '
    'fill="#fff">km</text>'
)
GLYPH_SPEED = (
    '<path d="M -11 6 A 12 12 0 1 1 11 6" fill="none" stroke="#fff" stroke-width="3" '
    'stroke-linecap="round"/>'
    '<line x1="0" y1="0" x2="-6" y2="-8" stroke="#fff" stroke-width="2" stroke-linecap="round"/>'
    '<text y="14" text-anchor="middle" font-family="' + FONT + '" font-size="7" '
    'font-weight="600" fill="#fff">45 KPH</text>'
)
GLYPH_GRADE = (
    '<text y="-2" text-anchor="middle" font-family="' + FONT + '" font-size="9" '
    'font-weight="600" fill="#fff">6.1%</text>'
    '<path d="M -8 10 L 8 10 L 8 3 Z" fill="#fff"/>'
)
GLYPH_HEART = (
    '<path d="M 0 -2 C 0 -7 -8 -7 -8 -1 C -8 4 -3 7 0 10 C 3 7 8 4 8 -1 C 8 -7 0 -7 0 -2 Z" '
    'fill="#fff"/>'
)
GLYPH_CADENCE = (
    '<path d="M -8 -5 A 9.5 9.5 0 0 1 8 -5" fill="none" stroke="#fff" stroke-width="2" '
    'stroke-linecap="round"/>'
    '<path d="M 8 5 A 9.5 9.5 0 0 1 -8 5" fill="none" stroke="#fff" stroke-width="2" '
    'stroke-linecap="round"/>'
    '<path d="M 8 -9 L 8 -5 L 4 -4 Z" fill="#fff"/>'
    '<path d="M -8 9 L -8 5 L -4 4 Z" fill="#fff"/>'
)

CYCLIST = (
    '<g id="cyclist" fill="none" stroke="#141414" stroke-width="1.4" stroke-linecap="round">'
    '<circle cx="5" cy="11" r="3.6"/>'
    '<circle cx="19" cy="11" r="3.6"/>'
    '<path d="M5 11 L9.5 5.5 L15.5 5.5 L19 11 M12.5 11 L9.5 5.5"/>'
    '<path d="M9.5 5.5 C10.5 1.5, 14 0.5, 15.7 3.2" stroke-width="2.2"/>'
    '<circle cx="16.6" cy="1.4" r="2" fill="#EDBB43" stroke="none"/>'
    '</g>'
)


def cyclist_at(x, y, angle):
    return f'<use href="#cyclist" transform="translate({x} {y}) rotate({angle}) translate(-12 -14.5)"/>'


def axis():
    """45 KM at the line's top (y=90) down to 5 KM near the base; 16 px per km."""
    parts = [
        '<g stroke="#555" stroke-width="0.8">',
        '<line x1="64" y1="82" x2="64" y2="740"/>',
    ]
    for km in range(5, 46):
        y = 90 + (45 - km) * 16
        w = 7 if km % 5 == 0 else 3.5
        parts.append(f'<line x1="64" y1="{y}" x2="{64 + w}" y2="{y}"/>')
    parts.append("</g>")
    for km in range(5, 46, 5):
        y = 90 + (45 - km) * 16
        parts.append(
            f'<text x="58" y="{y + 2.5}" text-anchor="end" font-family="{FONT}" '
            f'font-size="8" letter-spacing="0.8" fill="#999">{km} KM</text>'
        )
    return "\n  ".join(parts)


def build():
    pts = sample_path()
    polys = curtain_paths(pts)
    curtain = "\n    ".join(f'<path d="{fmt_poly(r)}"/>' for r in polys)
    path_d = "M 400 90 " + " ".join(
        f"C {p1[0]} {p1[1]}, {p2[0]} {p2[1]}, {p3[0]} {p3[1]}"
        for (_, p1, p2, p3) in SEGS
    )
    stops = "\n      ".join(
        f'<stop offset="{off}" stop-color="{col}"/>' for off, col in PALETTE
    )

    callouts = "\n  ".join([
        callout(470, 120, GLYPH_WATTS, ["WATTS GENERATED", "ON RIDE"], 406, 93),
        callout(470, 290, GLYPH_DIST, ["TOTAL DISTANCE", "BIKED"], 162, 266),
        callout(470, 450, GLYPH_SPEED, ["WEEKLY ELEVATION", "TARGET MET"], 434, 478),
        callout(470, 600, GLYPH_GRADE, ["HIGHEST ELEVATION", "GRADE"], 357, 601),
        callout(470, 745, GLYPH_HEART, ["HEART-RATE GOAL", "ACHIEVED"], 222, 713),
        callout(140, 150, GLYPH_CADENCE, ["CADENCE INTERVAL", "RECORD"], 293, 194),
    ])

    cyclists = "\n  ".join([
        cyclist_at(398, 91, -35),
        cyclist_at(302, 352, 30),
        cyclist_at(140, 742, 10),
    ])

    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 550 900">
  <defs>
    <!-- Color encodes altitude: fixed in canvas space so curtain strokes
         shift through the palette as they fall. -->
    <linearGradient id="altitude" gradientUnits="userSpaceOnUse" x1="0" y1="80" x2="0" y2="820">
      {stops}
    </linearGradient>
    <!-- Elliptical bottom boundary: the curtain ends in a drum-like base. -->
    <clipPath id="drum">
      <path d="M -20 -20 H 570 V 720
               C 500 750, 420 845, 270 850
               C 160 853, 45 800, -20 750 Z"/>
    </clipPath>
    {CYCLIST}
  </defs>

  <rect width="550" height="900" fill="#1a1a1a"/>

  {axis()}

  <!-- Curtain: offsets of the main curve, occlusion-culled so only the stroke
       hanging from the nearest line section above survives. -->
  <g clip-path="url(#drum)" fill="none" stroke="url(#altitude)" stroke-width="1.8"
     stroke-linecap="round">
    {curtain}
  </g>

  <path d="{path_d}" fill="none" stroke="url(#altitude)" stroke-width="12"
        stroke-linecap="round" stroke-linejoin="round"/>

  {cyclists}

  {callouts}
</svg>
'''


if __name__ == "__main__":
    svg = build()
    with open(OUT, "w") as f:
        f.write(svg)
    print(f"wrote {OUT} ({len(svg) // 1024} KB)")
