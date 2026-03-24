import React from 'react';
import { useParams, useNavigate } from 'react-router';
import type { CityData } from '../constants/cities';
import { fetchCities } from '../services/api';
import OverviewSection from '../components/city/OverviewSection';
import MapSection from '../components/city/MapSection';
import Spinner from '../components/ui/Spinner';

const CityPage: React.FC = () => {
  const { cityName } = useParams<{ cityName: string }>();
  const navigate = useNavigate();
  const [city, setCity] = React.useState<CityData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetchCities().then(cities => {
      const found = cities.find(c => 
        c.name.toLowerCase().replace(/\s+/g, '') === cityName?.toLowerCase().replace(/\s+/g, '') ||
        c.path.split('/').pop() === cityName
      );
      setCity(found || null);
      setLoading(false);
    }).catch(err => {
      console.error(err);
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

  if (!city) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[var(--blue)] to-[var(--blue-dark)] flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="text-4xl font-bold mb-4">City Not Found</h1>
          <p className="text-xl mb-8">The city you're looking for doesn't exist.</p>
          <button 
            onClick={() => navigate('/')}
            className="bg-[var(--green)] hover:bg-[var(--green-dark)] text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            Go Back Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Overview Section */}
      <OverviewSection city={city} />    
      
      {/* Map Section */}
      <MapSection city={city} />
    </div>
  );
};

export default CityPage; 