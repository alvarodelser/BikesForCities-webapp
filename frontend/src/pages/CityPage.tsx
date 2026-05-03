import React from 'react';
import { useParams } from 'react-router';
import type { CityData } from '../constants/cities';
import { fetchCities } from '../services/api';
import { useViewport } from '../hooks/useViewport';
import MapDesktop from '../components/city/MapDesktop';
import MapMobile from '../components/city/MapMobile';
import ErrorContainer from '../components/ui/ErrorContainer';
import LoadingContainer from '../components/ui/LoadingContainer';
import InfraStats from '../components/city/map/modes/infrastructure/InfraStats';

const CityPage: React.FC = () => {
  const { cityName: rawCityName } = useParams<{ cityName: string }>();
  const cityName = rawCityName?.replace(/\/$/, "");
  const [city, setCity] = React.useState<CityData | null>(null);
  // true only on the very first load (no city yet); city transitions keep the map mounted
  const [initialLoading, setInitialLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const { isMobile } = useViewport();

  React.useEffect(() => {
    setError(null);
    fetchCities().then(cities => {
      if (!cities || cities.length === 0) {
        setError("Unable to find city data. The database might be empty or unreachable.");
        setInitialLoading(false);
        return;
      }
      const found = cities.find(c =>
        c.slug === cityName ||
        c.name.toLowerCase().replace(/\s+/g, '') === cityName?.toLowerCase().replace(/\s+/g, '')
      );
      if (!found) {
        setError(`The city "${cityName}" could not be found.`);
        setInitialLoading(false);
      } else {
        setCity(found);
        setInitialLoading(false);
        document.title = `${found.name}${found.altName ? ` (${found.altName})` : ''} | BikesForCities`;
      }
    }).catch(err => {
      console.error(err);
      setError("Unable to reach the database. Please ensure the backend is running.");
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
          title="City Not Found"
          message={error || "The city you are looking for does not exist."}
          showHome={true}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="h-dvh">
        {isMobile ? <MapMobile city={city} /> : <MapDesktop city={city} />}
      </div>
      {/* TEMP: InfraStats preview for UI iteration */}
      <div className="w-full bg-[var(--blue)] px-[var(--space-gutter)] py-12">
        <h2 className="text-2xl font-bold text-white mb-8">Infraestructura — preview</h2>
        <InfraStats city={city} />
      </div>
    </div>
  );
};

export default CityPage;
 