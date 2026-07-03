# Ride Ribbon Ranking Panel — Design

**Date:** 2026-07-03
**Status:** Approved
**Builds on:** `2026-07-03-ride-ribbon-svg-design.md` (the standalone prototype in
`frontend/prototypes/ride-ribbon.svg` / `ride_ribbon_gen.py`)

## Goal

Replace the bar-chart graphic in the first "Los datos están para usarlos" panel
(`RankingsPanel`, next to "Visita nuestro ranking de ciudades") with the glassy
ride-ribbon animation, turned into a city-ranking visualization: cities from the
DB are placed on the main path according to their infrastructure coverage, with
a right-aligned label list and leader lines to their positions on the path.

## Decisions

- **Metric:** `coverage` (infrastructure coverage, %). Displayed with
  `formatPercentage`, axis meaning: higher coverage = higher on the path.
- **Cities:** sample 10 — sort cities with non-null `coverage`, then pick 10
  spread evenly across the sorted list, always including the best and the worst.
  If 10 or fewer have coverage, show all.
- **Score → position:** linear map of coverage onto the main path's vertical
  extent: worst sampled coverage → path bottom (y = 748), best → path top
  (y = 90). The path is monotonic in y, so each y resolves to a unique point;
  x comes from the sampled polyline (nearest sample by y).
- **Labels:** evenly spaced column on the right, right-anchored names with the
  coverage value; thin dotted leader line from each label to a small marker dot
  on the main path. Even spacing keeps clustered cities readable — the fan of
  leader lines encodes the real score gaps.
- **Geometry at runtime, not baked:** the Python generator's math (cubic
  sampling, occlusion-culled curtain) is ported to a TS util and computed on
  mount (a few ms) instead of shipping ~300 KB of baked path strings.

## Components

- `frontend/src/components/landing/showcase/rideRibbon.ts` — geometry util:
  `SEGS`, `PALETTE`, `samplePath()`, `curtainSteps()` (occlusion cull, grouped
  by offset step for the ripple), `pointAtY(y)`, `yForScore(score, min, max)`.
  Unit-tested (vitest): y-monotonicity of samples, `pointAtY` accuracy against
  known curve points, culled strokes never sit below an occluding branch,
  score mapping endpoints.
- `frontend/src/components/landing/showcase/RideRibbonRanking.tsx` — one SVG,
  viewBox ~720×900: curtain groups with staggered CSS ripple (24 ms/step,
  3.2 s cycle, `prefers-reduced-motion` disables), glass main line (blurred
  navy shadow + 92 %-opacity gradient stroke), diagonal sheen, drum clip —
  all as in the prototype but over the transparent card (card is already
  cream). Right column (x ≈ 560–700): city labels + leader lines + marker
  dots. Font: EB Garamond, colors from theme tokens.
- `RankingsPanel.tsx` — swap `RankingsChart` for `RideRibbonRanking`; keep
  `fetchCities()` flow, eyebrow/title/body/CTA. Sub-label becomes
  "Cobertura de infraestructura · %". Taller `graphicCardStyle` override since
  the ribbon is portrait. Loading state: render the ribbon without labels
  until cities arrive (ribbon itself needs no data).

## Error handling

- Fetch failure or no cities with coverage: ribbon renders alone, no labels
  (same graceful degradation as the current chart's silent catch).
- Cities with equal min/max coverage (degenerate range): place all at the
  path midpoint rather than dividing by zero.

## Out of scope

Prototype files stay as-is; axis/callouts/cyclists from the reference image;
mobile-specific redesign beyond the card's natural full-width stacking.
