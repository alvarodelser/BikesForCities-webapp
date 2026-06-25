# Landing Data Showcase Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Los datos están para usarlos" section to the landing page, with three alternating infographic/text panels (rankings chart, news grid, map thumbnails), inserted between `<MapSelector />` and `<GetInvolvedSection />`.

**Architecture:** Five new components under `frontend/src/components/landing/showcase/` plus one top-level section component. A shared `ShowcasePanel` handles the left/right flip layout. Each panel is self-contained. `LandingPage.tsx` is updated with a single import.

**Tech Stack:** React + TypeScript, Tailwind CSS + inline styles (matching existing patterns), Vitest + @testing-library/react, native SVG for the rankings chart, `ResponsiveChart` for responsive sizing, `fetchCities()` for rankings data.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/components/landing/showcase/ShowcasePanel.tsx` | Shared left/right alternating panel layout |
| Create | `src/components/landing/showcase/NewsPanel.tsx` | Static newspaper grid |
| Create | `src/components/landing/showcase/MapsPanel.tsx` | Static map thumbnails |
| Create | `src/components/landing/showcase/RankingsPanel.tsx` | Animated horizontal bar chart from API |
| Create | `src/components/landing/DataShowcaseSection.tsx` | Section header + three panels |
| Modify | `src/pages/LandingPage.tsx` | Add `<DataShowcaseSection />` |
| Create | `src/components/landing/showcase/ShowcasePanel.test.tsx` | Unit tests |
| Create | `src/components/landing/showcase/NewsPanel.test.tsx` | Unit tests |
| Create | `src/components/landing/showcase/MapsPanel.test.tsx` | Unit tests |
| Create | `src/components/landing/showcase/RankingsPanel.test.tsx` | Unit tests |
| Create | `src/components/landing/DataShowcaseSection.test.tsx` | Unit tests |

All paths relative to `frontend/`.

**Test command (run from `frontend/`):**
```bash
npx vitest run --project unit src/components/landing
```

---

## Task 1: ShowcasePanel — shared layout wrapper

**Files:**
- Create: `src/components/landing/showcase/ShowcasePanel.tsx`
- Create: `src/components/landing/showcase/ShowcasePanel.test.tsx`

### Step 1.1 — Write the failing test

```tsx
// src/components/landing/showcase/ShowcasePanel.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ShowcasePanel from './ShowcasePanel';

describe('ShowcasePanel', () => {
  const baseProps = {
    graphic: <div data-testid="graphic">chart</div>,
    eyebrow: 'Rankings · ciudades',
    title: 'Visita nuestro ranking',
    body: 'Cuerpo del panel.',
    ctaLabel: 'Ver ranking →',
    onCta: vi.fn(),
  };

  it('renders eyebrow, title, body and CTA', () => {
    render(<ShowcasePanel {...baseProps} />);
    expect(screen.getByText('Rankings · ciudades')).toBeInTheDocument();
    expect(screen.getByText('Visita nuestro ranking')).toBeInTheDocument();
    expect(screen.getByText('Cuerpo del panel.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver ranking →' })).toBeInTheDocument();
  });

  it('renders the graphic slot', () => {
    render(<ShowcasePanel {...baseProps} />);
    expect(screen.getByTestId('graphic')).toBeInTheDocument();
  });
});
```

### Step 1.2 — Run test to confirm it fails

```bash
cd frontend && npx vitest run --project unit src/components/landing/showcase/ShowcasePanel.test.tsx
```

Expected: FAIL — `Cannot find module './ShowcasePanel'`

### Step 1.3 — Implement ShowcasePanel

```tsx
// src/components/landing/showcase/ShowcasePanel.tsx
import React from 'react';
import { useViewport } from '../../../hooks/useViewport';

interface ShowcasePanelProps {
  flip?: boolean;
  graphic: React.ReactNode;
  eyebrow: string;
  title: string;
  body: string;
  ctaLabel: string;
  onCta: () => void;
}

