import React from 'react';
import { useParams } from 'react-router';
import type { CityData } from '../constants/cities';
import { getCities } from '../services/citiesCache';
import { useViewport } from '../hooks/useViewport';
import MapDesktop from '../components/city/MapDesktop';
import MapMobile from '../components/city/MapMobile';
import ErrorContainer from '../components/ui/ErrorContainer';
import LoadingContainer from '../components/ui/LoadingContainer';

const CityPage: React.FC = () => {
  const { cityName: rawCityName } = useParams<{ cityName: string }>();
  const cityName = rawCityName?.replace(/\/$/, "");
  const [city, setCity] = React.useState<CityData | null>(null);
  const [initialLoading, setInitialLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const { isMobile } = useViewport();

  React.useEffect(() => {
    setError(null);
    setCity(null);
    setInitialLoading(true);
    getCities().then(cities => {
      if (!cities || cities.length === 0) {
        setError("No se han encontrado datos de las ciudades. Por favor, inténtelo de nuevo más tarde.");
        setInitialLoading(false);
        return;
      }
      const found = cities.find(c =>
        c.slug === cityName ||
        c.name.toLowerCase().replace(/\s+/g, '') === cityName?.toLowerCase().replace(/\s+/g, '')
      );
      if (!found) {
        setError(`No se ha podido encontrar la ciudad "${cityName}".`);
        setInitialLoading(false);
      } else {
        setCity(found);
        setInitialLoading(false);
        document.title = `${found.name}${found.altName ? ` (${found.altName})` : ''} | BikesForCities`;
      }
    }).catch(err => {
      console.error(err);
      setError("No se ha podido conectar con el servidor. Por favor, compruebe su conexión e inténtelo de nuevo.");
      setInitialLoading(false);
    });
  }, [cityName]);

  if (initialLoading) {
    return (
      <div className="h-dvh bg-gradient-to-br from-[var(--blue)] to-[var(--blue-dark)] flex items-center justify-center">
        <LoadingContainer />
      </div>
    );
  }

  if (error || !city) {
    return (
      <div className="w-full h-dvh flex flex-col items-center justify-center bg-[var(--blue-dark)]">
        <ErrorContainer
          title="Ciudad no encontrada"
          message={error || "La ciudad que busca no existe en nuestra base de datos."}
          showHome={true}
        />
      </div>
    );
  }

  return isMobile ? <MapMobile city={city} /> : <MapDesktop city={city} />;
};

export default CityPage;
