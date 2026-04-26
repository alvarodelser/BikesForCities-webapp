import React, { useState } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import CityLeaderboard from '../components/compare/CityLeaderboard';
import { BarChart2 } from 'lucide-react';
import type { CityData } from '../constants/cities';

const ComparePage: React.FC = () => {
  const [selectedCities, setSelectedCities] = useState<CityData[]>([]);

  const toggleCity = (city: CityData) => {
    setSelectedCities((prev) => {
      const isSelected = prev.some((c) => c.path === city.path);
      if (isSelected) {
        return prev.filter((c) => c.path !== city.path);
      }
      if (prev.length >= 2) {
        return prev;
      }
      return [...prev, city];
    });
  };

  const selectedPaths = selectedCities.map((c) => c.path);

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--blue-dark)' }}>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section
        className="relative w-full pt-36 pb-20 px-6 flex flex-col items-center text-center overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, var(--blue-dark) 0%, var(--blue) 100%)',
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 70% 50% at 50% 40%, rgba(146,190,201,0.15) 0%, transparent 70%)',
          }}
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
            <path
              d="M0,32 C360,64 1080,0 1440,32 L1440,64 L0,64 Z"
              fill="rgba(0,56,73,0.6)"
            />
          </svg>
        </div>
      </section>

      {/* ── Leaderboard Section ───────────────────────────────────────────── */}
      <section className="py-8 md:py-16 px-4 md:px-6 relative z-10 -mt-10" style={{ backgroundColor: 'transparent' }}>
        <div className="max-w-[var(--container-max)] 3xl:max-w-none mx-auto">
          <CityLeaderboard
            selectedCityPaths={selectedPaths}
            onToggleCity={toggleCity}
          />
        </div>
      </section>

      {/* ── Overall Plots & Details ───────────────────────────────────────── */}
      <section className="py-16 px-6" style={{ backgroundColor: 'rgba(0,56,73,0.6)' }}>
        <div className="max-w-[var(--container-max)] 3xl:max-w-none mx-auto">
          
          {/* Selected Cities Details */}
          <div className="mb-16">
            <h2
              className="text-2xl font-bold text-white mb-2 flex items-center gap-3"
              style={{ fontFamily: 'var(--heading)' }}
            >
              Comparación detallada
              {selectedCities.length > 0 && (
                <div className="flex gap-1.5 md:hidden">
                  {selectedCities.map((_, i) => (
                    <span 
                      key={i} 
                      className="w-2 h-2 rounded-full" 
                      style={{ backgroundColor: i === 0 ? 'rgb(225,172,85)' : 'rgb(175,71,73)' }}
                    />
                  ))}
                </div>
              )}
            </h2>
            <p className="text-white/40 text-sm mb-8">
              Selecciona hasta dos ciudades en la tabla para ver sus mapas y estadísticas en paralelo.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 3xl:grid-cols-3 gap-6">
              {[0, 1].map((idx) => {
                const city = selectedCities[idx];
                const gradient = idx === 0
                  ? 'linear-gradient(135deg, rgba(225, 172, 85, 0.9), rgba(225, 172, 85, 0.4))'
                  : 'linear-gradient(135deg, rgba(175, 71, 73, 0.9), rgba(175, 71, 73, 0.4))';

                return (
                  <GlassCard
                    key={idx}
                    surface="glass"
                    tint="rgba(255, 255, 255, 0.05)"
                    blurStrength="lg"
                    shadow="lg"
                    className={`
                      ${city ? 'min-h-[400px]' : 'min-h-[150px]'}
                      flex flex-col p-0 overflow-hidden relative transition-all duration-500 ease-in-out
                    `}
                  >
                    {/* Backdrop Gradient (only if city selected) */}
                    {city && (
                      <div
                        className="absolute inset-0 z-0 opacity-80 animate-in fade-in duration-700"
                        style={{ background: gradient }}
                      />
                    )}

                    {/* Content Overlay */}
                    <div className="relative z-10 flex flex-col h-full">
                      {/* Header */}
                      <div
                        className="px-6 py-4 flex items-center justify-between border-b border-white/10"
                        style={{ backgroundColor: city ? 'rgba(0,0,0,0.1)' : 'transparent' }}
                      >
                        <h3 className={`text-xl font-bold tracking-tight transition-colors ${city ? 'text-white' : 'text-white/20'}`}>
                          {city ? city.name : `Ciudad ${idx + 1}`}
                        </h3>
                        {city && (
                          <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/20 text-white font-medium">
                            Seleccionada
                          </span>
                        )}
                      </div>

                      {/* Content Body */}
                      <div className={`flex-1 flex flex-col items-center justify-center p-8 text-center ${city ? 'bg-black/5' : 'bg-transparent'}`}>
                        {city ? (
                          <div className="space-y-6 w-full animate-in zoom-in-95 duration-500">
                            <div className="aspect-video w-full rounded-xl bg-white/10 border border-white/10 flex items-center justify-center relative overflow-hidden group">
                               <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent group-hover:opacity-100 transition-opacity opacity-0" />
                               <span className="text-white/60 font-medium z-10">Mapa de {city.name} (próximamente)</span>
                            </div>
                            <div className="h-32 w-full rounded-xl bg-white/10 border border-white/10 flex items-center justify-center">
                              <span className="text-white/60 font-medium">Gráfico de {city.name} (próximamente)</span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                             <p className="text-white/20 text-xs uppercase tracking-widest font-bold">Sin selección</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          </div>

          {/* Overall Graphs */}
          <div>
            <h2
              className="text-2xl font-bold text-white mb-8"
              style={{ fontFamily: 'var(--heading)' }}
            >
              Visión general
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <GlassCard
                surface="inset"
                depth="md"
                size="lg"
                className="flex flex-col items-center justify-center gap-3 min-h-[220px]"
              >
                <BarChart2 size={36} className="text-white/20" />
                <p className="text-white/30 text-sm font-medium">Gráfico próximamente</p>
              </GlassCard>

              <GlassCard
                surface="inset"
                depth="md"
                size="lg"
                className="flex flex-col items-center justify-center gap-3 min-h-[220px]"
              >
                <BarChart2 size={36} className="text-white/20" />
                <p className="text-white/30 text-sm font-medium">Gráfico próximamente</p>
              </GlassCard>
            </div>
          </div>

        </div>
      </section>

    </div>
  );
};

export default ComparePage;
