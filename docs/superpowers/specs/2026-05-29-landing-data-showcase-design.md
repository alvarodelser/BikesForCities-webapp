# Landing Page: "Los datos están para usarlos" Section

**Date:** 2026-05-29  
**Status:** Approved  
**Location in page:** Between `<MapSelector />` and `<GetInvolvedSection />` in `LandingPage.tsx`

---

## Overview

A new full-width section that demonstrates what the platform offers through three alternating infographic/text panels. The goal is to communicate the platform's value to all three audiences (citizens, associations, city councils) without siloing them — every tool serves everyone.

The section uses a single cream background (`var(--cream)`) throughout. Graphic cards share the same background and are defined only by an inset shadow and hairline border ring — no color contrast, fully integrated. Panels alternate left/right graphic position. On mobile, all panels collapse to stacked (graphic on top, text below).

---

## Section Header

| Field | Content |
|---|---|
| Eyebrow | `Bikes for Cities` |
| Title | `Los datos están para usarlos` |
| Subtitle | *"Tanto si eres ciudadano que quiere entender su barrio, formas parte de una asociación que busca argumentos, o trabajas en un ayuntamiento con ganas de actuar — aquí tienes las herramientas."* |
| Audience pills | `Ciudadanos` · `Asociaciones` · `Ayuntamientos` |

---

## File Structure

```
frontend/src/components/landing/
  DataShowcaseSection.tsx        ← top-level section, renders header + three panels
  showcase/
    RankingsPanel.tsx            ← panel 1
    NewsPanel.tsx                ← panel 2
    MapsPanel.tsx                ← panel 3
    ShowcasePanel.tsx            ← shared panel layout wrapper (graphic card + text block)
```

`LandingPage.tsx` updated to import and render `<DataShowcaseSection />` between `<MapSelector />` and `<GetInvolvedSection />`.

---

## Shared Panel Layout (`ShowcasePanel`)

A flex row with two children: a graphic card and a text block. Props control side (left/right) and flip direction. On mobile (`isMobile` from `useViewport`) renders as a single column.

**Graphic card styles:**
```
border-radius: 20px
background: var(--cream)
box-shadow: inset 0 2px 8px rgba(0,56,73,0.06),
            inset 0 0 0 1.5px rgba(0,56,73,0.08),
            0 4px 20px rgba(0,56,73,0.05)
flex: 0 0 46%   (desktop)
width: 100%     (mobile)
min-height: 190px (desktop) / 180px (mobile)
```

**Text block** renders: eyebrow label, title, body copy, CTA button. Colors from design tokens (`var(--blue-dark)`, `var(--green-dark)`, `var(--blue)`).

Panels are separated by a hairline divider: `border-top: 1px solid rgba(0,56,73,0.07)`.

---

## Panel 1 — Rankings (`RankingsPanel`)

**Graphic position:** left  
**CTA target:** `/compare`

### Graphic — Horizontal Bar Chart (SVG)

- Rendered as a native SVG element (no charting library dependency).
- On mount: all city bars appear immediately at full length but in a dim grey (`rgba(58,108,127,0.15)`), creating a skeleton-like initial state.
- When `fetchCities()` resolves: each bar animates to its actual value (CSS transition on `width`, staggered by index). The top city gets `var(--green-dark)`, others use `var(--blue)` at varying opacity based on rank.
- City name labels on the Y axis (left-aligned). Top city gets a small annotation badge.
- Default metric: `cyclingNetwork` (km of cycling network). Chart label: *"Red ciclista · km de red"*.
- If the API call fails or returns no data, bars stay in their dim skeleton state — no error UI needed in this context.

### Text Copy

- Eyebrow: `Rankings · ciudades`
- Title: *"Visita nuestro ranking de ciudades"*
- Body: *"Conoce los ejemplos de éxito y descubre cómo se posiciona la tuya en infraestructura, servicio de bicicleta y uso real. Más de 20 ciudades españolas comparadas."*
- CTA: `Ver ranking →`

---

