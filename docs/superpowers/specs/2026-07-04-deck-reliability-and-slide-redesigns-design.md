---
title: Deck reliability, transition engine v2, and slide redesigns (01/01b, 02, 05, 09–11)
date: 2026-07-04
status: approved
---

# Deck reliability + slide redesigns

Presentation lives in `presentation/` (slides → `build.mjs` → `deck/Bikes for Cities.dc.html`).
This spec covers two workstreams approved together: (1) making the deck reliable to
present from and fixing the ugly slide transitions, (2) redesigning four slide
areas. Findings below were verified live (deck served locally, driven via browser).

## Verified problems this spec fixes

1. **Slide 1→2 badge morph never fires.** `shell/tail.html` tags badges
   `data-morph-clone`/`data-morph-visible` (old contract); `deck/morph.js` (newer
   generic engine) looks for `data-morph="badge-1"`. No pair is ever found.
2. **Slide 2 caption chips are permanently invisible.** Authored `opacity:0`,
   revealed only by the morph that never runs.
3. **Thumbnail rail shows while presenting.** `no-rail` on `<x-import>` is
   camel-cased by the DC runtime and lands on the element as `norail`, which
   `deck-stage` ignores (verified on the live element). Rail exposes right-click
   Delete/Reorder during a talk.
4. **Fonts load from Google Fonts CDN** — offline venue ⇒ system-font fallback
   after a 2s hold.
5. **Hard-cut slide switches + crude morph proxies.** `deck-stage` flips
   visibility instantly; `morph.js` flies flat solid tiles containing only the
   target's text at a hardcoded 16px (wrong look, wrong scale, animates
   `left/top/width/height` = non-composited jank); `data-morph-hold` blanks the
   whole incoming slide during flight.
6. **No desktop click-advance** (tap nav is touch-only by design) and no
   in-deck fullscreen affordance.
7. **Empty image-slots** render dashed placeholder frames to the audience
   (slides 5, 9, 10, 11).

Constraint honored throughout: `deck-stage.js`, `image-slot.js`, `support.js`
are auto-generated/vendored — not edited. All fixes live in slide markup,
`shell/`, `build.mjs`, and deck-local scripts we own (`morph.js`, new
`deck-extras.js`).

---

## Part 1 — Deck platform

### 1.1 `deck/deck-extras.js` (new, loaded from `shell/head.html`)

Single script owning presentation-hardening behaviors:

- **Rail off:** after `deck-stage` mounts, `el.setAttribute('no-rail','')`
  (works around the `norail` lowercasing). The DC editor host re-enables the
  rail explicitly via its own postMessage path, so editing is unaffected.
- **Click-to-advance:** document-level click listener; a click that reaches the
  stage advances one slide via the deck element's `_advance(1,'click')`.
  Ignored: clicks on `a, button, video[controls], input…` (reuse the deck's
  interactive selector), the overlay/rail chrome, and any click with text
  selection active. After slide 01's button is removed the deck has no
  interactive slide content, so plain click = next is safe.
