import React from 'react';
import RankingsPanel from './showcase/RankingsPanel';
import NewsPanel from './showcase/NewsPanel';
import MapsPanel from './showcase/MapsPanel';

const AUDIENCE_PILLS = [
  { label: 'Ciudadanos',    bg: 'rgba(58,108,127,0.1)',  color: 'var(--blue)'       },
  { label: 'Asociaciones',  bg: 'rgba(2,122,118,0.1)',   color: 'var(--green-dark)' },
  { label: 'Ayuntamientos', bg: 'rgba(0,56,73,0.08)',    color: 'var(--blue-dark)'  },
];

const DataShowcaseSection: React.FC = () => {
  return (
    <section
      id="data-showcase"
      style={{ background: 'var(--cream)', width: '100%' }}
    >
      <div
        className="max-w-[var(--container-max)] mx-auto"
        style={{ paddingTop: 'var(--space-section-y)' }}
      >
        {/* Section header */}
        <div
          style={{
            padding: 'clamp(24px, 4vw, 40px) clamp(20px, 4vw, 52px) clamp(20px, 3vw, 32px)',
            borderBottom: '1px solid rgba(0,56,73,0.08)',
          }}
        >
          <p
            style={{
              fontSize: '0.62rem',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'var(--green-dark)',
              fontWeight: 700,
              marginBottom: 10,
            }}
          >
            Bikes for Cities
          </p>
          <h2
            className="font-heading font-bold"
            style={{
              fontSize: 'clamp(1.6rem, 4vw, 2.4rem)',
              lineHeight: 1.15,
              color: 'var(--blue-dark)',
              marginBottom: 12,
              letterSpacing: '-0.02em',
            }}
          >
            Los datos están<br />para usarlos
          </h2>
          <p
            style={{
              fontSize: '0.88rem',
              color: 'var(--blue)',
              opacity: 0.8,
              lineHeight: 1.65,
              maxWidth: '54ch',
              marginBottom: 16,
            }}
          >
            Tanto si eres ciudadano que quiere entender su barrio, formas parte de una asociación que busca argumentos, o trabajas en un ayuntamiento con ganas de actuar — aquí tienes las herramientas.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {AUDIENCE_PILLS.map(p => (
              <span
                key={p.label}
                style={{
                  fontSize: '0.6rem',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  padding: '4px 12px',
                  borderRadius: 20,
                  fontWeight: 600,
                  background: p.bg,
                  color: p.color,
                }}
              >
                {p.label}
              </span>
            ))}
          </div>
        </div>

        {/* Three panels */}
        <RankingsPanel />
        <NewsPanel />
        <MapsPanel />
      </div>
    </section>
  );
};

export default DataShowcaseSection;
