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

  const [animWidths, setAnimWidths] = useState<number[]>([]);
  const rafRef = useRef<number>(0);

  // Reset widths to zero when the city list arrives
  useEffect(() => {
    setAnimWidths(cities.map(() => 0));
  }, [cities]);

  // Animate to actual values once loaded
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

            {/* value annotation on top city */}
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
