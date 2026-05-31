import React from 'react';
import RankingsPanel from './showcase/RankingsPanel';
import NewsPanel from './showcase/NewsPanel';
import MapsPanel from './showcase/MapsPanel';


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
              marginBottom: 16,
            }}
          >
            Tanto si eres ciudadano que quiere entender su barrio, formas parte de una asociación que busca argumentos, o trabajas en un ayuntamiento con ganas de actuar — aquí tienes las herramientas.
          </p>
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
