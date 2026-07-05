# Single-file offline deck + reliable fullscreen — design

**Date:** 2026-07-04
**Context:** `presentation/` holds a working `dc-runtime` deck (13 slides) for the Ford
Philanthropy Smart Mobility Challenge oral defense. It will be presented from a
**hosted URL** opened live at the venue.

## Problem

The deck already scales to fit any screen and has the side rail disabled
(`no-rail`), but two things make a live, hosted presentation risky:

1. **External network dependency mid-talk.** Fonts load from Google Fonts CDN. On
   flaky or blocked venue wifi the deck can render with fallback fonts (layout
   shift) or stall.
2. **No reliable fullscreen path.** The deck scales to fill whatever window it is
   given but never enters fullscreen itself and has no hotkey; today that means
   OS-specific shortcuts (F11 / Ctrl+Cmd+F) fumbled on stage.

## Goal

Produce **one `.html` file** that:
- makes **zero external network requests** once fetched (self-contained: JS,
  fonts, images all inlined),
- enters fullscreen via a single reliable user action,
- deploys to the existing UPM server as a static file,
- doubles as an offline USB fallback (same file opens from `file://`).

Non-goals: no changes to slide content, the `dc-runtime` runtime files, or the
design system. Only add a fullscreen entry point and a bundler.

## Current state (verified)

- Build: `build.mjs` concatenates `shell/head.html` + `slides/*.html` +
  `shell/tail.html` → `deck/Bikes for Cities.dc.html`.
- The built HTML references, by relative path, **5 runtime JS files** in `deck/`:
  `support.js`, `image-slot.js`, `morph.js`, `bike-spinner.js`, `deck-stage.js`.
- **3 images**, all in `deck/uploads/`: `Delibes-en-bici.jpg`, `alcala1.jpeg`,
  `alcala2.jpg` (referenced as `uploads/…` in slides).
- **4 font families** via one Google Fonts `<link>`: Archivo (500–900),
  EB Garamond (400/500/600 + italics), Spline Sans (300–600), Space Mono
  (400/700).
- Stage is fixed 1920×1080, `transform: scale(min(vw/1920, vh/1080))`, letterboxed.
- Runtime keymap (`deck-stage.js`) uses arrows / Space / PageUp/Down / Home / End /
  `R` / digits `1–9`. `F` is **not** consumed — free for our use.

## Components

### 1. Fullscreen entry — `shell/fullscreen.html` (new)

A small snippet appended into every build by `build.mjs` (after `tail.html`), so it
lives in source and survives any future runtime regeneration. **It must not edit
the auto-generated `deck-stage.js`.**

Behavior:
- **Start overlay** on load: full-viewport panel reading roughly "Bikes for Cities —
  click to present". On click (or Enter/Space) it calls
  `document.documentElement.requestFullscreen()` and removes itself. Rationale:
  browsers only allow fullscreen from a user gesture — nothing can auto-fullscreen
  on load — so a click-to-start is the standard reliable pattern.
- **`F` / `f` key** toggles fullscreen at any time (`requestFullscreen` /
  `exitFullscreen`). `Esc` exits via browser default. Guard against modifier keys.
- If `requestFullscreen` rejects or is unavailable, the overlay still dismisses and
  the deck runs windowed (it already scales to fill the window) — fullscreen is an
  enhancement, never a hard requirement for the deck to work.
- Styling inline and self-contained; uses the deck's existing CSS custom
  properties (`--cream`, `--ink`) so the overlay matches the design.

### 2. Standalone bundler — extend `build.mjs`

Unchanged: still builds the editable folder deck at
`deck/Bikes for Cities.dc.html`. **Added:** after that, emit a second artifact
`deck/Bikes for Cities.standalone.html` by transforming the assembled HTML string:

1. **Inline JS.** For each of the 5 runtime files, replace
   `<script src="./NAME.js"></script>` with `<script>` + file contents read from
   `deck/NAME.js` + `</script>`. Fail loudly if an expected file is missing.
