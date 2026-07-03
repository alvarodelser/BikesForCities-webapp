import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import type { CityData } from '../../../constants/cities';
import { fetchCities } from '../../../services/api';
import RideRibbonRanking from './RideRibbonRanking';
import { sampleSpread } from './rideRibbon';
import ShowcasePanel from './ShowcasePanel';

const MAX_CITIES = 10;

/** Sort by coverage and pick MAX_CITIES spread across the range, keeping the
    best and the worst so the ribbon spans the full ranking. */
function sampleByCoverage(cities: CityData[]): CityData[] {
  const sorted = cities
    .filter(c => c.coverage != null)
    .sort((a, b) => (b.coverage ?? 0) - (a.coverage ?? 0));
  return sampleSpread(sorted, MAX_CITIES);
}

const RankingsPanel: React.FC = () => {
  const navigate = useNavigate();
  const [cities, setCities] = useState<CityData[]>([]);

  useEffect(() => {
    fetchCities()
      .then(data => setCities(sampleByCoverage(data)))
      .catch(() => {
        // ribbon renders without labels — no error UI needed here
      });
  }, []);

  const graphic = <RideRibbonRanking cities={cities} />;

  return (
    <ShowcasePanel
      graphic={graphic}
      graphicCardStyle={{ justifyContent: 'flex-start', padding: '20px 18px 12px' }}
      eyebrow="Rankings · ciudades"
      title="Visita nuestro ranking de ciudades"
      body="Conoce los ejemplos de éxito y descubre cómo se posiciona la tuya en infraestructura, servicio de bicicleta y uso real. Más de 20 ciudades españolas comparadas."
      ctaLabel="Ver ranking →"
      onCta={() => navigate('/compare')}
    />
  );
};

export default RankingsPanel;
