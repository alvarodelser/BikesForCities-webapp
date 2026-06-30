import React from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight } from 'lucide-react';
import backgroundTexture from '../../assets/background2.svg';
import { useReveal } from '../../contexts/RevealContext';

const DUR = 480;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

const HeroSection: React.FC = () => {
  const navigate = useNavigate();
  const { revealed } = useReveal();

  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
            clipPath: revealed ? 'inset(0 0% 0 0)' : 'inset(0 100% 0 0)',
            opacity: revealed ? 1 : 0,
            transition: prefersReduced
              ? `opacity ${DUR}ms ${EASE}`
              : `clip-path ${DUR + 200}ms ${EASE}, opacity ${DUR}ms ${EASE}`,
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
            transformOrigin: 'left',
            transform: revealed ? 'scaleX(1)' : 'scaleX(0)',
            transition: prefersReduced
              ? undefined
              : `transform ${DUR + 100}ms ${EASE} 180ms`,
          }}
        />

        {/* ── STRIP: tagline + CTA ── */}
        <div
          className="flex items-center justify-between gap-6 flex-wrap"
          style={{
            opacity: revealed ? 1 : 0,
            transform: revealed ? 'translateY(0)' : 'translateY(8px)',
            transition: prefersReduced
              ? `opacity ${DUR}ms ${EASE} 360ms`
              : `opacity ${DUR}ms ${EASE} 360ms, transform ${DUR}ms ${EASE} 360ms`,
          }}
        >
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
