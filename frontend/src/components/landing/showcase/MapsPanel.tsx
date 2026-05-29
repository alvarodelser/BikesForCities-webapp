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
