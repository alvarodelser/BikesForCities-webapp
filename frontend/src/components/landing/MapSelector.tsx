import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import type { CityData } from '../../constants/cities';
import { fetchCities } from '../../services/api';
import { useViewport } from '../../hooks/useViewport';
import SpainMap from './SpainMap';
import ScrollableCityCards from '../ui/ScrollableCityCards';
import WaveBackground from '../ui/WaveBackground';
import SideCardTail from './SideCardTail';
import CityCard from '../ui/CityCard';
import ErrorState from '../ui/ErrorState';
import Spinner from '../ui/Spinner';

// ─── Shared layout props ──────────────────────────────────────────────────────

interface LayoutProps {
  cities: CityData[];
  onNavigate: (cityName: string) => void;
}

// ─── Desktop Layout ───────────────────────────────────────────────────────────

function DesktopLayout({ cities, onNavigate }: LayoutProps) {
  const [selected, setSelected] = useState<CityData | null>(null);

  // One ref object per city, created lazily
  const targetRefs = useRef<Record<string, { current: Element | null }>>({});

  function getTargetRef(cityName: string) {
    if (!targetRefs.current[cityName]) {
      targetRefs.current[cityName] = { current: null };
    }
    return targetRefs.current[cityName];
  }

  // Dummy stable ref for when nothing is selected
  const emptyRef = useRef<Element | null>(null);

  const selectedTargetRef = selected
    ? getTargetRef(selected.name)
    : emptyRef;

  // Outside-click dismissal: clear selected when clicking empty section area
  // Pin clicks have role="button" on a <g> element; SideCardTail wraps in data-sidecard-root
  function handleSectionClick(e: React.MouseEvent) {
    if (!selected) return;
    const target = e.target as Element;
    if (target.closest('g[role="button"]')) return; // pin click
    if (target.closest('[data-sidecard-root]')) return; // card click
    setSelected(null);
  }

  const handleCityClick = useCallback((cityName: string) => {
    const city = cities.find(c => c.name === cityName) ?? null;
    setSelected(city);
  }, [cities]);

  const handleRegisterPinRef = useCallback((name: string, el: SVGGElement | null) => {
    if (!targetRefs.current[name]) {
      targetRefs.current[name] = { current: null };
    }
    targetRefs.current[name].current = el;
  }, []);

  return (
    <section
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
          registerPinRef={handleRegisterPinRef}
        />
      </div>

      {/* Side card tail — renders null internally when isMobile */}
      <SideCardTail targetRef={selectedTargetRef} visible={!!selected}>
        <div data-sidecard-root>
          {selected && (
            <CityCard
              city={selected}
              position={0}
              onCityNavigate={onNavigate}
            />
          )}
        </div>
      </SideCardTail>

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
    <section className="flex flex-col w-full min-h-[85vh]">
      {/* Map: 40vh */}
      <div className="relative h-[40vh] w-full overflow-hidden">
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
        <div className="relative z-10 h-full w-full">
          <SpainMap
            onCityClick={handleCityClick}
            onCityNavigate={onNavigate}
            selectedCity={selected?.name ?? null}
            cities={cities}
          />
        </div>
      </div>

      {/* Carousel: 45vh */}
      <div className="h-[45vh] w-full">
        <ScrollableCityCards
          cities={cities}
          selectedCity={selected?.name ?? null}
          onCitySelect={handleCityClick}
          onCityNavigate={onNavigate}
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
            'No se encontraron datos de ciudades en la base de datos. Por favor, ejecuta los scripts de ingesta.',
          );
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError(
          'No se puede conectar con la base de datos. Asegúrate de que Docker esté en ejecución.',
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
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full min-h-screen flex flex-col items-center justify-center bg-[var(--blue-dark)]">
        <ErrorState title="Error de Conexión" message={error} showRetry={true} />
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