- **F = fullscreen:** `F` toggles `document.documentElement.requestFullscreen()`
  / `exitFullscreen()`. Skipped when typing in editable elements (same guard as
  deck-stage's key handler).
- **Video autoplay driver:** on `slidechange`, for the entering slide every
  `video[data-deck-video]` gets `currentTime = 0; play()`; for the leaving
  slide, `pause()`. Videos are `muted playsinline preload="auto"`, no
  `controls`, no `loop` — play once and hold the last frame naturally.
  `play()` rejections (missing file) are swallowed; the poster shows instead.

### 1.2 Crossfade between slides (CSS only, `shell/head.html`)

Slides are light-DOM `<section>` children of `deck-stage`, so authored CSS can
transition them even though the base show/hide rules live in the shadow root:

```css
deck-stage > section {
  transition: opacity .25s ease, visibility 0s .25s;
}
deck-stage > section[data-deck-active] {
  transition: opacity .25s ease, visibility 0s 0s;
}
@media (prefers-reduced-motion: reduce) {
  deck-stage > section { transition: none; }
}
```

All slides are absolutely stacked, so this is a true crossfade with no layout
shift, for every slide pair. 250ms keeps it tight enough not to lag keyboard
navigation.

### 1.3 Morph engine v2 (`deck/morph.js` rewrite)

Same event contract (`slidechange` CustomEvent from deck-stage), new mechanics:

- **Pairs:** outgoing `[data-morph="ID"]` → incoming `[data-morph-target="ID"]`
  (unchanged contract; slide 01b's chart badges adopt it — see 2.1).
- **Real clones:** proxy = `cloneNode(true)` of the source element. Slides are
  inline-styled, so clones keep their exact appearance (glass chips stay glass
  chips, panels keep gradients/text). Clone is appended to a fixed, full-viewport
  layer, positioned at the source's bounding rect.
- **Transform-only flight:** FLIP — clone starts at the source rect and
  animates `translate(...) scale(...)` to the target rect over ~600ms
  `cubic-bezier(.2,.8,.2,1)`, with the existing ~100ms stagger between multiple
  pairs. No `left/top/width/height` animation, no font-size snapping: correct at
  any window scale because both rects come from the same scaled viewport.
  Non-uniform scale is fine for same-shaped chips; where source and target
  differ in aspect (08 panels → 09 pills) the clone crossfades into the target
  during the last ~150ms of flight, which visually absorbs the shape change.
- **No slide blanking:** `data-morph-hold` is removed from all slides and from
  the head.html CSS. During a qualifying morph the engine inline-hides only the
  *target* elements (and, for 08→09, the source panels' real counterparts are
  already gone with the outgoing slide); everything else on the incoming slide
  plays its normal entrance animations under the crossfade.
- **Completeness rule (design invariant):** no element may be authored
  invisible waiting for the morph. Every morph target has a normal visible
  end-state (entrance animation like its siblings). The engine suppresses
  targets only transiently, and a failsafe timer (flight duration + 400ms)
  force-reveals them, so a missed event can never strand content hidden.
- **Qualification:** morph runs only when the source elements exist on the
  previous slide *and* are actually visible (computed opacity > 0), previous
  slide is the expected neighbor, and `prefers-reduced-motion` is off.
  Otherwise targets simply play their entrance animations.

### 1.4 Self-hosted fonts

Download woff2 files for the weights actually used — Archivo 500–900, Spline
Sans 300–600, Space Mono 400/700, EB Garamond 400–600 + italics — into
`deck/fonts/`. Replace the Google Fonts `<link>` in `shell/head.html` with
`@font-face` rules pointing at `./fonts/*.woff2`. Zero-network presenting; the
`data-fonts-pending` hold in deck-stage still works (local fonts resolve fast).

### 1.5 Build copies media

`build.mjs` also copies presentation media from `input/` into `deck/uploads/`
(videos, `road.jpg`, any new photos), keeping `deck/` the single self-contained
folder you present from. Missing files are warnings, not failures.

---

## Part 2 — Slide redesigns

### 2.1 Slide 01 → 01 + 01b (question, then the takeover curve)

**Slide 01** keeps the Delibes photo, tone/grain overlays, and question
headline. The chart becomes a static authored SVG in the slide markup: bike
curve + area, axis labels, Fig. 01 chip — drawn on entry via a CSS clip-path
draw animation (`data-anim`). Deleted entirely: the "Reveal the automobile ▸"
button, the `DCLogic` chart component in `shell/tail.html`, its
`carShown`/`bikeIn` state and slidechange reset logic. The `lineColors` /
`photoTone` / `grain` tweak-props are dropped; current defaults (Teal & Blue,
Warm sepia, 0.7) are baked into the markup.

**Slide 01b** (new section, `slides/01b-takeover-curve.html` sorting between 01
and 02): visually identical base — same photo, overlays, and bike curve already
fully drawn (no re-draw). On entry: the car curve draws in (~1.3s clip
animation), then badge chips "1 — The automobile surge" (~1.3s delay) and
"2 — Today's resurgence" (~1.6s) rise in. Headline drops to a quieter secondary
treatment so the chart carries the slide. The badge chips carry
`data-morph="badge-1"` / `"badge-2"`.

Because 01 and 01b share the photo and bike curve pixel-for-pixel, the 250ms
crossfade reads as "the same slide gained a curve" — the build effect with
native navigation semantics (back from 02 lands on the revealed state; back
again returns to the bare question; rail/number-key jumps just work).

Speaker notes split accordingly. Visible kickers are NOT renumbered: 01b keeps
the "01" kicker (reads "01 — The origin", with its own quieter headline), so
slides 02–13 keep their current numbers and no downstream edits are needed.

### 2.2 Slide 02 — smaller photos, era subtitles, mode icons

- Photos shrink from filling the slide's flexible middle to ~40% of slide
  height, still side-by-side with the same frames/grain/gradient and the
  numbered badge chips (morph targets, now with visible entrance animations per
  the completeness rule).
- Under each photo, a caption block: era heading + one-line subtitle + icon row.
  Icons are inline Phosphor SVG paths (self-contained, `currentColor`):
  - **1908 — the street belonged to everyone.** Subtitle: the automobile
    arrives as one mode among many. Icons: pedestrian, horse, tram, bicycle,
    early car — equal size, ink color; bicycle in teal.
  - **Today — the street belongs to the car.** Subtitle: one mode dominates;
    the split is reopening. Icons: car (dominant, ink), bus, motorbike,
    pedestrian in muted steel; bicycle in teal — same accent in both rows to
    draw the parallel.
- The existing intro paragraph is removed (redundant with the subtitles).
  Headline and the Corollary bar stay.

### 2.3 Slide 05 — the efficiency scatter

- Keep the left photo column: 140-yrs bicycle card (photo still an open
  placeholder — needs a safety-bicycle image) and 4,000-yrs road card, which
  now uses `input/road.jpg` (copied to uploads, replacing the empty slot).
- New center chart panel (~48% width): the cost-of-transport scatter rebuilt as
  deck-styled SVG. Log-log axes ("Body weight" ×, "Energy cost of transport —
  calories per gram per km" y), Space Mono labels, cream panel with ink axes.
  Curated points in muted blues/sages: fruit fly, mouse, rabbit, dog, sheep,
  human walking, horse, cow, automobile, helicopter, jet transport. **Human on
  bicycle** in amber at the bottom right, ringed, callout: "the most
  energy-efficient machine ever measured." Entry: points pop in staggered;
  bicycle lands last with a bloom ring.
- Right column (~28%): condensed argument — zero-sum → collaborative reframe
  and the "more cyclists = shorter commutes, for cars too" stat box. The long
  closing paragraph compresses to its final clause (policy + infrastructure →
  civic-tech platform).
- Source line: after S. Wilson, *Scientific American* (1973) / Tucker's cost of
  transport data.

### 2.4 Slides 09/10/11 — autoplay walkthrough videos

- Each slide's `<image-slot>` panel becomes
  `<video data-deck-video muted playsinline preload="auto" src="uploads/observe.mp4">`
  (respectively `contribute.mp4`, `act.mp4`) inside the same framed panel
  (border, radius, shadow unchanged). `object-fit: cover`.
- Files land in `presentation/input/` (user copies them); `build.mjs` copies to
  `deck/uploads/`. Missing file ⇒ poster/placeholder background, no broken UI.
- Behavior via deck-extras driver (1.1): play once from start on entry, hold
  last frame, restart on re-entry, pause on exit.

---

## Out of scope

- `print/` export refresh (still stale, per README note).
- Remaining content placeholders: team names (04, 13), association names (10),
  budget buckets (12), safety-bicycle photo (05), video files themselves.
- Any edit to `deck-stage.js` / `support.js` / `image-slot.js`.

## Testing

- Serve `deck/` locally; drive with Playwright:
  - Arrows/space/click advance; click on overlay chrome does not double-advance.
  - `deck-stage` element carries real `no-rail`; rail absent.
  - 01→01b: bike curve does not re-draw; car curve draws; badges appear.
  - 01b→02: clones fly; slide 2 chips visible after landing; chips also visible
    when jumping straight to slide 2 (number key) and with reduced motion.
  - 08→09: panels fly and settle into pills; pills correct when jumping to 09.
  - Videos: entering 09 plays once and holds; re-entry restarts; leaving pauses.
  - Offline check: serve with fonts dir present, block external hosts, verify
    typography (no fallback fonts).
- Visual pass at multiple window sizes (letterbox scaling with proxies landing
  correctly at non-1:1 scale).