const CARD_STYLE: React.CSSProperties = {
  borderRadius: 20,
  background: 'var(--cream)',
  boxShadow: [
    'inset 0 2px 8px rgba(0,56,73,0.06)',
    'inset 0 0 0 1.5px rgba(0,56,73,0.08)',
    '0 4px 20px rgba(0,56,73,0.05)',
  ].join(', '),
  padding: '24px 22px 20px',
  minHeight: 190,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-end',
  overflow: 'hidden',
};

const ShowcasePanel: React.FC<ShowcasePanelProps> = ({
  flip = false,
  graphic,
  eyebrow,
  title,
  body,
  ctaLabel,
  onCta,
}) => {
  const { isMobile } = useViewport();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : flip ? 'row-reverse' : 'row',
        alignItems: isMobile ? 'stretch' : 'center',
        padding: isMobile ? '28px 20px' : '44px 52px',
        gap: isMobile ? 20 : 40,
        background: 'var(--cream)',
        borderTop: '1px solid rgba(0,56,73,0.07)',
      }}
    >
      {/* Graphic card */}
      <div
        style={{
          ...CARD_STYLE,
          flex: isMobile ? '0 0 auto' : '0 0 46%',
          minHeight: isMobile ? 180 : 190,
          width: isMobile ? '100%' : undefined,
        }}
      >
        {graphic}
      </div>

      {/* Text block */}
      <div style={{ flex: 1 }}>
        <p
          style={{
            fontSize: '0.58rem',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--green-dark)',
            fontWeight: 700,
            marginBottom: 8,
          }}
        >
          {eyebrow}
        </p>
        <h3
          className="font-heading font-bold"
          style={{
            fontSize: 'clamp(1.1rem, 2.5vw, 1.35rem)',
            lineHeight: 1.25,
            color: 'var(--blue-dark)',
            marginBottom: 10,
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </h3>
        <p
          style={{
            fontSize: '0.85rem',
            lineHeight: 1.7,
            color: 'var(--blue)',
            opacity: 0.85,
          }}
        >
          {body}
        </p>
        <button
          onClick={onCta}
          style={{
            display: 'inline-block',
            marginTop: 18,
            fontSize: '0.68rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            fontWeight: 700,
            padding: '8px 18px',
            borderRadius: 20,
            background: 'var(--blue-dark)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  );
};

export default ShowcasePanel;
```

### Step 1.4 — Run test to confirm it passes

```bash
cd frontend && npx vitest run --project unit src/components/landing/showcase/ShowcasePanel.test.tsx
```

Expected: PASS — 2 tests

### Step 1.5 — Commit

```bash
git add frontend/src/components/landing/showcase/ShowcasePanel.tsx \
        frontend/src/components/landing/showcase/ShowcasePanel.test.tsx
git commit -m "feat: add ShowcasePanel shared layout component"
```

---

## Task 2: NewsPanel — static newspaper grid

**Files:**
- Create: `src/components/landing/showcase/NewsPanel.tsx`
- Create: `src/components/landing/showcase/NewsPanel.test.tsx`

### Step 2.1 — Write the failing test

```tsx
// src/components/landing/showcase/NewsPanel.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router';
import NewsPanel from './NewsPanel';

describe('NewsPanel', () => {
  it('renders section title and body copy', () => {
    render(<MemoryRouter><NewsPanel /></MemoryRouter>);
    expect(screen.getByText('La actualidad ciclista, de un vistazo')).toBeInTheDocument();
  });

  it('renders the featured article headline', () => {
    render(<MemoryRouter><NewsPanel /></MemoryRouter>);
    expect(screen.getByText(/Barcelona amplía/)).toBeInTheDocument();
  });

  it('renders all three news cards', () => {
    render(<MemoryRouter><NewsPanel /></MemoryRouter>);
    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThanOrEqual(3);
  });
});
```

### Step 2.2 — Run test to confirm it fails

```bash
cd frontend && npx vitest run --project unit src/components/landing/showcase/NewsPanel.test.tsx
```

Expected: FAIL — `Cannot find module './NewsPanel'`

### Step 2.3 — Implement NewsPanel

```tsx
// src/components/landing/showcase/NewsPanel.tsx
import React from 'react';
import { useNavigate } from 'react-router';
import ShowcasePanel from './ShowcasePanel';

interface NewsItem {
  id: number;
  headline: string;
  source: string;
  date: string;
  url: string;
  featured: boolean;
}

const STATIC_NEWS: NewsItem[] = [
  {
    id: 1,
    headline: 'Barcelona amplía su red de carriles bici en 40 km durante 2025',
    source: 'El País',
    date: 'hace 2 días',
    url: '#',
    featured: true,
  },
  {
    id: 2,
    headline: 'El uso de la bici sube un 18% en ciudades medianas',
    source: 'Movilidad Sostenible',
    date: 'hace 5 días',
    url: '#',
    featured: false,
  },
  {
    id: 3,
    headline: 'Sevilla, referente europeo en infraestructura ciclista',
    source: 'La Vanguardia',
    date: 'hace 1 semana',
    url: '#',
    featured: false,
  },
];

// NOTE: Replace STATIC_NEWS with an API/CMS fetch in a future iteration.

function NewsCard({ item }: { item: NewsItem }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        borderRadius: 10,
        background: 'rgba(0,56,73,0.04)',
        border: '1px solid rgba(0,56,73,0.08)',
        padding: '8px 9px',
        overflow: 'hidden',
        position: 'relative',
        textDecoration: 'none',
        transition: 'background 0.2s',
        gridColumn: item.featured ? '1 / -1' : undefined,
        minHeight: item.featured ? 72 : 56,
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,56,73,0.08)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,56,73,0.04)')}
    >
      {item.featured && (
        <div
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            height: '45%',
            background: 'linear-gradient(135deg, rgba(58,108,127,0.18), rgba(2,122,118,0.12))',
            borderRadius: '8px 8px 0 0',
          }}
        />
      )}
      <p
        style={{
          fontSize: '0.52rem',
          fontWeight: 700,
          lineHeight: 1.35,
          color: 'var(--blue-dark)',
          position: 'relative',
          zIndex: 1,
          margin: 0,
        }}
      >
        {item.headline}
      </p>
      <p
        style={{
          fontSize: '0.42rem',
          color: 'var(--blue)',
          opacity: 0.5,
          marginTop: 2,
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {item.source} · {item.date}
      </p>
    </a>
  );
}

