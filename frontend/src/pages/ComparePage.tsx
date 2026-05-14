import React, { useState } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import CityLeaderboard from '../components/compare/CityLeaderboard';
import MobileTabs from '../components/compare/MobileTabs';
import CityComparisonTab from '../components/compare/CityComparisonTab';
import { BarChart2, Network, MapPin, Car } from 'lucide-react';
import type { CityData } from '../constants/cities';
import { MAP_MODES, type MapMode } from '../constants/mapModes';
import type { CompareMode } from '../components/compare/StaticCityMap';

const MODES = [
  { key: MAP_MODES.INFRASTRUCTURE as MapMode, label: 'Infraestructura', icon: Network, accent: '#027A76' },
  { key: MAP_MODES.STATIONS       as MapMode, label: 'Servicio Bici',   icon: MapPin,  accent: '#ffa585' },
  { key: MAP_MODES.TRAFFIC        as MapMode, label: 'Tráfico',         icon: Car,     accent: '#3A6C7F' },
] as const;

const ComparePage: React.FC = () => {
  const [selectedCities, setSelectedCities] = useState<CityData[]>([]);
  const [activeMode, setActiveMode] = useState<MapMode>(MAP_MODES.INFRASTRUCTURE);

  const toggleCity = (city: CityData) => {
    setSelectedCities((prev) => {
      const isSelected = prev.some((c) => c.path === city.path);
      if (isSelected) return prev.filter((c) => c.path !== city.path);
      if (prev.length >= 2) return prev;
      return [...prev, city];
    });
  };

  const selectedPaths = selectedCities.map((c) => c.path);

  const renderSelectedDots = () => {
    if (selectedCities.length === 0) return null;
    return (
      <div className="flex gap-1 items-center ml-2">
        {selectedCities.map((_, i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: i === 0 ? 'rgb(225,172,85)' : 'rgb(175,71,73)' }}
          />
        ))}
      </div>
    );
  };

  const compareTabLabel = (
    <div className="flex items-center justify-center">
      <span>Comparación</span>
      {renderSelectedDots()}
    </div>
  );

  const activeModeConfig = MODES.find(m => m.key === activeMode)!;

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--blue-dark)' }}>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section
        className="relative w-full pt-36 pb-20 px-6 flex flex-col items-center text-center overflow-hidden"
        style={{ background: 'linear-gradient(160deg, var(--blue-dark) 0%, var(--blue) 100%)' }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 40%, rgba(146,190,201,0.15) 0%, transparent 70%)' }}
        />
        <div className="relative z-10 max-w-[var(--container-reading)] mx-auto">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-[var(--green-light)]/70 mb-4">
            Análisis comparativo
          </p>
          <h1
            className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight"
            style={{ fontFamily: 'var(--heading)' }}
          >
            Compara nuestras ciudades
          </h1>
          <p className="text-lg text-white/60 leading-relaxed max-w-xl mx-auto">
            Explora y compara la extensión de las redes ciclistas, la cobertura
            y los recursos invertidos en las principales ciudades españolas.
          </p>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none">
          <svg viewBox="0 0 1440 64" className="w-full h-full" preserveAspectRatio="none">
            <path d="M0,32 C360,64 1080,0 1440,32 L1440,64 L0,64 Z" fill="rgba(0,56,73,0.6)" />
          </svg>
        </div>
      </section>

      {/* ── Mode selector — shared by all tabs ──────────────────────────── */}
      <div className="px-6 py-5" style={{ backgroundColor: 'rgba(0,56,73,0.6)' }}>
        <div className="max-w-[var(--container-max)] 3xl:max-w-none mx-auto flex justify-center">
          <div
            className="inline-flex gap-1 p-1 rounded-2xl"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            {MODES.map(({ key, label, icon: Icon, accent }) => {
              const isActive = activeMode === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveMode(key)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
                  style={{
                    backgroundColor: isActive ? accent : 'transparent',
                    color: isActive ? 'white' : 'rgba(255,255,255,0.45)',
                    boxShadow: isActive ? `0 4px 12px ${accent}50` : 'none',
                  }}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <MobileTabs defaultTab="leaderboard">

        {/* ── Tab 1: Leaderboard ─────────────────────────────────────────── */}
        <MobileTabs.Tab id="leaderboard" label="Clasificación">
          <section className="py-8 md:py-16 px-4 md:px-6 relative z-10" style={{ backgroundColor: 'transparent' }}>
            <div className="max-w-[var(--container-max)] 3xl:max-w-none mx-auto">
              <CityLeaderboard
                selectedCityPaths={selectedPaths}
                onToggleCity={toggleCity}
                activeMode={activeMode}
              />
            </div>
          </section>
        </MobileTabs.Tab>

        {/* ── Tab 2: Comparison ──────────────────────────────────────────── */}
        <MobileTabs.Tab id="compare" label={compareTabLabel}>
          <CityComparisonTab
            selectedCities={selectedCities}
            mode={activeMode as CompareMode}
          />
        </MobileTabs.Tab>

        {/* ── Tab 3: Overview ────────────────────────────────────────────── */}
        <MobileTabs.Tab id="overview" label="Visión general">
          <section className="py-16 px-6" style={{ backgroundColor: 'rgba(0,56,73,0.6)' }}>
            <div className="max-w-[var(--container-max)] 3xl:max-w-none mx-auto">
              <h2 className="text-2xl font-bold text-white mb-8" style={{ fontFamily: 'var(--heading)' }}>
                Visión general
              </h2>
              <div className="grid md:grid-cols-2 gap-6">
                <GlassCard surface="inset" depth="md" size="lg" className="flex flex-col items-center justify-center gap-3 min-h-[220px]">
                  <BarChart2 size={36} className="text-white/20" />
                  <p className="text-white/30 text-sm font-medium">Gráfico próximamente</p>
                </GlassCard>
                <GlassCard surface="inset" depth="md" size="lg" className="flex flex-col items-center justify-center gap-3 min-h-[220px]">
                  <BarChart2 size={36} className="text-white/20" />
                  <p className="text-white/30 text-sm font-medium">Gráfico próximamente</p>
                </GlassCard>
              </div>
            </div>
          </section>
        </MobileTabs.Tab>

      </MobileTabs>

    </div>
  );
};

export default ComparePage;
