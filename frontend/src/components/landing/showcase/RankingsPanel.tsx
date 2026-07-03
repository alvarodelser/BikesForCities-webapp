import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import type { CityData } from '../../../constants/cities';
import { fetchCities } from '../../../services/api';
import RideRibbonRanking from './RideRibbonRanking';
import { sampleRandomWithExtremes } from './rideRibbon';
import ShowcasePanel from './ShowcasePanel';

const MAX_CITIES = 10;

/** Pick MAX_CITIES at random, always keeping the best- and worst-covered
    city so the ribbon still spans the true min/max range. Called once per
    mount, so the sample varies across page visits. */
function sampleByCoverage(cities: CityData[]): CityData[] {
  const withCoverage = cities.filter(c => c.coverage != null);
  return sampleRandomWithExtremes(withCoverage, MAX_CITIES, c => c.coverage as number);
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