function NewsGraphic() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 7,
        width: '100%',
        height: 150,
      }}
    >
      {STATIC_NEWS.map(item => (
        <NewsCard key={item.id} item={item} />
      ))}
    </div>
  );
}

const NewsPanel: React.FC = () => {
  const navigate = useNavigate();

  return (
    <ShowcasePanel
      flip
      graphic={<NewsGraphic />}
      eyebrow="Actualidad · prensa"
      title="La actualidad ciclista, de un vistazo"
      body="Un panel tipo periódico con las últimas noticias sobre movilidad sostenible en España. Artículos reales, organizados por relevancia, clicables."
      ctaLabel="Leer más →"
      onCta={() => navigate('/about')}
    />
  );
};

export default NewsPanel;
```

### Step 2.4 — Run test to confirm it passes

```bash
cd frontend && npx vitest run --project unit src/components/landing/showcase/NewsPanel.test.tsx
```

Expected: PASS — 3 tests

### Step 2.5 — Commit

```bash
git add frontend/src/components/landing/showcase/NewsPanel.tsx \
        frontend/src/components/landing/showcase/NewsPanel.test.tsx
git commit -m "feat: add NewsPanel static newspaper grid"
```

---

## Task 3: MapsPanel — static map thumbnails

**Files:**
- Create: `src/components/landing/showcase/MapsPanel.tsx`
- Create: `src/components/landing/showcase/MapsPanel.test.tsx`

### Step 3.1 — Write the failing test

```tsx
// src/components/landing/showcase/MapsPanel.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import MapsPanel from './MapsPanel';

vi.mock('../../../services/api', () => ({
  fetchCities: vi.fn().mockResolvedValue([]),
}));

