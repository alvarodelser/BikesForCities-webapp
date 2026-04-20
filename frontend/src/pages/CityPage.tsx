import React from 'react';
import { useParams } from 'react-router';
import type { CityData } from '../constants/cities';
import { fetchCities } from '../services/api';
import { useViewport } from '../hooks/useViewport';
import MapDesktop from '../components/city/MapDesktop';
import MapMobile from '../components/city/MapMobile';
import ErrorState from '../components/ui/ErrorState';
import Spinner from '../components/ui/Spinner';

const CityPage: React.FC = () => {
  const { cityName: rawCityName } = useParams<{ cityName: string }>();
  const cityName = rawCityName?.replace(/\/$/, "");
  const [city, setCity] = React.useState<CityData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const { isMobile } = useViewport();

  React.useEffect(() => {
    setLoading(true);
    setError(null);
    fetchCities().then(cities => {
      if (!cities || cities.length === 0) {
        setError("Unable to find city data. The database might be empty or unreachable.");
        setLoading(false);
        return;
      }
      const found = cities.find(c => 
        c.name.toLowerCase().replace(/\s+/g, '') === cityName?.toLowerCase().replace(/\s+/g, '') ||
        c.path.split('/').pop() === cityName
      );
      if (!found) {
        setError(`The city "${cityName}" could not be found.`);
      } else {
        setCity(found);
      }
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setError("Unable to reach the database. Please ensure the backend is running.");
      setLoading(false);
    });
  }, [cityName]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[var(--blue)] to-[var(--blue-dark)] flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (error || !city) {
    return (
      <div className="w-full min-h-screen flex flex-col items-center justify-center bg-[var(--blue-dark)]">
        <ErrorState 
          title="City Not Found" 
          message={error || "The city you are looking for does not exist."} 
          showHome={true} 
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {isMobile ? <MapMobile city={city} /> : <MapDesktop city={city} />}
    </div>
  );
};

export default CityPage;
 