## Panel 2 — News (`NewsPanel`)

**Graphic position:** right (flipped)  
**CTA target:** `/about` or a future `/news` route (use `/about` for now)

### Graphic — Newspaper Grid

A CSS grid inside the graphic card:
- Row 1: one featured card spanning full width — image placeholder area (top ~40% of card, light tinted background), headline, source + date.
- Row 2: two equal-width smaller cards — headline, source + date only (no image).

All cards are `<a>` tags opening links in a new tab. On hover: subtle background lift (`rgba(0,56,73,0.06)` → `rgba(0,56,73,0.1)`).

### Static Data

Hardcoded as `STATIC_NEWS` constant in `NewsPanel.tsx`:

```ts
const STATIC_NEWS = [
  {
    id: 1,
    headline: "Barcelona amplía su red de carriles bici en 40 km durante 2025",
    source: "El País",
    date: "hace 2 días",
    url: "#",
    featured: true,
  },
  {
    id: 2,
    headline: "El uso de la bici sube un 18% en ciudades medianas",
    source: "Movilidad Sostenible",
    date: "hace 5 días",
    url: "#",
    featured: false,
  },
  {
    id: 3,
    headline: "Sevilla, referente europeo en infraestructura ciclista",
    source: "La Vanguardia",
    date: "hace 1 semana",
    url: "#",
    featured: false,
  },
];
```

> **Future:** Replace `STATIC_NEWS` with a fetch from a CMS or RSS-backed API endpoint. The component interface should stay the same — just swap the data source.

### Text Copy

- Eyebrow: `Actualidad · prensa`
- Title: *"La actualidad ciclista, de un vistazo"*
- Body: *"Un panel tipo periódico con las últimas noticias sobre movilidad sostenible en España. Artículos reales, organizados por relevancia, clicables."*
- CTA: `Leer más →`

---

## Panel 3 — Maps (`MapsPanel`)

**Graphic position:** left  
**CTA target:** First available city path from `fetchCities()`, fallback to `/compare`

### Graphic — Static Map Thumbnails

Three side-by-side thumbnail cards inside the graphic card. These are purely illustrative — no live map instances.

| Thumbnail | Mode label | Route line color |
|---|---|---|
| 1 (wider, flex 1.5) | `Infraestructura` | `var(--blue)` |
| 2 | `Accidentes` | `var(--red)` |
| 3 | `Tráfico` | `var(--yellow)` |

Each thumbnail: rounded card (`border-radius: 12px`), subtle dot grid background pattern, a colored route line SVG element at a slight angle, mode label at bottom-left.

### Text Copy

- Eyebrow: `Análisis · mapas`
- Title: *"Modelos de movilidad para tu ciudad"*
- Body: *"Infraestructura ciclista, accidentalidad y flujos de tráfico: tres capas de análisis para entender cómo se mueve tu ciudad — y dónde hay que actuar."*
- CTA: `Explorar mapas →`

---

## Data Dependencies

| Panel | Data source | Failure behaviour |
|---|---|---|
| Rankings | `fetchCities()` (existing API call) | Bars stay dim/skeleton |
| News | `STATIC_NEWS` constant | N/A |
| Maps | `fetchCities()` for CTA link only | CTA falls back to `/compare` |

No new API endpoints required.

---

## Mobile Behaviour

- All panels collapse to single column: graphic card full-width on top (~180px tall), text block below.
- Left/right alternation disappears — all panels read top-to-bottom.
- Section header, title, subtitle, and pills remain unchanged.
- CTA buttons remain full-width on mobile.

---

## Design Tokens Used

All values from `theme.css`:
- `var(--cream)` — section and card background
- `var(--blue-dark)` — titles, CTA button background
- `var(--blue)` — body text, mid-rank bars
- `var(--green-dark)` — eyebrows, top-rank bar, pills
- `var(--blue-light)` — tinted accents
- `var(--yellow)`, `var(--red)` — map route lines
- `--space-gutter`, `--space-section-y`, `--container-max` — layout spacing
