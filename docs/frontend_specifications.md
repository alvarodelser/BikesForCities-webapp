
# Bikes for Cities – Frontend Specifications (Updated)

## 1. Overview

The frontend is a **Single Page Application (SPA)** built with **React + TypeScript**, designed to visualize bike infrastructure and trip data for urban planning. It consumes data via a FastAPI backend and is deployed as part of a full Dockerized environment.

---

## 2. Folder Structure

The frontend resides in the `/frontend` directory. It is organized as:

```
frontend/
├── public/                 # Static assets (favicon, index.html)
├── src/
│   ├── components/         # Reusable visual elements
│   │   ├── layout/         # Navbar, Footer
│   │   ├── landing/        # HeroSection, SpainMap, CityMiniCards, etc.
│   │   ├── compare/        # CityComparisonGraph, MetricTable, etc.
│   │   ├── map/            # InteractiveMap, MapInsights, etc.
│   │   ├── about/          # DataCards, ResearchPapers
│   │   └── ui/             # Buttons, Cards (shadcn-based)
│   ├── sections/           # Page layouts using components
│   ├── pages/              # Route-level React components
│   ├── hooks/              # Custom logic (useCityData, useMapLayers)
│   ├── services/           # API queries (React Query)
│   ├── types/              # TypeScript interfaces
│   ├── App.tsx             # Router and layout shell
│   └── main.tsx            # React root
├── Dockerfile
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
├── vite.config.ts
└── package.json
```

---

## 3. Tech Stack

| Technology | Purpose | Notes |
|------------|---------|-------|
| **React 18 + TypeScript** | SPA structure with type safety | - |
| **Vite** | Build tool and dev server | ⚠️ *Vite replaces Webpack – much faster builds, live reloading* |
| **TailwindCSS** | Utility-first styling | Can be themed via `tailwind.config.js` |
| **shadcn/ui** | UI primitives built on Radix and Tailwind | ⚠️ *Evaluate vs. Chakra UI or plain Tailwind. Opinionated.* |
| **React Query** | Async API handling, caching | Better than manual `useEffect + fetch` |
| **react-leaflet** | Mapping and geospatial overlays | Ties in with PostGIS |
| **Chart.js** | Chart rendering | ⚠️ *Considered vs. Recharts – Chart.js is canvas-based, lower-level* |
| **lucide-react** | Icons | Optional |

---

## 4. Pages & Component Breakdown

### 🔹 Shared Layout (all pages)
- `Navbar`: links, city dropdown
- `Footer`: legal + social links

### 🔹 `/` LandingPage
- `HeroSection`
- `SpainMap`
- `CityMiniCards`
- `InvolvementSection`
- `FAQAccordion`
- `MiniResearchCards`

### 🔹 `/compare` ComparePage
- `CityComparisonGraph`
- `MetricTable`
- `CityDetailCards`
- `CombinedCityInsights`

### 🔹 `/map/:city` MapPage
- `MapHeader`
- `InteractiveMap`
- `MapMetricsBar`
- `MapInsights`
- `MapNews`

### 🔹 `/about` AboutPage
- `ProjectIntro`
- `DataCards`
- `ResearchPapers`
- `ExpandableSections`

---

## 5. API and Data Integration

All data interactions go through typed hooks using **React Query**. Example:

```ts
const { data, isLoading } = useQuery(['city-summary'], getCitySummary)
```

API services live in `/services/api.ts` and data types in `/types/`.

---

## 6. Design System

Using **TailwindCSS** and optionally `shadcn/ui`.

### Color & Typography
- Tailwind can define a palette in `tailwind.config.js`
- Typography follows hierarchy: headings (`text-xl`), body (`text-base`)
- Design principles: **contrast, clarity, spacing, accessibility**

### ⚠️ Notes:
- *Should we adopt a formal token system (e.g., `@tailwindcss/forms`, CSS variables)?*
- *If we switch from shadcn, Chakra UI or plain Tailwind are viable.*

---

## 7. Development & Deployment

### Local Dev
- `npm run dev` with Vite (live reload)
- React app runs on [http://localhost:5173](http://localhost:5173)
- Backend runs on [http://localhost:8000](http://localhost:8000)

### Docker Dev
In `docker-compose.yml`:
```yaml
frontend:
  build: ./frontend
  ports:
    - "5173:5173"
  volumes:
    - ./frontend:/app
  command: npm run dev
```

### Production (Recommended)
- **Build static frontend**: `npm run build`
- Result goes in `/dist` → served via **nginx**
- Backend served separately (FastAPI)
- Reverse proxy handles routing

### ⚠️ What's a "static frontend"?
> A built React app (HTML, JS, CSS) served without a live Node.js server. Fully client-side. Deployed to S3, Netlify, or nginx.

---

## 8. Testing Strategy

| Layer | Tool | Note |
|-------|------|------|
| Unit | React Testing Library + Jest | For components |
| E2E | Cypress / Playwright | For flows like city comparison |
| Backend | Pytest | Not part of this spec |
| Integration | Docker Compose | Full app test runs |

---

## 9. Open Questions / Decisions Pending

- ❓ Chart.js vs Recharts: Chart.js is fine, but more imperative; Recharts may be cleaner for JSX/reactive state
- ❓ shadcn/ui vs Chakra vs plain Tailwind: shadcn is fast but opinionated
- ❓ Should we define design tokens (colors, spacing) for consistency?
- ❓ Do we want a theme switcher (light/dark)?
