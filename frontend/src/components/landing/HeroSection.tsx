import React from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight } from 'lucide-react';
import backgroundTexture from '../../assets/background2.svg';

const HeroSection: React.FC = () => {
  const navigate = useNavigate();

  return (
    <section className="w-full relative overflow-hidden bg-[var(--cream)]">

      {/* Radial glow */}
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

      <div className="relative z-10 w-full max-w-[var(--container-max)] mx-auto px-[var(--space-gutter)] py-14 md:py-20">

        {/* ── HEADLINE ── */}
        <h1
          className="font-heading font-bold w-full"
          style={{
            fontSize: 'clamp(4rem, 7vw, 7.5rem)',
            letterSpacing: '-0.03em',
            lineHeight: 0.92,
            color: 'var(--blue-dark)',
          }}
        >
          Bikes for Cities
        </h1>

        {/* ── RULE ── */}
        <div
          aria-hidden
          style={{
            height: '1px',
            background: 'rgba(0,56,73,0.20)',
            margin: '1.5rem 0',
          }}
        />

        {/* ── STRIP: tagline + CTA ── */}
        <div className="flex items-center justify-between gap-6 flex-wrap">
          <p
            className="font-heading"
            style={{
              fontSize: '1rem',
              color: 'var(--blue-dark)',
              opacity: 0.55,
              letterSpacing: '0.01em',
            }}
          >
            Infraestructura ciclista · 20+ ciudades españolas
          </p>
          <button
            onClick={() => navigate('/compare')}
            className="group flex items-center gap-3 transition-transform duration-200 hover:-translate-y-[2px] active:scale-[0.98] focus:outline-none"
            style={{
              background: 'var(--blue-dark)',
              color: 'var(--cream)',
              borderRadius: '999px',
              padding: '0.8rem 1.9rem',
              fontSize: '1rem',
              fontFamily: 'var(--heading)',
              fontWeight: 600,
              letterSpacing: '0.01em',
              boxShadow: '0 4px 20px rgba(0,56,73,0.2)',
            }}
          >
            Explorar ciudades
            <ArrowRight
              size={16}
              className="transition-transform duration-200 group-hover:translate-x-1"
            />
          </button>
        </div>

      </div>
    </section>
  );
};

export default HeroSection;