2. **Inline images.** Replace every `uploads/NAME.ext` reference (in `src="…"` and
   any `url(…)`) with a `data:image/<mime>;base64,…` string read from
   `deck/uploads/NAME.ext`. Discover references by scanning the assembled HTML, so a
   newly added image is picked up automatically; fail loudly if a referenced file is
   absent.
3. **Inline fonts.** Replace the Google Fonts `<link>` (and the two `preconnect`
   links) with a `<style>` block of `@font-face` rules whose `src` is
   `url(data:font/woff2;base64,…)`, sourced from `presentation/fonts/` (Component 3).

The bundler is a pure string transform over the already-assembled HTML — no browser,
no DOM. Ordering: JS/image/font inlining are independent passes over the same string.

### 3. Font vendoring — `presentation/fonts/` (new) + `fonts.mjs` (new, one-time)

`fonts.mjs`:
- Fetches the Google Fonts CSS for the exact families/weights above using a modern
  browser User-Agent (so Google returns woff2), parses the `@font-face` blocks and
  their `url(...woff2)` links.
- Downloads each woff2 into `presentation/fonts/` and writes a manifest
  (`fonts.json` or a generated `fonts.css` with the `@font-face` rules rewritten to
  reference the local files) so `build.mjs` can produce the base64 `@font-face`
  block deterministically.
- Idempotent/cached: if `presentation/fonts/` is already populated, it is a no-op.
  After the first run, `build.mjs` needs no network.

Size budget: inlined fonts add a few hundred KB; total standalone file expected
well under ~1.5 MB. Acceptable for a hosted single file and instant to load.

### 4. Deploy to UPM

- Place `deck/Bikes for Cities.standalone.html` where the server serves static
  assets. Preferred: copy into the frontend's `public/` (Vite serves `public/` at
  web root) as e.g. `public/deck.html`, so it ships at a clean path such as
  `https://wiig.dia.fi.upm.es/b4c/deck.html`. Alternative: drop directly on the box.
- **Verification (required):** open the live URL from a *different device* (phone or
  another laptop) before the event, confirm: loads with correct fonts, DevTools
  Network shows no external requests, click-to-start enters fullscreen, `F` toggles,
  arrow keys navigate all 13 slides.

## Data flow

```
slides/*.html + shell/{head,fullscreen,tail}.html
        │  build.mjs (assemble)
        ▼
assembled HTML string ──► deck/Bikes for Cities.dc.html   (folder deck, editable/dev)
        │  build.mjs (inline JS + images + fonts)
        │      ▲ fonts from presentation/fonts/ (populated once by fonts.mjs)
        ▼
deck/Bikes for Cities.standalone.html  ──► copy to frontend/public/deck.html ──► UPM URL
```

## Error handling

- Bundler: missing runtime JS, missing referenced image, or empty `presentation/fonts/`
  → throw with a clear message naming the missing artifact (never silently emit a
  broken standalone).
- Fullscreen: `requestFullscreen` rejection is caught; overlay dismisses and deck
  runs windowed.

## Testing

- **Bundler assertion:** after building the standalone, grep it to assert **zero**
  `src="./`, `https://fonts.`, or `uploads/` occurrences remain, and that all 5 JS
  filenames and all 3 image basenames appear as inlined content / data URIs. This is
  the machine-checkable "no external requests" guarantee.
- **Manual:** load the standalone from `file://` with the network disabled — must
  render with correct fonts and images, click-to-start fullscreen works, `F` toggles,
  all 13 slides navigate.
- **Live:** the cross-device URL check in Component 4.

## Known caveat (on the record)

The deck is a fixed 16:9 canvas scaled to fit. On a 16:9 projector it fills
edge-to-edge; on 4:3 / 16:10 it letterboxes cleanly (never distorts or crops). Most
event projectors are 16:9, so this is normally a non-issue.
