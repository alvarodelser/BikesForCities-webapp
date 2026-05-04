import React from 'react';
import backgroundTexture from '../../assets/background2.svg';

const FEATURES = [
  {
    index: '01',
    color: '#027A76',
    title: 'Compara nuestras ciudades',
    desc: 'Datos de más de 20 ciudades',
  },
  {
    index: '02',
    color: '#F4A24C',
    title: 'Explora mapas de movilidad',
    desc: 'Diversos modos de ver sobre el papel',
  },
  {
    index: '03',
    color: '#AF4749',
    title: 'Planifica con visión de futuro',
    desc: 'Estrategia municipal basada en datos',
  },
];

const HeroSection: React.FC = () => {
  const scrollToNextSection = () => {
    document.getElementById('map-selector')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="w-full relative overflow-hidden bg-[var(--cream)]">

      {/* Radial glow — same as CityPage hero */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 40% 50%, rgba(146,190,201,0.18) 0%, transparent 70%)',
        }}
      />

      {/* background2 texture */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage: `url(${backgroundTexture})`,
          backgroundSize: '600px 600px',
        }}
      />

      <div className="relative z-10 w-full max-w-[var(--container-max)] mx-auto px-[var(--space-gutter)] py-24 md:py-32 lg:py-40">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">

          {/* ── TITLE + SUBTITLE ── */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <h1
              className="font-heading font-bold leading-tight text-[var(--blue-dark)]"
              style={{ fontSize: 'clamp(3rem, 7vw, 6rem)', letterSpacing: '-0.02em' }}
            >
              Bikes for Cities
            </h1>
            <p
              className="font-heading text-[var(--blue)] opacity-60"
              style={{ fontSize: 'clamp(1rem, 1.6vw, 1.2rem)' }}
            >
              Movilidad sostenible en la era digital
            </p>
          </div>

          {/* ── GLASSMORPHIC PILLS ── */}
          <div className="lg:col-span-5 flex flex-col gap-3">
            {FEATURES.map((feat, i) => (
              <button
                key={i}
                onClick={scrollToNextSection}
                className="group w-full text-left transition-transform duration-200 hover:-translate-y-[2px] active:scale-[0.99] focus:outline-none"
              >
                <div
                  className="relative overflow-hidden rounded-2xl px-5 py-4"
                  style={{
                    background: 'rgba(255, 255, 255, 0.55)',
                    backdropFilter: 'blur(14px)',
                    WebkitBackdropFilter: 'blur(14px)',
                    border: '1px solid rgba(255, 255, 255, 0.75)',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.85)',
                  }}
                >
                  {/* top-edge chrome shimmer */}
                  <div
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-px"
                    style={{
                      background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.9), transparent)',
                    }}
                  />

                  <div className="flex items-center gap-4">
                    {/* colored accent dot */}
                    <span
                      className="shrink-0 w-2 h-2 rounded-full"
                      style={{ background: feat.color, opacity: 0.85 }}
                    />

                    <div className="min-w-0 flex-1">
                      <p
                        className="font-heading font-semibold text-[var(--blue-dark)] leading-snug"
                        style={{ fontSize: '14.5px' }}
                      >
                        {feat.title}
                      </p>
                      <p
                        className="font-heading text-[var(--blue)] mt-0.5"
                        style={{ fontSize: '12px', opacity: 0.5 }}
                      >
                        {feat.desc}
                      </p>
                    </div>

                    {/* index */}
                    <span
                      className="font-heading font-bold tabular-nums shrink-0"
                      style={{ fontSize: '10px', color: feat.color, letterSpacing: '0.1em', opacity: 0.65 }}
                    >
                      {feat.index}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
};

export default HeroSection;
