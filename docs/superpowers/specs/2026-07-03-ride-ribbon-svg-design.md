# Ride Ribbon SVG — Design

**Date:** 2026-07-03
**Status:** Approved (step 1 of a larger replication of a cycling-infographic reference image)

## Goal

Replicate the main curving ribbon line and its gradient from a reference cycling
infographic (dark background, thick winding line descending the canvas, colored
cyan → green → yellow → orange → red by altitude). This step covers only the
main line and gradient — no curtain strokes, axis, icons, or callouts yet.

## Decisions

- **Target:** standalone SVG prototype, not a React component yet. Port into the
  app later once it looks right.
- **Curve fidelity:** freehand — same rhythm and vibe as the reference (bottom-left
  entry, sweeps right, climbs with soft S-bends, bulge right at mid-height, sharp
  left hook in the upper third, exit top-right), not a pixel trace.
- **Gradient technique:** single vertical `linearGradient` with
  `gradientUnits="userSpaceOnUse"` applied as the `stroke` of one `<path>`. In the
  reference, color maps to *height* (elevation metaphor), not arc-length, so a
  vertical gradient is exact, keeps the file one element, and the future curtain
  strokes can share the same gradient.
- Rejected: gradient-along-path via chopped segments (heavy, unneeded — color is
  altitude-based); mask over gradient rect (more machinery, only useful for
  textures inside the ribbon later).

## Spec

- File: `frontend/prototypes/ride-ribbon.svg`, self-contained.
- Portrait `viewBox="0 0 550 900"`, background rect `#1a1a1a`.
- One `<path>`: `fill="none"`, `stroke-linecap="round"`, `stroke-linejoin="round"`,
  stroke width ≈ 10, a handful of cubic Béziers following the rhythm above.
- Gradient stops (top → bottom, positioned to echo the reference's altitude bands):
  `#4FD8EB` cyan → `#7ED957` green → `#F7E733` yellow → `#F79B33` orange →
  `#F03A17` red.

## Out of scope (later steps)

Curtain of repeated offset strokes below the line, km axis, cyclist icons,
stat callout bubbles, any animation, React integration.
