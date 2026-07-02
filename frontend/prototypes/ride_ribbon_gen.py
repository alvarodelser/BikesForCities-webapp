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
  </defs>

  <rect width="550" height="900" fill="#1a1a1a"/>

  <!-- Curtain: offsets of the main curve, occlusion-culled so only the stroke
       hanging from the nearest line section above survives. -->
  <g clip-path="url(#drum)" fill="none" stroke="url(#altitude)" stroke-width="1.8"
     stroke-linecap="round">
    {curtain}
  </g>

  <path d="{path_d}" fill="none" stroke="url(#altitude)" stroke-width="12"
        stroke-linecap="round" stroke-linejoin="round"/>

</svg>
'''


if __name__ == "__main__":
    svg = build()
    with open(OUT, "w") as f:
        f.write(svg)
    print(f"wrote {OUT} ({len(svg) // 1024} KB)")