describe('MapsPanel', () => {
  it('renders section title', () => {
    render(<MemoryRouter><MapsPanel /></MemoryRouter>);
    expect(screen.getByText('Modelos de movilidad para tu ciudad')).toBeInTheDocument();
  });

  it('renders all three mode labels', () => {
    render(<MemoryRouter><MapsPanel /></MemoryRouter>);
    expect(screen.getByText('Infraestructura')).toBeInTheDocument();
    expect(screen.getByText('Accidentes')).toBeInTheDocument();
    expect(screen.getByText('Tráfico')).toBeInTheDocument();
  });
});
```

### Step 3.2 — Run test to confirm it fails

```bash
cd frontend && npx vitest run --project unit src/components/landing/showcase/MapsPanel.test.tsx
```

Expected: FAIL — `Cannot find module './MapsPanel'`

### Step 3.3 — Implement MapsPanel

```tsx
// src/components/landing/showcase/MapsPanel.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import type { CityData } from '../../../constants/cities';
import { fetchCities } from '../../../services/api';
import ShowcasePanel from './ShowcasePanel';

const MAP_MODES = [
  { label: 'Infraestructura', color: 'var(--blue)',   flex: 1.5 },
  { label: 'Accidentes',      color: 'var(--red)',    flex: 1   },
  { label: 'Tráfico',         color: 'var(--yellow)', flex: 1   },
];

function MapThumb({ label, color, flex }: { label: string; color: string; flex: number }) {
  return (
    <div
      style={{
        flex,
        borderRadius: 12,
        background: 'rgba(0,56,73,0.04)',
        border: '1px solid rgba(0,56,73,0.08)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        padding: 8,
        minHeight: 150,
      }}
    >
      {/* dot grid */}
      <div
        aria-hidden
        style={{
          position: 'absolute', top: 8, left: 8, right: 8, bottom: 28,
          backgroundImage: [
            'linear-gradient(rgba(0,56,73,0.06) 1px, transparent 1px)',
            'linear-gradient(90deg, rgba(0,56,73,0.06) 1px, transparent 1px)',
          ].join(', '),
          backgroundSize: '10px 10px',
          borderRadius: 6,
        }}
      />
      {/* route line */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: 22, left: 12, right: 12,
          height: 2,
          borderRadius: 1,
          background: color,
          opacity: 0.55,
          transform: 'rotate(-6deg)',
        }}
      />
      <p
        style={{
          fontSize: '0.48rem',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--blue-dark)',
          opacity: 0.55,
          fontWeight: 700,
          position: 'relative',
          zIndex: 1,
          margin: 0,
        }}
      >
        {label}
      </p>
    </div>
  );
}

function MapsGraphic() {
  return (
    <div style={{ display: 'flex', gap: 8, height: 150, alignItems: 'stretch', width: '100%' }}>
      {MAP_MODES.map(m => (
        <MapThumb key={m.label} label={m.label} color={m.color} flex={m.flex} />
      ))}
    </div>
  );
}

const MapsPanel: React.FC = () => {
  const navigate = useNavigate();
  const [firstCityPath, setFirstCityPath] = useState<string | null>(null);

  useEffect(() => {
    fetchCities()
      .then((cities: CityData[]) => {
        if (cities.length > 0) setFirstCityPath(cities[0].path);
      })
      .catch(() => {});
  }, []);

  return (
    <ShowcasePanel
      graphic={<MapsGraphic />}
      eyebrow="Análisis · mapas"
      title="Modelos de movilidad para tu ciudad"
      body="Infraestructura ciclista, accidentalidad y flujos de tráfico: tres capas de análisis para entender cómo se mueve tu ciudad — y dónde hay que actuar."
      ctaLabel="Explorar mapas →"
      onCta={() => navigate(firstCityPath ?? '/compare')}
    />
  );
};

export default MapsPanel;
```

### Step 3.4 — Run test to confirm it passes

```bash
cd frontend && npx vitest run --project unit src/components/landing/showcase/MapsPanel.test.tsx
```

Expected: PASS — 2 tests

### Step 3.5 — Commit

```bash
git add frontend/src/components/landing/showcase/MapsPanel.tsx \
        frontend/src/components/landing/showcase/MapsPanel.test.tsx
