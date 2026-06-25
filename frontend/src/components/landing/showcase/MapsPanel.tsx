import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import type { CityData } from '../../../constants/cities';
import { fetchCities } from '../../../services/api';
import ShowcasePanel from './ShowcasePanel';

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
      graphic={
        <img
          src="/landing/map_traffic_od.svg"
          alt="Mapa animado de flujos origen-destino de movilidad ciclista"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      }
      graphicCardStyle={{
        padding: 0,
        border: '1.5px solid rgba(0,56,73,0.12)',
        boxShadow: '0 6px 24px rgba(0,56,73,0.1), 0 1px 4px rgba(0,56,73,0.06)',
      }}
      eyebrow="Análisis · mapas"
      title="Modelos de movilidad para tu ciudad"
      body="Infraestructura ciclista, accidentalidad y flujos de tráfico: tres capas de análisis para entender cómo se mueve tu ciudad — y dónde hay que actuar."
      ctaLabel="Explorar mapas →"
      onCta={() => navigate(firstCityPath ?? '/compare')}
    />
  );
};

export default MapsPanel;
