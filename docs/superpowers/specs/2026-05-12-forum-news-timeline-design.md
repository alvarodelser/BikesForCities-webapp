# Forum News Timeline — Design Spec

**Date**: 2026-05-12  
**Branch**: `feat/forum`  
**Status**: Approved

---

## Overview

A new `/forum` route ("Foro" in the navbar) that displays cycling mobility news articles chronologically with a draggable timeline on the right that acts as a custom scroll controller. For now, data is read from `data/movilidad_news.json` via a service abstraction so the API can be wired in later without touching the components.

---

## 1. Data Layer

### DB Migration: `007_news_table.sql`

```sql
CREATE TABLE IF NOT EXISTS news (
    id             SERIAL PRIMARY KEY,
    headline       TEXT NOT NULL,
    summary        TEXT,
    link           TEXT,
    source         TEXT,
    publication_dt DATE,
    topics         TEXT[],
    raw_txt        TEXT,
    city           TEXT,
    created_at     TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_news_publication_dt ON news(publication_dt);
CREATE INDEX IF NOT EXISTS idx_news_city ON news(city);
```

### Type: `frontend/src/types/news.ts`

```ts
export interface NewsItem {
  id: number;
  headline: string;
  summary?: string;
  link?: string;
  source?: string;
  publication_dt: string; // ISO date YYYY-MM-DD
  topics?: string[];
  raw_txt?: string;
  city?: string;
}
```

### Service: `frontend/src/services/newsService.ts`

- Imports `frontend/src/data/movilidad_news.json` statically (JSON copied from project root `data/` into the frontend src tree so Vite can resolve it)
- Maps JSON fields: `description → summary`, `publication_date → publication_dt`
- Assigns sequential numeric IDs
- Returns `NewsItem[]` sorted newest-first
- Exported as `getNews(): NewsItem[]`
- Future: swap body of `getNews` for a `fetch('/api/news')` call — no component changes needed

---

## 2. Page Layout & Components

### Route

`/forum` added to `App.tsx`. Navbar gets a "Foro" link.

### `ForumPage.tsx`

Full viewport height minus navbar (`height: calc(100vh - var(--navbar-height))`). The page body does not scroll — only the feed div scrolls. Two-column layout:

- **Left (fluid)**: search bar at top, scrollable news feed below
- **Right (fixed ~28px wide)**: vertical timeline track, position sticky

### `NewsCard.tsx`

Minimal card matching the editorial style:
- Background: `--cream`
- Font: EB Garamond (site default)
- Thin bottom border in `--blue-light`
- On hover: subtle left-border accent in `--green-dark` (no box-shadow)
- Content: linked headline in `--blue-dark`, then `source · date` in `text-sm` muted

### `NewsSearch.tsx`

Single text input:
- `border-radius: var(--rounded-sm)` (2px — matching site style)
- Bottom border only, in `--blue`
- Cream background, muted placeholder
- Client-side filter on `headline + summary`

### `NewsTimeline.tsx`

Vertical timeline on the right:
- Track: ~2px wide, `--blue-light`
- Article dots: 6px circles at proportionally correct date positions, `--blue-dark`
- Year labels: `text-xs`, `--black`, next to track at year boundaries
- Draggable thumb: ~18px tall pill, `--green-dark`

---

## 3. Timeline Sync Mechanics

Single `scrollRef` on the feed div drives all sync. No polling or animation frames.

- **Feed → timeline**: `onScroll` handler computes `scrollTop / (scrollHeight - clientHeight)` (0–1 fraction), sets thumb `top` via CSS
- **Timeline → feed**: `pointerdown + pointermove` on thumb computes drag fraction of track height, sets `scrollRef.current.scrollTop` directly
- **Dot clicks**: jump feed to that article's proportional scroll position
- **Thumb bounds**: clamped between topmost and bottommost dot positions; track padding matches
- The feed is the sole scrolling element on the page

---

## Out of Scope (this iteration)

- Topic chip filters
- API endpoint / backend wiring
- City filtering
- Pagination
- Mobile layout optimization