git commit -m "feat: add MapsPanel static map thumbnails"
```

---

## Task 4: RankingsPanel — animated horizontal bar chart

**Files:**
- Create: `src/components/landing/showcase/RankingsPanel.tsx`
- Create: `src/components/landing/showcase/RankingsPanel.test.tsx`

### Step 4.1 — Write the failing test

```tsx
// src/components/landing/showcase/RankingsPanel.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import type { CityData } from '../../../constants/cities';
import RankingsPanel from './RankingsPanel';

const MOCK_CITIES: CityData[] = [
  { name: 'Sevilla',   slug: 'sevilla',   path: '/sevilla',   population: 700000, budget: null, geoCoords: { longitude: 0, latitude: 0 }, cyclingNetwork: 180 },
  { name: 'Madrid',    slug: 'madrid',    path: '/madrid',    population: 3400000, budget: null, geoCoords: { longitude: 0, latitude: 0 }, cyclingNetwork: 120 },
  { name: 'Barcelona', slug: 'barcelona', path: '/barcelona', population: 1600000, budget: null, geoCoords: { longitude: 0, latitude: 0 }, cyclingNetwork: 95  },
];

vi.mock('../../../services/api', () => ({
  fetchCities: vi.fn().mockResolvedValue(MOCK_CITIES),
}));

describe('RankingsPanel', () => {
  it('renders the section title', () => {
    render(<MemoryRouter><RankingsPanel /></MemoryRouter>);
    expect(screen.getByText('Visita nuestro ranking de ciudades')).toBeInTheDocument();
  });

  it('renders city names after data loads', async () => {
    render(<MemoryRouter><RankingsPanel /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Sevilla')).toBeInTheDocument();
      expect(screen.getByText('Madrid')).toBeInTheDocument();
    });
  });

  it('renders the chart SVG', () => {
    render(<MemoryRouter><RankingsPanel /></MemoryRouter>);
    expect(document.querySelector('svg')).toBeInTheDocument();
  });
});
```

### Step 4.2 — Run test to confirm it fails

```bash
cd frontend && npx vitest run --project unit src/components/landing/showcase/RankingsPanel.test.tsx
```

Expected: FAIL — `Cannot find module './RankingsPanel'`

### Step 4.3 — Implement RankingsPanel

```tsx
// src/components/landing/showcase/RankingsPanel.tsx
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import type { CityData } from '../../../constants/cities';
import { fetchCities } from '../../../services/api';
import ResponsiveChart from '../../ui/ResponsiveChart';
import ShowcasePanel from './ShowcasePanel';

const LABEL_WIDTH = 90;
const ROW_HEIGHT = 22;
const ROW_GAP = 6;
const MAX_CITIES = 12;
const BAR_HEIGHT = 14;

function sortAndLimit(cities: CityData[]): CityData[] {
  return [...cities]
    .filter(c => c.cyclingNetwork != null)
    .sort((a, b) => (b.cyclingNetwork ?? 0) - (a.cyclingNetwork ?? 0))
    .slice(0, MAX_CITIES);
}

function barColor(rank: number, total: number): string {
  if (rank === 0) return 'var(--green-dark)';
  const opacity = 0.8 - (rank / total) * 0.45;
  return `rgba(58,108,127,${opacity.toFixed(2)})`;
}

interface ChartProps {
  cities: CityData[];
  loaded: boolean;
  width: number;
}

