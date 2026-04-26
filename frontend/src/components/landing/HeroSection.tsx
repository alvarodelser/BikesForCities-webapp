import React from 'react';
import ErrorContainer from '../ui/ErrorContainer';

const FEATURES = [
  {
    tint: 'linear-gradient(135deg, rgba(2,122,118,0.06) 0%, rgba(2,122,118,0.02) 100%)',
    border: 'rgba(2,122,118,0.08)',
    title: 'Compara nuestras ciudades',
    description: 'Datos de más de X ciudades',
  },
  {
    tint: 'linear-gradient(135deg, rgba(244,162,76,0.06) 0%, rgba(244,162,76,0.02) 100%)',
    border: 'rgba(244,162,76,0.08)',
    title: 'Explora mapas de movilidad',
    description: 'Diversos modos de ver sobre el papel',
  },
  {
    tint: 'linear-gradient(135deg, rgba(175,71,73,0.06) 0%, rgba(175,71,73,0.02) 100%)',
    border: 'rgba(175,71,73,0.08)',
    title: 'Planifica con visión de futuro',
    description: 'Estrategia municipal basada en datos',
  },
];

const HeroSection: React.FC = () => {
  const scrollToNextSection = () => {
    const mapSelector = document.getElementById('map-selector');
    if (mapSelector) {
      mapSelector.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section
      className="w-full relative overflow-hidden"
      style={{ backgroundColor: '#ffffff' }}
    >
      {/* ── Main hero container ── */}
      <div
        className="relative z-10 w-full max-w-[var(--container-max)] mx-auto px-[var(--space-gutter)] py-24 md:py-32 lg:py-40"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* ── TOP LEFT: Title + subtitle ── */}
          <div className="lg:col-span-8 flex flex-col pt-8 lg:pt-0">
            {/* Title - Single line, bold, top left */}
            <h1
              style={{
                background: 'linear-gradient(180deg, #1a3a5a 0%, #2c5c8c 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
              className="text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-heading font-bold leading-tight tracking-tighter mb-4"
            >
              Bikes for Cities
            </h1>

            {/* Subtitle */}
            <p
              className="text-lg md:text-xl font-heading font-medium text-[var(--blue-dark)] opacity-40 max-w-xl"
            >
              Movilidad sostenible en la era digital
            </p>

            {/* Subtle accent line */}
            <div
              className="h-[2px] rounded-full mt-6 mb-12"
              style={{
                width: '40px',
                background: 'var(--green)',
                opacity: 0.3
              }}
            />

            <ErrorContainer
              variant="inline"
              title="Página en Desarrollo"
              message="Esta plataforma se encuentra actualmente en fase de desarrollo. Algunos de los datos mostrados son estáticos o han sido fabricados con fines de demostración."
              className="mt-4"
            />
          </div>

          {/* ── RIGHT: Smaller Feature Pills ── */}
          <div className="hidden lg:flex lg:col-span-4 flex-col gap-3 lg:items-end lg:pt-4">
            {FEATURES.map((feat, i) => (
              <div
                key={i}
                onClick={scrollToNextSection}
                className="group cursor-pointer rounded-2xl p-4 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] w-full max-w-[300px]"
                style={{
                  background: feat.tint,
                  border: `1px solid ${feat.border}`,
                  backdropFilter: 'blur(10px)',
                }}
              >
                <h3 className="text-xs lg:text-[13px] font-bold text-gray-700 mb-0.5">
                  {feat.title}
                </h3>
                <p className="text-[11px] text-gray-400 font-medium leading-normal">
                  {feat.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;