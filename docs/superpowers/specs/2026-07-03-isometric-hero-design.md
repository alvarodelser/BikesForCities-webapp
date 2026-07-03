# Isometric WebGL Hero — "Painting the Lane"

**Date:** 2026-07-03
**Status:** Approved
**Replaces:** the full-screen `LandingReveal` intro overlay AND the current hero visuals. The isometric scene *is* the hero.

## Goal

On page load, the B4C bike logo draws itself, descends with physics into an
isometric night-city scene, lands on a red bike lane, and rides forever —
painting the lane just ahead of itself while glass buildings stream past and
pulse green as the bike passes them. Reference: dark teal isometric
illustration with a diagonal red lane, flat cream bike, and glowing teal
building prisms.

## Decisions

| Decision | Choice |
|---|---|
| Tech | Plain Three.js (`three@0.180`, already a dependency; no react-three-fiber) |
| Looping | Forever (render loop pauses when tab hidden / hero off-screen — no UX difference) |
| Palette | Dark like the reference: deep teal background, `--red` lane, cream bike, teal→green glass |
| Text layout | Headline + CTA overlaid on the full-bleed scene, text weighted left, action center-right |
| Bike representation | Flat glowing plane inside the WebGL scene (CanvasTexture of the logo strokes) |
| Intro replay | Descent plays on every load (short, non-blocking) |
| Fallbacks | Reduced motion → single static render; no WebGL → CSS/SVG poster |

## Architecture

`LandingReveal.tsx` full-screen overlay is removed. `RevealContext` is kept:
`HeroScene` flips `revealed` at bike touchdown, so the existing headline
clip-path and CTA transitions in `HeroSection` keep working.

New directory `frontend/src/components/landing/hero3d/`:

| File | Responsibility |
|---|---|
| `HeroScene.tsx` | React wrapper: canvas mount/unmount, resize, tab-visibility + IntersectionObserver pause, flips `revealed` on landing, chooses fallback path |
| `scene.ts` | Renderer, orthographic isometric camera, lights, `EffectComposer` + `UnrealBloomPass`, pixel ratio capped at 2 |
| `bike.ts` | Bike plane with CanvasTexture stroke-draw; descent physics; landing squash/stretch |
| `lane.ts` | Red lane strip with `Reflector` planar reflection; landing ring ripple; fixed leading edge |
| `buildings.ts` | Building meshes, glass materials, spawn/recycle pool, pulse animation |
| `buildings.logic.ts` | Pure logic (spawn cadence, z-crossing pulse trigger, pool recycling) — unit-testable without WebGL |
| `physics.ts` | Pure gravity + bounce-decay step for the descent — unit-testable |

`HeroSection.tsx` is rewritten: full-bleed dark section hosting the canvas,
headline/CTA absolutely positioned on top, text color flipped to cream.

## Intro sequence (every load)

1. **Draw + descend.** The bike plane fades in high above the ground while its
   strokes draw (same path data and stagger as `AnimatedB4CLogo`, replayed via
   `Path2D` + animated `lineDash` on a CanvasTexture). Gravity pulls it down;
   it lands at hero center with 1–2 decaying squash-and-stretch bounces.
2. **Touchdown.** A red ring ripples outward on the ground plane from the
   contact point; the lane materializes from that circle.
3. **Treadmill starts.** The world begins scrolling backwards; `revealed`
   flips and the headline/CTA compose with their existing transitions.

## The lane

- Long red strip (`--red` #AF4749 brightened toward crimson) laid diagonally
  across the ground plane, matching the reference's bottom-left → center
  diagonal.
- Reflective: Three.js `Reflector` on the strip, dimmed and red-tinted so the
  glowing bike reads as reflected in wet paint, not a mirror.
- **Self-painting illusion:** the lane's leading edge sits fixed a short
  distance in front of the bike and never advances. The bike is stationary at
  hero center; ground texture and buildings slide backwards. The bare ground
  just ahead of the leading edge makes the bike appear to lay the lane in
  front of itself.

## Buildings

- Isometric prisms with varied silhouettes: plain boxes, L-shaped footprints,
  stepped towers, wide slabs, occasional tall thin towers. Loose clusters on
  both sides of the lane.
- Material: `MeshPhysicalMaterial` with `transmission` (refraction), mid
  `roughness` (frosted/diffusive), faint teal emissive lifting them out of the
  dark background. Bloom catches the emissive.
- Spawn beyond a horizon fog ahead of the bike, stream backwards with the
  treadmill, recycle via object pool once behind the camera.
- **Pulse:** when a building crosses the bike's position, its emissive flashes
  bright green (`--green-dark` #027A76) over ~600 ms, then settles to a
  permanently greener tint than before — the bike leaves a greener city
  behind it.

## Palette & composition

- Background: deep teal-green derived from `--blue-dark` #003849 /
  `--green-dark` #027A76 (near-black teal like the reference), subtle radial
  vignette.
- Cream bike (`--cream` #FBF6EF) with emissive boost → bloom glow.
- Headline "Bikes for Cities" + CTA overlaid, cream on dark, weighted left;
  bike + lane weighted center-right.

## Performance & fallbacks

- Render loop pauses on `document.visibilitychange` (tab hidden) and when the
  hero fully exits the viewport (IntersectionObserver).
- `prefers-reduced-motion`: one static render — bike already on the lane,
  buildings placed, no descent, no treadmill, no RAF loop.
- WebGL unavailable: static CSS/SVG poster — dark background, red diagonal
  band, DOM `AnimatedB4CLogo` (which stays in the codebase for this and any
  other use).
- Bloom is the only post-processing pass; pixel ratio ≤ 2; pooled buildings.
  Target: 60 fps on mid-range mobile.

## Testing

- Vitest on pure modules: `physics.ts` (fall, bounce decay, rest detection),
  `buildings.logic.ts` (spawn cadence, pulse trigger on z-crossing, pool
  recycling).
- Playwright visual checks: intro frame, mid-loop frame, reduced-motion
  static frame.

## Out of scope

- No changes to the rest of the landing page sections.
- No react-three-fiber adoption.
- No texture/image assets — everything procedural or from existing SVG path
  data.