function RankingsChart({ cities, loaded, width }: ChartProps) {
  const barAreaWidth = Math.max(0, width - LABEL_WIDTH - 16);
  const maxValue = cities[0]?.cyclingNetwork ?? 1;

  // Animate bars: start at 0, expand to full width after load
  const [animWidths, setAnimWidths] = useState<number[]>(cities.map(() => 0));
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!loaded || cities.length === 0) return;
    rafRef.current = requestAnimationFrame(() => {
      setAnimWidths(cities.map(c => {
        const ratio = (c.cyclingNetwork ?? 0) / maxValue;
        return Math.round(ratio * barAreaWidth);
      }));
    });
    return () => cancelAnimationFrame(rafRef.current);
  }, [loaded, cities, barAreaWidth, maxValue]);

  const svgHeight = cities.length * (ROW_HEIGHT + ROW_GAP) + 24;

  return (
    <svg
      width={width}
      height={svgHeight}
      role="img"
      aria-label="Ranking de infraestructura ciclista por ciudad"
    >
      {cities.map((city, i) => {
        const y = 12 + i * (ROW_HEIGHT + ROW_GAP);
        const labelY = y + ROW_HEIGHT / 2 + 4;
        const barY = y + (ROW_HEIGHT - BAR_HEIGHT) / 2;
        const color = barColor(i, cities.length);

        return (
          <g key={city.slug}>
            {/* city name */}
            <text
              x={LABEL_WIDTH - 8}
              y={labelY}
              textAnchor="end"
              fontSize={10}
              fill="var(--blue-dark)"
              opacity={0.75}
              fontFamily="EB Garamond, Georgia, serif"
            >
              {city.name}
            </text>

            {/* background track */}
            <rect
              x={LABEL_WIDTH}
              y={barY}
              width={barAreaWidth}
              height={BAR_HEIGHT}
              rx={BAR_HEIGHT / 2}
              fill="rgba(0,56,73,0.06)"
            />

            {/* animated bar */}
            <rect
              x={LABEL_WIDTH}
              y={barY}
              width={animWidths[i] ?? 0}
              height={BAR_HEIGHT}
              rx={BAR_HEIGHT / 2}
              fill={color}
              style={{ transition: `width ${0.45 + i * 0.05}s ease` }}
            />

            {/* value label for top city */}
            {i === 0 && loaded && (
              <text
                x={LABEL_WIDTH + (animWidths[0] ?? 0) + 6}
                y={labelY}
                fontSize={9}
                fill="var(--green-dark)"
                fontWeight="bold"
                fontFamily="EB Garamond, Georgia, serif"
              >
                {city.cyclingNetwork} km
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

const RankingsPanel: React.FC = () => {
  const navigate = useNavigate();
  const [cities, setCities] = useState<CityData[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchCities()
      .then(data => {
        setCities(sortAndLimit(data));
        setLoaded(true);
      })
      .catch(() => {
        // bars stay in dim skeleton state — no error UI needed here
      });
  }, []);

  const graphic = (
    <div style={{ width: '100%' }}>
      <p style={{
        fontSize: '0.55rem',
        letterSpacing: '0.06em',
        color: 'var(--blue)',
        opacity: 0.55,
        marginBottom: 12,
        fontWeight: 600,
        textTransform: 'uppercase',
      }}>
        Red ciclista · km de red
      </p>
      <ResponsiveChart minHeight={160} maxHeight={280}>
        {({ width }) => (
          <RankingsChart cities={cities} loaded={loaded} width={width} />
        )}
      </ResponsiveChart>
    </div>
  );

  return (
    <ShowcasePanel
      graphic={graphic}
      eyebrow="Rankings · ciudades"
      title="Visita nuestro ranking de ciudades"
      body="Conoce los ejemplos de éxito y descubre cómo se posiciona la tuya en infraestructura, servicio de bicicleta y uso real. Más de 20 ciudades españolas comparadas."
      ctaLabel="Ver ranking →"
      onCta={() => navigate('/compare')}
    />
  );
};

export default RankingsPanel;
```

### Step 4.4 — Run test to confirm it passes

```bash
cd frontend && npx vitest run --project unit src/components/landing/showcase/RankingsPanel.test.tsx
```

Expected: PASS — 3 tests

### Step 4.5 — Commit

```bash
git add frontend/src/components/landing/showcase/RankingsPanel.tsx \
        frontend/src/components/landing/showcase/RankingsPanel.test.tsx
git commit -m "feat: add RankingsPanel animated horizontal bar chart"
```

---

## Task 5: DataShowcaseSection — section header + composition

**Files:**
- Create: `src/components/landing/DataShowcaseSection.tsx`
- Create: `src/components/landing/DataShowcaseSection.test.tsx`

### Step 5.1 — Write the failing test

```tsx
// src/components/landing/DataShowcaseSection.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import DataShowcaseSection from './DataShowcaseSection';

vi.mock('../../services/api', () => ({
  fetchCities: vi.fn().mockResolvedValue([]),
}));

describe('DataShowcaseSection', () => {
  it('renders the section title', () => {
    render(<MemoryRouter><DataShowcaseSection /></MemoryRouter>);
    expect(screen.getByText('Los datos están para usarlos')).toBeInTheDocument();
  });

  it('renders all three audience pills', () => {
    render(<MemoryRouter><DataShowcaseSection /></MemoryRouter>);
    expect(screen.getByText('Ciudadanos')).toBeInTheDocument();
    expect(screen.getByText('Asociaciones')).toBeInTheDocument();
    expect(screen.getByText('Ayuntamientos')).toBeInTheDocument();
  });

  it('renders all three panel titles', () => {
    render(<MemoryRouter><DataShowcaseSection /></MemoryRouter>);
    expect(screen.getByText('Visita nuestro ranking de ciudades')).toBeInTheDocument();
    expect(screen.getByText('La actualidad ciclista, de un vistazo')).toBeInTheDocument();
    expect(screen.getByText('Modelos de movilidad para tu ciudad')).toBeInTheDocument();
  });
});
```

### Step 5.2 — Run test to confirm it fails

```bash
cd frontend && npx vitest run --project unit src/components/landing/DataShowcaseSection.test.tsx
```

Expected: FAIL — `Cannot find module './DataShowcaseSection'`

### Step 5.3 — Implement DataShowcaseSection

```tsx
// src/components/landing/DataShowcaseSection.tsx
import React from 'react';
import RankingsPanel from './showcase/RankingsPanel';
import NewsPanel from './showcase/NewsPanel';
import MapsPanel from './showcase/MapsPanel';

const AUDIENCE_PILLS = [
  { label: 'Ciudadanos',    bg: 'rgba(58,108,127,0.1)',  color: 'var(--blue)'      },
  { label: 'Asociaciones',  bg: 'rgba(2,122,118,0.1)',   color: 'var(--green-dark)' },
  { label: 'Ayuntamientos', bg: 'rgba(0,56,73,0.08)',    color: 'var(--blue-dark)'  },
];

const DataShowcaseSection: React.FC = () => {
  return (
    <section
      id="data-showcase"
      style={{ background: 'var(--cream)', width: '100%' }}
    >
      <div
        className="max-w-[var(--container-max)] mx-auto"
        style={{ paddingTop: 'var(--space-section-y)' }}
      >
        {/* ── Section header ── */}
        <div
          style={{
            padding: 'clamp(24px, 4vw, 40px) clamp(20px, 4vw, 52px) clamp(20px, 3vw, 32px)',
            borderBottom: '1px solid rgba(0,56,73,0.08)',
          }}
        >
          <p
            style={{
              fontSize: '0.62rem',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'var(--green-dark)',
              fontWeight: 700,
              marginBottom: 10,
            }}
          >
            Bikes for Cities
          </p>
          <h2
            className="font-heading font-bold"
            style={{
              fontSize: 'clamp(1.6rem, 4vw, 2.4rem)',
              lineHeight: 1.15,
              color: 'var(--blue-dark)',
              marginBottom: 12,
              letterSpacing: '-0.02em',
            }}
          >
            Los datos están<br />para usarlos
          </h2>
          <p
            style={{
              fontSize: '0.88rem',
              color: 'var(--blue)',
              opacity: 0.8,
              lineHeight: 1.65,
              maxWidth: '54ch',
              marginBottom: 16,
            }}
          >
            Tanto si eres ciudadano que quiere entender su barrio, formas parte de una asociación que busca argumentos, o trabajas en un ayuntamiento con ganas de actuar — aquí tienes las herramientas.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {AUDIENCE_PILLS.map(p => (
              <span
                key={p.label}
                style={{
                  fontSize: '0.6rem',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  padding: '4px 12px',
                  borderRadius: 20,
                  fontWeight: 600,
                  background: p.bg,
                  color: p.color,
                }}
              >
                {p.label}
              </span>
            ))}
          </div>
        </div>

        {/* ── Three panels ── */}
        <RankingsPanel />
        <NewsPanel />
        <MapsPanel />
      </div>
    </section>
  );
};

export default DataShowcaseSection;
```

### Step 5.4 — Run test to confirm it passes

```bash
cd frontend && npx vitest run --project unit src/components/landing/DataShowcaseSection.test.tsx
```

Expected: PASS — 3 tests

### Step 5.5 — Commit

```bash
git add frontend/src/components/landing/DataShowcaseSection.tsx \
        frontend/src/components/landing/DataShowcaseSection.test.tsx
git commit -m "feat: add DataShowcaseSection with header and three panels"
```

---

## Task 6: Wire into LandingPage

**Files:**
- Modify: `src/pages/LandingPage.tsx`

### Step 6.1 — Update LandingPage.tsx

Replace:
```tsx
import React from 'react';

import HeroSection from '../components/landing/HeroSection';
import MapSelector from '../components/landing/MapSelector';
import GetInvolvedSection from '../components/landing/GetInvolvedSection';

const LandingPage: React.FC = () => {
  return (
    <div className="overflow-x-hidden">
      <HeroSection />
      <MapSelector />
      <GetInvolvedSection />
    </div>
  );
};

export default LandingPage;
```

With:
```tsx
import React from 'react';

import HeroSection from '../components/landing/HeroSection';
import MapSelector from '../components/landing/MapSelector';
import DataShowcaseSection from '../components/landing/DataShowcaseSection';
import GetInvolvedSection from '../components/landing/GetInvolvedSection';

const LandingPage: React.FC = () => {
  return (
    <div className="overflow-x-hidden">
      <HeroSection />
      <MapSelector />
      <DataShowcaseSection />
      <GetInvolvedSection />
    </div>
  );
};

export default LandingPage;
```

### Step 6.2 — Run all new tests to confirm everything passes

```bash
cd frontend && npx vitest run --project unit src/components/landing
```

Expected: PASS — all tests across ShowcasePanel, NewsPanel, MapsPanel, RankingsPanel, DataShowcaseSection

### Step 6.3 — Run TypeScript check

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

### Step 6.4 — Commit

```bash
git add frontend/src/pages/LandingPage.tsx
git commit -m "feat: wire DataShowcaseSection into landing page"
```

---

## Self-Review

**Spec coverage:**
- ✓ Section title, subtitle, audience pills → Task 5
- ✓ Three alternating panels → Task 5 composes Tasks 2/3/4 with `flip` prop
- ✓ Rankings: horizontal bar chart, animated SVG, data from `fetchCities()`, skeleton on failure → Task 4
- ✓ News: static data, newspaper grid, featured card, clickable links → Task 2
- ✓ Maps: three thumbnails with mode labels and colored route lines, CTA falls back to `/compare` → Task 3
- ✓ Graphic card: same cream bg, inset shadow, rounded corners → Task 1 `ShowcasePanel`
- ✓ Mobile: stacked column, graphic on top → Task 1 `ShowcasePanel` with `isMobile`
- ✓ `STATIC_NEWS` note for future CMS → Task 2 inline comment
- ✓ `LandingPage.tsx` updated → Task 6

**Placeholder scan:** No TBDs. URLs in `STATIC_NEWS` use `#` — intentional.

**Type consistency:**
- `CityData` imported from `../../../constants/cities` ✓
- `fetchCities()` returns `Promise<CityData[]>` ✓
- `ShowcasePanel` props interface used consistently across NewsPanel, MapsPanel, RankingsPanel ✓
- `ResponsiveChart` render prop `{ band, width, height }` — only `width` used ✓
