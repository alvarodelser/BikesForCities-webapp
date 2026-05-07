import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import type { CityData } from '../../constants/cities';
import { fetchCities } from '../../services/api';
import { useViewport } from '../../hooks/useViewport';
import SpainMap from './SpainMap';
import ScrollableCityCards from '../ui/ScrollableCityCards';
import WaveBackground from '../ui/WaveBackground';
import ErrorContainer from '../ui/ErrorContainer';
import LoadingContainer from '../ui/LoadingContainer';

// ─── Shared layout props ──────────────────────────────────────────────────────

interface LayoutProps {
  cities: CityData[];
  onNavigate: (cityName: string) => void;
}

// ─── Desktop Layout ───────────────────────────────────────────────────────────

function DesktopLayout({ cities, onNavigate }: LayoutProps) {
  const [selected, setSelected] = useState<CityData | null>(null);

  // Outside-click dismissal: clear selected when clicking empty section area
  function handleSectionClick(e: React.MouseEvent) {
    if (!selected) return;
    const target = e.target as Element;
    if (target.closest('g[role="button"]')) return; // pin click
    setSelected(null);
  }

  const handleCityClick = useCallback((cityName: string) => {
    const city = cities.find(c => c.name === cityName) ?? null;
    setSelected(city);
  }, [cities]);

  return (
    <section
      id="map-selector"
      className="relative w-full h-[80vh] px-[var(--space-gutter)] py-[var(--space-section-y)]"
      onClick={handleSectionClick}
    >
      {/* Wave Background — desktop quality with existing tuning props */}
      <WaveBackground
        quality="high"
        color={0x3A6C7F}
        specularColor={0x7BA492}
        shininess={8}
        waveHeight={20}
        waveSpeed={0.5}
        zoom={5}
        cameraFov={90}
        cameraY={300}
        cameraZ={100}
        targetY={-50}
        className="absolute inset-0 w-full h-full -z-10 pointer-events-auto"
      />

      {/* Spain Map fills the section */}
      <div className="relative z-10 h-full w-full">
        <SpainMap
          onCityClick={handleCityClick}
          onCityNavigate={onNavigate}
          selectedCity={selected?.name ?? null}
          cities={cities}
        />
      </div>

      {/* Hint when nothing is selected */}
      {!selected && (
        <div className="pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 rounded-full bg-white/70 px-4 py-2 text-sm">
          Haz clic en una ciudad para ver detalles
        </div>
      )}
    </section>
  );
}

// ─── Mobile Layout ────────────────────────────────────────────────────────────

function MobileLayout({ cities, onNavigate }: LayoutProps) {
  const [selected, setSelected] = useState<CityData | null>(cities[0] ?? null);

  const handleCityClick = useCallback((cityName: string) => {
    const city = cities.find(c => c.name === cityName) ?? null;
    setSelected(city);
  }, [cities]);

  return (
    <section id="map-selector" className="relative flex flex-col w-full min-h-[85vh] overflow-hidden">
      {/* Wave Background — covers entire section on mobile */}
      <WaveBackground
        quality="low"
        color={0x3A6C7F}
        specularColor={0x7BA492}
        shininess={8}
        waveHeight={20}
        waveSpeed={0.5}
        zoom={5}
        cameraFov={90}
        cameraY={300}
        cameraZ={100}
        targetY={-50}
        className="absolute inset-0 w-full h-full -z-10 pointer-events-auto"
      />

      {/* Map: 35vh instead of 40vh to move everything up */}
      <div className="relative h-[35vh] w-full overflow-hidden z-10">
        <SpainMap
          onCityClick={handleCityClick}
          onCityNavigate={onNavigate}
          selectedCity={selected?.name ?? null}
          cities={cities}
        />
      </div>

      {/* Carousel: 45vh */}
      <div className="relative h-[45vh] w-full z-10">
        <ScrollableCityCards
          cities={cities}
          selectedCity={selected?.name ?? null}
          onCitySelect={handleCityClick}
          onCityNavigate={onNavigate}
          fadeColor="var(--blue-dark)"
        />
      </div>
    </section>
  );
}

// ─── MapSelector (top-level) ──────────────────────────────────────────────────

const MapSelector: React.FC = () => {
  const [cities, setCities] = useState<CityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isMobile } = useViewport();
  const navigate = useNavigate();

  useEffect(() => {
    fetchCities()
      .then(data => {
        if (data && data.length > 0) {
          setCities(data);
        } else {
          setError(
            'No se han encontrado datos de ciudades disponibles.',
          );
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError(
          'Error al conectar con el servidor. Por favor, inténtelo de nuevo más tarde.',
        );
        setLoading(false);
      });
  }, []);

  const handleCityNavigate = (cityName: string) => {
    const city = cities.find(c => c.name === cityName);
    if (city) {
      navigate(city.path);
    }
  };

  if (loading) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center bg-[var(--blue-dark)]">
        <LoadingContainer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full min-h-screen flex flex-col items-center justify-center bg-[var(--blue-dark)]">
        <ErrorContainer title="Error de Conexión" message={error} showRetry={true} />
      </div>
    );
  }

  return isMobile ? (
    <MobileLayout cities={cities} onNavigate={handleCityNavigate} />
  ) : (
    <DesktopLayout cities={cities} onNavigate={handleCityNavigate} />
  );
};

export default MapSelector;
